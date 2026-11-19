import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import type { Page } from '@playwright/test';
import { resetFixture, openBoard, editorFrame, type Fixture } from './utils';

const openMenu = async ( page: Page ) => {
    await page.locator( '[data-wfd-control="L2"]' ).click();
    await expect( page.getByRole( 'menu' ).first() ).toBeVisible();
};

const armTemplate = async ( page: Page, item: string ) => {
    await openMenu( page );
    await page
        .getByRole( 'menuitem', { name: 'Template', exact: true } )
        .click();
    await page.getByRole( 'menuitem', { name: item } ).click();
};

const placeAt = async ( page: Page, dx = 300, dy = 500 ) => {
    const canvas = ( await page
        .locator( '[data-wfd-region="canvas"]' )
        .boundingBox() )!;
    await page.mouse.move( canvas.x + dx - 20, canvas.y + dy - 20 );
    await page.mouse.move( canvas.x + dx, canvas.y + dy, { steps: 3 } );
    await page.mouse.down();
    await page.mouse.up();
};

const pagesNamed = async (
    requestUtils: any,
    postType: string,
    title: string
) => {
    const list = await requestUtils.rest( {
        path: `/wp/v2/${ postType }`,
        params: { status: 'any', per_page: 100, context: 'edit' },
    } );
    return list.filter( ( item: any ) => item.title.raw === title );
};

test.describe( 'NEW', () => {
    let fixture: Fixture;
    test.beforeEach( async ( { page, requestUtils } ) => {
        fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
    } );

    test( 'AC-NEW-01 The Add artboard menu lists the four kinds with descriptions; Template has the submenu', async ( {
        page,
    } ) => {
        await openMenu( page );
        const menu = page.getByRole( 'menu' ).first();
        const items = menu.getByRole( 'menuitem' );
        await expect( items ).toHaveCount( 4 );
        const expected = [
            [ 'Page', 'Content at its own address.' ],
            [ 'Template', 'The layout many pages or posts share.' ],
            [ 'Template part', 'A header, footer or other shared region.' ],
            [ 'Pattern', 'A section to drop into any page or template.' ],
        ];
        for ( const [ index, [ title, line ] ] of expected.entries() ) {
            await expect( items.nth( index ) ).toContainText( title );
            await expect( items.nth( index ) ).toContainText( line );
        }
        await expect( items.nth( 1 ) ).toHaveAttribute(
            'aria-haspopup',
            'menu'
        );
        await items.nth( 1 ).click();
        const submenu = page.getByRole( 'menu' ).nth( 1 );
        await expect( submenu ).toContainText( 'New template for' );
        await expect( submenu ).toContainText( 'Already on the site' );
        await expect(
            submenu.getByRole( 'menuitem', { name: 'Single item' } )
        ).toBeVisible();
        await expect(
            submenu.getByRole( 'menuitem', { name: 'Custom' } )
        ).toBeVisible();
        const index = submenu.getByRole( 'menuitem', { name: /^Index/ } );
        await expect( index ).toContainText( 'On this board' );
        await expect( index ).toBeDisabled();
        await expect(
            submenu.getByRole( 'menuitem', { name: /^Pages/ } )
        ).toContainText( 'Open as artboard' );
    } );

    test( 'AC-NEW-02 After choosing a kind a placement ghost follows the pointer; Esc cancels and nothing is created', async ( {
        page,
        requestUtils,
    } ) => {
        await openMenu( page );
        await page
            .getByRole( 'menuitem', { name: 'Page', exact: true } )
            .click();
        const canvas = ( await page
            .locator( '[data-wfd-region="canvas"]' )
            .boundingBox() )!;
        const ghost = page.locator( '[data-wfd-placement]' );
        await page.mouse.move( canvas.x + 200, canvas.y + 300 );
        await page.mouse.move( canvas.x + 220, canvas.y + 320, { steps: 2 } );
        await expect( ghost ).toBeVisible();
        await expect( ghost ).toContainText( 'Untitled page · Page · Desktop' );
        await expect( ghost ).toContainText( 'Click to place' );
        const first = ( await ghost
            .locator( '.wfd-placement__outline' )
            .boundingBox() )!;
        expect( first.x ).toBeCloseTo( canvas.x + 220, 0 );
        expect( first.y ).toBeCloseTo( canvas.y + 320, 0 );
        // Sized as the Desktop device at the current zoom.
        const zoom = await page.evaluate(
            () => ( window as any ).wfdTest.viewport.get().zoom
        );
        expect( first.width ).toBeCloseTo( 1440 * zoom, 0 );
        await page.mouse.move( canvas.x + 420, canvas.y + 220, { steps: 3 } );
        const second = ( await ghost
            .locator( '.wfd-placement__outline' )
            .boundingBox() )!;
        expect( second.x ).toBeCloseTo( canvas.x + 420, 0 );
        expect( second.y ).toBeCloseTo( canvas.y + 220, 0 );

        await page.keyboard.press( 'Escape' );
        await expect( ghost ).toHaveCount( 0 );
        await expect( page.locator( '[data-wfd-placer]' ) ).toHaveCount( 0 );
        await page.mouse.click( canvas.x + 420, canvas.y + 220 );
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 9 );
        expect(
            await pagesNamed( requestUtils, 'pages', 'Untitled page' )
        ).toHaveLength( 0 );
    } );

    test( 'AC-NEW-03 Placing a Page creates a draft page "Untitled page" on the theme\'s blank or title-less template; placing a Pattern creates a draft synced pattern "Untitled pattern"', async ( {
        page,
        requestUtils,
    } ) => {
        await openMenu( page );
        await page
            .getByRole( 'menuitem', { name: 'Page', exact: true } )
            .click();
        await placeAt( page );
        const live = page.locator( '[data-wfd-tier="live"]' );
        await expect( live ).toHaveAttribute( 'data-wfd-kind', 'page' );
        await expect( live ).toHaveAttribute( 'data-wfd-device', 'desktop' );
        await expect( page.locator( '[data-wfd-control="H7"]' ) ).toHaveText(
            'Untitled page · Page'
        );
        const pages = await pagesNamed(
            requestUtils,
            'pages',
            'Untitled page'
        );
        expect( pages ).toHaveLength( 1 );
        expect( pages[ 0 ].status ).toBe( 'draft' );
        expect( pages[ 0 ].content.raw ).toBe( '' );
        // Twenty Twenty-Five has no blank template; it has a title-less one.
        expect( pages[ 0 ].template ).toBe( 'page-no-title' );

        await page.getByRole( 'button', { name: 'Back to the board' } ).click();
        await openMenu( page );
        await page
            .getByRole( 'menuitem', { name: 'Pattern', exact: true } )
            .click();
        await placeAt( page, 500, 600 );
        await expect( live ).toHaveAttribute( 'data-wfd-kind', 'pattern' );
        await expect( page.locator( '[data-wfd-control="H7"]' ) ).toHaveText(
            'Untitled pattern · Pattern'
        );
        const patterns = await pagesNamed(
            requestUtils,
            'blocks',
            'Untitled pattern'
        );
        expect( patterns ).toHaveLength( 1 );
        expect( patterns[ 0 ].status ).toBe( 'draft' );
        expect( patterns[ 0 ].content.raw ).toBe( '' );
        // Synced: no "unsynced" marker.
        expect( patterns[ 0 ].wp_pattern_sync_status ?? '' ).not.toBe(
            'unsynced'
        );
        expect( patterns[ 0 ].meta?.wp_pattern_sync_status ?? '' ).not.toBe(
            'unsynced'
        );
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 11 );
    } );

    test( 'AC-NEW-04 Placing a Template or Template part creates no post until it is saved from Review, where it is listed as "New"', async ( {
        page,
        requestUtils,
    } ) => {
        const exists = async ( base: string, slug: string ) => {
            try {
                await requestUtils.rest( {
                    path: `/wp/v2/${ base }/${ fixture.theme }//${ slug }`,
                } );
                return true;
            } catch {
                return false;
            }
        };
        await armTemplate( page, 'Single item' );
        await placeAt( page );
        const live = page.locator( '[data-wfd-tier="live"]' );
        await expect( live ).toHaveAttribute( 'data-wfd-kind', 'template' );
        await expect( page.locator( '[data-wfd-control="H7"]' ) ).toHaveText(
            'Single item · Template'
        );
        // The theme's Header part, one empty paragraph, the theme's Footer part.
        const id = ( await live.getAttribute( 'data-wfd-artboard' ) )!;
        const frame = editorFrame( page, id );
        await expect(
            frame.locator( 'header.wp-block-template-part' )
        ).toBeVisible();
        await expect(
            frame.locator( 'footer.wp-block-template-part' )
        ).toBeVisible();
        await expect(
            frame.locator( '.is-root-container > p[data-empty="true"]' )
        ).toHaveCount( 1 );
        expect( await exists( 'templates', 'singular' ) ).toBe( false );

        await page.getByRole( 'button', { name: 'Back to the board' } ).click();
        await openMenu( page );
        await page
            .getByRole( 'menuitem', { name: 'Template part', exact: true } )
            .click();
        await placeAt( page, 520, 640 );
        await expect( live ).toHaveAttribute(
            'data-wfd-kind',
            'template-part'
        );
        await expect( page.locator( '[data-wfd-control="H7"]' ) ).toHaveText(
            'Untitled part · Template part'
        );
        expect( await exists( 'template-parts', 'untitled-part' ) ).toBe(
            false
        );

        // Neither is written to the board's layout before its first save.
        await page.waitForTimeout( 2600 );
        const board = await requestUtils.rest< {
            layout: { artboards: unknown[] };
        } >( {
            path: `/wp/v2/wfd-boards/${ fixture.boardId }`,
            params: { context: 'edit' },
        } );
        expect( board.layout.artboards ).toHaveLength( 9 );

        // Review lists both as new, and saving creates them.
        await page.getByRole( 'button', { name: 'Back to the board' } ).click();
        const review = page.locator( '[data-wfd-control="H9"]' );
        await expect( review ).toHaveText( 'Review 2 changes' );
        await review.click();
        const drawer = page.getByRole( 'dialog', { name: 'Review changes' } );
        await expect( drawer ).toContainText( 'Single item' );
        await expect( drawer ).toContainText( 'New Template' );
        await expect( drawer ).toContainText( 'Untitled part' );
        await expect( drawer ).toContainText( 'New Template part' );
        await drawer.getByRole( 'button', { name: 'Save 2 changes' } ).click();
        await expect
            .poll( () => exists( 'templates', 'singular' ) )
            .toBe( true );
        await expect
            .poll( () => exists( 'template-parts', 'untitled-part' ) )
            .toBe( true );
        await page.waitForTimeout( 2600 );
        const saved = await requestUtils.rest< {
            layout: { artboards: { entityId: unknown }[] };
        } >( {
            path: `/wp/v2/wfd-boards/${ fixture.boardId }`,
            params: { context: 'edit' },
        } );
        expect( saved.layout.artboards ).toHaveLength( 11 );
        expect( saved.layout.artboards.map( ( a ) => a.entityId ) ).toEqual(
            expect.arrayContaining( [
                `${ fixture.theme }//singular`,
                `${ fixture.theme }//untitled-part`,
            ] )
        );
    } );

    test( "AC-NEW-05 No control changes an artboard's kind", async ( {
        page,
    } ) => {
        // Selected: the settings panel offers device, Edit and Remove only.
        await page
            .locator( '[data-wfd-artboard] .wfd-artboard__frame' )
            .first()
            .click();
        const settings = page.locator( '[data-wfd-panel="settings"]' );
        await expect( settings.getByRole( 'radio' ) ).toHaveText( [
            'Desktop',
            'Tablet',
            'Mobile',
        ] );
        await expect( settings.getByRole( 'button' ) ).toHaveText( [
            'Edit',
            'Remove from board',
        ] );
        await expect( settings.getByRole( 'combobox' ) ).toHaveCount( 0 );

        // New and in edit: the label menu and the kind tab offer devices only.
        await armTemplate( page, 'Single item' );
        await placeAt( page );
        const live = page.locator( '[data-wfd-tier="live"]' );
        await expect( live ).toHaveAttribute( 'data-wfd-kind', 'template' );
        await expect(
            live.locator( '.wfd-artboard__label' ).getByRole( 'button' )
        ).toHaveCount( 1 );
        await live.getByRole( 'button', { name: 'Artboard device' } ).click();
        await expect( page.getByRole( 'menuitemradio' ) ).toHaveText( [
            'Desktop',
            'Tablet',
            'Mobile',
        ] );
        await page.keyboard.press( 'Escape' );
        const panel = page.locator( '[data-wfd-panel="editing"]' );
        await expect( panel.getByRole( 'radio' ) ).toHaveText( [
            'Desktop',
            'Tablet',
            'Mobile',
        ] );
        await expect( panel.getByRole( 'combobox' ) ).toHaveCount( 0 );
        await expect( panel.getByRole( 'button' ) ).toHaveCount( 0 );
        await expect( live ).toHaveAttribute( 'data-wfd-kind', 'template' );
    } );

    test( "AC-NEW-06 A new template's first tab shows the caution notice about having no draft", async ( {
        page,
    } ) => {
        await armTemplate( page, 'Single item' );
        await placeAt( page );
        const panel = page.locator( '[data-wfd-panel="editing"]' );
        await expect( panel.getByRole( 'tab' ) ).toHaveText( [
            'Template',
            'Block',
        ] );
        await expect(
            panel.getByRole( 'tab', { name: 'Template' } )
        ).toHaveAttribute( 'aria-selected', 'true' );
        await expect( panel.locator( '[data-wfd-live-notice]' ) ).toHaveText(
            'Templates have no draft. Saving this one puts it live on the site.'
        );
        await expect( panel ).toContainText( 'Single item' );
        await expect( panel ).toContainText(
            'The same three previews the editor has. Add the template again to see two devices side by side.'
        );
    } );

    test( 'AC-NEW-07 A new template part is saved with the General area', async ( {
        page,
        requestUtils,
    } ) => {
        await openMenu( page );
        await page
            .getByRole( 'menuitem', { name: 'Template part', exact: true } )
            .click();
        await placeAt( page );
        await expect(
            page.locator( '[data-wfd-tier="live"]' )
        ).toHaveAttribute( 'data-wfd-kind', 'template-part' );
        await page.getByRole( 'button', { name: 'Back to the board' } ).click();
        await page.locator( '[data-wfd-control="H9"]' ).click();
        await page
            .getByRole( 'dialog', { name: 'Review changes' } )
            .getByRole( 'button', { name: 'Save 1 change' } )
            .click();
        await expect
            .poll( async () => {
                try {
                    const part = await requestUtils.rest< { area: string } >( {
                        path: `/wp/v2/template-parts/${ fixture.theme }//untitled-part`,
                        params: { context: 'edit' },
                    } );
                    return part.area;
                } catch {
                    return null;
                }
            } )
            .toBe( 'uncategorized' );
        const part = await requestUtils.rest< {
            title: { raw: string };
            content: { raw: string };
        } >( {
            path: `/wp/v2/template-parts/${ fixture.theme }//untitled-part`,
            params: { context: 'edit' },
        } );
        expect( part.title.raw ).toBe( 'Untitled part' );
    } );

    test( 'AC-NEW-08 A purpose whose template exists is absent from "New template for" and present under "Already on the site"', async ( {
        page,
    } ) => {
        await openMenu( page );
        await page
            .getByRole( 'menuitem', { name: 'Template', exact: true } )
            .click();
        const submenu = page.getByRole( 'menu' ).nth( 1 );
        const groups = submenu.getByRole( 'group' );
        const fresh = groups.nth( 0 );
        const existing = groups.nth( 1 );
        // Twenty Twenty-Five ships Archive, Search results and 404 templates.
        await expect( fresh.getByRole( 'menuitem' ) ).toHaveText( [
            'Single item',
            'Custom',
        ] );
        for ( const name of [
            /All Archives/,
            /Search Results/,
            /Page: 404/,
        ] ) {
            await expect(
                existing.getByRole( 'menuitem', { name } )
            ).toBeVisible();
        }
        await expect(
            existing.getByRole( 'menuitem', { name: 'Single item' } )
        ).toHaveCount( 0 );
    } );
} );
