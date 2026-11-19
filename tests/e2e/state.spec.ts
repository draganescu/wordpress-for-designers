import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import {
    resetFixture,
    openBoard,
    boardUrl,
    artboardOf,
    setViewport,
    BOARDS_URL,
} from './utils';

test.describe( 'STATE', () => {
    test( 'AC-STATE-01 A board with no artboards shows the empty state and its button opens the Add artboard menu', async ( {
        page,
        requestUtils,
    } ) => {
        await resetFixture( requestUtils, { seed: false } );
        const board = await requestUtils.rest< { id: number } >( {
            method: 'POST',
            path: '/wp/v2/wfd-boards',
            data: { title: 'Empty one', status: 'publish' },
        } );
        await openBoard( page, board.id, 0 );
        const canvas = page.locator( '[data-wfd-region="canvas"]' );
        await expect( canvas ).toContainText( 'This board has no artboards' );
        await expect( canvas ).toContainText(
            'Add a page, template, template part or pattern to start designing.'
        );
        const left = page.locator( '[data-wfd-region="left"]' );
        await expect(
            left.getByRole( 'heading', { name: 'Artboards' } )
        ).toBeVisible();
        await expect( left ).toContainText( 'No artboards yet.' );
        await expect( left.locator( '[data-wfd-group]' ) ).toHaveCount( 0 );
        await expect(
            page.locator( '[data-wfd-control="H9"]' )
        ).toBeDisabled();
        await expect(
            page
                .locator( '[data-wfd-region="right"]' )
                .getByRole( 'heading', { name: 'Styles' } )
        ).toBeVisible();

        await canvas.getByRole( 'button', { name: 'Add artboard' } ).click();
        const items = page.getByRole( 'menu' ).first().getByRole( 'menuitem' );
        await expect( items ).toHaveCount( 4 );
        await expect( items.nth( 0 ) ).toContainText( 'Page' );
        await expect( items.nth( 3 ) ).toContainText( 'Pattern' );
        // Placing from it works and the empty state goes away.
        await items.nth( 3 ).click();
        const box = ( await canvas.boundingBox() )!;
        await page.mouse.move( box.x + 180, box.y + 180 );
        await page.mouse.move( box.x + 200, box.y + 200, { steps: 2 } );
        await page.mouse.down();
        await page.mouse.up();
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 1 );
        await expect( canvas ).not.toContainText(
            'This board has no artboards'
        );
    } );

    test( 'AC-STATE-02 An inserter search with no match shows the "No results" state', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        await page
            .locator( '[data-wfd-region="header"]' )
            .getByRole( 'button', { name: 'Block inserter', exact: true } )
            .click();
        const panel = page.locator( '.wfd-inserter' );
        await panel.getByRole( 'searchbox' ).fill( 'zzqqxx' );
        await expect( panel ).toContainText( 'No results' );
        await expect( panel ).toContainText(
            'Nothing in blocks, patterns, templates or media matches "zzqqxx".'
        );
        await expect( panel.locator( '.wfd-row' ) ).toHaveCount( 0 );
        // Nothing is in edit, so there is no Blocks tab.
        await expect( panel.getByRole( 'tab' ) ).toHaveCount( 3 );
        // A query that matches in another tab is not "no results".
        await panel.getByRole( 'searchbox' ).fill( 'Sign-off' );
        await expect( panel ).not.toContainText( 'No results' );
    } );

    test( 'AC-STATE-03 Review with no changes shows its empty state', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        // Reach it by discarding the only change while the drawer is open.
        const menu = page
            .locator( '[data-wfd-region="right"]' )
            .getByRole( 'button', { name: /^Variation:/ } );
        await menu.click();
        await page.getByRole( 'menuitemradio', { name: 'Evening' } ).click();
        await page.locator( '[data-wfd-control="H9"]' ).click();
        const drawer = page.getByRole( 'dialog', { name: 'Review changes' } );
        await drawer.getByRole( 'button', { name: 'Discard all' } ).click();
        await page
            .getByRole( 'alertdialog' )
            .getByRole( 'button', { name: 'Discard' } )
            .click();
        await expect( drawer ).toContainText( 'No changes to review' );
        await expect( drawer ).toContainText(
            'Edits to pages, templates, parts, patterns and styles appear here before they reach the site.'
        );
        await expect(
            drawer.getByRole( 'button', { name: /Save|Retry/ } )
        ).toHaveCount( 0 );
        await expect(
            drawer.getByRole( 'button', { name: 'Discard all' } )
        ).toHaveCount( 0 );
        await expect(
            drawer.getByRole( 'button', { name: 'Keep editing' } )
        ).toHaveCount( 0 );
        await expect( drawer.getByRole( 'checkbox' ) ).toHaveCount( 0 );
    } );

    test( 'AC-STATE-04 The Boards screen with no boards shows its empty state', async ( {
        page,
        requestUtils,
    } ) => {
        await resetFixture( requestUtils, { seed: false } );
        await page.goto( BOARDS_URL );
        await expect(
            page.getByRole( 'heading', { name: 'Boards', level: 1 } )
        ).toBeVisible();
        await expect(
            page.getByText( 'No boards yet', { exact: true } )
        ).toBeVisible();
        await expect(
            page.getByText(
                "A board is a canvas where you lay out this site's pages, templates, parts and patterns side by side."
            )
        ).toBeVisible();
        await page
            .locator( '.wfd-boards__empty' )
            .getByRole( 'button', { name: 'Add board' } )
            .click();
        await page.waitForURL( /page=wfd-board&board=\d+/ );
    } );

    test( 'AC-STATE-05 An artboard whose entity request fails shows the error state; Retry loads it once the request succeeds', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        const hero = artboardOf( fixture, 'pattern' );
        const failing = ( route: any ) =>
            route.fulfill( {
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify( {
                    code: 'broken',
                    message: 'Broken',
                    data: { status: 500 },
                } ),
            } );
        // Both the request for the pattern and the list that would carry it.
        const pattern = new RegExp(
            `/wp/v2/blocks(/${ fixture.patterns.hero })?\\?`
        );
        await page.route( pattern, failing );
        await page.goto( boardUrl( fixture.boardId ) );
        const artboard = page.locator( `[data-wfd-artboard="${ hero.id }"]` );
        await expect( artboard ).toContainText( "Couldn't load this pattern." );
        await expect( artboard ).toContainText(
            'Check your connection and try again.'
        );
        const retry = artboard.getByRole( 'button', { name: 'Retry' } );
        await expect( retry ).toBeVisible();
        // The others load, and the failed one keeps its place on the board.
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 9 );
        await expect( page.locator( '.wfd-artboard__error' ) ).toHaveCount( 1 );
        // At least 170 px high on screen.
        const box = ( await artboard
            .locator( '.wfd-artboard__frame' )
            .boundingBox() )!;
        expect( box.height ).toBeGreaterThanOrEqual( 169 );

        // Still failing: Retry keeps the error state.
        await retry.click();
        await expect( artboard ).toContainText( "Couldn't load this pattern." );

        await page.unroute( pattern, failing );
        await artboard.getByRole( 'button', { name: 'Retry' } ).click();
        await expect( page.locator( '.wfd-artboard__error' ) ).toHaveCount( 0 );
        await expect( artboard.locator( '.wfd-artboard__label' ) ).toHaveText(
            'Hero · Pattern · Desktop'
        );
        await setViewport( page, { x: -300, y: -120, zoom: 0.25 } );
        await expect(
            artboard
                .frameLocator( 'iframe' )
                .locator( 'p', { hasText: 'Hero paragraph.' } )
        ).toBeAttached();
    } );

    test( 'AC-STATE-06 An artboard whose entity no longer exists is removed from the board on load', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        const hero = artboardOf( fixture, 'pattern' );
        const about = artboardOf( fixture, 'page' );
        // The pattern is deleted for good; the page is in the trash.
        await requestUtils.rest( {
            method: 'DELETE',
            path: `/wp/v2/blocks/${ fixture.patterns.hero }`,
            params: { force: true },
        } );
        await requestUtils.rest( {
            method: 'DELETE',
            path: `/wp/v2/pages/${ fixture.pages.about }`,
        } );
        const errors: string[] = [];
        page.on( 'pageerror', ( error ) => errors.push( error.message ) );
        await page.goto( boardUrl( fixture.boardId ) );
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 7 );
        await expect(
            page.locator( `[data-wfd-artboard="${ hero.id }"]` )
        ).toHaveCount( 0 );
        await expect(
            page.locator( `[data-wfd-artboard="${ about.id }"]` )
        ).toHaveCount( 0 );
        await expect( page.locator( '.wfd-artboard__error' ) ).toHaveCount( 0 );
        const left = page.locator( '[data-wfd-region="left"]' );
        await expect(
            left.locator( '[data-wfd-group="pattern"] [data-wfd-row]' )
        ).toHaveCount( 1 );
        await expect(
            left.locator( '[data-wfd-group="page"] [data-wfd-row]' )
        ).toHaveCount( 1 );
        expect( errors ).toEqual( [] );
        // The board's saved layout no longer has them.
        await page.waitForTimeout( 2600 );
        const board = await requestUtils.rest< {
            layout: { artboards: { id: string }[] };
        } >( {
            path: `/wp/v2/wfd-boards/${ fixture.boardId }`,
            params: { context: 'edit' },
        } );
        const ids = board.layout.artboards.map( ( a ) => a.id );
        expect( ids ).toHaveLength( 7 );
        expect( ids ).not.toContain( hero.id );
        expect( ids ).not.toContain( about.id );
    } );
} );
