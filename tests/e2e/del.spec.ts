import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import type { Page } from '@playwright/test';
import { resetFixture, openBoard, artboardOf, type Fixture } from './utils';

const statusOf = async ( requestUtils: any, path: string ) => {
    try {
        const item = await requestUtils.rest( {
            path,
            params: { context: 'edit' },
        } );
        return item.status ?? item.source ?? 'exists';
    } catch ( error ) {
        return ( error as any )?.data?.status ?? 'error';
    }
};

const pressDelete = async ( page: Page, id: string ) => {
    await page.locator( `[data-wfd-row="${ id }"]` ).click();
    await page.locator( '[data-wfd-region="canvas"]' ).focus();
    await page.keyboard.press( 'Delete' );
    const dialog = page.getByRole( 'alertdialog' );
    await expect( dialog ).toBeVisible();
    return dialog;
};

test.describe( 'DEL', () => {
    let fixture: Fixture;
    test.beforeEach( async ( { page, requestUtils } ) => {
        fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
    } );

    test( 'AC-DEL-01 Delete opens the dialog; Cancel changes nothing; Remove with the box unchecked removes the artboard and leaves the entity', async ( {
        page,
        requestUtils,
    } ) => {
        const sign = artboardOf( fixture, 'pattern', 'desktop', 1 );
        const dialog = await pressDelete( page, sign.id );
        await expect( dialog ).toContainText(
            'Remove Sign-off from this board?'
        );
        await expect( dialog ).toContainText(
            'The pattern stays on your site unless you also delete it.'
        );
        const box = dialog.getByRole( 'checkbox', {
            name: 'Also delete the Sign-off pattern from the site. It is removed everywhere it is used.',
        } );
        await expect( box ).not.toBeChecked();
        await expect( dialog.getByRole( 'button' ) ).toHaveText( [
            'Cancel',
            'Remove',
        ] );
        await dialog.getByRole( 'button', { name: 'Cancel' } ).click();
        await expect( dialog ).toHaveCount( 0 );
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 9 );

        // The same dialog from the settings panel.
        await page.getByRole( 'button', { name: 'Remove from board' } ).click();
        await expect( dialog ).toBeVisible();
        await dialog.getByRole( 'button', { name: 'Remove' } ).click();
        await expect( dialog ).toHaveCount( 0 );
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 8 );
        await expect(
            page.locator( `[data-wfd-artboard="${ sign.id }"]` )
        ).toHaveCount( 0 );
        expect(
            await statusOf(
                requestUtils,
                `/wp/v2/blocks/${ fixture.patterns.sign }`
            )
        ).toBe( 'publish' );
        // The layout is saved without it.
        await page.waitForTimeout( 2600 );
        const board = await requestUtils.rest< {
            layout: { artboards: { id: string }[] };
        } >( {
            path: `/wp/v2/wfd-boards/${ fixture.boardId }`,
            params: { context: 'edit' },
        } );
        expect( board.layout.artboards.map( ( a ) => a.id ) ).not.toContain(
            sign.id
        );
    } );

    test( 'AC-DEL-02 With the box checked, a page goes to the trash, a user pattern is deleted, a user-made template is deleted', async ( {
        page,
        requestUtils,
    } ) => {
        // A page.
        const about = artboardOf( fixture, 'page' );
        let dialog = await pressDelete( page, about.id );
        await expect( dialog ).toContainText(
            'The page stays on your site unless you also delete it.'
        );
        await dialog
            .getByRole( 'checkbox', {
                name: 'Also move the About page to the trash.',
            } )
            .check();
        await dialog.getByRole( 'button', { name: 'Remove' } ).click();
        await expect( dialog ).toHaveCount( 0 );
        await expect(
            page.locator( `[data-wfd-artboard="${ about.id }"]` )
        ).toHaveCount( 0 );
        await expect
            .poll( () =>
                statusOf(
                    requestUtils,
                    `/wp/v2/pages/${ fixture.pages.about }`
                )
            )
            .toBe( 'trash' );

        // A user pattern.
        const hero = artboardOf( fixture, 'pattern' );
        dialog = await pressDelete( page, hero.id );
        await dialog
            .getByRole( 'checkbox', {
                name: 'Also delete the Hero pattern from the site. It is removed everywhere it is used.',
            } )
            .check();
        await dialog.getByRole( 'button', { name: 'Remove' } ).click();
        await expect(
            page.locator( `[data-wfd-artboard="${ hero.id }"]` )
        ).toHaveCount( 0 );
        await expect
            .poll( () =>
                statusOf(
                    requestUtils,
                    `/wp/v2/blocks/${ fixture.patterns.hero }`
                )
            )
            .toBe( 'trash' );

        // A user-made template: make one, open it from the inserter, delete it.
        await requestUtils.rest( {
            method: 'POST',
            path: '/wp/v2/templates',
            data: {
                slug: 'wfd-made',
                title: 'Made by a user',
                content:
                    '<!-- wp:paragraph --><p>Made</p><!-- /wp:paragraph -->',
            },
        } );
        await page.reload();
        await page.locator( '[data-wfd-artboard]' ).first().waitFor();
        const header = page.locator( '[data-wfd-region="header"]' );
        await header
            .getByRole( 'button', { name: 'Block inserter', exact: true } )
            .click();
        const inserter = page.locator( '.wfd-inserter' );
        await inserter.getByRole( 'tab', { name: 'Templates' } ).click();
        await inserter
            .locator( '.wfd-row', { hasText: 'Made by a user' } )
            .click();
        const made = page.locator( '[data-wfd-artboard].is-selected' );
        await expect( made ).toHaveAttribute( 'data-wfd-kind', 'template' );
        const madeId = ( await made.getAttribute( 'data-wfd-artboard' ) )!;
        await header
            .getByRole( 'button', { name: 'Close block inserter' } )
            .click();
        dialog = await pressDelete( page, madeId );
        await expect( dialog ).toContainText(
            'The template stays on your site unless you also delete it.'
        );
        await dialog
            .getByRole( 'checkbox', {
                name: 'Also delete the Made by a user template from the site.',
            } )
            .check();
        await dialog.getByRole( 'button', { name: 'Remove' } ).click();
        await expect(
            page.locator( `[data-wfd-artboard="${ madeId }"]` )
        ).toHaveCount( 0 );
        await expect
            .poll( () =>
                statusOf(
                    requestUtils,
                    `/wp/v2/templates/${ fixture.theme }//wfd-made`
                )
            )
            .toBe( 404 );

        // Removing with the box checked is not undoable.
        await expect(
            page.locator( '[data-wfd-control="H3"]' )
        ).not.toHaveAccessibleName( 'Undo remove artboard, on the board' );
    } );

    test( "AC-DEL-03 For a theme template with changes the box offers reset; checking it restores the theme's version", async ( {
        page,
        requestUtils,
    } ) => {
        const part = `/wp/v2/template-parts/${ fixture.theme }//header`;
        const before = await requestUtils.rest< {
            source: string;
            content: { raw: string };
        } >( {
            path: part,
            params: { context: 'edit' },
        } );
        expect( before.source ).toBe( 'custom' );
        expect( before.content.raw ).toContain( 'Fixture header text' );

        // A theme item without changes has no checkbox.
        const footer = artboardOf( fixture, 'template-part', 'desktop', 1 );
        let dialog = await pressDelete( page, footer.id );
        await expect( dialog ).toContainText(
            'Remove Footer from this board?'
        );
        await expect( dialog ).toContainText(
            "Footer ships with the theme, so it can't be deleted. It stays on your site."
        );
        await expect( dialog.getByRole( 'checkbox' ) ).toHaveCount( 0 );
        await dialog.getByRole( 'button', { name: 'Cancel' } ).click();

        // The changed Header offers reset.
        const header = artboardOf( fixture, 'template-part' );
        dialog = await pressDelete( page, header.id );
        await expect( dialog ).toContainText(
            "Header ships with the theme, so it can't be deleted. It stays on your site."
        );
        const box = dialog.getByRole( 'checkbox', {
            name: "Also reset Header to the theme's version. Your changes to it are lost.",
        } );
        await expect( box ).not.toBeChecked();
        await box.check();
        await dialog.getByRole( 'button', { name: 'Remove' } ).click();
        await expect( dialog ).toHaveCount( 0 );
        await expect(
            page.locator( `[data-wfd-artboard="${ header.id }"]` )
        ).toHaveCount( 0 );
        await expect
            .poll(
                async () =>
                    (
                        await requestUtils.rest< { source: string } >( {
                            path: part,
                            params: { context: 'edit' },
                        } )
                    ).source
            )
            .toBe( 'theme' );
        const after = await requestUtils.rest< { content: { raw: string } } >( {
            path: part,
            params: { context: 'edit' },
        } );
        expect( after.content.raw ).not.toContain( 'Fixture header text' );
        // The part still exists, so Header (Mobile) stays on the board.
        await expect(
            page.locator(
                `[data-wfd-artboard="${ artboardOf( fixture, 'template-part', 'mobile' ).id }"]`
            )
        ).toHaveCount( 1 );
    } );

    test( 'AC-DEL-04 Removing with the box unchecked is undoable as a layout change', async ( {
        page,
    } ) => {
        const hero = artboardOf( fixture, 'pattern' );
        const dialog = await pressDelete( page, hero.id );
        await dialog.getByRole( 'button', { name: 'Remove' } ).click();
        await expect(
            page.locator( `[data-wfd-artboard="${ hero.id }"]` )
        ).toHaveCount( 0 );
        const undo = page.locator( '[data-wfd-control="H3"]' );
        await expect( undo ).toHaveAccessibleName(
            'Undo remove artboard, on the board'
        );
        await undo.click();
        const restored = page.locator( `[data-wfd-artboard="${ hero.id }"]` );
        await expect( restored ).toHaveCount( 1 );
        await expect( restored ).toHaveCSS( 'left', `${ hero.x }px` );
        await expect( restored ).toHaveCSS( 'top', `${ hero.y }px` );
        await expect(
            page.locator( '[data-wfd-control="H4"]' )
        ).toHaveAccessibleName( 'Redo remove artboard, on the board' );
        // The keyboard does the same.
        await page.locator( '[data-wfd-region="canvas"]' ).focus();
        await page.keyboard.press( 'ControlOrMeta+Shift+z' );
        await expect( restored ).toHaveCount( 0 );
        await page.keyboard.press( 'ControlOrMeta+z' );
        await expect( restored ).toHaveCount( 1 );
    } );

    test( 'AC-DEL-05 Delete with several selected opens no dialog, removes them all, leaves the entities, and one undo restores them', async ( {
        page,
        requestUtils,
    } ) => {
        const hero = artboardOf( fixture, 'pattern' );
        const sign = artboardOf( fixture, 'pattern', 'desktop', 1 );
        await page.locator( `[data-wfd-row="${ hero.id }"]` ).click();
        await page
            .locator( `[data-wfd-row="${ sign.id }"]` )
            .click( { modifiers: [ 'ControlOrMeta' ] } );
        await expect( page.locator( '.wfd-artboard.is-selected' ) ).toHaveCount(
            2
        );
        await page.locator( '[data-wfd-region="canvas"]' ).focus();
        await page.keyboard.press( 'Delete' );
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 7 );
        await expect( page.getByRole( 'alertdialog' ) ).toHaveCount( 0 );
        for ( const artboard of [ hero, sign ] ) {
            await expect(
                page.locator( `[data-wfd-artboard="${ artboard.id }"]` )
            ).toHaveCount( 0 );
            const block = ( await requestUtils.rest( {
                path: `/wp/v2/blocks/${ artboard.entityId }`,
            } ) ) as { status: string };
            expect( block.status ).toBe( 'publish' );
        }
        const undo = page.locator( '[data-wfd-control="H3"]' );
        await expect( undo ).toHaveAccessibleName(
            'Undo remove artboard, on the board'
        );
        await undo.click();
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 9 );
        for ( const artboard of [ hero, sign ] ) {
            await expect(
                page.locator( `[data-wfd-artboard="${ artboard.id }"]` )
            ).toHaveCount( 1 );
        }
    } );

    test( 'AC-DEL-06 Delete with focus on a list row acts on the selection: the dialog for one, no dialog for several', async ( {
        page,
    } ) => {
        const hero = artboardOf( fixture, 'pattern' );
        const sign = artboardOf( fixture, 'pattern', 'desktop', 1 );
        const heroRow = page.locator( `[data-wfd-row="${ hero.id }"]` );
        const signRow = page.locator( `[data-wfd-row="${ sign.id }"]` );
        const dialog = page.getByRole( 'alertdialog' );

        // One selected: the click leaves the focus on the row.
        await heroRow.click();
        await expect( heroRow ).toBeFocused();
        await page.keyboard.press( 'Delete' );
        await expect( dialog ).toContainText( 'Remove Hero from this board?' );
        await dialog.getByRole( 'button', { name: 'Cancel' } ).click();
        await expect( dialog ).toHaveCount( 0 );
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 9 );

        // Several selected: they all go, with no dialog.
        await heroRow.click();
        await signRow.click( { modifiers: [ 'ControlOrMeta' ] } );
        await expect( signRow ).toBeFocused();
        await page.keyboard.press( 'Backspace' );
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 7 );
        await expect( dialog ).toHaveCount( 0 );
        await expect( heroRow ).toHaveCount( 0 );
        await expect( signRow ).toHaveCount( 0 );
        await page.locator( '[data-wfd-control="H3"]' ).click();
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 9 );
    } );
} );
