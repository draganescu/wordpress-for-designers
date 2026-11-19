import type { Page } from '@playwright/test';
import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import {
    resetFixture,
    openBoard,
    setViewport,
    enterEdit,
    editorFrame,
    artboardOf,
    type Fixture,
} from './utils';

const BROWSER_ID = '11111111-2222-4333-8444-777777777777';
const SAVED_ID = '11111111-2222-4333-8444-888888888888';

type Browser = {
    id: string;
    kind: 'browser';
    path: string;
    device: string;
    x: number;
    y: number;
    height: number;
    shows: 'unsaved' | 'saved';
};

// Left of everything in the fixture.
const AT = { x: -2000, y: 800 };

test.describe( 'BROWSER', () => {
    let fixture: Fixture;
    test.beforeEach( async ( { requestUtils } ) => {
        fixture = await resetFixture( requestUtils );
    } );

    const saveLayout = async ( requestUtils: any, layout: unknown ) => {
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

    const savedBrowsers = async ( requestUtils: any ) =>
        (
            await requestUtils.rest( {
                path: `/wp/v2/wfd-boards/${ fixture.boardId }`,
                params: { context: 'edit' },
            } )
        ).layout.artboards.filter(
            ( a: { kind: string } ) => a.kind === 'browser'
        ) as Browser[];

    const seedBrowser = (
        requestUtils: any,
        browser: Partial< Browser > = {}
    ) =>
        saveLayout( requestUtils, {
            version: 1,
            artboards: [
                ...fixture.layout.artboards,
                {
                    id: BROWSER_ID,
                    kind: 'browser',
                    path: '/',
                    device: 'desktop',
                    height: 900,
                    shows: 'saved',
                    ...AT,
                    ...browser,
                },
            ],
        } );

    // The browser at 50%, its corner 100 by 100 pixels into the canvas area.
    const showBrowser = ( page: Page, at = AT ) =>
        setViewport( page, {
            x: 100 - at.x * 0.5,
            y: 100 - at.y * 0.5,
            zoom: 0.5,
        } );

    const browser = ( page: Page, id = BROWSER_ID ) =>
        page.locator( `[data-wfd-artboard="${ id }"]` );
    const page$ = ( page: Page, id = BROWSER_ID ) =>
        page.frameLocator( `[data-wfd-artboard="${ id }"] iframe.wfd-browser` );
    const canvasBox = async ( page: Page ) =>
        ( await page.locator( '[data-wfd-region="canvas"]' ).boundingBox() )!;
    const address = ( page: Page ) =>
        page.getByRole( 'textbox', { name: 'Address' } );
    // The address the window's page is on, or null before it is mounted.
    const pageUrl = ( page: Page, id = BROWSER_ID ) =>
        page.evaluate(
            ( selector ) =>
                (
                    document.querySelector(
                        selector
                    ) as HTMLIFrameElement | null
                 )?.contentWindow?.location.href ?? null,
            `[data-wfd-artboard="${ id }"] iframe.wfd-browser`
        );

    test( 'AC-BROWSER-01 "Browser" in the Add artboard menu arms placement; a click on the board places a Desktop browser there showing the homepage, labelled "/ · Browser · Desktop", selected and not browsing, with a window 900 board units tall, listed under "Browsers" in the left panel; after a reload it is still there', async ( {
        page,
        requestUtils,
    } ) => {
        await openBoard( page, fixture.boardId );
        await showBrowser( page );
        const box = await canvasBox( page );
        await page.locator( '[data-wfd-control="L2"]' ).click();
        await page.getByRole( 'menuitem', { name: /^Browser/ } ).click();
        await page.mouse.move( box.x + 100, box.y + 100 );
        await page.mouse.move( box.x + 120, box.y + 120, { steps: 2 } );
        await expect( page.locator( '[data-wfd-placement]' ) ).toContainText(
            '/ · Browser · Desktop'
        );
        await page.mouse.down();
        await page.mouse.up();

        const placed = page.locator( '[data-wfd-kind="browser"]' );
        await expect( placed ).toHaveCount( 1 );
        await expect( placed ).toHaveAttribute( 'data-wfd-device', 'desktop' );
        await expect( placed ).toHaveClass( /is-selected/ );
        await expect( placed ).not.toHaveAttribute( 'data-wfd-tier', 'live' );
        await expect( placed.locator( '.wfd-artboard__label' ) ).toHaveText(
            '/ · Browser · Desktop'
        );
        // 900 board units tall at 50%.
        const frame = ( await placed
            .locator( '.wfd-artboard__frame' )
            .boundingBox() )!;
        expect( frame.height ).toBeCloseTo( 450, 0 );
        expect( frame.x ).toBeCloseTo( box.x + 120, -1 );
        // The homepage.
        const id = ( await placed.getAttribute( 'data-wfd-artboard' ) )!;
        await expect
            .poll( () => pageUrl( page, id ) )
            .toMatch( /^https?:\/\/[^/]+\/\?wfd_preview=[\w.-]+$/ );
        await expect( page$( page, id ).locator( 'body' ) ).toBeVisible();
        // WordPress's toolbar is not shown.
        await expect( page$( page, id ).locator( '#wpadminbar' ) ).toBeHidden();
        const left = page.locator( '[data-wfd-region="left"]' );
        await expect( left ).toContainText( 'Browsers' );
        await expect( left.getByText( '/', { exact: true } ) ).toBeVisible();

        // Saved with the layout.
        await expect
            .poll( async () => ( await savedBrowsers( requestUtils ) ).length, {
                timeout: 6000,
            } )
            .toBe( 1 );
        await page.reload();
        await expect( page.locator( '[data-wfd-kind="browser"]' ) ).toHaveCount(
            1
        );
    } );

    test( "AC-BROWSER-02 Outside browsing, a click on a browser's page selects the browser and follows no link, and a drag moves it; Delete opens the remove dialog with no checkbox and Remove takes it off the board", async ( {
        page,
        requestUtils,
    } ) => {
        await seedBrowser( requestUtils );
        await openBoard( page, fixture.boardId, 10 );
        await showBrowser( page );
        await page$( page ).locator( 'body' ).waitFor();
        const before = await pageUrl( page );
        const frame = ( await browser( page )
            .locator( '.wfd-artboard__frame' )
            .boundingBox() )!;
        // The site title in the page's header is a link.
        const link = ( await page$( page )
            .locator( 'header a, .wp-block-site-title a' )
            .first()
            .boundingBox() )!;
        await page.mouse.click( link.x + 4, link.y + link.height / 2 );
        await expect( browser( page ) ).toHaveClass( /is-selected/ );
        await expect( browser( page ) ).not.toHaveAttribute(
            'data-wfd-tier',
            'live'
        );
        await page.waitForTimeout( 500 );
        expect( await pageUrl( page ) ).toBe( before );

        // A drag moves it, by 100 board units at 50%.
        const from = { x: frame.x + 200, y: frame.y + 200 };
        await page.mouse.move( from.x, from.y );
        await page.mouse.down();
        await page.mouse.move( from.x + 5, from.y + 5, { steps: 2 } );
        await page.mouse.move( from.x + 50, from.y + 50, { steps: 6 } );
        await page.mouse.up();
        await expect
            .poll( async () => ( await savedBrowsers( requestUtils ) )[ 0 ], {
                timeout: 6000,
            } )
            .toMatchObject( { x: AT.x + 100, y: AT.y + 100 } );

        await page.keyboard.press( 'Delete' );
        const dialog = page.getByRole( 'alertdialog' );
        await expect( dialog ).toBeVisible();
        await expect( dialog.getByRole( 'checkbox' ) ).toHaveCount( 0 );
        await dialog.getByRole( 'button', { name: /Remove/ } ).click();
        await expect( browser( page ) ).toHaveCount( 0 );
    } );

    test( 'AC-BROWSER-03 Double-click starts browsing: following a link in the page changes the address field and the document bar; typing an address of the site and pressing Enter goes there; Esc pressed inside the page ends browsing with the browser selected; after a reload of the board the browser shows the last address', async ( {
        page,
        requestUtils,
    } ) => {
        // The About page's own address, as the site links it.
        const link = (
            await requestUtils.rest( {
                path: `/wp/v2/pages/${ fixture.pages.about }`,
            } )
        ).link as string;
        const home = new URL( '/', link ).href;
        const aboutPath = '/' + link.slice( home.length );
        await seedBrowser( requestUtils, { path: aboutPath } );
        await openBoard( page, fixture.boardId, 10 );
        await showBrowser( page );
        await page$( page ).locator( 'body' ).waitFor();
        const frame = ( await browser( page )
            .locator( '.wfd-artboard__frame' )
            .boundingBox() )!;
        await page.mouse.dblclick( frame.x + 200, frame.y + 200 );
        await expect( browser( page ) ).toHaveAttribute(
            'data-wfd-tier',
            'live'
        );
        await expect( address( page ) ).toHaveValue( aboutPath );
        const bar = page.locator( '[data-wfd-region="header"]' );
        await expect( bar ).toContainText( `${ aboutPath } · Browser` );

        // A link: the site title leads home.
        await page$( page ).locator( '.wp-block-site-title a' ).first().click();
        await expect( address( page ) ).toHaveValue( '/' );
        await expect( bar ).toContainText( '/ · Browser' );

        // A typed address, without its leading slash.
        await address( page ).fill( aboutPath.slice( 1 ) );
        await address( page ).press( 'Enter' );
        await expect.poll( () => pageUrl( page ) ).toBe( link );
        await expect( address( page ) ).toHaveValue( aboutPath );
        await expect(
            page$( page ).locator( 'h2', { hasText: 'About' } )
        ).toBeVisible();

        // Esc inside the page.
        await page$( page ).locator( 'body' ).click();
        await page.keyboard.press( 'Escape' );
        await expect( browser( page ) ).not.toHaveAttribute(
            'data-wfd-tier',
            'live'
        );
        await expect( browser( page ) ).toHaveClass( /is-selected/ );

        await expect
            .poll(
                async () => ( await savedBrowsers( requestUtils ) )[ 0 ]?.path,
                {
                    timeout: 6000,
                }
            )
            .toBe( aboutPath );
        await page.reload();
        await page$( page ).locator( 'body' ).waitFor();
        await expect.poll( () => pageUrl( page ) ).toBe( link );
    } );

    test( 'AC-BROWSER-04 A change to a page made in an artboard is not shown in a browser on that page set to "Saved site" until it is saved from Review; after the save the browser shows it without Reload being pressed', async ( {
        page,
        requestUtils,
    } ) => {
        const about = artboardOf( fixture, 'page' );
        // Left of the About artboard.
        const at = { x: about.x - 1600, y: about.y };
        await seedBrowser( requestUtils, {
            path: `/?page_id=${ fixture.pages.about }`,
            ...at,
        } );
        await openBoard( page, fixture.boardId, 10 );
        // Both in view at 30%, the lowest zoom for editing.
        await setViewport( page, {
            x: 60 - at.x * 0.3,
            y: 100 - at.y * 0.3,
            zoom: 0.3,
        } );
        const shown = page$( page ).locator( 'p', {
            hasText: 'About paragraph.',
        } );
        await expect( shown ).toHaveText( 'About paragraph.' );

        await enterEdit( page, about.id );
        await editorFrame( page, about.id )
            .locator( 'p', { hasText: 'About paragraph.' } )
            .first()
            .click();
        await page.keyboard.press( 'End' );
        await page.keyboard.type( ' Updated' );
        await page.getByRole( 'button', { name: 'Back to the board' } ).click();
        await page.waitForTimeout( 500 );
        await expect( shown ).toHaveText( 'About paragraph.' );

        await page.locator( '[data-wfd-control="H9"]' ).click();
        const drawer = page.getByRole( 'dialog', { name: 'Review changes' } );
        await drawer.getByRole( 'button', { name: 'Save 1 change' } ).click();
        await expect(
            page$( page ).locator( 'p', {
                hasText: 'About paragraph. Updated',
            } )
        ).toBeVisible();
    } );

    test( 'AC-BROWSER-05 The server accepts a browser with exactly its fields and rejects one with an `entityId`, one without a `path`, one whose `path` does not start with "/", one without a `height`, one whose `height` is below 200 and one whose `shows` is not "unsaved" or "saved"', async ( {
        requestUtils,
    } ) => {
        expect( await seedBrowser( requestUtils ) ).toBe( 200 );
        expect(
            await seedBrowser( requestUtils, {
                path: '/?page_id=2#top',
                device: 'mobile',
            } )
        ).toBe( 200 );
        expect(
            await seedBrowser( requestUtils, {
                entityId: 3,
            } as Partial< Browser > )
        ).toBe( 400 );
        const withoutPath = {
            id: BROWSER_ID,
            kind: 'browser',
            device: 'desktop',
            height: 900,
            shows: 'saved',
            ...AT,
        };
        expect(
            await saveLayout( requestUtils, {
                version: 1,
                artboards: [ withoutPath ],
            } )
        ).toBe( 400 );
        expect( await seedBrowser( requestUtils, { path: 'about/' } ) ).toBe(
            400
        );
        expect(
            await seedBrowser( requestUtils, { path: 'https://example.com/' } )
        ).toBe( 400 );
        expect( await seedBrowser( requestUtils, { height: 200 } ) ).toBe(
            200
        );
        expect( await seedBrowser( requestUtils, { height: 199 } ) ).toBe(
            400
        );
        expect( await seedBrowser( requestUtils, { shows: 'unsaved' } ) ).toBe(
            200
        );
        expect(
            await seedBrowser( requestUtils, {
                shows: 'draft',
            } as unknown as Partial< Browser > )
        ).toBe( 400 );
        const { height, ...withoutHeight } = {
            id: BROWSER_ID,
            kind: 'browser',
            path: '/',
            device: 'desktop',
            height: 900,
            shows: 'saved',
            ...AT,
        };
        expect( height ).toBe( 900 );
        expect(
            await saveLayout( requestUtils, {
                version: 1,
                artboards: [ withoutHeight ],
            } )
        ).toBe( 400 );
    } );

    test( 'AC-BROWSER-06 Dragging a browser\'s bottom edge down by 200 board units makes its window 200 units taller, and the height is kept after a reload; Undo, whose tooltip reads "Undo resize browser, on the board", puts it back; dragging it up past 200 stops at 200', async ( {
        page,
        requestUtils,
    } ) => {
        await seedBrowser( requestUtils, { height: 600 } );
        await openBoard( page, fixture.boardId, 10 );
        await showBrowser( page );
        const frame = () =>
            browser( page ).locator( '.wfd-artboard__frame' ).boundingBox();
        const before = ( await frame() )!;
        // 600 units at 50%.
        expect( before.height ).toBeCloseTo( 300, 0 );
        const dragEdge = async ( dy: number ) => {
            const now = ( await frame() )!;
            const edge = {
                x: now.x + now.width / 2,
                y: now.y + now.height,
            };
            await page.mouse.move( edge.x, edge.y );
            await page.mouse.down();
            await page.mouse.move( edge.x, edge.y + dy / 2, { steps: 4 } );
            await page.mouse.move( edge.x, edge.y + dy, { steps: 4 } );
            await page.mouse.up();
        };
        // Down 200 board units: 100 pixels at 50%.
        await dragEdge( 100 );
        await expect
            .poll( async () => ( await frame() )!.height )
            .toBeCloseTo( 400, 0 );
        await expect( browser( page ) ).toHaveClass( /is-selected/ );
        await expect
            .poll(
                async () =>
                    ( await savedBrowsers( requestUtils ) )[ 0 ]?.height,
                {
                    timeout: 6000,
                }
            )
            .toBe( 800 );
        await page.reload();
        await browser( page ).waitFor();
        await expect
            .poll( async () => ( await frame() )!.height )
            .toBeCloseTo( 400, 0 );

        // Undo puts it back.
        await page.locator( '[data-wfd-region="canvas"]' ).focus();
        const undo = page
            .locator( '[data-wfd-region="header"]' )
            .getByRole( 'button', { name: /^Undo/ } );
        await dragEdge( 100 );
        await expect
            .poll( async () => ( await frame() )!.height )
            .toBeCloseTo( 500, 0 );
        await expect( undo ).toHaveAccessibleName(
            'Undo resize browser, on the board'
        );
        await undo.click();
        await expect
            .poll( async () => ( await frame() )!.height )
            .toBeCloseTo( 400, 0 );

        // Up past the minimum.
        await dragEdge( -1000 );
        await expect
            .poll( async () => ( await frame() )!.height )
            .toBeCloseTo( 100, 0 );
    } );

    test( 'AC-BROWSER-07 A page scrolled while browsing stays scrolled where it was after Esc ends browsing', async ( {
        page,
        requestUtils,
    } ) => {
        await seedBrowser( requestUtils, { height: 300 } );
        await openBoard( page, fixture.boardId, 10 );
        await showBrowser( page );
        await page$( page ).locator( 'body' ).waitFor();
        const box = ( await browser( page )
            .locator( '.wfd-artboard__frame' )
            .boundingBox() )!;
        await page.mouse.dblclick( box.x + 200, box.y + 60 );
        await expect( browser( page ) ).toHaveAttribute(
            'data-wfd-tier',
            'live'
        );
        const scrollY = () =>
            page.evaluate(
                ( selector ) =>
                    ( document.querySelector( selector ) as HTMLIFrameElement )
                        .contentWindow!.scrollY,
                `[data-wfd-artboard="${ BROWSER_ID }"] iframe.wfd-browser`
            );
        await page.mouse.move( box.x + 200, box.y + 60 );
        await page.mouse.wheel( 0, 300 );
        await expect.poll( scrollY ).toBeGreaterThan( 100 );
        const scrolled = await scrollY();
        await page.keyboard.press( 'Escape' );
        await expect( browser( page ) ).not.toHaveAttribute(
            'data-wfd-tier',
            'live'
        );
        await page.waitForTimeout( 300 );
        expect( await scrollY() ).toBe( scrolled );
    } );

    // Two browsers on the About page, left of its artboard: one showing
    // unsaved changes above one showing the saved site.
    const seedPair = async ( requestUtils: any, path: string ) => {
        const about = artboardOf( fixture, 'page' );
        const at = { x: about.x - 1600, y: about.y };
        await saveLayout( requestUtils, {
            version: 1,
            artboards: [
                ...fixture.layout.artboards,
                {
                    id: BROWSER_ID,
                    kind: 'browser',
                    path,
                    device: 'desktop',
                    height: 600,
                    shows: 'unsaved',
                    ...at,
                },
                {
                    id: SAVED_ID,
                    kind: 'browser',
                    path,
                    device: 'desktop',
                    height: 600,
                    shows: 'saved',
                    x: at.x,
                    y: at.y + 800,
                },
            ],
        } );
        return { about, at };
    };

    const aboutAddress = async ( requestUtils: any ) => {
        const link = (
            await requestUtils.rest( {
                path: `/wp/v2/pages/${ fixture.pages.about }`,
            } )
        ).link as string;
        return {
            link,
            path: '/' + link.slice( new URL( '/', link ).href.length ),
        };
    };

    test( "AC-BROWSER-08 A browser showing unsaved changes shows a change typed into a page's artboard, without a save and without Reload being pressed, and keeps showing it on a link followed to another page and back; a browser on the same page set to \"Saved site\" does not show it until Review saves it. The page requested without signing in shows the saved content even with that browser's `wfd_preview` argument, and so does the signed-in user's own request with another value", async ( {
        page,
        requestUtils,
        playwright,
    } ) => {
        const { path } = await aboutAddress( requestUtils );
        const { about, at } = await seedPair( requestUtils, path );
        await openBoard( page, fixture.boardId, 11 );
        await setViewport( page, {
            x: 60 - at.x * 0.3,
            y: 60 - at.y * 0.3,
            zoom: 0.3,
        } );
        const unsaved = page$( page );
        const saved = page$( page, SAVED_ID );
        await expect(
            unsaved.locator( 'p', { hasText: 'About paragraph.' } )
        ).toBeVisible();

        await enterEdit( page, about.id );
        await editorFrame( page, about.id )
            .locator( 'p', { hasText: 'About paragraph.' } )
            .first()
            .click();
        await page.keyboard.press( 'End' );
        await page.keyboard.type( ' Previewed' );
        await page.getByRole( 'button', { name: 'Back to the board' } ).click();

        await expect(
            unsaved.locator( 'p', { hasText: 'About paragraph. Previewed' } )
        ).toBeVisible( { timeout: 8000 } );
        await expect(
            saved.locator( 'p', { hasText: 'About paragraph.' } )
        ).not.toContainText( 'Previewed' );

        // Without signing in the argument does nothing, and neither does
        // a value that is not the signed-in user's nonce.
        const previewUrl = ( await pageUrl( page ) )!;
        expect(
            new URL( previewUrl ).searchParams.get( 'wfd_preview' )
        ).toMatch( /^[\w.-]{6,}$/ );
        const visitor = await playwright.request.newContext( {
            storageState: { cookies: [], origins: [] },
        } );
        const html = await ( await visitor.get( previewUrl ) ).text();
        expect( html ).not.toContain( 'id="wpadminbar"' );
        expect( html ).toMatch( /About paragraph\.<\/p>/ );
        expect( html ).not.toContain( 'About paragraph. Previewed' );
        await visitor.dispose();
        const wrong = new URL( previewUrl );
        wrong.searchParams.set( 'wfd_preview', '1' );
        const own = await ( await page.request.get( wrong.href ) ).text();
        expect( own ).toContain( 'id="wpadminbar"' );
        expect( own ).not.toContain( 'About paragraph. Previewed' );

        // A link to another page and back.
        const box = ( await browser( page )
            .locator( '.wfd-artboard__frame' )
            .boundingBox() )!;
        await page.mouse.dblclick( box.x + 100, box.y + 60 );
        await expect( browser( page ) ).toHaveAttribute(
            'data-wfd-tier',
            'live'
        );
        await unsaved.locator( '.wp-block-site-title a' ).first().click();
        await expect( address( page ) ).toHaveValue( '/' );
        expect( await pageUrl( page ) ).toContain( 'wfd_preview=' );
        await address( page ).fill( path );
        await address( page ).press( 'Enter' );
        await expect(
            unsaved.locator( 'p', { hasText: 'About paragraph. Previewed' } )
        ).toBeVisible();
        await page.keyboard.press( 'Escape' );

        await page.locator( '[data-wfd-control="H9"]' ).click();
        const drawer = page.getByRole( 'dialog', { name: 'Review changes' } );
        await drawer.getByRole( 'button', { name: 'Save 1 change' } ).click();
        await expect(
            saved.locator( 'p', { hasText: 'About paragraph. Previewed' } )
        ).toBeVisible();
    } );

    test( 'AC-BROWSER-09 A browser showing unsaved changes shows an unsaved change to global styles and to a template part', async ( {
        page,
        requestUtils,
    } ) => {
        // Left of the header part's artboard, both in view at 30%.
        const header = artboardOf( fixture, 'template-part' );
        const at = { x: header.x - 1600, y: header.y };
        await seedBrowser( requestUtils, {
            shows: 'unsaved',
            height: 600,
            ...at,
        } );
        await openBoard( page, fixture.boardId, 10 );
        await setViewport( page, {
            x: 60 - at.x * 0.3,
            y: 60 - at.y * 0.3,
            zoom: 0.3,
        } );
        const shown = page$( page );
        await expect( shown.locator( 'body' ) ).toBeVisible();
        const background = () =>
            shown
                .locator( 'body' )
                .evaluate(
                    ( body ) => getComputedStyle( body ).backgroundColor
                );
        const before = await background();

        // Global styles: another variation.
        await page.locator( '[data-wfd-region="canvas"]' ).focus();
        await page.keyboard.press( 'Escape' );
        await page
            .locator( '[data-wfd-region="right"]' )
            .getByRole( 'button', { name: /^Variation:/ } )
            .click();
        await page.getByRole( 'menuitemradio', { name: 'Evening' } ).click();
        await expect.poll( background, { timeout: 8000 } ).not.toBe( before );

        // The header part, in its artboard.
        await enterEdit( page, header.id );
        await editorFrame( page, header.id )
            .locator( 'p', { hasText: 'Fixture header text' } )
            .first()
            .click();
        await page.keyboard.press( 'End' );
        await page.keyboard.type( ' Edited' );
        await page.getByRole( 'button', { name: 'Back to the board' } ).click();
        await expect(
            shown.getByText( 'Fixture header text Edited' )
        ).toBeVisible( { timeout: 8000 } );
    } );
} );
