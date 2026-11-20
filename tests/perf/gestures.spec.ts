import type { Page } from '@playwright/test';
import { resetFixture } from '../e2e/utils';
import {
    VIEWS,
    devtools,
    drawn,
    drawnLayers,
    droppedFrames,
    expect,
    openBoardAt,
    percentile,
    processStats,
    rasterWork,
    settle,
    test,
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

// Pan and zoom on a board of 30 artboards with twelve Previews in view.
// Here it also runs at device pixel ratio 2, with `@2x` after the names of
// those results. What the numbers stand for on a machine that draws in
// software is in docs/performance.md, "On a real laptop".
test.describe( 'Gestures', { tag: '@timing' }, () => {
    test( 'pan and zoom', async ( {
        page,
        requestUtils,
        browser,
        metrics,
        deviceScaleFactor,
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
        const client = await devtools( page );

        // What the compositor holds for this view.
        const layers = await drawnLayers( client, () =>
            wheel( page, { deltaX: 1 }, 2 )
        );
        const scale = deviceScaleFactor ?? 1;
        record( 'layers.count', layers.length, 'count' );
        // Four bytes per pixel, were every layer fully drawn.
        record(
            'layers.pixels-memory',
            layers.reduce(
                ( sum, layer ) =>
                    sum + layer.width * layer.height * 4 * scale * scale,
                0
            ),
            'bytes'
        );
        record(
            'gestures.gpu-memory',
            ( await processStats( browser ) ).gpu,
            'bytes'
        );

        await throttle( client );

        const pan = await wheel( page, { deltaX: 12, deltaY: 8 }, 120 );
        record( 'pan.frame-p95', percentile( pan, 0.95 ), 'ms' );
        record( 'pan.frames-dropped', droppedFrames( pan ), 'count' );
        await settle( page );

        const zoom = await wheel( page, { deltaY: -3, ctrlKey: true }, 120 );
        record( 'zoom.frame-p95', percentile( zoom, 0.95 ), 'ms' );
        record( 'zoom.frames-dropped', droppedFrames( zoom ), 'count' );
        await settle( page );

        // Zooming in and back out, twice over 40 frames: the board is drawn
        // at each scale on the way and drawn sharp once it stops.
        const { raster, sharpen } = await rasterWork(
            page,
            metrics,
            async ( endMark ) => {
                await wheel( page, { deltaY: -3, ctrlKey: true }, 20 );
                await wheel( page, { deltaY: -3, ctrlKey: true }, 20, endMark );
            }
        );
        record( 'zoom.raster', raster, 'ms' );
        record( 'zoom.sharpen', sharpen, 'ms' );
    } );
} );
