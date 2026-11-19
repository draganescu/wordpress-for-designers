import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import {
    resetFixture,
    openBoard,
    enterEdit,
    editorFrame,
    artboardOf,
    type Fixture,
} from './utils';

test.describe( 'UNDO', () => {
    let fixture: Fixture;
    test.beforeEach( async ( { page, requestUtils } ) => {
        fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
    } );

    test( 'AC-UNDO-01 In edit, Undo reverts the last content change and its tooltip reads "Undo edit, in {artboard name}"', async ( {
        page,
    } ) => {
        const header = artboardOf( fixture, 'template-part' );
        await enterEdit( page, header.id );
        const undo = page.locator( '[data-wfd-control="H3"]' );
        const redo = page.locator( '[data-wfd-control="H4"]' );
        await expect( undo ).toBeDisabled();
        await expect( undo ).toHaveAccessibleName( 'Undo' );
        const paragraph = editorFrame( page, header.id ).locator( 'p', {
            hasText: 'Fixture header text',
        } );
        await paragraph.click();
        await page.keyboard.press( 'End' );
        await page.keyboard.type( ' more' );
        await expect( paragraph ).toHaveText( 'Fixture header text more' );
        await expect( undo ).toBeEnabled();
        await expect( undo ).toHaveAccessibleName( 'Undo edit, in Header' );
        await undo.hover();
        await expect(
            page.getByText( 'Undo edit, in Header', { exact: true } )
        ).toBeVisible();
        await undo.click();
        await expect( paragraph ).toHaveText( 'Fixture header text' );
        await expect( redo ).toHaveAccessibleName( 'Redo edit, in Header' );
        await redo.click();
        await expect( paragraph ).toHaveText( 'Fixture header text more' );
        // The keyboard shortcut undoes content too.
        await paragraph.click();
        await page.keyboard.press( 'ControlOrMeta+z' );
        await expect( paragraph ).toHaveText( 'Fixture header text' );
    } );

    test( 'AC-UNDO-02 On the board, Undo reverts the last layout change and its tooltip reads "Undo {action}, on the board"', async ( {
        page,
    } ) => {
        const hero = artboardOf( fixture, 'pattern' );
        const artboard = page.locator( `[data-wfd-artboard="${ hero.id }"]` );
        const undo = page.locator( '[data-wfd-control="H3"]' );
        const redo = page.locator( '[data-wfd-control="H4"]' );
        await expect( undo ).toBeDisabled();
        await expect( undo ).toHaveAccessibleName( 'Undo' );

        await artboard.locator( '.wfd-artboard__frame' ).click();
        await page.locator( '[data-wfd-region="canvas"]' ).focus();
        await page.keyboard.press( 'Shift+ArrowRight' );
        await expect( artboard ).toHaveCSS( 'left', `${ hero.x + 10 }px` );
        await expect( undo ).toHaveAccessibleName(
            'Undo move artboard, on the board'
        );
        await undo.hover();
        await expect(
            page.getByText( 'Undo move artboard, on the board', {
                exact: true,
            } )
        ).toBeVisible();

        await page
            .locator( '[data-wfd-panel="settings"]' )
            .getByRole( 'radio', { name: 'Mobile' } )
            .click();
        await expect( artboard ).toHaveAttribute( 'data-wfd-device', 'mobile' );
        await expect( undo ).toHaveAccessibleName(
            'Undo change device, on the board'
        );
        await undo.click();
        await expect( artboard ).toHaveAttribute(
            'data-wfd-device',
            'desktop'
        );
        await expect( redo ).toHaveAccessibleName(
            'Redo change device, on the board'
        );
        await undo.click();
        await expect( artboard ).toHaveCSS( 'left', `${ hero.x }px` );
        await expect( undo ).toBeDisabled();
    } );

    test( 'AC-UNDO-03 Layout undo does not revert content, and content undo does not move artboards', async ( {
        page,
    } ) => {
        const header = artboardOf( fixture, 'template-part' );
        const artboard = page.locator( `[data-wfd-artboard="${ header.id }"]` );
        const undo = page.locator( '[data-wfd-control="H3"]' );

        // A layout change, then a content change.
        await artboard.locator( '.wfd-artboard__frame' ).click();
        await page.locator( '[data-wfd-region="canvas"]' ).focus();
        await page.keyboard.press( 'Shift+ArrowDown' );
        await expect( artboard ).toHaveCSS( 'top', `${ header.y + 10 }px` );
        await enterEdit( page, header.id );
        const paragraph = editorFrame( page, header.id ).locator( 'p', {
            hasText: 'Fixture header text',
        } );
        await paragraph.click();
        await page.keyboard.press( 'End' );
        await page.keyboard.type( ' kept' );

        // Content undo leaves the artboard where it is.
        await undo.click();
        await expect( paragraph ).toHaveText( 'Fixture header text' );
        await expect( artboard ).toHaveCSS( 'top', `${ header.y + 10 }px` );
        await page.locator( '[data-wfd-control="H4"]' ).click();
        await expect( paragraph ).toHaveText( 'Fixture header text kept' );

        // Back on the board, layout undo leaves the content as it is.
        await page.getByRole( 'button', { name: 'Back to the board' } ).click();
        await expect( undo ).toHaveAccessibleName(
            'Undo move artboard, on the board'
        );
        await undo.click();
        await expect( artboard ).toHaveCSS( 'top', `${ header.y }px` );
        await page.locator( '[data-wfd-control="H8"]' ).click();
        await page.getByRole( 'menuitem', { name: 'Zoom to 50%' } ).click();
        await expect(
            artboard
                .frameLocator( 'iframe' )
                .locator( 'p', { hasText: 'Fixture header text kept' } )
        ).toBeAttached();
    } );
} );
