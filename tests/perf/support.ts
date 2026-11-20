/**
 * Helpers of the performance suite.
 *
 * Everything the suite takes from Chromium itself is in this file and nowhere
 * else in tests/perf: the DevTools protocol (CPU slow-down, page metrics,
 * garbage collection, the process list, compositor layers), the operating
 * system's process sizes, the names of Chromium's trace events, and the
 * observers run in the page. This is the file to change when WordPress offers
 * the same thing. Tracing and event durations already come from the `metrics`
 * fixture of `@wordpress/e2e-test-utils-playwright`; results leave a test as
 * a `results` attachment that `reporter.ts` writes out, the way Gutenberg's
 * performance tests do it.
 */
import { execFileSync } from 'child_process';
import type { Browser, CDPSession, Page } from '@playwright/test';
import { test as base } from '@wordpress/e2e-test-utils-playwright';
import type {
    Metrics,
    RequestUtils,
} from '@wordpress/e2e-test-utils-playwright';
import { openBoard } from '../e2e/utils';

export { expect } from '@wordpress/e2e-test-utils-playwright';

type Recorder = (
    name: string,
    value: number,
    unit: 'count' | 'bytes' | 'ms'
) => void;

/**
 * The suite's `test`. Its `record` fixture notes one measurement: the
 * indicator as listed in docs/performance.md, the number, and its unit.
 * Measurements taken at device pixel ratio 2 get `@2x` after their name.
 */
export const test = base.extend< { record: Recorder } >( {
    record: async ( { deviceScaleFactor }, provide, testInfo ) => {
        const suffix = deviceScaleFactor === 2 ? '@2x' : '';
        const results: object[] = [];
        await provide( ( name, value, unit ) => {
            if ( ! Number.isFinite( value ) ) {
                throw new Error( `${ name } was measured as ${ value }.` );
            }
            results.push( { name: name + suffix, value, unit } );
        } );
        await testInfo.attach( 'results', {
            body: JSON.stringify( results ),
            contentType: 'application/json',
        } );
    },
} );

// How many times slower than the machine running the suite the page's main
// thread is made for timing tests, to stand for an older laptop. Why CI sets
// another value is in docs/performance.md.
const CPU_THROTTLE = Number( process.env.PERF_CPU_THROTTLE ?? 4 );

// The longest the suite waits for a board, in milliseconds.
const LIMIT = 240_000;

/**
 * A DevTools session on a page, with the Performance domain on.
 *
 * @param page The page.
 */
export async function devtools( page: Page ): Promise< CDPSession > {
    const client = await page.context().newCDPSession( page );
    await client.send( 'Performance.enable' );
    return client;
}

/**
 * Slows the page's main thread for a timing test.
 *
 * @param client The page's DevTools session.
 */
export async function throttle( client: CDPSession ) {
    await client.send( 'Emulation.setCPUThrottlingRate', {
        rate: CPU_THROTTLE,
    } );
}

/**
 * Chromium's own counters for the page: `JSHeapUsedSize`, `Documents`,
 * `Nodes`, `TaskDuration` (seconds of main-thread work so far) and others.
 *
 * @param client The page's DevTools session.
 */
export async function pageMetrics(
    client: CDPSession
): Promise< Record< string, number > > {
    const { metrics } = await client.send( 'Performance.getMetrics' );
    return Object.fromEntries( metrics.map( ( m ) => [ m.name, m.value ] ) );
}

function residentBytes( pid: number ): number {
    try {
        const out = execFileSync( 'ps', [ '-o', 'rss=', '-p', String( pid ) ], {
            encoding: 'utf8',
        } );
        return parseInt( out.trim(), 10 ) * 1024 || 0;
    } catch {
        // The process ended between being listed and being measured.
        return 0;
    }
}

/**
 * Memory and CPU time of the browser's processes, as the operating system
 * reports them. `tab` is the page's process, which holds every artboard's
 * document as well as the JavaScript heap; `gpu` is the process that draws.
 * Open one page at a time, or `tab` is the largest of them.
 *
 * @param browser The browser.
 */
export async function processStats( browser: Browser ): Promise< {
    tab: number;
    gpu: number;
    cpuSeconds: number;
} > {
    const session = await browser.newBrowserCDPSession();
    const { processInfo } = await session.send( 'SystemInfo.getProcessInfo' );
    await session.detach();
    let tab = 0;
    let gpu = 0;
    let cpuSeconds = 0;
    for ( const info of processInfo ) {
        const bytes = residentBytes( info.id );
        if ( info.type === 'renderer' && bytes > tab ) {
            tab = bytes;
            cpuSeconds = info.cpuTime;
        } else if ( info.type === 'GPU' ) {
            gpu = bytes;
        }
    }
    return { tab, gpu, cpuSeconds };
}

/**
 * What the tab holds once garbage is collected: the size of its process and
 * of the GPU process, the JavaScript heap, and the documents and nodes
 * Chromium counts.
 *
 * @param page    The page.
 * @param browser The browser.
 */
export async function held( page: Page, browser: Browser ) {
    const client = await devtools( page );
    await client.send( 'HeapProfiler.enable' );
    // Collected until a round frees no more documents or nodes: a detached
    // document goes in more than one.
    let metrics: Record< string, number > | undefined;
    for (;;) {
        await client.send( 'HeapProfiler.collectGarbage' );
        const now = await pageMetrics( client );
        const isLess =
            ! metrics ||
            now.Documents + now.Nodes < metrics.Documents + metrics.Nodes;
        metrics = now;
        if ( ! isLess ) {
            break;
        }
    }
    const { tab, gpu } = await processStats( browser );
    await client.detach();
    return {
        tab,
        gpu,
        heap: metrics.JSHeapUsedSize,
        documents: metrics.Documents,
        nodes: metrics.Nodes,
    };
}

/**
 * Waits until the app has stopped rendering and requesting. Playwright's
 * "networkidle" is not used: two of the board's REST requests never report
 * as finished to it.
 *
 * @param page The page.
 */
export async function settle( page: Page ) {
    const deadline = Date.now() + LIMIT;
    let last = '';
    while ( Date.now() < deadline ) {
        const now = await page.evaluate( () =>
            [
                ( window as any ).wfdTest.counters.renders,
                performance.getEntriesByType( 'resource' ).length,
                document.querySelectorAll( 'iframe' ).length,
            ].join( ' ' )
        );
        if ( now === last ) {
            return;
        }
        last = now;
        await page.waitForTimeout( 750 );
    }
    throw new Error(
        `The board was still rendering or requesting after ${
            LIMIT / 1000
        } seconds.`
    );
}

/**
 * A percentile of a list of numbers.
 *
 * @param values The numbers.
 * @param p      The percentile, 0 to 1.
 */
export function percentile( values: number[], p: number ): number {
    if ( ! values.length ) {
        return NaN;
    }
    const sorted = [ ...values ].sort( ( a, b ) => a - b );
    return sorted[
        Math.min( sorted.length - 1, Math.ceil( p * sorted.length ) - 1 )
    ];
}

/**
 * Starts recording long tasks (main-thread work of 50 ms or more) on the
 * page. Returns a function that stops and gives the longest task and the
 * blocking time (the part of each task beyond 50 ms), both in milliseconds.
 *
 * @param page           The page.
 * @param fromNavigation Start with the page's next navigation instead of now.
 */
export async function watchLongTasks( page: Page, fromNavigation = false ) {
    const observe = () => {
        if ( window.top !== window ) {
            return;
        }
        const store: number[] = [];
        const observer = new PerformanceObserver( ( list ) => {
            for ( const entry of list.getEntries() ) {
                store.push( entry.duration );
            }
        } );
        observer.observe( { type: 'longtask' } );
        ( window as any ).wfdPerfTasks = { store, observer };
    };
    await ( fromNavigation
        ? page.addInitScript( observe )
        : page.evaluate( observe ) );
    return async () =>
        page.evaluate( () => {
            const { store, observer } = ( window as any ).wfdPerfTasks;
            for ( const entry of observer.takeRecords() ) {
                store.push( entry.duration );
            }
            observer.disconnect();
            return {
                longest: store.length ? Math.max( ...store ) : 0,
                blocking: store.reduce(
                    ( sum: number, d: number ) => sum + Math.max( 0, d - 50 ),
                    0
                ),
            };
        } );
}

/**
 * How many Previews and Snapshots show their content, and how many do not
 * yet. A Snapshot shows it once its frozen copy is made. Runs in the page.
 */
function artboardsShown() {
    let shown = 0;
    let waiting = 0;
    document
        .querySelectorAll(
            '[data-wfd-tier="preview"], [data-wfd-tier="snapshot"]'
        )
        .forEach( ( element ) => {
            const frame = element.querySelector< HTMLIFrameElement >(
                element.getAttribute( 'data-wfd-tier' ) === 'snapshot'
                    ? '.wfd-snapshot__copy iframe'
                    : 'iframe'
            );
            if ( frame?.contentDocument?.body?.childElementCount ) {
                shown++;
            } else {
                waiting++;
            }
        } );
    return { shown, waiting };
}

/**
 * An expression that calls a function in the page with `artboardsShown` in
 * its scope. Only a function of this file can use it: elsewhere the name is
 * rewritten when the file is compiled.
 *
 * @param fn  The function.
 * @param arg A value passed to it.
 */
const inPage = ( fn: ( arg: any ) => unknown, arg?: unknown ) =>
    `( () => { ${ artboardsShown.toString() }; return ( ${ fn.toString() } )( ${ JSON.stringify(
        arg ?? null
    ) } ); } )()`;

const isDrawn = () => artboardsShown().waiting === 0;

/**
 * Whether the board shows artboards and every one of them has its content:
 * for a board that showed none before. Runs in the page, through `timeUntil`.
 */
export const hasShownAll = () => {
    const { shown, waiting } = artboardsShown();
    return shown > 0 && waiting === 0;
};

/**
 * Waits until every Preview and Snapshot shows its content and the app is
 * quiet.
 *
 * @param page The page.
 */
export async function drawn( page: Page ) {
    // On an interval, not every frame: "Things to know", docs/performance.md.
    const options = { polling: 250, timeout: LIMIT };
    await page.waitForFunction( inPage( isDrawn ), undefined, options );
    await settle( page );
    await page.waitForFunction( inPage( isDrawn ), undefined, options );
}

/**
 * Before a board is opened: notes when its first artboard and its last were
 * shown. Returns a function that gives both, in milliseconds from the start
 * of navigation.
 *
 * @param page The page.
 */
export async function watchOpening( page: Page ) {
    await page.addInitScript(
        inPage( () => {
            if ( window.top !== window ) {
                return;
            }
            const state = { shown: 0, first: 0, last: 0 };
            ( window as any ).wfdPerfOpen = state;
            // On an interval: "Things to know", docs/performance.md.
            window.setInterval( () => {
                const { shown } = artboardsShown();
                if ( shown > state.shown ) {
                    state.shown = shown;
                    state.last = performance.now();
                    state.first ||= state.last;
                }
            }, 100 );
        } )
    );
    return async (): Promise< { first: number; last: number } > => {
        const state = await page.evaluate(
            () => ( window as any ).wfdPerfOpen
        );
        if ( ! state?.shown ) {
            throw new Error( 'No artboard was seen being shown.' );
        }
        return state;
    };
}

async function timed(
    page: Page,
    action: () => Promise< unknown >,
    expression: string,
    polling: 'raf' | number
): Promise< number > {
    const start = await page.evaluate( () => performance.now() );
    // The page's clock at the first check on which the condition holds.
    const end = page.waitForFunction(
        `${ expression } ? performance.now() : 0`,
        undefined,
        { polling, timeout: LIMIT }
    );
    await action();
    return ( ( await ( await end ).jsonValue() ) as number ) - start;
}

/**
 * Times something from just before `action` until `done` first holds, in
 * the page's own clock.
 *
 * `done` runs in the page once per animation frame by default. Anything
 * that takes seconds and mounts artboards must be given an interval in
 * milliseconds instead: "Things to know", docs/performance.md.
 *
 * @param page    The page.
 * @param action  What to do, from the test.
 * @param done    The condition, evaluated in the page.
 * @param arg     A value passed to `done`.
 * @param polling How often to check: every frame, or every so many ms.
 */
export async function timeUntil< T >(
    page: Page,
    action: () => Promise< unknown >,
    done: ( arg: T ) => boolean,
    arg?: T,
    polling: 'raf' | number = 'raf'
): Promise< number > {
    return timed( page, action, inPage( done, arg ), polling );
}

/**
 * Times something from just before `action` until what `read` gives in the
 * page is no longer what it gave before.
 *
 * @param page   The page.
 * @param action What to do, from the test.
 * @param read   What to watch, evaluated in the page.
 */
export async function timeUntilChange(
    page: Page,
    action: () => Promise< unknown >,
    read: () => string
): Promise< number > {
    const before = await page.evaluate( read );
    return timed(
        page,
        action,
        `( ${ read.toString() } )() !== ${ JSON.stringify( before ) }`,
        'raf'
    );
}

/**
 * Viewports that put the fixture in a known state.
 */
export const VIEWS = {
    // Far from every artboard: all are Ghosts.
    far: { x: 200000, y: 200000, zoom: 1 },
    // The nine-artboard fixture, all Previews.
    previews: { x: 40, y: 40, zoom: 0.25 },
    // The dense grid of extra artboards: twelve Previews, the rest Snapshots.
    grid: { x: -1560, y: 20, zoom: 0.25 },
};

export type View = { x: number; y: number; zoom: number };

/**
 * A viewport with an artboard at the top left of the canvas area. From 30%
 * zoom up, editing an artboard in view starts without the board zooming,
 * which would change the tier of the others.
 *
 * @param artboard   The artboard.
 * @param artboard.x
 * @param artboard.y
 * @param zoom       The zoom.
 */
export const viewOn = (
    artboard: { x: number; y: number },
    zoom: number
): View => ( {
    x: 40 - artboard.x * zoom,
    y: 100 - artboard.y * zoom,
    zoom,
} );

/**
 * Opens a board at a given viewport, as if it had been left there. Without
 * this a board opens fitted, which for the fixture is below 20% zoom.
 *
 * @param page         The page.
 * @param requestUtils The REST helper.
 * @param boardId      The board.
 * @param view         The viewport to open at.
 * @param count        Number of artboards expected.
 */
export async function openBoardAt(
    page: Page,
    requestUtils: RequestUtils,
    boardId: number,
    view: View,
    count = 9
) {
    const me = await requestUtils.rest< { id: number } >( {
        path: '/wp/v2/users/me',
    } );
    await page.addInitScript(
        ( [ key, value ] ) => {
            if ( window.top === window ) {
                window.localStorage.setItem( key, value );
            }
        },
        [ `wfd/viewport/${ me.id }/${ boardId }`, JSON.stringify( view ) ]
    );
    await openBoard( page, boardId, count );
}

/**
 * Counts the requests a page makes from now on.
 *
 * @param page The page.
 */
export function trackRequests( page: Page ) {
    const counts = { total: 0, rest: 0 };
    page.on( 'request', ( request ) => {
        counts.total++;
        if ( /\/wp-json\/|rest_route=/.test( request.url() ) ) {
            counts.rest++;
        }
    } );
    return counts;
}

/**
 * Leaves edit with the header's back button.
 *
 * @param page The page.
 */
export const leaveEdit = ( page: Page ) =>
    page.getByRole( 'button', { name: 'Back to the board' } ).click();

/**
 * Main-thread time spent dispatching events of the given types during
 * `action`, in milliseconds, one list per type. It is the time the event's
 * listeners and what they run at once take, React's render included; it ends
 * before the browser lays out and paints.
 *
 * The fixture's own `getEventDurations` is not used: WordPress sends a key
 * pressed in an editor's document on to the page from inside the first
 * dispatch, and it would count that one twice. A dispatch made inside
 * another is left to the outer one here.
 *
 * @param metrics WordPress's metrics fixture, which records the trace.
 * @param types   Event types, such as `pointerdown`.
 * @param action  What to do, from the test.
 */
export async function dispatchTimes(
    metrics: Metrics,
    types: string[],
    action: () => Promise< unknown >
): Promise< number[][] > {
    await metrics.startTracing();
    await action();
    await metrics.stopTracing();
    const times = new Map< string, number[] >(
        types.map( ( type ) => [ type, [] ] )
    );
    let coveredUntil = -Infinity;
    for ( const event of metrics.trace.traceEvents
        .filter(
            ( { name, dur, args } ) =>
                name === 'EventDispatch' &&
                dur !== undefined &&
                times.has( args?.data?.type as string )
        )
        .sort( ( a, b ) => a.ts - b.ts ) ) {
        if ( event.ts >= coveredUntil ) {
            times.get( event.args.data!.type )!.push( event.dur! / 1000 );
            coveredUntil = event.ts + event.dur!;
        }
    }
    return [ ...times.values() ];
}

/**
 * Starts recording the time between animation frames on the page. Returns a
 * function that stops and gives the intervals in milliseconds.
 *
 * @param page The page.
 */
export async function watchFrames( page: Page ) {
    await page.evaluate( () => {
        const state = { times: [] as number[], on: true };
        ( window as any ).wfdPerfFrames = state;
        const tick = ( time: number ) => {
            state.times.push( time );
            if ( state.on ) {
                requestAnimationFrame( tick );
            }
        };
        requestAnimationFrame( tick );
    } );
    return async (): Promise< number[] > =>
        page.evaluate( () => {
            const state = ( window as any ).wfdPerfFrames;
            state.on = false;
            return state.times
                .slice( 1 )
                .map( ( time: number, i: number ) => time - state.times[ i ] );
        } );
}

/**
 * Frames that took more than one and a half 60 Hz frames to arrive.
 *
 * @param intervals Times between frames, in milliseconds.
 */
export const droppedFrames = ( intervals: number[] ) =>
    intervals.filter( ( interval ) => interval > 25 ).length;

/**
 * The compositor's layers that draw content, each with its `width` and
 * `height`. Chromium reports its layers only when they change.
 *
 * @param client The page's DevTools session.
 * @param change Something that changes what is drawn.
 */
export async function drawnLayers(
    client: CDPSession,
    change: () => Promise< unknown >
): Promise< { width: number; height: number }[] > {
    await client.send( 'LayerTree.enable' );
    const tree = new Promise< { layers?: any[] } >( ( resolve ) =>
        client.once( 'LayerTree.layerTreeDidChange', resolve )
    );
    await change();
    const { layers = [] } = await tree;
    await client.send( 'LayerTree.disable' );
    return layers.filter( ( layer ) => layer.drawsContent );
}

// How long drawing is watched for after a gesture, and the pause that ends
// it, in milliseconds. Chromium gives no sign that it has finished drawing.
const RASTER_WATCH = 4000;
const RASTER_PAUSE = 250;

/**
 * The drawing work a gesture causes: `raster`, how much there is, and
 * `sharpen`, how long after the gesture's last event it goes on, both in
 * milliseconds. Drawing that follows a pause of a quarter of a second is
 * not counted as the gesture's.
 *
 * @param page    The page.
 * @param metrics WordPress's metrics fixture.
 * @param gesture What to do. It is given the name of a performance mark to
 *                leave in the page when its last event is sent.
 */
export async function rasterWork(
    page: Page,
    metrics: Metrics,
    gesture: ( endMark: string ) => Promise< unknown >
): Promise< { raster: number; sharpen: number } > {
    const mark = ( name: string ) =>
        page.evaluate( ( n ) => {
            performance.mark( n );
        }, name );
    await metrics.startTracing( {
        categories: [ 'cc', 'blink.user_timing' ],
    } );
    await mark( 'wfd-perf-raster-start' );
    await gesture( 'wfd-perf-raster-end' );
    await page.waitForTimeout( RASTER_WATCH );
    await mark( 'wfd-perf-raster-stop' );
    await metrics.stopTracing();

    const events: any[] = metrics.trace.traceEvents;
    const at = ( name: string ): number => {
        const event = events.find( ( { name: n } ) => n === name );
        if ( ! event ) {
            throw new Error( `The trace has no "${ name }" mark.` );
        }
        return event.ts;
    };
    const start = at( 'wfd-perf-raster-start' );
    const end = at( 'wfd-perf-raster-end' );
    const stop = at( 'wfd-perf-raster-stop' );
    const rasters = events
        .filter(
            ( event ) =>
                event.name === 'RasterTask' &&
                event.ph === 'X' &&
                event.ts >= start
        )
        .sort( ( a, b ) => a.ts - b.ts );
    if ( ! rasters.length ) {
        throw new Error( 'The trace has no RasterTask events.' );
    }
    let sharp = end;
    for ( const event of rasters ) {
        if ( event.ts + event.dur <= end ) {
            continue;
        }
        if ( event.ts - sharp > RASTER_PAUSE * 1000 ) {
            break;
        }
        sharp = Math.max( sharp, event.ts + event.dur );
    }
    if ( stop - sharp < RASTER_PAUSE * 1000 ) {
        throw new Error(
            `Drawing had not stopped ${ RASTER_WATCH } ms after the gesture.`
        );
    }
    return {
        raster: rasters.reduce( ( sum, event ) => sum + event.dur, 0 ) / 1000,
        sharpen: ( sharp - end ) / 1000,
    };
}

/**
 * Changes the site's background colour in global styles, as an edit that is
 * not saved. Every artboard's document repaints.
 *
 * @param page   The page.
 * @param colour The new colour.
 */
export async function changeBackground( page: Page, colour: string ) {
    await page.evaluate( ( value ) => {
        const { select, dispatch } = ( window as any ).wp.data;
        const id = select( 'core' ).__experimentalGetCurrentGlobalStylesId();
        const { styles } = select( 'core' ).getEditedEntityRecord(
            'root',
            'globalStyles',
            id
        );
        dispatch( 'core' ).editEntityRecord( 'root', 'globalStyles', id, {
            styles: {
                ...styles,
                color: { ...styles?.color, background: value },
            },
        } );
    }, colour );
}

/**
 * Whether every Preview's document has a given background colour. Runs in
 * the page.
 *
 * @param rgb The colour as `getComputedStyle` gives it.
 */
export function previewsHaveBackground( rgb: string ): boolean {
    const frames = Array.from(
        document.querySelectorAll< HTMLIFrameElement >(
            '[data-wfd-tier="preview"] iframe'
        )
    );
    return (
        frames.length > 0 &&
        frames.every(
            ( frame ) =>
                frame.contentDocument?.body &&
                frame.contentWindow!.getComputedStyle(
                    frame.contentDocument.body
                ).backgroundColor === rgb
        )
    );
}
