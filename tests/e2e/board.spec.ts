import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import { resetFixture, openBoard, viewportOf, BOARDS_URL } from './utils';

test.describe( 'BOARD', () => {
    test( 'AC-BOARD-01 Add board creates Untitled board and opens the app without wp-admin chrome', async ( {
        page,
        requestUtils,
    } ) => {
        await resetFixture( requestUtils, { seed: false } );
        await page.goto( '/wp-admin/index.php' );
        const menu = page.locator( '#toplevel_page_wfd-boards' );
        await menu.locator( 'a.menu-top' ).click();
        await menu.getByRole( 'link', { name: 'Add board' } ).click();
        await page.waitForURL( /page=wfd-board&board=\d+/ );
        await expect( page.locator( '#wfd-board-root' ) ).toBeAttached();
        await expect( page.locator( '#adminmenu' ) ).toHaveCount( 0 );
        await expect( page.locator( '#wpadminbar' ) ).toHaveCount( 0 );

        const id = Number( new URL( page.url() ).searchParams.get( 'board' ) );
        const board = await requestUtils.rest< {
            title: { raw: string };
            status: string;
            layout: unknown;
        } >( {
            path: `/wp/v2/wfd-boards/${ id }`,
            params: { context: 'edit' },
        } );
        expect( board.title.raw ).toBe( 'Untitled board' );
        expect( board.status ).toBe( 'publish' );
        expect( board.layout ).toEqual( { version: 1, artboards: [] } );
    } );

    test( 'AC-BOARD-02 The Boards screen lists boards with count and edited time, and search filters', async ( {
        page,
        requestUtils,
    } ) => {
        await resetFixture( requestUtils );
        await requestUtils.rest( {
            method: 'POST',
            path: '/wp/v2/wfd-boards',
            data: { title: 'Membership pages', status: 'publish' },
        } );
        await page.goto( BOARDS_URL );
        await expect(
            page.getByRole( 'heading', { name: 'Boards', level: 1 } )
        ).toBeVisible();
        await expect(
            page.getByText( /^9 artboards · edited .+/ )
        ).toBeVisible();
        await expect(
            page.getByText( /^0 artboards · edited .+/ )
        ).toBeVisible();

        const search = page.getByRole( 'searchbox', {
            name: 'Search boards',
        } );
        await search.fill( 'Member' );
        await expect(
            page.getByRole( 'link', { name: 'Membership pages' } ).first()
        ).toBeVisible();
        await expect(
            page.getByRole( 'link', { name: 'Fixture board' } )
        ).toHaveCount( 0 );
    } );

    test( 'AC-BOARD-03 A layout with an unknown field or a wrong type is rejected with 400', async ( {
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        const artboard = fixture.layout.artboards[ 0 ];
        const save = async ( layout: unknown ) => {
            try {
                await requestUtils.rest( {
                    method: 'POST',
                    path: `/wp/v2/wfd-boards/${ fixture.boardId }`,
                    data: { layout },
                } );
                return 200;
            } catch ( error ) {
                return ( error as { data?: { status?: number } } ).data?.status;
            }
        };
        const bad = [
            { version: 1, artboards: [], extra: true },
            { version: 1, artboards: [ { ...artboard, note: 'x' } ] },
            { version: 1, artboards: [ { ...artboard, x: '10' } ] },
            { version: 2, artboards: [] },
            { version: 1, artboards: [ { ...artboard, device: 'watch' } ] },
            { version: 1, artboards: [ { ...artboard, kind: 'page' } ] },
            {
                version: 1,
                artboards: [
                    { ...artboard, content: '<!-- wp:paragraph -->' },
                ],
            },
        ];
        for ( const layout of bad ) {
            expect( await save( layout ) ).toBe( 400 );
        }
        expect( await save( { version: 1, artboards: [ artboard ] } ) ).toBe(
            200
        );
        const board = await requestUtils.rest< {
            layout: { artboards: unknown[] };
        } >( {
            path: `/wp/v2/wfd-boards/${ fixture.boardId }`,
            params: { context: 'edit' },
        } );
        expect( board.layout.artboards ).toEqual( [ artboard ] );
    } );

    test( 'AC-BOARD-04 Rename and Move to trash on a board card work; a trashed board leaves the list', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await page.goto( BOARDS_URL );
        await page.getByRole( 'button', { name: 'Actions' } ).first().click();
        await page.getByRole( 'menuitem', { name: 'Rename' } ).click();
        await page.getByRole( 'textbox' ).fill( 'Renamed board' );
        await page.getByRole( 'button', { name: 'Save' } ).click();
        await expect(
            page.getByRole( 'link', { name: 'Renamed board' } ).first()
        ).toBeVisible();
        await page.getByRole( 'button', { name: 'Actions' } ).first().click();
        await page.getByRole( 'menuitem', { name: 'Move to trash' } ).click();
        await expect(
            page.getByRole( 'link', { name: 'Renamed board' } )
        ).toHaveCount( 0 );
        const board = await requestUtils.rest< { status: string } >( {
            path: `/wp/v2/wfd-boards/${ fixture.boardId }`,
            params: { context: 'edit' },
        } );
        expect( board.status ).toBe( 'trash' );
    } );

    test( 'AC-BOARD-05 Moving an artboard persists after 3 seconds and nothing appears in Review', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        const target = fixture.layout.artboards[ 3 ];
        const artboard = page.locator( `[data-wfd-artboard="${ target.id }"]` );
        await artboard.locator( '.wfd-artboard__frame' ).click();
        await page.locator( '[data-wfd-region="canvas"]' ).focus();
        await page.keyboard.press( 'Shift+ArrowRight' );
        await page.keyboard.press( 'Shift+ArrowDown' );
        await expect(
            page.getByRole( 'button', { name: 'Review changes' } )
        ).toBeDisabled();
        await page.waitForTimeout( 3000 );

        const saved = await requestUtils.rest< {
            layout: { artboards: { id: string; x: number; y: number }[] };
        } >( {
            path: `/wp/v2/wfd-boards/${ fixture.boardId }`,
            params: { context: 'edit' },
        } );
        const stored = saved.layout.artboards.find(
            ( a ) => a.id === target.id
        )!;
        expect( [ stored.x, stored.y ] ).toEqual( [
            target.x + 10,
            target.y + 10,
        ] );

        await page.reload();
        await expect( artboard ).toHaveCSS( 'left', `${ target.x + 10 }px` );
        await expect( artboard ).toHaveCSS( 'top', `${ target.y + 10 }px` );
        await expect(
            page.getByRole( 'button', { name: 'Review changes' } )
        ).toBeDisabled();
    } );

    test( 'AC-BOARD-06 Reopening restores the last pan and zoom; a board never opened opens fitted to all artboards', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        // Never opened by this browser: fitted to all artboards.
        const canvas = page.locator( '[data-wfd-region="canvas"]' );
        const box = ( await canvas.boundingBox() )!;
        const frames = page.locator(
            '[data-wfd-artboard] .wfd-artboard__frame'
        );
        for ( let i = 0; i < 9; i++ ) {
            const b = ( await frames.nth( i ).boundingBox() )!;
            expect( b.x ).toBeGreaterThanOrEqual( box.x );
            expect( b.x + b.width ).toBeLessThanOrEqual( box.x + box.width );
            expect( b.y ).toBeGreaterThanOrEqual( box.y );
            expect( b.y + b.height ).toBeLessThanOrEqual( box.y + box.height );
        }
        const fitted = await viewportOf( page );

        // Zoom and pan, then come back.
        await page.mouse.move( box.x + 400, box.y + 300 );
        await page.keyboard.down( 'Control' );
        await page.mouse.wheel( 0, -80 );
        await page.keyboard.up( 'Control' );
        await page.mouse.wheel( 37, 21 );
        await expect
            .poll( async () => ( await viewportOf( page ) ).zoom )
            .toBeGreaterThan( fitted.zoom );
        await page.waitForTimeout( 400 );
        const left = await viewportOf( page );
        await page.goto( BOARDS_URL );
        await openBoard( page, fixture.boardId );
        const restored = await viewportOf( page );
        expect( restored.zoom ).toBeCloseTo( left.zoom, 5 );
        expect( restored.x ).toBeCloseTo( left.x, 2 );
        expect( restored.y ).toBeCloseTo( left.y, 2 );
        await expect(
            page.locator( '[data-wfd-control="H8"] .wfd-header__zoom-value' )
        ).toHaveText( `${ Math.round( left.zoom * 100 ) }%` );
    } );
} );
