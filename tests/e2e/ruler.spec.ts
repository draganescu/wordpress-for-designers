import { readFileSync } from 'fs';
import { createRequire } from 'module';
import type { Locator, Page } from '@playwright/test';
import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import {
    resetFixture,
    openBoard,
    boardAtRest,
    viewportOf,
    setViewport,
    setZoom,
    enterEdit,
    editorFrame,
    artboardOf,
    saveBoardLayout,
    savedBoardLayout,
    setViewChoices,
    viewChecked,
    chooseView,
    rulerOf,
    putCornerAt,
    guidePoint,
    type Artboard,
    type Fixture,
    type Point,
} from './utils';

// The engine of the scan WordPress's end-to-end utilities use (AC-A11Y-03).
const AXE_SOURCE = readFileSync(
    createRequire( __filename ).resolve( 'axe-core/axe.min.js' ),
    'utf8'
);

const GUIDE_ID = '11111111-2222-4333-8444-777777777777';
const NOTE_ID = '11111111-2222-4333-8444-666666666666';
const ORIGIN = { x: 0, y: 0 };

type Box = { x: number; y: number; width: number; height: number };

const intersect = ( a: Box, b: Box ) =>
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height;

// Whether a span is the two values given, to within one unit.
const isSpan = ( span: number[] | null, ends: number[] ) =>
    !! span &&
    span.length === 2 &&
    span.every( ( value, index ) => Math.abs( value - ends[ index ] ) <= 1 );

test.describe( 'RULER', () => {
    let fixture: Fixture;
    let about: Artboard;
    test.beforeEach( async ( { requestUtils } ) => {
        fixture = await resetFixture( requestUtils );
        about = artboardOf( fixture, 'page' );
    } );

    const rulers = ( page: Page ) => page.locator( '[data-wfd-ruler]' );
    const ruler = ( page: Page, side: 'top' | 'left' ) =>
        page.locator(
            `[data-wfd-region="canvas"] [data-wfd-ruler="${ side }"]`
        );
    const areaBox = async ( page: Page ) =>
        ( await page.locator( '[data-wfd-region="canvas"]' ).boundingBox() )!;

    // Opens the fixture board with the stored choices of D109 given.
    const open = async ( page: Page, shown: boolean ) => {
        await setViewChoices( page, fixture.boardId, {
            rulers: shown,
            guides: true,
        } );
        await openBoard( page, fixture.boardId );
    };

    // How far zero on the two rulers is from where a point of the board is
    // drawn, in CSS px. A ruler rounds its zero.
    const zeroOff = async ( page: Page, origin: Point ) => {
        const view = await viewportOf( page );
        const top = await rulerOf( page, 'top' );
        const left = await rulerOf( page, 'left' );
        return Math.max(
            Math.abs( top.zero - ( view.x + origin.x * view.zoom ) ),
            Math.abs( left.zero - ( view.y + origin.y * view.zoom ) )
        );
    };
    const expectZeroAt = ( page: Page, origin: Point ) =>
        expect.poll( () => zeroOff( page, origin ) ).toBeLessThanOrEqual( 1.5 );

    // The height the board holds for an artboard now: it is measured again
    // when the artboard renders.
    const heightOf = ( page: Page, id: string ): Promise< number > =>
        page.evaluate(
            ( artboardId ) =>
                ( window as any ).wp.data
                    .select( 'wfd/board' )
                    .getArtboards()
                    .find( ( a: { id: string } ) => a.id === artboardId )
                    .height,
            id
        );

    const expectSpans = async (
        page: Page,
        across: () => Promise< number[] > | number[],
        down: () => Promise< number[] > | number[]
    ) => {
        await expect
            .poll( async () =>
                isSpan( ( await rulerOf( page, 'top' ) ).span, await across() )
            )
            .toBe( true );
        await expect
            .poll( async () =>
                isSpan( ( await rulerOf( page, 'left' ) ).span, await down() )
            )
            .toBe( true );
    };
    const expectNoSpan = async ( page: Page ) => {
        await expect
            .poll( async () => ( await rulerOf( page, 'top' ) ).span )
            .toBeNull();
        await expect
            .poll( async () => ( await rulerOf( page, 'left' ) ).span )
            .toBeNull();
    };

    test( 'AC-RULER-01 On a board this browser has never opened, no ruler is in the page and the "Rulers" item of the zoom menu is unchecked. Choosing it shows the top ruler, the left ruler and the corner and checks the item; Shift + R with focus on the board hides them and pressed again shows them; after a reload they are as they were left, and another board is not affected', async ( {
        page,
        requestUtils,
    } ) => {
        const other = await requestUtils.rest< { id: number } >( {
            method: 'POST',
            path: '/wp/v2/wfd-boards',
            data: { title: 'Second board', status: 'publish' },
        } );
        // Nothing is stored for this board: the context is new.
        await openBoard( page, fixture.boardId );
        const canvas = page.locator( '[data-wfd-region="canvas"]' );
        await expect( rulers( page ) ).toHaveCount( 0 );
        await page.locator( '[data-wfd-control="H8"]' ).click();
        const item = page.locator( '[data-wfd-view="rulers"]' );
        await expect( item ).toContainText( 'Rulers' );
        await expect( item ).toHaveAttribute( 'role', 'menuitemcheckbox' );
        await expect( item ).toHaveAttribute( 'aria-checked', 'false' );
        await expect(
            page.locator( '[data-wfd-view="guides"]' )
        ).toContainText( 'Guides' );

        await chooseView( page, 'rulers' );
        await expect( rulers( page ) ).toHaveCount( 2 );
        const area = await areaBox( page );
        const top = ( await ruler( page, 'top' ).boundingBox() )!;
        const left = ( await ruler( page, 'left' ).boundingBox() )!;
        for ( const side of [ 'top', 'left' ] as const ) {
            await expect( ruler( page, side ) ).toHaveJSProperty(
                'tagName',
                'CANVAS'
            );
        }
        // The top ruler lies over the top edge, as wide as the area and about
        // 20 px thick; the left ruler over the left edge, down to the bottom.
        expect( Math.abs( top.x - area.x ) ).toBeLessThanOrEqual( 1 );
        expect( Math.abs( top.y - area.y ) ).toBeLessThanOrEqual( 1 );
        expect( Math.abs( top.width - area.width ) ).toBeLessThanOrEqual( 1 );
        expect( top.height ).toBeGreaterThanOrEqual( 16 );
        expect( top.height ).toBeLessThanOrEqual( 24 );
        expect( Math.abs( left.x - area.x ) ).toBeLessThanOrEqual( 1 );
        expect( left.width ).toBeGreaterThanOrEqual( 16 );
        expect( left.width ).toBeLessThanOrEqual( 24 );
        expect(
            Math.abs( left.y + left.height - ( area.y + area.height ) )
        ).toBeLessThanOrEqual( 1 );
        expect( await viewChecked( page, 'rulers' ) ).toBe( 'true' );

        // Shift + R with focus on the board.
        await canvas.focus();
        await page.keyboard.press( 'Shift+KeyR' );
        await expect( rulers( page ) ).toHaveCount( 0 );
        expect( await viewChecked( page, 'rulers' ) ).toBe( 'false' );
        await canvas.focus();
        await page.keyboard.press( 'Shift+KeyR' );
        await expect( rulers( page ) ).toHaveCount( 2 );

        // As they were left after a reload.
        await openBoard( page, fixture.boardId );
        await expect( rulers( page ) ).toHaveCount( 2 );
        expect( await viewChecked( page, 'rulers' ) ).toBe( 'true' );

        // Another board has its own choice.
        await openBoard( page, other.id, 0 );
        await expect( rulers( page ) ).toHaveCount( 0 );
        expect( await viewChecked( page, 'rulers' ) ).toBe( 'false' );

        // Hidden, they stay hidden after a reload too.
        await openBoard( page, fixture.boardId );
        await expect( rulers( page ) ).toHaveCount( 2 );
        await page.locator( '[data-wfd-region="canvas"]' ).focus();
        await page.keyboard.press( 'Shift+KeyR' );
        await expect( rulers( page ) ).toHaveCount( 0 );
        await openBoard( page, fixture.boardId );
        await expect( rulers( page ) ).toHaveCount( 0 );
    } );

    test( "AC-RULER-02 With nothing selected, zero on each ruler is at the board's origin and no span is shaded. At 17% zoom the numbers are 500 apart, at 50% they are 100 apart, and a number above or left of zero is negative", async ( {
        page,
    } ) => {
        await open( page, true );
        await expect( rulers( page ) ).toHaveCount( 2 );
        await expect( page.locator( '.wfd-artboard.is-selected' ) ).toHaveCount(
            0
        );

        // The origin 300 by 200 pixels into the canvas area, at 17%.
        await setViewport( page, { x: 300, y: 200, zoom: 0.17 } );
        await expectZeroAt( page, ORIGIN );
        await expect
            .poll( async () => ( await rulerOf( page, 'top' ) ).step )
            .toBe( 500 );
        let top = await rulerOf( page, 'top' );
        let left = await rulerOf( page, 'left' );
        expect( Math.abs( top.zero - 300 ) ).toBeLessThanOrEqual( 1 );
        expect( Math.abs( left.zero - 200 ) ).toBeLessThanOrEqual( 1 );
        expect( top.step ).toBe( 500 );
        expect( left.step ).toBe( 500 );
        await expectNoSpan( page );
        await expect( ruler( page, 'top' ) ).not.toHaveAttribute(
            'data-wfd-span',
            /./
        );
        await expect( ruler( page, 'left' ) ).not.toHaveAttribute(
            'data-wfd-span',
            /./
        );

        // At 50%.
        await setZoom( page, 0.5, { x: 300, y: 200 } );
        await expect
            .poll( async () => ( await rulerOf( page, 'top' ) ).step )
            .toBe( 100 );
        await expectZeroAt( page, ORIGIN );
        top = await rulerOf( page, 'top' );
        left = await rulerOf( page, 'left' );
        expect( left.step ).toBe( 100 );
        // Zero sits inside the area on both rulers, clear of their corner,
        // so each ruler has a stretch above or left of zero. The numbers
        // themselves are painted on a `canvas` element and cannot be read:
        // the far side of zero is negative by where zero is.
        expect( top.zero ).toBeGreaterThan( 40 );
        expect( left.zero ).toBeGreaterThan( 40 );
        await expectNoSpan( page );
    } );

    test( 'AC-RULER-03 With one artboard selected, zero is at its top-left corner and the span is "0 1440" on the top ruler for a Desktop artboard and 0 to its height on the left ruler. With two artboards selected, and with a note selected, the rulers are as with nothing selected', async ( {
        page,
        requestUtils,
    } ) => {
        expect(
            await saveBoardLayout( requestUtils, fixture.boardId, {
                version: 1,
                artboards: fixture.layout.artboards,
                notes: [
                    {
                        id: NOTE_ID,
                        x: about.x + 400,
                        y: about.y - 240,
                        text: 'Check the spacing',
                        color: 'yellow',
                    },
                ],
            } )
        ).toBe( 200 );
        await open( page, true );
        // About at 25%, its corner 260 by 150 pixels into the canvas area.
        await putCornerAt( page, about, 0.25, { x: 260, y: 150 } );
        await boardAtRest( page );
        await expectZeroAt( page, ORIGIN );
        await expectNoSpan( page );

        // One artboard.
        await page.locator( `[data-wfd-row="${ about.id }"]` ).click();
        await expect(
            page.locator( `[data-wfd-artboard="${ about.id }"]` )
        ).toHaveClass( /is-selected/ );
        await expectZeroAt( page, about );
        await expect( ruler( page, 'top' ) ).toHaveAttribute(
            'data-wfd-span',
            '0 1440'
        );
        await expectSpans(
            page,
            () => [ 0, 1440 ],
            async () => [ 0, await heightOf( page, about.id ) ]
        );

        // Two artboards.
        const member = artboardOf( fixture, 'page', 'desktop', 1 );
        await page.keyboard.down( 'ControlOrMeta' );
        await page.locator( `[data-wfd-row="${ member.id }"]` ).click();
        await page.keyboard.up( 'ControlOrMeta' );
        await expect( page.locator( '.wfd-artboard.is-selected' ) ).toHaveCount(
            2
        );
        await expectZeroAt( page, ORIGIN );
        await expectNoSpan( page );

        // One again, then a note.
        await page.locator( `[data-wfd-row="${ about.id }"]` ).click();
        await expectZeroAt( page, about );
        const note = page.locator( '[data-wfd-note]' );
        const box = ( await note.boundingBox() )!;
        await page.mouse.click( box.x + box.width / 2, box.y + box.height / 2 );
        await expect( note ).toHaveClass( /is-selected/ );
        await expect( page.locator( '.wfd-artboard.is-selected' ) ).toHaveCount(
            0
        );
        await expectZeroAt( page, ORIGIN );
        await expectNoSpan( page );
    } );

    test( "AC-RULER-04 With an artboard in edit and a block selected, zero is at the artboard's top-left corner and the span on each ruler is the block's edges in the page's pixels; selecting another block changes the span; with no block selected the span is the artboard's extent", async ( {
        page,
    } ) => {
        test.setTimeout( 90000 );
        const hero = artboardOf( fixture, 'pattern' );
        await open( page, true );
        // Hero at 50%, its corner 40 by 100 pixels into the canvas area.
        await putCornerAt( page, hero, 0.5, { x: 40, y: 100 } );
        await enterEdit( page, hero.id );
        const frame = editorFrame( page, hero.id );
        const heading = frame.locator( 'h2', { hasText: 'Hero' } );
        const paragraph = frame.locator( 'p', { hasText: 'Hero paragraph.' } );

        // A block's edges in its document, which is the page at its own
        // pixels, counted from the artboard's top-left corner.
        const edgesOf = ( block: Locator ) =>
            block.evaluate( ( element ) => {
                const rect = element.getBoundingClientRect();
                const view = element.ownerDocument.defaultView!;
                return {
                    across: [
                        rect.left + view.scrollX,
                        rect.right + view.scrollX,
                    ],
                    down: [
                        rect.top + view.scrollY,
                        rect.bottom + view.scrollY,
                    ],
                };
            } );

        await heading.click();
        await expect( heading ).toHaveClass( /is-selected/ );
        await expectZeroAt( page, hero );
        await expectSpans(
            page,
            async () => ( await edgesOf( heading ) ).across,
            async () => ( await edgesOf( heading ) ).down
        );
        const first = ( await rulerOf( page, 'left' ) ).span;

        // Another block.
        await paragraph.click();
        await expect( paragraph ).toHaveClass( /is-selected/ );
        await expectSpans(
            page,
            async () => ( await edgesOf( paragraph ) ).across,
            async () => ( await edgesOf( paragraph ) ).down
        );
        expect( ( await rulerOf( page, 'left' ) ).span ).not.toEqual( first );
        await expectZeroAt( page, hero );

        // No block: Esc clears the block selection and edit continues.
        await page.keyboard.press( 'Escape' );
        await expect(
            page.locator( '.block-editor-block-toolbar' )
        ).toHaveCount( 0 );
        await expect(
            page.locator( `[data-wfd-artboard="${ hero.id }"]` )
        ).toHaveAttribute( 'data-wfd-tier', 'live' );
        await expectSpans(
            page,
            () => [ 0, 1440 ],
            async () => [ 0, await heightOf( page, hero.id ) ]
        );
        await expectZeroAt( page, hero );
    } );

    test( "AC-RULER-05 With rulers shown, panning and zooming the board cause no React render while the gesture lasts, and after each frame `data-wfd-zero` on both rulers is where the board's origin, or the selected artboard's corner, is drawn", async ( {
        page,
    } ) => {
        // Waiting for a slow machine's board to load can take a while.
        test.setTimeout( 180000 );
        await open( page, true );
        await expect( rulers( page ) ).toHaveCount( 2 );
        // One gesture of twenty wheel events, measured in the page as in
        // AC-PERF-01. After each frame, zero on each ruler is compared with
        // where the canvas surface's transform draws the point.
        type Wheel = { deltaX?: number; deltaY?: number; ctrlKey?: boolean };
        const run = ( init: Wheel, origin: Point ) =>
            page.evaluate(
                async ( [ wheel, point ] ) => {
                    const hooks = ( window as any ).wfdTest;
                    const area = document.querySelector(
                        '[data-wfd-region="canvas"]'
                    ) as HTMLElement;
                    const surface = area.querySelector(
                        '.wfd-canvas__surface'
                    ) as HTMLElement;
                    const zeroOf = ( side: string ) =>
                        Number(
                            area
                                .querySelector(
                                    `[data-wfd-ruler="${ side }"]`
                                )!
                                .getAttribute( 'data-wfd-zero' )
                        );
                    const box = area.getBoundingClientRect();
                    const frame = () =>
                        new Promise( ( resolve ) =>
                            requestAnimationFrame( resolve )
                        );
                    const layout = () =>
                        ( window as any ).wp.data
                            .select( 'wfd/board' )
                            .getArtboards();
                    const layoutBefore = layout();
                    const rendersBefore = hooks.counters.renders;
                    const transforms: string[] = [];
                    let worst = 0;
                    for ( let i = 0; i < 20; i++ ) {
                        area.dispatchEvent(
                            new WheelEvent( 'wheel', {
                                bubbles: true,
                                cancelable: true,
                                clientX: box.left + 300,
                                clientY: box.top + 300,
                                ...wheel,
                            } )
                        );
                        await frame();
                        await frame();
                        transforms.push( surface.style.transform );
                        const drawn = new DOMMatrix(
                            window.getComputedStyle( surface ).transform
                        );
                        worst = Math.max(
                            worst,
                            Math.abs(
                                zeroOf( 'top' ) -
                                    ( drawn.e + point.x * drawn.a )
                            ),
                            Math.abs(
                                zeroOf( 'left' ) -
                                    ( drawn.f + point.y * drawn.d )
                            )
                        );
                    }
                    return {
                        rendersDuring: hooks.counters.renders - rendersBefore,
                        distinctTransforms: new Set( transforms ).size,
                        hasLayoutChanged: layout() !== layoutBefore,
                        worst,
                    };
                },
                [ init, origin ] as const
            );
        // A measurement during which the board rendered because it measured
        // an artboard's height is taken again, once the board is at rest.
        const measure = async ( init: Wheel, origin: Point ) => {
            let measured = null;
            for ( let attempt = 0; attempt < 10; attempt++ ) {
                await boardAtRest( page );
                measured = await run( init, origin );
                if ( ! measured.rendersDuring || ! measured.hasLayoutChanged ) {
                    break;
                }
            }
            return measured!;
        };
        const check = async ( origin: Point ) => {
            const pan = await measure( { deltaX: 6, deltaY: 4 }, origin );
            const zoom = await measure( { deltaY: -3, ctrlKey: true }, origin );
            for ( const gesture of [ pan, zoom ] ) {
                expect( gesture.rendersDuring ).toBe( 0 );
                expect( gesture.distinctTransforms ).toBe( 20 );
                // A ruler rounds its zero.
                expect( gesture.worst ).toBeLessThanOrEqual( 1.5 );
            }
            // And once the gesture has settled.
            await expectZeroAt( page, origin );
        };

        // Nothing selected: the board's origin.
        await check( ORIGIN );

        // One artboard selected: its corner.
        await page.locator( `[data-wfd-row="${ about.id }"]` ).click();
        await expect(
            page.locator( `[data-wfd-artboard="${ about.id }"]` )
        ).toHaveClass( /is-selected/ );
        await expectZeroAt( page, about );
        await check( about );
    } );

    test( 'AC-RULER-06 With rulers hidden and no guide on the board, no ruler element is in the page, the keyboard shortcuts control and the canvas notices are in their corners, and the layout the board saves has no `guides` field. With rulers shown, the control and the notices are inside the canvas, clear of both rulers', async ( {
        page,
        requestUtils,
    } ) => {
        const control = page.locator( '[data-wfd-control="A5"]' );
        const banner = page.locator( '[data-wfd-banner="usage"]' );
        // A canvas notice: the usage banner of a colour token (D61).
        const showNotice = async () => {
            const token = page
                .locator( '[data-wfd-region="right"]' )
                .locator( '.wfd-row', {
                    has: page.locator( '.wfd-row__name', {
                        hasText: /^Accent 1$/,
                    } ),
                } );
            await token.click();
            await page.keyboard.press( 'Escape' );
            await expect( banner ).toBeVisible();
        };

        // Hidden, with no guide.
        await open( page, false );
        await expect( rulers( page ) ).toHaveCount( 0 );
        await expect( page.locator( '[data-wfd-guide]' ) ).toHaveCount( 0 );
        let area = await areaBox( page );
        const cornered = ( await control.boundingBox() )!;
        expect( cornered.x - area.x ).toBeLessThan( 40 );
        expect(
            area.y + area.height - ( cornered.y + cornered.height )
        ).toBeLessThan( 40 );

        // A change to the layout, saved by the board itself.
        await page.locator( `[data-wfd-row="${ about.id }"]` ).click();
        await page.locator( '[data-wfd-region="canvas"]' ).focus();
        await page.keyboard.press( 'ArrowRight' );
        await expect
            .poll(
                async () =>
                    (
                        await savedBoardLayout( requestUtils, fixture.boardId )
                    ).artboards.find( ( a ) => a.id === about.id )?.x,
                { timeout: 10000 }
            )
            .toBe( about.x + 1 );
        expect(
            Object.keys(
                await savedBoardLayout( requestUtils, fixture.boardId )
            ).sort()
        ).toEqual( [ 'artboards', 'version' ] );
        await page.keyboard.press( 'Escape' );
        await expect( page.locator( '.wfd-artboard.is-selected' ) ).toHaveCount(
            0
        );

        await showNotice();
        const noticed = ( await banner.boundingBox() )!;
        expect( noticed.x - area.x ).toBeGreaterThanOrEqual( 0 );
        expect( noticed.x - area.x ).toBeLessThan( 40 );
        expect( noticed.y - area.y ).toBeGreaterThanOrEqual( 0 );
        expect( noticed.y - area.y ).toBeLessThan( 40 );

        // Shown.
        await open( page, true );
        await expect( rulers( page ) ).toHaveCount( 2 );
        await showNotice();
        area = await areaBox( page );
        const top = ( await ruler( page, 'top' ).boundingBox() )!;
        const left = ( await ruler( page, 'left' ).boundingBox() )!;
        for ( const element of [ control, banner ] ) {
            const box = ( await element.boundingBox() )!;
            expect( intersect( box, top ) ).toBe( false );
            expect( intersect( box, left ) ).toBe( false );
            // Inside the canvas area.
            expect( box.x ).toBeGreaterThanOrEqual( area.x );
            expect( box.y ).toBeGreaterThanOrEqual( area.y );
            expect( box.x + box.width ).toBeLessThanOrEqual(
                area.x + area.width
            );
            expect( box.y + box.height ).toBeLessThanOrEqual(
                area.y + area.height
            );
        }
        // Each is still at its corner, moved in by no more than the rulers.
        const moved = ( await control.boundingBox() )!;
        expect( moved.x - area.x ).toBeLessThan( 40 + left.width );
        expect(
            area.y + area.height - ( moved.y + moved.height )
        ).toBeLessThan( 40 );
        const cleared = ( await banner.boundingBox() )!;
        expect( cleared.x - area.x ).toBeLessThan( 40 + left.width );
        expect( cleared.y - area.y ).toBeLessThan( 40 + top.height );
    } );

    test( 'AC-RULER-07 The automated accessibility scan reports no violations with rulers shown, a guide on an artboard and that guide selected', async ( {
        page,
        requestUtils,
    } ) => {
        expect(
            await saveBoardLayout( requestUtils, fixture.boardId, {
                version: 1,
                artboards: fixture.layout.artboards,
                guides: [
                    {
                        id: GUIDE_ID,
                        axis: 'y',
                        // Artboards are measured much shorter than the
                        // fixture's heights: near the top is on About.
                        at: 40,
                        artboard: about.id,
                        device: 'desktop',
                    },
                ],
            } )
        ).toBe( 200 );
        await open( page, true );
        await putCornerAt( page, about, 0.25, { x: 260, y: 150 } );
        await boardAtRest( page );
        const guide = page.locator( `[data-wfd-guide="${ GUIDE_ID }"]` );
        await expect( guide ).toHaveCount( 1 );
        const scan = async () => {
            await page.evaluate( AXE_SOURCE );
            return page.evaluate( async () => {
                const results = await ( window as any ).axe.run( document, {
                    resultTypes: [ 'violations' ],
                } );
                return results.violations.map( ( violation: any ) => ( {
                    id: violation.id,
                    nodes: violation.nodes
                        .slice( 0, 4 )
                        .map(
                            ( node: any ) => `${ node.target.join( ' >> ' ) }`
                        ),
                } ) );
            } );
        };

        // Rulers shown and a guide on an artboard.
        await expect( rulers( page ) ).toHaveCount( 2 );
        expect( await scan(), 'Rulers and a guide' ).toEqual( [] );

        // That guide selected, with its card in the right panel.
        const on = await guidePoint( page, GUIDE_ID );
        await page.mouse.click( on.x, on.y );
        await expect( guide ).toHaveAttribute( 'data-wfd-selected', 'true' );
        await expect(
            page.locator( '[data-wfd-region="right"] [data-wfd-panel="guide"]' )
        ).toBeVisible();
        expect( await scan(), 'A guide selected' ).toEqual( [] );
    } );
} );
