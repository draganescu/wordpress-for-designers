import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import type { Page } from '@playwright/test';
import type { RequestUtils } from '@wordpress/e2e-test-utils-playwright';
import { resetFixture, openBoard, editorFrame, artboardOf } from '../e2e/utils';
import {
    VIEWS,
    changeBackground,
    devtools,
    drawn,
    droppedFrames,
    openBoardAt,
    pageMetrics,
    percentile,
    pointOn,
    previewsHaveBackground,
    processStats,
    record,
    settle,
    throttle,
    timeUntil,
    watchFrames,
    watchInteractions,
    watchLongTasks,
} from './support';

/**
 * Opens a board in a new tab with nothing cached, and gives when its
 * artboards were shown and how long the main thread was blocked. Times are
 * milliseconds from the start of navigation.
 *
 * @param page         The page.
 * @param requestUtils The REST helper.
 * @param size         How many artboards the board has.
 */
async function timeOpen(
    page: Page,
    requestUtils: RequestUtils,
    size: number
) {
    const fixture = await resetFixture( requestUtils, { extra: size - 9 } );
    await throttle( await devtools( page ) );
    await page.addInitScript( () => {
        if ( window.top !== window ) {
            return;
        }
        const state = { tasks: [] as number[], shown: 0, first: 0, last: 0 };
        ( window as any ).wfdPerfOpen = state;
        new PerformanceObserver( ( list ) => {
            for ( const entry of list.getEntries() ) {
                state.tasks.push( entry.duration );
            }
        } ).observe( { type: 'longtask' } );
        const tick = () => {
            let shown = 0;
            document
                .querySelectorAll< HTMLIFrameElement >(
                    '[data-wfd-tier="preview"] iframe, .wfd-snapshot__copy iframe'
                )
                .forEach( ( frame ) => {
                    if ( frame.contentDocument?.body?.childElementCount ) {
                        shown++;
                    }
                } );
            if ( shown > state.shown ) {
                state.shown = shown;
                state.last = performance.now();
                state.first ||= state.last;
            }
        };
        // Ten times a second, not every frame: asking for frames would
        // take the idle time the app mounts artboards in.
        window.setInterval( tick, 100 );
    } );
    await openBoard( page, fixture.boardId, size );
    await drawn( page );
    return page.evaluate( () => {
        const state = ( window as any ).wfdPerfOpen;
        return {
            first: state.first as number,
            last: state.last as number,
            longest: Math.max( 0, ...state.tasks ),
            blocking: state.tasks.reduce(
                ( sum: number, d: number ) => sum + Math.max( 0, d - 50 ),
                0
            ) as number,
        };
    } );
}

// Timings. The page's main thread is slowed (PERF_CPU_THROTTLE, 4 by
// default) to stand for an older laptop. They vary from run to run, so they
// are run several times and compared between two builds on one machine,
// not held to a budget.
test.describe( 'Timings', { tag: '@timing' }, () => {
    test( 'opening the fixture board', async ( {
        page,
        requestUtils,
    }, testInfo ) => {
        const open = await timeOpen( page, requestUtils, 9 );
        record( testInfo, 'open.first-artboard', open.first, 'ms' );
        record( testInfo, 'open.all-artboards', open.last, 'ms' );
        record( testInfo, 'open.blocking', open.blocking, 'ms' );
        record( testInfo, 'open.longest-task', open.longest, 'ms' );
    } );

    test( 'opening a board of 30 artboards', async ( {
        page,
        requestUtils,
    }, testInfo ) => {
        const open = await timeOpen( page, requestUtils, 30 );
        record( testInfo, 'open-30.first-artboard', open.first, 'ms' );
        record( testInfo, 'open-30.all-artboards', open.last, 'ms' );
        record( testInfo, 'open-30.blocking', open.blocking, 'ms' );
    } );

    test( 'select, drag, enter edit and type', async ( {
        page,
        requestUtils,
    }, testInfo ) => {
        const fixture = await resetFixture( requestUtils );
        const hero = artboardOf( fixture, 'pattern', 'desktop', 0 );
        const sign = artboardOf( fixture, 'pattern', 'desktop', 1 );
        // Hero at the top left of the canvas area at 50%: editing starts
        // without the board moving.
        await openBoardAt( page, requestUtils, fixture.boardId, {
            x: 40 - hero.x * 0.5,
            y: 100 - hero.y * 0.5,
            zoom: 0.5,
        } );
        await drawn( page );
        await throttle( await devtools( page ) );
        const body = page.locator( 'body' );

        // Select.
        let point = await pointOn( page, sign.id );
        let interactions = await watchInteractions( body );
        await page.mouse.click( point.x, point.y );
        await expect(
            page.locator( `[data-wfd-artboard="${ sign.id }"]` )
        ).toHaveClass( /is-selected/ );
        await page.waitForTimeout( 500 );
        record(
            testInfo,
            'select.latency',
            Math.max( ...( await interactions( 1 ) ) ),
            'ms'
        );

        // Drag.
        const frames = await watchFrames( page );
        await page.mouse.move( point.x, point.y );
        await page.mouse.down();
        await page.mouse.move( point.x + 180, point.y + 60, { steps: 60 } );
        await page.mouse.up();
        const intervals = await frames();
        record(
            testInfo,
            'drag.frame-p95',
            percentile( intervals, 0.95 ),
            'ms'
        );
        record(
            testInfo,
            'drag.frames-dropped',
            droppedFrames( intervals ),
            'count'
        );
        await settle( page );

        // Enter edit: from the double-click to an editor that can be typed in.
        point = await pointOn( page, hero.id );
        record(
            testInfo,
            'edit.enter',
            await timeUntil(
                page,
                () => page.mouse.dblclick( point.x, point.y ),
                ( id: string ) =>
                    !! document
                        .querySelector< HTMLIFrameElement >(
                            `[data-wfd-artboard="${ id }"][data-wfd-tier="live"] iframe[name="editor-canvas"]`
                        )
                        ?.contentDocument?.querySelector(
                            '.is-root-container'
                        ),
                hero.id
            ),
            'ms'
        );

        // Type.
        const canvas = editorFrame( page, hero.id );
        await canvas.locator( 'h2' ).click();
        await page.waitForTimeout( 500 );
        interactions = await watchInteractions( canvas.locator( 'body' ) );
        await page.keyboard.type( 'thirty characters of typing ok', {
            delay: 120,
        } );
        await page.waitForTimeout( 500 );
        const keys = await interactions( 30 );
        record( testInfo, 'type.latency-p50', percentile( keys, 0.5 ), 'ms' );
        record( testInfo, 'type.latency-p95', percentile( keys, 0.95 ), 'ms' );
    } );

    test( 'a style change with twelve Previews in view', async ( {
        page,
        requestUtils,
    }, testInfo ) => {
        const fixture = await resetFixture( requestUtils, { extra: 21 } );
        await openBoardAt(
            page,
            requestUtils,
            fixture.boardId,
            VIEWS.grid,
            30
        );
        await expect(
            page.locator( '[data-wfd-tier="preview"] iframe' )
        ).toHaveCount( 12 );
        await drawn( page );
        await throttle( await devtools( page ) );

        const tasks = await watchLongTasks( page );
        record(
            testInfo,
            'style.repaint',
            await timeUntil(
                page,
                () => changeBackground( page, '#445566' ),
                previewsHaveBackground,
                'rgb(68, 85, 102)'
            ),
            'ms'
        );
        await settle( page );
        const { longest, blocking } = await tasks();
        record( testInfo, 'style.longest-task', longest, 'ms' );
        record( testInfo, 'style.blocking', blocking, 'ms' );
    } );

    test( 'making frozen copies and tidying 30 artboards', async ( {
        page,
        requestUtils,
    }, testInfo ) => {
        const fixture = await resetFixture( requestUtils, { extra: 21 } );
        // Opened far from every artboard, so that none has been rendered.
        await openBoardAt( page, requestUtils, fixture.boardId, VIEWS.far, 30 );
        await settle( page );
        await throttle( await devtools( page ) );

        record(
            testInfo,
            'snapshot.create-30',
            await timeUntil(
                page,
                () =>
                    page.evaluate( () =>
                        ( window as any ).wfdTest.viewport.set(
                            { x: 20, y: 20, zoom: 0.1 },
                            { immediate: true }
                        )
                    ),
                () => {
                    const frozen = Array.from(
                        document.querySelectorAll(
                            '[data-wfd-tier="snapshot"]'
                        )
                    );
                    return (
                        frozen.length > 12 &&
                        frozen.every(
                            ( element ) =>
                                !! element.querySelector< HTMLIFrameElement >(
                                    '.wfd-snapshot__copy iframe'
                                )?.contentDocument?.body?.childElementCount
                        )
                    );
                },
                null,
                100
            ),
            'ms'
        );
        await settle( page );

        const places = () =>
            Array.from(
                document.querySelectorAll< HTMLElement >(
                    '[data-wfd-artboard]'
                )
            )
                .map( ( element ) => element.style.left + element.style.top )
                .join();
        const before = await page.evaluate( places );
        const tasks = await watchLongTasks( page );
        record(
            testInfo,
            'tidy.apply',
            await timeUntil(
                page,
                () => page.locator( '[data-wfd-control="H12"]' ).click(),
                ( was: string ) =>
                    Array.from(
                        document.querySelectorAll< HTMLElement >(
                            '[data-wfd-artboard]'
                        )
                    )
                        .map(
                            ( element ) =>
                                element.style.left + element.style.top
                        )
                        .join() !== was,
                before
            ),
            'ms'
        );
        await settle( page );
        record(
            testInfo,
            'tidy.longest-task',
            ( await tasks() ).longest,
            'ms'
        );
    } );

    test( 'a board left alone for ten seconds', async ( {
        page,
        requestUtils,
        browser,
    }, testInfo ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoardAt(
            page,
            requestUtils,
            fixture.boardId,
            VIEWS.previews
        );
        await drawn( page );
        // Past the layout autosave and anything else that follows opening.
        await page.waitForTimeout( 4000 );
        const client = await devtools( page );

        const before = {
            ...( await pageMetrics( client ) ),
            ...( await processStats( browser ) ),
        };
        await page.waitForTimeout( 10_000 );
        const after = {
            ...( await pageMetrics( client ) ),
            ...( await processStats( browser ) ),
        };
        // Not slowed: this is work done, not time waited.
        record(
            testInfo,
            'idle.main-thread',
            ( after.TaskDuration - before.TaskDuration ) * 1000,
            'ms'
        );
        record(
            testInfo,
            'idle.process-cpu',
            ( after.cpuSeconds - before.cpuSeconds ) * 1000,
            'ms'
        );
    } );
} );
