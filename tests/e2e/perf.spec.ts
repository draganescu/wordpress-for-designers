import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import {
    resetFixture,
    openBoard,
    counters,
    setViewport,
    enterEdit,
    editorFrame,
    artboardOf,
    fingers,
    pointsOn,
    type Point,
} from './utils';

test.describe( 'PERF', () => {
    test( 'AC-PERF-01 A pan or zoom gesture commits no React render and changes the canvas transform each frame', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        await page.waitForTimeout( 1500 );

        const result = await page.evaluate( async () => {
            const hooks = ( window as any ).wfdTest;
            const area = document.querySelector(
                '[data-wfd-region="canvas"]'
            ) as HTMLElement;
            const surface = area.querySelector(
                '.wfd-canvas__surface'
            ) as HTMLElement;
            const box = area.getBoundingClientRect();
            const frame = () =>
                new Promise( ( resolve ) => requestAnimationFrame( resolve ) );
            const run = async ( init: WheelEventInit ) => {
                const rendersBefore = hooks.counters.renders;
                const transforms: string[] = [];
                for ( let i = 0; i < 20; i++ ) {
                    area.dispatchEvent(
                        new WheelEvent( 'wheel', {
                            bubbles: true,
                            cancelable: true,
                            clientX: box.left + 300,
                            clientY: box.top + 300,
                            ...init,
                        } )
                    );
                    await frame();
                    await frame();
                    transforms.push( surface.style.transform );
                }
                return {
                    rendersDuring: hooks.counters.renders - rendersBefore,
                    distinctTransforms: new Set( transforms ).size,
                };
            };
            const pan = await run( { deltaX: 6, deltaY: 4 } );
            const zoom = await run( { deltaY: -3, ctrlKey: true } );
            const rendersAtEnd = hooks.counters.renders;
            await new Promise( ( resolve ) => setTimeout( resolve, 600 ) );
            return {
                pan,
                zoom,
                rendersAfterSettle: hooks.counters.renders - rendersAtEnd,
            };
        } );

        expect( result.pan.rendersDuring ).toBe( 0 );
        expect( result.pan.distinctTransforms ).toBe( 20 );
        expect( result.zoom.rendersDuring ).toBe( 0 );
        expect( result.zoom.distinctTransforms ).toBe( 20 );
        // React hears about the gesture once it settles.
        expect( result.rendersAfterSettle ).toBeGreaterThan( 0 );
        expect( ( await counters( page ) ).renders ).toBeGreaterThan( 0 );
    } );

    test( 'AC-PERF-02 Wheel events from inside artboard iframes produce at most one viewport update per animation frame', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        const hero = artboardOf( fixture, 'pattern' );
        await enterEdit( page, hero.id );
        await editorFrame( page, hero.id ).locator( 'h2' ).waitFor();

        const result = await page
            .locator(
                `[data-wfd-artboard="${ hero.id }"] iframe[name="editor-canvas"]`
            )
            .evaluate( async ( iframe: HTMLIFrameElement ) => {
                const hooks = ( window as any ).wfdTest;
                const doc = iframe.contentDocument!;
                const target = doc.querySelector( 'h2' )!;
                const frame = () =>
                    new Promise( ( resolve ) =>
                        requestAnimationFrame( resolve )
                    );
                await frame();
                const start = hooks.viewport.get();
                const updatesBefore = hooks.viewport.counters.updates;
                let frames = 0;
                let events = 0;
                let prevented = 0;
                // Bursts of eight wheel events inside the iframe per frame.
                for ( let i = 0; i < 12; i++ ) {
                    for ( let j = 0; j < 8; j++ ) {
                        const event = new (
                            iframe.contentWindow as any
                         ).WheelEvent( 'wheel', {
                            bubbles: true,
                            cancelable: true,
                            clientX: 40,
                            clientY: 20,
                            deltaX: 1,
                            deltaY: 2,
                        } );
                        target.dispatchEvent( event );
                        events++;
                        if ( event.defaultPrevented ) {
                            prevented++;
                        }
                    }
                    await frame();
                    frames++;
                }
                await frame();
                const end = hooks.viewport.get();
                return {
                    frames,
                    events,
                    prevented,
                    updates: hooks.viewport.counters.updates - updatesBefore,
                    dx: end.x - start.x,
                    dy: end.y - start.y,
                };
            } );

        expect( result.events ).toBe( 96 );
        // Every event reached the shell and was taken from the iframe.
        expect( result.prevented ).toBe( 96 );
        expect( result.dx ).toBeCloseTo( -96, 0 );
        expect( result.dy ).toBeCloseTo( -192, 0 );
        // Coalesced: no more than one viewport update per animation frame.
        expect( result.updates ).toBeGreaterThan( 0 );
        expect( result.updates ).toBeLessThanOrEqual( result.frames + 1 );
        // Panning keeps the artboard in edit.
        await expect(
            page.locator( `[data-wfd-artboard="${ hero.id }"]` )
        ).toHaveAttribute( 'data-wfd-tier', 'live' );
    } );

    test( 'AC-PERF-03 Editor scripts and styles are requested once per session, not per artboard', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        const client = await page.context().newCDPSession( page );
        await client.send( 'Network.enable' );
        // Transfers from the network, by address (cache hits are not transfers).
        const transfers = new Map< string, number >();
        const cached = new Set< string >();
        const urls = new Map< string, string >();
        client.on( 'Network.requestWillBeSent', ( event ) => {
            urls.set( event.requestId, event.request.url );
        } );
        client.on( 'Network.requestServedFromCache', ( event ) => {
            cached.add( event.requestId );
        } );
        client.on( 'Network.responseReceived', ( event ) => {
            if (
                event.response.fromDiskCache ||
                event.response.fromPrefetchCache ||
                event.response.fromServiceWorker
            ) {
                cached.add( event.requestId );
            }
        } );
        client.on( 'Network.loadingFinished', ( event ) => {
            const url = urls.get( event.requestId );
            if (
                url &&
                ! cached.has( event.requestId ) &&
                /\.(js|css)(\?|$)/.test( url ) &&
                /wp-includes|wp-content\/plugins\/wordpress-for-designers/.test(
                    url
                )
            ) {
                transfers.set( url, ( transfers.get( url ) ?? 0 ) + 1 );
            }
        } );

        await openBoard( page, fixture.boardId );
        // Mount every artboard as a Preview, then edit three of them in turn.
        await setViewport( page, { x: 40, y: 40, zoom: 0.25 } );
        await expect
            .poll( () =>
                page.locator( '[data-wfd-tier="preview"] iframe' ).count()
            )
            .toBe( 9 );
        for ( const artboard of [
            artboardOf( fixture, 'template-part' ),
            artboardOf( fixture, 'pattern' ),
            artboardOf( fixture, 'page' ),
        ] ) {
            await enterEdit( page, artboard.id );
            await page
                .getByRole( 'button', { name: 'Back to the board' } )
                .click();
        }
        await page.waitForTimeout( 500 );

        const editorAssets = [ ...transfers.keys() ].filter( ( url ) =>
            /block-editor|block-library|components|editor|core-data|blocks|board\.js|style-board/.test(
                url
            )
        );
        expect( editorAssets.length ).toBeGreaterThan( 5 );
        const repeated = [ ...transfers ].filter(
            ( [ , count ] ) => count > 1
        );
        expect( repeated ).toEqual( [] );
        // The plugin's own script loads once.
        expect(
            [ ...transfers.keys() ].filter( ( url ) =>
                /build\/board\.js/.test( url )
            )
        ).toHaveLength( 1 );
        expect( ( await counters( page ) ).renders ).toBeGreaterThan( 0 );
    } );

    test.describe( 'by touch', () => {
        test.use( { hasTouch: true, viewport: { width: 1180, height: 820 } } );

        test( 'AC-PERF-04 A two-finger pan or pinch commits no React render and changes the canvas transform at most once per animation frame', async ( {
            page,
            requestUtils,
        } ) => {
            const fixture = await resetFixture( requestUtils );
            await openBoard( page, fixture.boardId );
            await setViewport( page, { x: 20, y: 20, zoom: 0.25 } );
            await page.waitForTimeout( 1500 );
            const touch = await fingers( page );
            const [ a, b ] = await pointsOn( page, null );

            // Counts animation frames next to the app's own counters.
            await page.evaluate( () => {
                const state = ( ( window as any ).wfdFrames = { count: 0 } );
                const tick = () => {
                    state.count++;
                    window.requestAnimationFrame( tick );
                };
                window.requestAnimationFrame( tick );
            } );
            const read = () =>
                page.evaluate( () => {
                    const hooks = ( window as any ).wfdTest;
                    return {
                        renders: hooks.counters.renders as number,
                        updates: hooks.viewport.counters.updates as number,
                        frames: ( window as any ).wfdFrames.count as number,
                        transform: (
                            document.querySelector(
                                '.wfd-canvas__surface'
                            ) as HTMLElement
                         ).style.transform,
                    };
                } );
            // Three moves at a time, faster than the frames.
            const run = async ( at: ( step: number ) => [ Point, Point ] ) => {
                await touch.down( a );
                await touch.down( a, b );
                const before = await read();
                for ( let i = 1; i <= 30; i += 3 ) {
                    await Promise.all(
                        [ i, i + 1, i + 2 ].map( ( step ) =>
                            touch.move( ...at( step ) )
                        )
                    );
                }
                const after = await read();
                await touch.up();
                return { before, after };
            };

            const pan = await run( ( step ) => [
                { x: a.x + step * 2, y: a.y - step },
                { x: b.x + step * 2, y: b.y - step },
            ] );
            const pinch = await run( ( step ) => [
                { x: a.x - step, y: a.y },
                { x: b.x + step, y: b.y },
            ] );
            for ( const { before, after } of [ pan, pinch ] ) {
                expect( after.renders - before.renders ).toBe( 0 );
                expect( after.transform ).not.toBe( before.transform );
                expect( after.updates ).toBeGreaterThan( before.updates );
                expect( after.updates - before.updates ).toBeLessThanOrEqual(
                    after.frames - before.frames + 1
                );
            }
            // React hears about the gesture once it settles.
            const rendersAtEnd = ( await read() ).renders;
            await expect
                .poll( async () => ( await read() ).renders )
                .toBeGreaterThan( rendersAtEnd );
        } );
    } );
} );
