import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import {
    resetFixture,
    boardUrl,
    loginAs,
    restNonce,
    BOARDS_URL,
} from './utils';

test.describe( 'PERM', () => {
    test( 'AC-PERM-01 An administrator sees Designer with Boards and Add board', async ( {
        page,
        requestUtils,
    } ) => {
        await resetFixture( requestUtils );
        await page.goto( '/wp-admin/index.php' );
        const menu = page.locator( '#adminmenu #toplevel_page_wfd-boards' );
        await expect( menu.locator( '.wp-menu-name' ) ).toHaveText(
            'Designer'
        );
        await menu.locator( 'a.menu-top' ).click();
        const items = menu.locator( '.wp-submenu li:not(.wp-submenu-head) a' );
        await expect( items ).toHaveText( [ 'Boards', 'Add board' ] );
    } );

    test( 'AC-PERM-02 An editor has no menu and gets permission errors', async ( {
        browser,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        const page = await loginAs( browser, 'wfd_editor' );
        await page.goto( '/wp-admin/index.php' );
        await expect( page.locator( '#adminmenu' ) ).toBeVisible();
        await expect( page.locator( '#toplevel_page_wfd-boards' ) ).toHaveCount(
            0
        );

        const app = await page.goto( boardUrl( fixture.boardId ) );
        expect( app?.status() ).toBe( 403 );
        await expect( page.locator( 'body' ) ).toContainText(
            'Sorry, you are not allowed to access this page.'
        );
        const list = await page.goto( BOARDS_URL );
        expect( list?.status() ).toBe( 403 );

        const nonce = await restNonce( page );
        const headers = { 'X-WP-Nonce': nonce };
        const read = await page.request.get(
            '/?rest_route=/wp/v2/wfd-boards&context=edit',
            { headers }
        );
        expect( read.status() ).toBe( 403 );
        const one = await page.request.get(
            `/?rest_route=/wp/v2/wfd-boards/${ fixture.boardId }&context=edit`,
            { headers }
        );
        expect( one.status() ).toBe( 403 );
        const create = await page.request.post(
            '/?rest_route=/wp/v2/wfd-boards',
            { headers, data: { title: 'Nope' } }
        );
        expect( create.status() ).toBe( 403 );
        await page.context().close();
    } );

    test( 'AC-PERM-03 A board made by one administrator is listed and editable for another', async ( {
        browser,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        const page = await loginAs( browser, 'wfd_admin2' );
        await page.goto( BOARDS_URL );
        await expect(
            page.getByRole( 'link', { name: 'Fixture board' } ).first()
        ).toBeVisible();

        const nonce = await restNonce( page );
        const layout = {
            version: 1,
            artboards: fixture.layout.artboards.slice( 0, 1 ),
        };
        const update = await page.request.post(
            `/?rest_route=/wp/v2/wfd-boards/${ fixture.boardId }`,
            { headers: { 'X-WP-Nonce': nonce }, data: { layout } }
        );
        expect( update.status() ).toBe( 200 );
        expect( ( await update.json() ).layout.artboards ).toHaveLength( 1 );

        await page.goto( boardUrl( fixture.boardId ) );
        await expect( page.locator( '#wfd-board-root' ) ).toBeAttached();
        await page.context().close();
    } );

    test( 'AC-PERM-04 Only a user with edit_theme_options reads a board over REST', async ( {
        browser,
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        const base = '/?rest_route=/wp/v2/wfd-boards';
        const one = `${ base }/${ fixture.boardId }`;
        const reads = [
            base,
            `${ base }&context=edit`,
            `${ base }&_fields=id,layout`,
            `${ base }&search=Fixture`,
            one,
            `${ one }&context=edit`,
            `${ one }&_fields=layout`,
            // WordPress matches a route whatever the case of its letters.
            '/?rest_route=/wp/v2/WFD-Boards',
            `/?rest_route=/WP/V2/wfd-boards/${ fixture.boardId }`,
        ];

        // Nobody logged in.
        const anonymous = await browser.newContext( {
            storageState: undefined,
            baseURL: process.env.WP_BASE_URL,
        } );
        for ( const url of reads ) {
            const response = await anonymous.request.get( url );
            expect( [ url, response.status() ] ).toEqual( [ url, 401 ] );
            expect( await response.text() ).not.toContain( 'artboards' );
        }
        await anonymous.close();

        // Logged in without the capability.
        for ( const login of [ 'wfd_subscriber', 'wfd_editor' ] ) {
            const other = await loginAs( browser, login );
            const headers = { 'X-WP-Nonce': await restNonce( other ) };
            for ( const url of reads ) {
                const response = await other.request.get( url, { headers } );
                expect( [ login, url, response.status() ] ).toEqual( [
                    login,
                    url,
                    403,
                ] );
                expect( await response.text() ).not.toContain( 'artboards' );
            }
            await other.context().close();
        }

        // An administrator reads what was read before.
        const headers = { 'X-WP-Nonce': await restNonce( page ) };
        for ( const context of [ 'view', 'edit' ] ) {
            const list = await page.request.get(
                `${ base }&context=${ context }`,
                { headers }
            );
            expect( list.status() ).toBe( 200 );
            const boards = await list.json();
            expect(
                boards.map( ( board: { id: number } ) => board.id )
            ).toEqual( [ fixture.boardId ] );
            expect( boards[ 0 ].layout ).toEqual( fixture.layout );
            const single = await page.request.get(
                `${ one }&context=${ context }`,
                { headers }
            );
            expect( single.status() ).toBe( 200 );
            expect( ( await single.json() ).layout ).toEqual( fixture.layout );
        }
    } );
} );
