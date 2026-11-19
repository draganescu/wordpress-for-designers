import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import type { Page } from '@playwright/test';
import { resetFixture } from '../e2e/utils';
import {
    VIEWS,
    devtools,
    drawn,
    droppedFrames,
    openBoardAt,
    percentile,
    processStats,
    record,
    throttle,
} from './support';

/**
 * Sends one wheel event per animation frame to the canvas, half of them one
 * way and half back, and gives the time between frames in milliseconds.
 *
 * @param page   The page.
 * @param init   The wheel event: deltas, and `ctrlKey` for a zoom.
 * @param frames How many frames.
 * @param mark   A performance mark to leave when the last event is sent.
 */
async function wheel(
    page: Page,
    init: WheelEventInit,
    frames: number,
    mark = ''
): Promise< number[] > {
    return page.evaluate(
        async ( [ event, count, name ] ) => {
            const area = document.querySelector(
                '[data-wfd-region="canvas"]'
            ) as HTMLElement;
            const box = area.getBoundingClientRect();
            const next = () =>
                new Promise< number >( ( resolve ) =>
                    requestAnimationFrame( resolve )
                );
            const intervals: number[] = [];
            let last = await next();
            for ( let i = 0; i < count; i++ ) {
                const sign = i < count / 2 ? 1 : -1;
                area.dispatchEvent(
                    new WheelEvent( 'wheel', {
                        bubbles: true,
                        cancelable: true,
                        clientX: box.left + 400,
                        clientY: box.top + 300,
                        ctrlKey: event.ctrlKey,
                        deltaX: ( event.deltaX ?? 0 ) * sign,
                        deltaY: ( event.deltaY ?? 0 ) * sign,
                    } )
                );
                const now = await next();
                intervals.push( now - last );
                last = now;
            }
            if ( name ) {
                performance.mark( name );
            }
            return intervals;
        },
        [ init, frames, mark ] as const
    );
}

// Pan and zoom on a board of 30 artboards with twelve Previews in view. Runs
// at device pixel ratio 1 and 2; the results of the second have `@2x` after
// their names. On a CI runner the page is drawn in software, so these show
// main-thread and raster cost, not what a laptop's graphics chip does: see
// docs/performance.md.
test.describe( 'Gestures', { tag: '@timing' }, () => {
    test( 'pan and zoom', async ( {
        page,
        requestUtils,
        browser,
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
        const client = await devtools( page );

        // What the compositor holds for this view.
        await client.send( 'LayerTree.enable' );
        const tree = new Promise< { layers?: any[] } >( ( resolve ) =>
            client.once( 'LayerTree.layerTreeDidChange', resolve )
        );
        await wheel( page, { deltaX: 1 }, 2 );
        const { layers = [] } = await tree;
        await client.send( 'LayerTree.disable' );
        const scale = testInfo.project.use.deviceScaleFactor ?? 1;
        const drawnLayers = layers.filter( ( layer ) => layer.drawsContent );
        record( testInfo, 'layers.count', drawnLayers.length, 'count' );
        // Four bytes per pixel, were every layer fully drawn.
        record(
            testInfo,
            'layers.pixels-memory',
            drawnLayers.reduce(
                ( sum, layer ) =>
                    sum + layer.width * layer.height * 4 * scale * scale,
                0
            ),
            'bytes'
        );
        record(
            testInfo,
            'gestures.gpu-memory',
            ( await processStats( browser ) ).gpu,
            'bytes'
        );

        await throttle( client );

        const pan = await wheel( page, { deltaX: 12, deltaY: 8 }, 120 );
        record( testInfo, 'pan.frame-p95', percentile( pan, 0.95 ), 'ms' );
        record( testInfo, 'pan.frames-dropped', droppedFrames( pan ), 'count' );
        await page.waitForTimeout( 500 );

        const zoom = await wheel( page, { deltaY: -3, ctrlKey: true }, 120 );
        record( testInfo, 'zoom.frame-p95', percentile( zoom, 0.95 ), 'ms' );
        record(
            testInfo,
            'zoom.frames-dropped',
            droppedFrames( zoom ),
            'count'
        );
        await page.waitForTimeout( 500 );

        // Drawing work for a zoom that ends at a new scale: how much there
        // is, and how long after the last wheel event it goes on (the time
        // the board looks soft).
        await browser.startTracing( page, {
            categories: [ 'cc', 'blink.user_timing' ],
        } );
        await page.evaluate( () => performance.mark( 'wfd-perf-zoom-start' ) );
        await wheel( page, { deltaY: -3, ctrlKey: true }, 20 );
        await wheel(
            page,
            { deltaY: -3, ctrlKey: true },
            20,
            'wfd-perf-zoom-end'
        );
        await page.waitForTimeout( 2500 );
        const trace = JSON.parse( ( await browser.stopTracing() ).toString() );
        const events: any[] = trace.traceEvents ?? trace;
        const at = ( name: string ) =>
            events.find( ( event ) => event.name === name )?.ts as number;
        const start = at( 'wfd-perf-zoom-start' );
        const end = at( 'wfd-perf-zoom-end' );
        const rasters = events.filter(
            ( event ) =>
                event.name === 'RasterTask' &&
                event.ph === 'X' &&
                event.ts >= start
        );
        record(
            testInfo,
            'zoom.raster',
            rasters.reduce( ( sum, event ) => sum + event.dur, 0 ) / 1000,
            'ms'
        );
        record(
            testInfo,
            'zoom.sharpen',
            Math.max(
                0,
                ...rasters.map( ( event ) => event.ts + event.dur - end )
            ) / 1000,
            'ms'
        );
    } );
} );
