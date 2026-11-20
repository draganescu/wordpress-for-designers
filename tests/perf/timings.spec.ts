import type { Page } from '@playwright/test';
import type { RequestUtils } from '@wordpress/e2e-test-utils-playwright';
import {
    resetFixture,
    openBoard,
    editorFrame,
    artboardOf,
    visiblePoint,
} from '../e2e/utils';
import {
    VIEWS,
    changeBackground,
    devtools,
    dispatchTimes,
    drawn,
    droppedFrames,
    expect,
    hasShownAll,
    openBoardAt,
    pageMetrics,
    percentile,
    previewsHaveBackground,
    processStats,
    settle,
    test,
    throttle,
    timeUntil,
    timeUntilChange,
    viewOn,
    watchFrames,
    watchLongTasks,
    watchOpening,
} from './support';

const sum = ( values: number[] ) => values.reduce( ( a, b ) => a + b, 0 );

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
    const shown = await watchOpening( page );
    const tasks = await watchLongTasks( page, true );
    await openBoard( page, fixture.boardId, size );
    await drawn( page );
    return { ...( await shown() ), ...( await tasks() ) };
}

// Timings, with the page's main thread slowed to stand for an older laptop.
// They vary from run to run, so they are run several times and compared
// between two builds on one machine, not held to a budget.
test.describe( 'Timings', { tag: '@timing' }, () => {
    test( 'opening the fixture board', async ( {
        page,
        requestUtils,
        record,
    } ) => {
        const open = await timeOpen( page, requestUtils, 9 );
        record( 'open.first-artboard', open.first, 'ms' );
        record( 'open.all-artboards', open.last, 'ms' );
        record( 'open.blocking', open.blocking, 'ms' );
        record( 'open.longest-task', open.longest, 'ms' );
    } );

    test( 'opening a board of 30 artboards', async ( {
        page,
        requestUtils,
        record,
    } ) => {
        const open = await timeOpen( page, requestUtils, 30 );
        record( 'open-30.first-artboard', open.first, 'ms' );
        record( 'open-30.all-artboards', open.last, 'ms' );
        record( 'open-30.blocking', open.blocking, 'ms' );
    } );

    test( 'select, drag, enter edit and type', async ( {
        page,
        requestUtils,
        metrics,
        record,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        const hero = artboardOf( fixture, 'pattern', 'desktop', 0 );
        const sign = artboardOf( fixture, 'pattern', 'desktop', 1 );
        await openBoardAt(
            page,
            requestUtils,
            fixture.boardId,
            viewOn( hero, 0.5 )
        );
        await drawn( page );
        await throttle( await devtools( page ) );

        // Select.
        let point = ( await visiblePoint( page, sign.id ) )!;
        const click = await dispatchTimes(
            metrics,
            [ 'pointerdown', 'pointerup', 'click' ],
            async () => {
                await page.mouse.click( point.x, point.y );
                await expect(
                    page.locator( `[data-wfd-artboard="${ sign.id }"]` )
                ).toHaveClass( /is-selected/ );
            }
        );
        expect( click.map( ( events ) => events.length ) ).toEqual( [
            1, 1, 1,
        ] );
        record( 'select.handling', sum( click.flat() ), 'ms' );

        // Drag.
        const frames = await watchFrames( page );
        await page.mouse.move( point.x, point.y );
        await page.mouse.down();
        await page.mouse.move( point.x + 180, point.y + 60, { steps: 60 } );
        await page.mouse.up();
        const intervals = await frames();
        record( 'drag.frame-p95', percentile( intervals, 0.95 ), 'ms' );
        record( 'drag.frames-dropped', droppedFrames( intervals ), 'count' );
        await settle( page );

        // Enter edit: from the double-click to an editor that can be typed in.
        point = ( await visiblePoint( page, hero.id ) )!;
        record(
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
        const text = 'thirty characters of typing ok';
        await editorFrame( page, hero.id ).locator( 'h2' ).click();
        await settle( page );
        const [ down, press, up ] = await dispatchTimes(
            metrics,
            [ 'keydown', 'keypress', 'keyup' ],
            () => page.keyboard.type( text, { delay: 120 } )
        );
        expect( [ down.length, press.length, up.length ] ).toEqual( [
            text.length,
            text.length,
            text.length,
        ] );
        const keys = down.map( ( time, i ) => time + press[ i ] + up[ i ] );
        record( 'type.handling-p50', percentile( keys, 0.5 ), 'ms' );
        record( 'type.handling-p95', percentile( keys, 0.95 ), 'ms' );
    } );

    test( 'a style change with twelve Previews in view', async ( {
        page,
        requestUtils,
        record,
    } ) => {
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
        record( 'style.longest-task', longest, 'ms' );
        record( 'style.blocking', blocking, 'ms' );
    } );

    test( 'making frozen copies and tidying 30 artboards', async ( {
        page,
        requestUtils,
        record,
    } ) => {
        const fixture = await resetFixture( requestUtils, { extra: 21 } );
        // Opened far from every artboard, so that none has been rendered.
        await openBoardAt( page, requestUtils, fixture.boardId, VIEWS.far, 30 );
        await settle( page );
        await throttle( await devtools( page ) );

        record(
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
                hasShownAll,
                undefined,
                100
            ),
            'ms'
        );
        await settle( page );

        // Clicked where it is, not through its locator: the checks a
        // locator makes before it clicks would be timed too.
        const tidy = ( await page
            .locator( '[data-wfd-control="H12"]' )
            .boundingBox() )!;
        const tasks = await watchLongTasks( page );
        record(
            'tidy.apply',
            await timeUntilChange(
                page,
                () =>
                    page.mouse.click(
                        tidy.x + tidy.width / 2,
                        tidy.y + tidy.height / 2
                    ),
                () =>
                    Array.from(
                        document.querySelectorAll< HTMLElement >(
                            '[data-wfd-artboard]'
                        )
                    )
                        .map(
                            ( element ) =>
                                element.style.left + element.style.top
                        )
                        .join()
            ),
            'ms'
        );
        await settle( page );
        record( 'tidy.longest-task', ( await tasks() ).longest, 'ms' );
    } );

    test( 'a board left alone for ten seconds', async ( {
        page,
        requestUtils,
        browser,
        record,
    } ) => {
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
            'idle.main-thread',
            ( after.TaskDuration - before.TaskDuration ) * 1000,
            'ms'
        );
        record(
            'idle.process-cpu',
            ( after.cpuSeconds - before.cpuSeconds ) * 1000,
            'ms'
        );
    } );
} );
