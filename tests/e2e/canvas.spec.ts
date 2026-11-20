import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import type { Page } from '@playwright/test';
import {
    resetFixture,
    openBoard,
    viewportOf,
    setViewport,
    frameBox,
    enterEdit,
    editorFrame,
    artboardOf,
    fingers,
    gridOn,
    pointOn,
    pointsOn,
    type Point,
} from './utils';

test.describe( 'CANVAS', () => {
    let fixture: Awaited< ReturnType< typeof resetFixture > >;
    test.beforeEach( async ( { page, requestUtils } ) => {
        fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
    } );

    const frameOf = ( page: Page, id: string ) =>
        page.locator( `[data-wfd-artboard="${ id }"]` );
    const selectedArtboards = ( page: Page ) =>
        page.locator( '.wfd-artboard.is-selected' );
    const selectedIds = ( page: Page ) =>
        selectedArtboards( page ).evaluateAll( ( els: HTMLElement[] ) =>
            els.map( ( el ) => el.dataset.wfdArtboard ).sort()
        );

    test( 'AC-CANVAS-01 Each artboard shows the label "{Name} · {Kind} · {Device}"', async ( {
        page,
    } ) => {
        await expect
            .poll( async () =>
                (
                    await page
                        .locator( '[data-wfd-artboard] .wfd-artboard__label' )
                        .allInnerTexts()
                ).sort()
            )
            .toEqual(
                [
                    'About · Page · Desktop',
                    'Become a member · Page · Desktop',
                    'Footer · Template part · Desktop',
                    'Header · Template part · Desktop',
                    'Header · Template part · Mobile',
                    'Hero · Pattern · Desktop',
                    'Index · Template · Desktop',
                    'Sign-off · Pattern · Desktop',
                    'Single Posts · Template · Desktop',
                ].sort()
            );
    } );

    test( 'AC-CANVAS-02 Click selects one artboard, empty board clears, dragging moves and is undoable', async ( {
        page,
    } ) => {
        const hero = page.locator(
            `[data-wfd-artboard="${ fixture.layout.artboards[ 3 ].id }"]`
        );
        const about = page.locator(
            `[data-wfd-artboard="${ fixture.layout.artboards[ 5 ].id }"]`
        );
        await hero.locator( '.wfd-artboard__frame' ).click();
        await expect( page.locator( '.wfd-artboard.is-selected' ) ).toHaveCount(
            1
        );
        await expect( hero ).toHaveClass( /is-selected/ );
        await about.locator( '.wfd-artboard__frame' ).click();
        await expect( page.locator( '.wfd-artboard.is-selected' ) ).toHaveCount(
            1
        );
        await expect( about ).toHaveClass( /is-selected/ );

        // Empty board: the bottom-left corner of the canvas has no artboard.
        const canvas = page.locator( '[data-wfd-region="canvas"]' );
        const box = ( await canvas.boundingBox() )!;
        await page.mouse.click( box.x + 12, box.y + box.height - 12 );
        await expect( page.locator( '.wfd-artboard.is-selected' ) ).toHaveCount(
            0
        );

        // Drag Hero by 60 x 40 screen pixels.
        const { zoom } = await viewportOf( page );
        const before = await hero.evaluate( ( el: HTMLElement ) => ( {
            left: parseFloat( el.style.left ),
            top: parseFloat( el.style.top ),
        } ) );
        const frame = ( await frameBox( hero ) )!;
        await page.mouse.move( frame.x + 20, frame.y + 20 );
        await page.mouse.down();
        await page.mouse.move( frame.x + 50, frame.y + 40, { steps: 4 } );
        await page.mouse.move( frame.x + 80, frame.y + 60, { steps: 4 } );
        await page.mouse.up();
        const after = await hero.evaluate( ( el: HTMLElement ) => ( {
            left: parseFloat( el.style.left ),
            top: parseFloat( el.style.top ),
        } ) );
        expect( after.left ).toBeCloseTo( before.left + 60 / zoom, -1 );
        expect( after.top ).toBeCloseTo( before.top + 40 / zoom, -1 );
        await expect( hero ).toHaveClass( /is-selected/ );

        const undo = page.locator( '[data-wfd-control="H3"]' );
        await expect( undo ).toBeEnabled();
        await undo.click();
        await expect
            .poll( () =>
                hero.evaluate( ( el: HTMLElement ) =>
                    parseFloat( el.style.left )
                )
            )
            .toBe( before.left );
        await page.locator( '[data-wfd-control="H4"]' ).click();
        await expect
            .poll( () =>
                hero.evaluate( ( el: HTMLElement ) =>
                    parseFloat( el.style.left )
                )
            )
            .toBe( after.left );
    } );

    test( 'AC-CANVAS-05 Cmd/Ctrl + click adds an artboard to the selection or takes it out; several move together as one undoable step', async ( {
        page,
    } ) => {
        const hero = page.locator(
            `[data-wfd-artboard="${ fixture.layout.artboards[ 3 ].id }"]`
        );
        const about = page.locator(
            `[data-wfd-artboard="${ fixture.layout.artboards[ 5 ].id }"]`
        );
        const selected = selectedArtboards( page );
        const right = page.locator( '[data-wfd-region="right"]' );
        const position = ( el: HTMLElement ) => ( {
            left: parseFloat( el.style.left ),
            top: parseFloat( el.style.top ),
        } );
        const modClick = async ( artboard: typeof hero ) => {
            const box = ( await frameBox( artboard ) )!;
            await page.keyboard.down( 'ControlOrMeta' );
            await page.mouse.click(
                box.x + Math.min( 20, box.width / 2 ),
                box.y + Math.min( 20, box.height / 2 )
            );
            await page.keyboard.up( 'ControlOrMeta' );
        };

        await hero.locator( '.wfd-artboard__frame' ).click();
        await expect( right.locator( '.wfd-styles' ) ).toHaveCount( 0 );
        await modClick( about );
        await expect( selected ).toHaveCount( 2 );
        await expect( hero ).toHaveClass( /is-selected/ );
        await expect( about ).toHaveClass( /is-selected/ );
        // Several selected: the right panel shows Styles.
        await expect( right.locator( '.wfd-styles' ) ).toHaveCount( 1 );
        // A second Cmd/Ctrl + click takes it out again.
        await modClick( about );
        await expect( selected ).toHaveCount( 1 );
        await expect( hero ).toHaveClass( /is-selected/ );
        await modClick( about );
        await expect( selected ).toHaveCount( 2 );

        // Dragging one of them moves both.
        const { zoom } = await viewportOf( page );
        const heroBefore = await hero.evaluate( position );
        const aboutBefore = await about.evaluate( position );
        const frame = ( await frameBox( hero ) )!;
        await page.mouse.move( frame.x + 20, frame.y + 20 );
        await page.mouse.down();
        await page.mouse.move( frame.x + 50, frame.y + 40, { steps: 4 } );
        await page.mouse.move( frame.x + 80, frame.y + 60, { steps: 4 } );
        await page.mouse.up();
        const heroAfter = await hero.evaluate( position );
        const aboutAfter = await about.evaluate( position );
        expect( heroAfter.left ).toBeCloseTo( heroBefore.left + 60 / zoom, -1 );
        expect( heroAfter.top ).toBeCloseTo( heroBefore.top + 40 / zoom, -1 );
        expect( aboutAfter.left - aboutBefore.left ).toBe(
            heroAfter.left - heroBefore.left
        );
        expect( aboutAfter.top - aboutBefore.top ).toBe(
            heroAfter.top - heroBefore.top
        );
        await expect( selected ).toHaveCount( 2 );

        // An arrow key nudges both.
        await page.keyboard.press( 'ArrowRight' );
        await expect
            .poll( () => hero.evaluate( position ) )
            .toEqual( {
                left: heroAfter.left + 1,
                top: heroAfter.top,
            } );
        await expect
            .poll( () => about.evaluate( position ) )
            .toEqual( {
                left: aboutAfter.left + 1,
                top: aboutAfter.top,
            } );

        // Each move is one step: two undos put both back.
        const undo = page.locator( '[data-wfd-control="H3"]' );
        await undo.click();
        await expect
            .poll( () => about.evaluate( position ) )
            .toEqual( aboutAfter );
        await undo.click();
        await expect
            .poll( () => hero.evaluate( position ) )
            .toEqual( heroBefore );
        await expect
            .poll( () => about.evaluate( position ) )
            .toEqual( aboutBefore );

        // In edit the modifier changes nothing: the click leaves edit and
        // selects that artboard alone.
        const header = artboardOf( fixture, 'template-part' );
        // Entering edit fits the Header; its Mobile artboard is in view.
        const mobile = page.locator(
            `[data-wfd-artboard="${
                artboardOf( fixture, 'template-part', 'mobile' ).id
            }"]`
        );
        await enterEdit( page, header.id );
        await modClick( mobile );
        await expect( page.locator( '[data-wfd-tier="live"]' ) ).toHaveCount(
            0
        );
        await expect( selected ).toHaveCount( 1 );
        await expect( mobile ).toHaveClass( /is-selected/ );
    } );

    test( 'AC-CANVAS-07 Tidy up puts the board in one row per kind, in left-panel order, as one undoable step', async ( {
        page,
    } ) => {
        const ids = fixture.layout.artboards.map( ( a ) => a.id );
        const kindOf = new Map(
            fixture.layout.artboards.map( ( a ) => [ a.id, a.kind ] )
        );
        const boxes = () =>
            page.evaluate( ( list ) => {
                const out: Record<
                    string,
                    { left: number; top: number; width: number; height: number }
                > = {};
                list.forEach( ( id ) => {
                    const el = document.querySelector(
                        `[data-wfd-artboard="${ id }"]`
                    ) as HTMLElement;
                    out[ id ] = {
                        left: parseFloat( el.style.left ),
                        top: parseFloat( el.style.top ),
                        width: el.offsetWidth,
                        height: el.offsetHeight,
                    };
                } );
                return out;
            }, ids );
        // Names load asynchronously; left-panel order needs them.
        await expect(
            page.locator( '[data-wfd-row] .wfd-row__name', {
                hasText: 'Index',
            } )
        ).toBeVisible();
        const order = await page
            .locator( '[data-wfd-row]' )
            .evaluateAll( ( rows ) =>
                rows.map( ( row ) => row.getAttribute( 'data-wfd-row' )! )
            );
        const before = await boxes();
        const beforeText = JSON.stringify( before );

        const tidy = page.locator( '[data-wfd-control="H12"]' );
        await expect( tidy ).toHaveAccessibleName( 'Tidy up' );
        await tidy.click();
        await expect
            .poll( async () => JSON.stringify( await boxes() ) )
            .not.toBe( beforeText );
        const after = await boxes();

        const kinds = [ 'page', 'template', 'template-part', 'pattern' ];
        let rowBottom = -Infinity;
        for ( const kind of kinds ) {
            const row = order.filter( ( id ) => kindOf.get( id ) === kind );
            expect( row.length ).toBeGreaterThan( 0 );
            // One row, top-aligned, below the row before it.
            const top = after[ row[ 0 ] ].top;
            expect( top ).toBeGreaterThan( rowBottom );
            row.forEach( ( id ) => expect( after[ id ].top ).toBe( top ) );
            // Side by side in left-panel order, not overlapping.
            for ( let i = 1; i < row.length; i++ ) {
                const prev = after[ row[ i - 1 ] ];
                expect( after[ row[ i ] ].left ).toBeGreaterThanOrEqual(
                    prev.left + prev.width
                );
            }
            rowBottom = Math.max(
                ...row.map( ( id ) => after[ id ].top + after[ id ].height )
            );
        }

        // One step: Undo names it and puts everything back.
        const undo = page.locator( '[data-wfd-control="H3"]' );
        await expect( undo ).toHaveAccessibleName(
            'Undo tidy up, on the board'
        );
        await undo.click();
        await expect
            .poll( async () => {
                const now = await boxes();
                return ids.map( ( id ) => [ now[ id ].left, now[ id ].top ] );
            } )
            .toEqual(
                ids.map( ( id ) => [ before[ id ].left, before[ id ].top ] )
            );

        // Disabled while an artboard is in edit.
        await enterEdit( page, artboardOf( fixture, 'page' ).id );
        await expect( tidy ).toBeDisabled();
    } );

    // A point of the canvas area with nothing over it: no artboard, and no
    // control floating over the board. The lowest one, and of those the
    // leftmost.
    const emptyBoardPoint = async ( page: Page ) => {
        const found = await gridOn( page, null );
        if ( ! found.length ) {
            throw new Error( 'No empty board in view' );
        }
        return found.reduce( ( lowest, point ) =>
            point.y > lowest.y ? point : lowest
        );
    };

    const zoomAtPointerAndPan = async ( page: Page, x: number, y: number ) => {
        const canvas = page.locator( '[data-wfd-region="canvas"]' );
        const box = ( await canvas.boundingBox() )!;
        const local = { x: x - box.x, y: y - box.y };
        const before = await viewportOf( page );
        const anchor = {
            x: ( local.x - before.x ) / before.zoom,
            y: ( local.y - before.y ) / before.zoom,
        };
        await page.mouse.move( x, y );
        await page.keyboard.down( 'Control' );
        await page.mouse.wheel( 0, -60 );
        await page.keyboard.up( 'Control' );
        await expect
            .poll( async () => ( await viewportOf( page ) ).zoom )
            .toBeGreaterThan( before.zoom );
        const zoomed = await viewportOf( page );
        // The board point under the pointer has not moved.
        expect( anchor.x * zoomed.zoom + zoomed.x ).toBeCloseTo( local.x, 0 );
        expect( anchor.y * zoomed.zoom + zoomed.y ).toBeCloseTo( local.y, 0 );

        await canvas.focus();
        await page.keyboard.down( 'Space' );
        await page.mouse.move( x, y );
        await page.mouse.down();
        await page.mouse.move( x + 40, y + 25, { steps: 4 } );
        await page.mouse.up();
        await page.keyboard.up( 'Space' );
        await expect
            .poll( async () => ( await viewportOf( page ) ).x )
            .toBeCloseTo( zoomed.x + 40, 0 );
        const panned = await viewportOf( page );
        expect( panned.y ).toBeCloseTo( zoomed.y + 25, 0 );
        expect( panned.zoom ).toBeCloseTo( zoomed.zoom, 5 );
    };

    test( 'AC-CANVAS-06 Dragging from empty board selects every artboard the rectangle touches; Cmd/Ctrl + drag adds; Esc cancels; in edit the drag leaves edit', async ( {
        page,
    } ) => {
        const ids = fixture.layout.artboards.map( ( { id } ) => id );
        const heroId = fixture.layout.artboards[ 3 ].id;
        const marquee = page.locator( '[data-wfd-marquee]' );
        const emptyPoint = (): Promise< Point > => emptyBoardPoint( page );
        // A point inside an artboard's frame that is in view, near its top
        // left.
        const pointIn = async ( id: string ): Promise< Point > => {
            const [ first ] = await gridOn( page, id );
            expect( first ).toBeTruthy();
            return first;
        };
        // The artboards whose frame a rectangle between two points touches.
        const touchedBy = async ( a: Point, b: Point ) => {
            const touched: string[] = [];
            for ( const id of ids ) {
                const f = ( await frameBox( frameOf( page, id ) ) )!;
                if (
                    f.x < Math.max( a.x, b.x ) &&
                    f.x + f.width > Math.min( a.x, b.x ) &&
                    f.y < Math.max( a.y, b.y ) &&
                    f.y + f.height > Math.min( a.y, b.y )
                ) {
                    touched.push( id );
                }
            }
            return touched.sort();
        };
        // A plain drag selects what the rectangle touches, as it is dragged.
        const start = await emptyPoint();
        const end = await pointIn( heroId );
        const touched = await touchedBy( start, end );
        expect( touched ).toContain( heroId );
        await expect( marquee ).toBeHidden();
        await page.mouse.move( start.x, start.y );
        await page.mouse.down();
        await page.mouse.move( end.x, end.y, { steps: 6 } );
        await expect( marquee ).toBeVisible();
        await expect.poll( () => selectedIds( page ) ).toEqual( touched );
        const drawn = ( await marquee.boundingBox() )!;
        expect( drawn.x ).toBeCloseTo( Math.min( start.x, end.x ), 0 );
        expect( drawn.y ).toBeCloseTo( Math.min( start.y, end.y ), 0 );
        expect( drawn.width ).toBeCloseTo( Math.abs( end.x - start.x ), 0 );
        expect( drawn.height ).toBeCloseTo( Math.abs( end.y - start.y ), 0 );

        // An artboard the rectangle no longer touches is deselected.
        const near = { x: start.x + 6, y: start.y - 6 };
        expect( await touchedBy( start, near ) ).toEqual( [] );
        await page.mouse.move( near.x, near.y, { steps: 6 } );
        await expect.poll( () => selectedIds( page ) ).toEqual( [] );
        await page.mouse.move( end.x, end.y, { steps: 6 } );
        await page.mouse.up();
        await expect( marquee ).toBeHidden();
        await expect.poll( () => selectedIds( page ) ).toEqual( touched );

        // Cmd/Ctrl + drag keeps what was selected and adds to it.
        const otherId = ids.find( ( id ) => ! touched.includes( id ) )!;
        expect( otherId ).toBeTruthy();
        await page.evaluate(
            ( id ) =>
                ( window as any ).wp.data
                    .dispatch( 'wfd/board' )
                    .selectArtboard( id ),
            otherId
        );
        await expect.poll( () => selectedIds( page ) ).toEqual( [ otherId ] );
        await page.keyboard.down( 'ControlOrMeta' );
        await page.mouse.move( start.x, start.y );
        await page.mouse.down();
        await page.mouse.move( end.x, end.y, { steps: 6 } );
        await page.mouse.up();
        await page.keyboard.up( 'ControlOrMeta' );
        await expect
            .poll( () => selectedIds( page ) )
            .toEqual( [ otherId, ...touched ].sort() );

        // Esc cancels the drag: the selection is as it was before it.
        const kept = [ otherId, ...touched ].sort();
        await page.mouse.move( start.x, start.y );
        await page.mouse.down();
        await page.mouse.move( near.x, near.y, { steps: 6 } );
        await expect( marquee ).toBeVisible();
        await expect.poll( () => selectedIds( page ) ).toEqual( [] );
        await page.keyboard.press( 'Escape' );
        await expect( marquee ).toBeHidden();
        await expect.poll( () => selectedIds( page ) ).toEqual( kept );
        await page.mouse.move( end.x, end.y, { steps: 6 } );
        await expect( marquee ).toBeHidden();
        await page.mouse.up();
        await expect.poll( () => selectedIds( page ) ).toEqual( kept );

        // A plain drag replaces the selection.
        await page.mouse.move( start.x, start.y );
        await page.mouse.down();
        await page.mouse.move( end.x, end.y, { steps: 6 } );
        await page.mouse.up();
        await expect.poll( () => selectedIds( page ) ).toEqual( touched );

        // While an artboard is in edit, the drag leaves edit and selects.
        await enterEdit( page, heroId );
        const from = await emptyPoint();
        const to = await pointIn( heroId );
        const expected = await touchedBy( from, to );
        expect( expected ).toContain( heroId );
        await page.mouse.move( from.x, from.y );
        await page.mouse.down();
        await page.mouse.move( to.x, to.y, { steps: 6 } );
        await expect( page.locator( '[data-wfd-tier="live"]' ) ).toHaveCount(
            0
        );
        await page.mouse.up();
        await expect.poll( () => selectedIds( page ) ).toEqual( expected );
    } );
    test( 'AC-CANVAS-03 Cmd/Ctrl + wheel zooms around the pointer and Space + drag pans, also over an artboard', async ( {
        page,
    } ) => {
        const canvas = page.locator( '[data-wfd-region="canvas"]' );
        const box = ( await canvas.boundingBox() )!;
        // Over empty board.
        const empty = await emptyBoardPoint( page );
        await zoomAtPointerAndPan( page, empty.x, empty.y );
        // Over an artboard.
        const frame = ( await frameBox(
            page.locator(
                `[data-wfd-artboard="${ fixture.layout.artboards[ 0 ].id }"]`
            )
        ) )!;
        const positions = await page
            .locator( '[data-wfd-artboard]' )
            .evaluateAll( ( els: HTMLElement[] ) =>
                els.map( ( el ) => el.style.left + ',' + el.style.top )
            );
        await zoomAtPointerAndPan(
            page,
            Math.max( frame.x, box.x ) + 30,
            Math.max( frame.y, box.y ) + 30
        );
        // Panning with Space over an artboard moved the board, not the artboard.
        expect(
            await page
                .locator( '[data-wfd-artboard]' )
                .evaluateAll( ( els: HTMLElement[] ) =>
                    els.map( ( el ) => el.style.left + ',' + el.style.top )
                )
        ).toEqual( positions );

        // Over the Live artboard: Space + drag pans and keeps it Live; wheel
        // zoom works around the pointer.
        const hero = artboardOf( fixture, 'pattern' );
        // Edit starts at the current zoom: put the artboard in view first.
        await setViewport( page, {
            x: 50 - hero.x * 0.6,
            y: 70 - hero.y * 0.6,
            zoom: 0.6,
        } );
        await enterEdit( page, hero.id );
        const live = page.locator( `[data-wfd-artboard="${ hero.id }"]` );
        const liveBox = ( await frameBox( live ) )!;
        const at = {
            x: Math.max( liveBox.x, box.x ) + 60,
            y: liveBox.y + liveBox.height / 2,
        };
        const before = await viewportOf( page );
        await canvas.focus();
        await page.keyboard.down( 'Space' );
        await page.mouse.move( at.x, at.y );
        await page.mouse.down();
        await page.mouse.move( at.x + 35, at.y + 20, { steps: 4 } );
        await page.mouse.up();
        await page.keyboard.up( 'Space' );
        await expect
            .poll( async () => ( await viewportOf( page ) ).x )
            .toBeCloseTo( before.x + 35, 0 );
        await expect( live ).toHaveAttribute( 'data-wfd-tier', 'live' );

        // Plain wheel over the Live artboard scrolls the board.
        const panned = await viewportOf( page );
        await page.mouse.move( at.x + 35, at.y + 20 );
        await page.mouse.wheel( 0, 30 );
        await expect
            .poll( async () => ( await viewportOf( page ) ).y )
            .toBeCloseTo( panned.y - 30, 0 );
        await expect( live ).toHaveAttribute( 'data-wfd-tier', 'live' );

        // Ctrl + wheel with the pointer inside the Live artboard's document.
        const now = await viewportOf( page );
        const pointer = { x: at.x + 35, y: at.y - 10 };
        const local = { x: pointer.x - box.x, y: pointer.y - box.y };
        const anchor = {
            x: ( local.x - now.x ) / now.zoom,
            y: ( local.y - now.y ) / now.zoom,
        };
        await page.mouse.move( pointer.x, pointer.y );
        await page.keyboard.down( 'Control' );
        await page.mouse.wheel( 0, -50 );
        await page.keyboard.up( 'Control' );
        await expect
            .poll( async () => ( await viewportOf( page ) ).zoom )
            .toBeGreaterThan( now.zoom );
        const zoomed = await viewportOf( page );
        expect( anchor.x * zoomed.zoom + zoomed.x ).toBeCloseTo( local.x, 0 );
        expect( anchor.y * zoomed.zoom + zoomed.y ).toBeCloseTo( local.y, 0 );
        // Zooming in keeps the artboard in edit.
        await expect( live ).toHaveAttribute( 'data-wfd-tier', 'live' );
    } );

    test( 'AC-CANVAS-04 The zoom menu items change zoom as named and Fit all shows every artboard', async ( {
        page,
    } ) => {
        const trigger = page.locator( '[data-wfd-control="H8"]' );
        const pick = async ( name: string ) => {
            await trigger.click();
            await page.getByRole( 'menuitem', { name, exact: true } ).click();
        };
        await trigger.click();
        await expect( page.getByRole( 'menuitem' ) ).toHaveText( [
            'Zoom in',
            'Zoom out',
            'Zoom to 50%',
            'Zoom to 100%',
            'Fit all',
            'Fit selection',
        ] );
        await expect(
            page.getByRole( 'menuitem', { name: 'Fit selection' } )
        ).toBeDisabled();
        await page.keyboard.press( 'Escape' );

        await pick( 'Zoom to 50%' );
        expect( ( await viewportOf( page ) ).zoom ).toBe( 0.5 );
        await expect( trigger.locator( '.wfd-header__zoom-value' ) ).toHaveText(
            '50%'
        );
        await pick( 'Zoom to 100%' );
        expect( ( await viewportOf( page ) ).zoom ).toBe( 1 );
        await expect( trigger.locator( '.wfd-header__zoom-value' ) ).toHaveText(
            '100%'
        );
        await pick( 'Zoom out' );
        const out = ( await viewportOf( page ) ).zoom;
        expect( out ).toBeLessThan( 1 );
        await pick( 'Zoom in' );
        expect( ( await viewportOf( page ) ).zoom ).toBeCloseTo( 1, 5 );

        await pick( 'Fit all' );
        const canvas = ( await page
            .locator( '[data-wfd-region="canvas"]' )
            .boundingBox() )!;
        const frames = page.locator(
            '[data-wfd-artboard] .wfd-artboard__frame'
        );
        for ( let i = 0; i < 9; i++ ) {
            const b = ( await frames.nth( i ).boundingBox() )!;
            expect( b.x ).toBeGreaterThanOrEqual( canvas.x );
            expect( b.y ).toBeGreaterThanOrEqual( canvas.y );
            expect( b.x + b.width ).toBeLessThanOrEqual(
                canvas.x + canvas.width
            );
            expect( b.y + b.height ).toBeLessThanOrEqual(
                canvas.y + canvas.height
            );
        }

        // Fit selection.
        await frames.first().click();
        await pick( 'Fit selection' );
        const selected = ( await page
            .locator( '.wfd-artboard.is-selected .wfd-artboard__frame' )
            .boundingBox() )!;
        // Fitted: as large as the canvas allows, and never above 100%.
        const fit = await viewportOf( page );
        expect(
            fit.zoom === 1 ||
                selected.height > canvas.height * 0.8 ||
                selected.width > canvas.width * 0.8
        ).toBe( true );
        expect( selected.x ).toBeGreaterThanOrEqual( canvas.x );
        expect( selected.x + selected.width ).toBeLessThanOrEqual(
            canvas.x + canvas.width
        );
        expect( selected.y ).toBeGreaterThanOrEqual( canvas.y );
        expect( selected.y + selected.height ).toBeLessThanOrEqual(
            canvas.y + canvas.height
        );
    } );

    // An iPad Air in landscape, with fingers only (D64). The touches are
    // Chromium's emulated ones.
    test.describe( 'by touch', () => {
        test.use( { hasTouch: true, viewport: { width: 1180, height: 820 } } );

        const shift = ( point: Point, dx: number, dy: number ) => ( {
            x: point.x + dx,
            y: point.y + dy,
        } );
        const positions = ( page: Page ) =>
            page
                .locator( '[data-wfd-artboard]' )
                .evaluateAll( ( els: HTMLElement[] ) =>
                    els.map( ( el ) => el.style.left + ',' + el.style.top )
                );
        const position = ( page: Page, id: string ) =>
            frameOf( page, id ).evaluate( ( el: HTMLElement ) => ( {
                left: parseFloat( el.style.left ),
                top: parseFloat( el.style.top ),
            } ) );
        // The browser's own zoom and scroll of the page.
        const pageView = ( page: Page ) =>
            page.evaluate( () => ( {
                scale: window.visualViewport!.scale,
                x: window.scrollX + window.visualViewport!.offsetLeft,
                y: window.scrollY + window.visualViewport!.offsetTop,
            } ) );
        const PAGE_AT_REST = { scale: 1, x: 0, y: 0 };
        // A point on the Index template and one on empty board just right
        // of it: a rectangle between them touches no other artboard.
        const besideIndex = async ( page: Page, id: string ) => {
            const box = ( await frameBox( frameOf( page, id ) ) )!;
            const onIndex = { x: box.x + box.width - 60, y: box.y + 160 };
            const onEmpty = { x: box.x + box.width + 15, y: box.y + 100 };
            expect(
                await page.evaluate(
                    ( { x, y } ) =>
                        document
                            .elementFromPoint( x, y )
                            ?.getAttribute( 'data-wfd-region' ),
                    onEmpty
                )
            ).toBe( 'canvas' );
            return { onIndex, onEmpty };
        };

        // Two fingers that start on an artboard, or on empty board, pan the
        // board by (dx, dy).
        const panWithTwo = async (
            page: Page,
            touch: Awaited< ReturnType< typeof fingers > >,
            id: string | null,
            dx: number,
            dy: number
        ) => {
            const [ a, b ] = await pointsOn( page, id );
            const before = await viewportOf( page );
            await touch.down( a );
            await touch.down( a, b );
            await touch.glide(
                [ a, b ],
                [ shift( a, dx, dy ), shift( b, dx, dy ) ]
            );
            await touch.up();
            await expect
                .poll( async () => ( await viewportOf( page ) ).x )
                .toBeCloseTo( before.x + dx, 0 );
            const after = await viewportOf( page );
            expect( after.y ).toBeCloseTo( before.y + dy, 0 );
            expect( after.zoom ).toBeCloseTo( before.zoom, 5 );
        };

        // Two fingers that start on an artboard, or on empty board, move
        // apart or together by a factor about the point midway between them.
        const pinchWithTwo = async (
            page: Page,
            touch: Awaited< ReturnType< typeof fingers > >,
            id: string | null,
            factor: number
        ) => {
            const box = ( await page
                .locator( '[data-wfd-region="canvas"]' )
                .boundingBox() )!;
            const [ a, b ] = await pointsOn( page, id );
            const middle = { x: ( a.x + b.x ) / 2, y: ( a.y + b.y ) / 2 };
            const scaled = ( point: Point ) => ( {
                x: middle.x + ( point.x - middle.x ) * factor,
                y: middle.y + ( point.y - middle.y ) * factor,
            } );
            const before = await viewportOf( page );
            const local = { x: middle.x - box.x, y: middle.y - box.y };
            const anchor = {
                x: ( local.x - before.x ) / before.zoom,
                y: ( local.y - before.y ) / before.zoom,
            };
            await touch.down( a );
            await touch.down( a, b );
            await touch.glide( [ a, b ], [ scaled( a ), scaled( b ) ] );
            await touch.up();
            await expect
                .poll( async () => ( await viewportOf( page ) ).zoom )
                .toBeCloseTo( before.zoom * factor, 3 );
            // The board point midway between the fingers has not moved.
            const after = await viewportOf( page );
            expect( anchor.x * after.zoom + after.x ).toBeCloseTo( local.x, 0 );
            expect( anchor.y * after.zoom + after.y ).toBeCloseTo( local.y, 0 );
        };

        test( 'AC-CANVAS-08 Two fingers pan the board and a pinch zooms it about the point between them, over empty board and over an artboard, and the page does not zoom or scroll', async ( {
            page,
        } ) => {
            const touch = await fingers( page );
            const index = fixture.layout.artboards[ 0 ];
            await setViewport( page, { x: 20, y: 20, zoom: 0.25 } );
            await expect( frameOf( page, index.id ) ).toHaveAttribute(
                'data-wfd-tier',
                'preview'
            );
            const before = await positions( page );

            // Over empty board.
            await panWithTwo( page, touch, null, 50, -30 );
            await pinchWithTwo( page, touch, null, 1.5 );
            await setViewport( page, { x: 20, y: 20, zoom: 0.25 } );

            // Over an artboard: the board moves, the artboard does not, and
            // nothing is selected.
            await panWithTwo( page, touch, index.id, 40, 30 );
            await pinchWithTwo( page, touch, index.id, 1.4 );
            await pinchWithTwo( page, touch, index.id, 0.8 );
            await expect( selectedArtboards( page ) ).toHaveCount( 0 );
            expect( await positions( page ) ).toEqual( before );

            // A pinch stops at the lowest zoom.
            await setViewport( page, { x: 20, y: 20, zoom: 0.25 } );
            const [ a, b ] = await pointsOn( page, null );
            const middle = { x: ( a.x + b.x ) / 2, y: ( a.y + b.y ) / 2 };
            const near = ( point: Point ) => ( {
                x: middle.x + ( point.x - middle.x ) / 25,
                y: middle.y + ( point.y - middle.y ) / 25,
            } );
            await touch.down( a );
            await touch.down( a, b );
            await touch.glide( [ a, b ], [ near( a ), near( b ) ], 10 );
            await touch.up();
            await expect
                .poll( async () => ( await viewportOf( page ) ).zoom )
                .toBeCloseTo( 0.02, 5 );

            expect( await pageView( page ) ).toEqual( PAGE_AT_REST );
        } );

        test( 'AC-CANVAS-09 Two fingers inside the artboard in edit pan and pinch the board, and it stays in edit; so it does when they start on empty board or on another artboard', async ( {
            page,
        } ) => {
            const touch = await fingers( page );
            const hero = artboardOf( fixture, 'pattern' );
            const sign = artboardOf( fixture, 'pattern', 'desktop', 1 );
            const home = {
                x: 20 - hero.x * 0.4,
                y: 150 - hero.y * 0.4,
                zoom: 0.4,
            };
            await setViewport( page, home );
            await enterEdit( page, hero.id );
            await editorFrame( page, hero.id ).locator( 'h2' ).waitFor();
            const live = frameOf( page, hero.id );

            // Inside the Live artboard's own document.
            await panWithTwo( page, touch, hero.id, 30, 20 );
            await expect( live ).toHaveAttribute( 'data-wfd-tier', 'live' );
            await pinchWithTwo( page, touch, hero.id, 1.25 );
            await expect( live ).toHaveAttribute( 'data-wfd-tier', 'live' );

            // Starting on empty board.
            await setViewport( page, home );
            await panWithTwo( page, touch, null, -30, 20 );
            await expect( live ).toHaveAttribute( 'data-wfd-tier', 'live' );

            // Starting on another artboard.
            await setViewport( page, home );
            await panWithTwo( page, touch, sign.id, 30, -20 );
            await expect( live ).toHaveAttribute( 'data-wfd-tier', 'live' );
            await expect( frameOf( page, sign.id ) ).not.toHaveClass(
                /is-selected/
            );

            expect( await pageView( page ) ).toEqual( PAGE_AT_REST );
        } );

        test( 'AC-CANVAS-10 One finger: a tap selects and a tap on empty board clears, a drag moves an artboard or draws the selection rectangle, a double tap edits', async ( {
            page,
        } ) => {
            const touch = await fingers( page );
            const index = fixture.layout.artboards[ 0 ];
            const hero = artboardOf( fixture, 'pattern' );
            await setViewport( page, { x: 20, y: 20, zoom: 0.25 } );

            // Tap.
            const onHero = await pointOn( page, hero.id );
            const { onIndex, onEmpty } = await besideIndex( page, index.id );
            await touch.tap( onHero );
            await expect
                .poll( () => selectedIds( page ) )
                .toEqual( [ hero.id ] );
            // Too far from the last tap to be a double tap with it.
            expect(
                Math.hypot( onIndex.x - onHero.x, onIndex.y - onHero.y )
            ).toBeGreaterThan( 30 );
            await touch.tap( onIndex );
            await expect
                .poll( () => selectedIds( page ) )
                .toEqual( [ index.id ] );
            await touch.tap( onEmpty );
            await expect( selectedArtboards( page ) ).toHaveCount( 0 );

            // Drag an artboard by 60 x 40 screen pixels.
            const { zoom } = await viewportOf( page );
            const before = await position( page, hero.id );
            await touch.down( onHero );
            await touch.glide( [ onHero ], [ shift( onHero, 60, 40 ) ] );
            await touch.up();
            const after = await position( page, hero.id );
            expect( after.left ).toBeCloseTo( before.left + 60 / zoom, -1 );
            expect( after.top ).toBeCloseTo( before.top + 40 / zoom, -1 );
            await expect
                .poll( () => selectedIds( page ) )
                .toEqual( [ hero.id ] );
            const undo = page.locator( '[data-wfd-control="H3"]' );
            await expect( undo ).toBeEnabled();
            await undo.click();
            await expect
                .poll( async () => ( await position( page, hero.id ) ).left )
                .toBe( before.left );

            // Drag from empty board onto the Index template.
            const marquee = page.locator( '[data-wfd-marquee]' );
            await touch.down( onEmpty );
            await touch.glide( [ onEmpty ], [ onIndex ] );
            await expect( marquee ).toBeVisible();
            await expect
                .poll( () => selectedIds( page ) )
                .toEqual( [ index.id ] );
            await touch.up();
            await expect( marquee ).toBeHidden();
            await expect
                .poll( () => selectedIds( page ) )
                .toEqual( [ index.id ] );

            // Double tap.
            await touch.tap( onHero );
            await touch.tap( onHero );
            await expect( frameOf( page, hero.id ) ).toHaveAttribute(
                'data-wfd-tier',
                'live'
            );
        } );

        test( 'AC-CANVAS-11 A second finger undoes a one-finger drag of an artboard or of the selection rectangle, and the two fingers then pan', async ( {
            page,
        } ) => {
            const touch = await fingers( page );
            const index = fixture.layout.artboards[ 0 ];
            const hero = artboardOf( fixture, 'pattern' );
            await setViewport( page, { x: 20, y: 20, zoom: 0.25 } );
            const undo = page.locator( '[data-wfd-control="H3"]' );
            const onHero = await pointOn( page, hero.id );
            const { onIndex, onEmpty } = await besideIndex( page, index.id );

            // One finger drags the artboard, then a second one lands.
            const before = await position( page, hero.id );
            let dragged = shift( onHero, 40, 30 );
            await touch.down( onHero );
            await touch.glide( [ onHero ], [ dragged ] );
            await expect
                .poll( async () => ( await position( page, hero.id ) ).left )
                .toBeGreaterThan( before.left );
            let view = await viewportOf( page );
            await touch.down( dragged, onEmpty );
            await expect
                .poll( () => position( page, hero.id ) )
                .toEqual( before );
            await touch.glide(
                [ dragged, onEmpty ],
                [ shift( dragged, 30, 20 ), shift( onEmpty, 30, 20 ) ]
            );
            await touch.up();
            await expect
                .poll( async () => ( await viewportOf( page ) ).x )
                .toBeCloseTo( view.x + 30, 0 );
            expect( ( await viewportOf( page ) ).y ).toBeCloseTo(
                view.y + 20,
                0
            );
            // Nothing was moved or selected.
            expect( await position( page, hero.id ) ).toEqual( before );
            await expect( selectedArtboards( page ) ).toHaveCount( 0 );
            await expect( undo ).toBeDisabled();

            // One finger draws the rectangle, then a second one lands.
            await setViewport( page, { x: 20, y: 20, zoom: 0.25 } );
            await touch.tap( onHero );
            await expect
                .poll( () => selectedIds( page ) )
                .toEqual( [ hero.id ] );
            const marquee = page.locator( '[data-wfd-marquee]' );
            await touch.down( onEmpty );
            await touch.glide( [ onEmpty ], [ onIndex ] );
            await expect( marquee ).toBeVisible();
            await expect
                .poll( () => selectedIds( page ) )
                .toEqual( [ index.id ] );
            dragged = onIndex;
            view = await viewportOf( page );
            await touch.down( dragged, onHero );
            await expect( marquee ).toBeHidden();
            await expect
                .poll( () => selectedIds( page ) )
                .toEqual( [ hero.id ] );
            await touch.glide(
                [ dragged, onHero ],
                [ shift( dragged, -30, 20 ), shift( onHero, -30, 20 ) ]
            );
            await touch.up();
            await expect
                .poll( async () => ( await viewportOf( page ) ).x )
                .toBeCloseTo( view.x - 30, 0 );
            await expect
                .poll( () => selectedIds( page ) )
                .toEqual( [ hero.id ] );
            await expect( marquee ).toBeHidden();
        } );
    } );
} );
