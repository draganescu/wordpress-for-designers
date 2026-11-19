import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import {
    resetFixture,
    openBoard,
    viewportOf,
    enterEdit,
    editorFrame,
    artboardOf,
} from './utils';

test.describe( 'KEY', () => {
    test( 'AC-KEY-01 Every row of the keyboard map does what it says with focus on the board', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        const canvas = page.locator( '[data-wfd-region="canvas"]' );
        const box = ( await canvas.boundingBox() )!;
        const selected = page.locator( '.wfd-artboard.is-selected' );
        const position = () =>
            selected.evaluate( ( el: HTMLElement ) => [
                parseFloat( el.style.left ),
                parseFloat( el.style.top ),
            ] );
        // Names load asynchronously; the order below needs them.
        await expect(
            page.locator( '[data-wfd-row] .wfd-row__name', {
                hasText: 'Index',
            } )
        ).toBeVisible();
        const order = await page
            .locator( '[data-wfd-row]' )
            .evaluateAll( ( rows ) =>
                rows.map( ( row ) => row.getAttribute( 'data-wfd-row' ) )
            );

        // Space + drag pans.
        await canvas.focus();
        let view = await viewportOf( page );
        await page.keyboard.down( 'Space' );
        await page.mouse.move( box.x + 200, box.y + 200 );
        await page.mouse.down();
        await page.mouse.move( box.x + 230, box.y + 220, { steps: 3 } );
        await page.mouse.up();
        await page.keyboard.up( 'Space' );
        await expect
            .poll( async () => ( await viewportOf( page ) ).x )
            .toBeCloseTo( view.x + 30, 0 );

        // Middle-button drag pans.
        view = await viewportOf( page );
        await page.mouse.move( box.x + 200, box.y + 200 );
        await page.mouse.down( { button: 'middle' } );
        await page.mouse.move( box.x + 180, box.y + 190, { steps: 3 } );
        await page.mouse.up( { button: 'middle' } );
        await expect
            .poll( async () => ( await viewportOf( page ) ).x )
            .toBeCloseTo( view.x - 20, 0 );

        // Cmd/Ctrl + wheel and Cmd/Ctrl + plus / minus zoom.
        view = await viewportOf( page );
        await page.keyboard.down( 'Control' );
        await page.mouse.wheel( 0, -40 );
        await page.keyboard.up( 'Control' );
        await expect
            .poll( async () => ( await viewportOf( page ) ).zoom )
            .toBeGreaterThan( view.zoom );
        view = await viewportOf( page );
        await canvas.focus();
        await page.keyboard.press( 'Control+=' );
        expect( ( await viewportOf( page ) ).zoom ).toBeGreaterThan(
            view.zoom
        );
        await page.keyboard.press( 'Control+-' );
        expect( ( await viewportOf( page ) ).zoom ).toBeCloseTo( view.zoom, 5 );

        // Shift + 1 fits all artboards.
        await page.keyboard.press( 'Shift+Digit1' );
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

        // Tab and Shift + Tab move the selection in left-panel order.
        await canvas.focus();
        await page.keyboard.press( 'Tab' );
        await expect( selected ).toHaveAttribute(
            'data-wfd-artboard',
            order[ 0 ]!
        );
        await page.keyboard.press( 'Tab' );
        await expect( selected ).toHaveAttribute(
            'data-wfd-artboard',
            order[ 1 ]!
        );
        await page.keyboard.press( 'Tab' );
        await expect( selected ).toHaveAttribute(
            'data-wfd-artboard',
            order[ 2 ]!
        );
        await page.keyboard.press( 'Shift+Tab' );
        await expect( selected ).toHaveAttribute(
            'data-wfd-artboard',
            order[ 1 ]!
        );
        await expect( canvas ).toBeFocused();

        // Shift + 2 fits the selected artboard.
        await page.keyboard.press( 'Shift+Digit2' );
        const fitted = ( await selected
            .locator( '.wfd-artboard__frame' )
            .boundingBox() )!;
        const fit = await viewportOf( page );
        expect(
            fit.zoom === 1 ||
                fitted.height > box.height * 0.8 ||
                fitted.width > box.width * 0.8
        ).toBe( true );
        await page.keyboard.press( 'Shift+Digit1' );

        // Arrow keys nudge by 1 unit; with Shift, by 10.
        const start = await position();
        await page.keyboard.press( 'ArrowRight' );
        expect( await position() ).toEqual( [ start[ 0 ] + 1, start[ 1 ] ] );
        await page.keyboard.press( 'ArrowDown' );
        expect( await position() ).toEqual( [
            start[ 0 ] + 1,
            start[ 1 ] + 1,
        ] );
        await page.keyboard.press( 'Shift+ArrowLeft' );
        expect( await position() ).toEqual( [
            start[ 0 ] - 9,
            start[ 1 ] + 1,
        ] );
        await page.keyboard.press( 'Shift+ArrowUp' );
        expect( await position() ).toEqual( [
            start[ 0 ] - 9,
            start[ 1 ] - 9,
        ] );

        // Cmd/Ctrl + Z and Cmd/Ctrl + Shift + Z undo and redo layout.
        await page.keyboard.press( 'Control+z' );
        expect( await position() ).toEqual( [
            start[ 0 ] - 9,
            start[ 1 ] + 1,
        ] );
        await page.keyboard.press( 'Control+Shift+z' );
        expect( await position() ).toEqual( [
            start[ 0 ] - 9,
            start[ 1 ] - 9,
        ] );

        // Delete and Backspace open the confirmation.
        for ( const key of [ 'Delete', 'Backspace' ] ) {
            await page.keyboard.press( key );
            const dialog = page.getByRole( 'alertdialog' );
            await expect( dialog ).toContainText( 'from this board?' );
            await dialog.getByRole( 'button', { name: 'Cancel' } ).click();
            await expect( dialog ).toHaveCount( 0 );
            await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount(
                9
            );
            await canvas.focus();
        }

        // Enter edits the selected artboard.
        const id = await selected.getAttribute( 'data-wfd-artboard' );
        await page.keyboard.press( 'Enter' );
        await expect(
            page.locator( `[data-wfd-artboard="${ id }"]` )
        ).toHaveAttribute( 'data-wfd-tier', 'live' );
        await page.getByRole( 'button', { name: 'Back to the board' } ).click();
        await expect( selected ).toHaveAttribute( 'data-wfd-artboard', id! );

        // Esc clears the selection.
        await canvas.focus();
        await page.keyboard.press( 'Escape' );
        await expect( selected ).toHaveCount( 0 );
    } );

    test( 'AC-KEY-02 With an artboard in edit, typing, arrows and Delete act on blocks, not on the board', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        const header = artboardOf( fixture, 'template-part' );
        const artboard = page.locator( `[data-wfd-artboard="${ header.id }"]` );
        await enterEdit( page, header.id );
        const view = await viewportOf( page );
        const paragraph = editorFrame( page, header.id ).locator( 'p', {
            hasText: 'Fixture header text',
        } );
        await paragraph.click();
        await page.keyboard.press( 'End' );
        // Typing, including Space, "1", "2" and "!", goes to the block.
        await page.keyboard.type( ' a 1 2!' );
        await expect( paragraph ).toHaveText( 'Fixture header text a 1 2!' );
        // Arrows move the caret; Backspace and Delete edit text.
        await page.keyboard.press( 'ArrowLeft' );
        await page.keyboard.press( 'ArrowLeft' );
        await page.keyboard.press( 'Backspace' );
        await page.keyboard.press( 'Delete' );
        await expect( paragraph ).toHaveText( 'Fixture header text a 1!' );
        await page.keyboard.press( 'Shift+ArrowUp' );
        await page.keyboard.press( 'Tab' );

        // The board did not react.
        await expect( artboard ).toHaveCSS( 'left', `${ header.x }px` );
        await expect( artboard ).toHaveCSS( 'top', `${ header.y }px` );
        await expect( page.getByRole( 'alertdialog' ) ).toHaveCount( 0 );
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 9 );
        await expect( artboard ).toHaveAttribute( 'data-wfd-tier', 'live' );
        expect( await viewportOf( page ) ).toEqual( view );
    } );

    test( 'AC-KEY-03 Esc in edit, with nothing for the editor to dismiss, leaves edit and keeps the artboard selected', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        const header = artboardOf( fixture, 'template-part' );
        const artboard = page.locator( `[data-wfd-artboard="${ header.id }"]` );
        await enterEdit( page, header.id );
        const paragraph = editorFrame( page, header.id ).locator( 'p', {
            hasText: 'Fixture header text',
        } );
        await paragraph.click();
        await expect(
            page.locator( '.block-editor-block-toolbar' )
        ).toHaveCount( 1 );

        // A popover is open: Esc closes it and edit continues.
        await page
            .locator( '[data-wfd-control="H6"]' )
            .getByRole( 'button', { name: 'Options' } )
            .click();
        await expect( page.getByRole( 'menu' ) ).toBeVisible();
        await page.keyboard.press( 'Escape' );
        await expect( page.getByRole( 'menu' ) ).toHaveCount( 0 );
        await expect( artboard ).toHaveAttribute( 'data-wfd-tier', 'live' );

        // A block is selected: Esc clears the selection and edit continues.
        await paragraph.click();
        await page.keyboard.press( 'Escape' );
        await expect( artboard ).toHaveAttribute( 'data-wfd-tier', 'live' );
        await expect(
            page.locator( '.block-editor-block-toolbar' )
        ).toHaveCount( 0 );

        // Nothing left to dismiss: Esc leaves edit, the artboard stays selected.
        await page.keyboard.press( 'Escape' );
        await expect( artboard ).not.toHaveAttribute( 'data-wfd-tier', 'live' );
        await expect( artboard ).toHaveClass( /is-selected/ );
        await expect(
            page.locator( `[data-wfd-row="${ header.id }"]` )
        ).toHaveAttribute( 'aria-current', 'true' );
    } );
} );
