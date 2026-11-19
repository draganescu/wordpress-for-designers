import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import type {
    Browser,
    CDPSession,
    Locator,
    Page,
    TestInfo,
} from '@playwright/test';
import type { RequestUtils } from '@wordpress/e2e-test-utils-playwright';
import { openBoard } from '../e2e/utils';

/**
 * How many times slower than the machine running the suite the page's main
 * thread is made for timing tests, to stand for an older laptop. The CI
 * workflow sets 2, its runner being slow already; use 1 when the suite runs
 * on the laptop itself.
 */
export const CPU_THROTTLE = Number( process.env.PERF_CPU_THROTTLE ?? 4 );

const RESULTS =
    process.env.PERF_RESULTS ??
    path.join( process.cwd(), 'artifacts', 'perf', 'results.jsonl' );

/**
 * Appends one measurement to the results file. Measurements taken on the
 * high-density project get `@2x` after their name.
 *
 * @param testInfo The running test.
 * @param name     The indicator, as listed in docs/performance.md.
 * @param value    The number measured.
 * @param unit     `count`, `bytes` or `ms`.
 */
export function record(
    testInfo: TestInfo,
    name: string,
    value: number,
    unit: 'count' | 'bytes' | 'ms'
) {
    if ( ! Number.isFinite( value ) ) {
        return;
    }
    const suffix = testInfo.project.name.endsWith( '-2x' ) ? '@2x' : '';
    fs.mkdirSync( path.dirname( RESULTS ), { recursive: true } );
    fs.appendFileSync(
        RESULTS,
        JSON.stringify( { name: name + suffix, value, unit } ) + '\n'
    );
}

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
 * @param rate   The slow-down factor.
 */
export async function throttle( client: CDPSession, rate = CPU_THROTTLE ) {
    await client.send( 'Emulation.setCPUThrottlingRate', { rate } );
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

/**
 * Collects garbage, so that what is measured next is what is still held.
 *
 * @param client The page's DevTools session.
 */
export async function collectGarbage( client: CDPSession ) {
    await client.send( 'HeapProfiler.enable' );
    for ( let i = 0; i < 3; i++ ) {
        await client.send( 'HeapProfiler.collectGarbage' );
    }
}

function residentBytes( pid: number ): number {
    try {
        const out = execFileSync( 'ps', [ '-o', 'rss=', '-p', String( pid ) ], {
            encoding: 'utf8',
        } );
        return parseInt( out.trim(), 10 ) * 1024 || 0;
    } catch {
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
 * Waits until the app has stopped rendering and requesting. Playwright's
 * "networkidle" is not used: two of the board's REST requests never report
 * as finished to it.
 *
 * @param page The page.
 */
export async function settle( page: Page ) {
    let last = '';
    for ( let i = 0; i < 80; i++ ) {
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
}

/**
 * The app's counters as numbers that can be subtracted.
 *
 * @param page The page.
 */
export async function appCounters( page: Page ) {
    return page.evaluate( () => {
        const hooks = ( window as any ).wfdTest;
        return {
            renders: hooks.counters.renders as number,
            styleGenerations: hooks.counters.styleGenerations as number,
            parses: hooks.counters.parses as number,
        };
    } );
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
 * @param page The page.
 */
export async function watchLongTasks( page: Page ) {
    await page.evaluate( () => {
        const store: number[] = [];
        const observer = new PerformanceObserver( ( list ) => {
            for ( const entry of list.getEntries() ) {
                store.push( entry.duration );
            }
        } );
        observer.observe( { type: 'longtask' } );
        ( window as any ).wfdPerfTasks = { store, observer };
    } );
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
 * Times something from just before `action` until `done` first holds, in
 * the page's own clock.
 *
 * `done` runs in the page once per animation frame by default, which is
 * exact but asks the browser for a frame every 16 ms. The app mounts
 * artboards in the main thread's idle time, and on a slow machine those
 * frames leave none: the thing being timed then never finishes. Anything
 * that takes seconds and goes through that queue must be given an interval
 * in milliseconds instead.
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
    arg: T,
    polling: 'raf' | number = 'raf'
): Promise< number > {
    const start = await page.evaluate( () => performance.now() );
    // The page's clock at the first check on which the condition holds.
    const end = page.waitForFunction(
        `(${ done.toString() })(${ JSON.stringify(
            arg
        ) }) ? performance.now() : 0`,
        undefined,
        { polling, timeout: 240_000 }
    );
    await action();
    return ( ( await ( await end ).jsonValue() ) as number ) - start;
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

/**
 * Opens a board at a given viewport, as if it had been left there. Without
 * this a board opens fitted, which for the fixture is below 20% zoom.
 *
 * @param page         The page.
 * @param requestUtils The REST helper.
 * @param boardId      The board.
 * @param view         The viewport to open at.
 * @param view.x
 * @param view.y
 * @param view.zoom
 * @param count        Number of artboards expected.
 */
export async function openBoardAt(
    page: Page,
    requestUtils: RequestUtils,
    boardId: number,
    view: { x: number; y: number; zoom: number },
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
 * Whether every Preview and Snapshot on the page shows its content. Runs in
 * the page.
 */
export function isDrawn(): boolean {
    const shown = Array.from(
        document.querySelectorAll(
            '[data-wfd-tier="preview"], [data-wfd-tier="snapshot"]'
        )
    );
    return shown.every(
        ( element ) =>
            !! element.querySelector( 'iframe' )?.contentDocument?.body
                ?.childElementCount
    );
}

/**
 * Waits until every Preview and Snapshot shows its content and the app is
 * quiet.
 *
 * @param page The page.
 */
export async function drawn( page: Page ) {
    // Checked four times a second, not every frame: see `timeUntil`.
    const options = { polling: 250, timeout: 240_000 };
    await page.waitForFunction( isDrawn, undefined, options );
    await settle( page );
    await page.waitForFunction( isDrawn, undefined, options );
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
 * A point of an artboard's frame that is inside the canvas area.
 *
 * @param page The page.
 * @param id   The artboard id.
 */
export async function pointOn( page: Page, id: string ) {
    const canvas = ( await page
        .locator( '[data-wfd-region="canvas"]' )
        .boundingBox() )!;
    const frame = ( await page
        .locator( `[data-wfd-artboard="${ id }"] .wfd-artboard__frame` )
        .boundingBox() )!;
    const left = Math.max( canvas.x, frame.x );
    const top = Math.max( canvas.y, frame.y );
    const right = Math.min( canvas.x + canvas.width, frame.x + frame.width );
    const bottom = Math.min( canvas.y + canvas.height, frame.y + frame.height );
    return { x: ( left + right ) / 2, y: ( top + bottom ) / 2 };
}

/**
 * Starts recording how long the browser takes to show the result of each
 * click or key press in a document (the Event Timing API, what "Interaction
 * to Next Paint" is built on). Returns a function that stops and gives one
 * duration in milliseconds per interaction. The browser does not report an
 * interaction shorter than 16 ms; `expected` fills those in as 16.
 *
 * @param body The body of the document: the page's, or an editor canvas's.
 */
export async function watchInteractions( body: Locator ) {
    await body.evaluate( () => {
        const entries: [ number, number ][] = [];
        const read = ( list: PerformanceEntry[] ) => {
            for ( const entry of list as any[] ) {
                if ( entry.interactionId ) {
                    entries.push( [ entry.interactionId, entry.duration ] );
                }
            }
        };
        const observer = new PerformanceObserver( ( list ) =>
            read( list.getEntries() )
        );
        observer.observe( { type: 'event', durationThreshold: 16 } as any );
        ( window as any ).wfdPerfEvents = { entries, observer, read };
    } );
    return async ( expected = 0 ): Promise< number[] > => {
        const durations = await body.evaluate( () => {
            const { entries, observer, read } = ( window as any ).wfdPerfEvents;
            read( observer.takeRecords() );
            observer.disconnect();
            const longest = new Map< number, number >();
            for ( const [ id, duration ] of entries ) {
                longest.set( id, Math.max( longest.get( id ) ?? 0, duration ) );
            }
            return [ ...longest.values() ];
        } );
        while ( durations.length < expected ) {
            durations.push( 16 );
        }
        return durations;
    };
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
