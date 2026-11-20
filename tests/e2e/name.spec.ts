import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import type { Page } from '@playwright/test';
import {
    resetFixture,
    openBoard,
    enterEdit,
    artboardOf,
    type Fixture,
} from './utils';

const review = ( page: Page ) => page.locator( '[data-wfd-control="H9"]' );
const field = ( page: Page ) => page.locator( '[data-wfd-name-field]' );
const labelOf = ( page: Page, id: string ) =>
    page.locator( `[data-wfd-artboard="${ id }"] .wfd-artboard__label` );
const titleOf = async ( requestUtils: any, path: string ) =>
    (
        await requestUtils.rest( {
            path,
            params: { context: 'edit' },
        } )
    ).title.raw;

test.describe( 'NAME', () => {
    let fixture: Fixture;
    test.beforeEach( async ( { page, requestUtils } ) => {
        fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
    } );

    test( 'AC-NAME-01 Double-clicking the label of a page or pattern artboard puts its name in a text field; Enter keeps the new name, which shows in the label and the left panel at once and in Review with the line "Title: changed"; saving from Review writes it to the site', async ( {
        page,
        requestUtils,
    } ) => {
        const about = artboardOf( fixture, 'page' );
        const canvas = page.locator( '[data-wfd-region="canvas"]' );
        await expect( labelOf( page, about.id ) ).toHaveText(
            'About · Page · Desktop'
        );
        await labelOf( page, about.id )
            .locator( '.wfd-artboard__label-text' )
            .dblclick();

        // The name is in a text field, selected; the rest of the label stays.
        await expect( field( page ) ).toHaveCount( 1 );
        await expect( field( page ) ).toBeFocused();
        await expect( field( page ) ).toHaveValue( 'About' );
        await expect( field( page ) ).toHaveAccessibleName( 'Name' );
        expect(
            await field( page ).evaluate( ( input: HTMLInputElement ) => [
                input.selectionStart,
                input.selectionEnd,
            ] )
        ).toEqual( [ 0, 5 ] );
        await expect( labelOf( page, about.id ) ).toContainText(
            '· Page · Desktop'
        );
        // It did not enter edit, and the artboard is selected.
        await expect( page.locator( '[data-wfd-tier="live"]' ) ).toHaveCount(
            0
        );
        await expect(
            page.locator( `[data-wfd-artboard="${ about.id }"]` )
        ).toHaveClass( /is-selected/ );

        // Typing does not reach the board: Backspace removes no artboard.
        await page.keyboard.type( 'Our storyx' );
        await page.keyboard.press( 'Backspace' );
        await expect( page.getByRole( 'alertdialog' ) ).toHaveCount( 0 );
        await page.keyboard.press( 'Enter' );
        await expect( field( page ) ).toHaveCount( 0 );
        await expect( canvas ).toBeFocused();

        // The new name shows at once and is not on the site yet.
        await expect( labelOf( page, about.id ) ).toHaveText(
            'Our story · Page · Desktop'
        );
        await expect(
            page.locator( `[data-wfd-row="${ about.id }"]` )
        ).toContainText( 'Our story' );
        await expect( review( page ) ).toHaveText( 'Review 1 change' );
        expect(
            await titleOf(
                requestUtils,
                `/wp/v2/pages/${ fixture.pages.about }`
            )
        ).toBe( 'About' );

        // A pattern is named the same way.
        const hero = artboardOf( fixture, 'pattern' );
        await labelOf( page, hero.id )
            .locator( '.wfd-artboard__label-text' )
            .dblclick();
        await expect( field( page ) ).toHaveValue( 'Hero' );
        await page.keyboard.type( 'Masthead' );
        await page.keyboard.press( 'Enter' );
        await expect( labelOf( page, hero.id ) ).toHaveText(
            'Masthead · Pattern · Desktop'
        );
        await expect( review( page ) ).toHaveText( 'Review 2 changes' );

        // Review lists both with the line, and saving writes the names.
        await review( page ).click();
        const drawer = page.getByRole( 'dialog', { name: 'Review changes' } );
        const cards = drawer.locator( '.wfd-review__item' );
        const cardOf = ( name: string ) =>
            (
                ( cards as any ).filter( { hasText: name } ) as typeof cards
             ).first();
        await expect( drawer ).toContainText( 'Our story' );
        await expect( drawer ).toContainText( 'Masthead' );
        await expect( drawer.getByText( 'Title: changed' ) ).toHaveCount( 2 );
        await expect( cardOf( 'Our story' ) ).toBeVisible();
        await drawer.getByRole( 'button', { name: 'Save 2 changes' } ).click();
        await expect
            .poll( () =>
                titleOf( requestUtils, `/wp/v2/pages/${ fixture.pages.about }` )
            )
            .toBe( 'Our story' );
        await expect
            .poll( () =>
                titleOf(
                    requestUtils,
                    `/wp/v2/blocks/${ fixture.patterns.hero }`
                )
            )
            .toBe( 'Masthead' );
    } );

    test( 'AC-NAME-02 F2 with one page or pattern artboard selected renames it on its label; Esc leaves the name as it was, an empty name is not kept, and a click elsewhere keeps the new name', async ( {
        page,
    } ) => {
        const about = artboardOf( fixture, 'page' );
        const canvas = page.locator( '[data-wfd-region="canvas"]' );
        const selected = page.locator( '[data-wfd-artboard].is-selected' );
        await page.locator( `[data-wfd-row="${ about.id }"]` ).click();
        await canvas.focus();

        // Esc leaves the name as it was and the artboard selected.
        await page.keyboard.press( 'F2' );
        await expect( field( page ) ).toBeFocused();
        await expect( field( page ) ).toHaveValue( 'About' );
        await page.keyboard.type( 'Thrown away' );
        await page.keyboard.press( 'Escape' );
        await expect( field( page ) ).toHaveCount( 0 );
        await expect( labelOf( page, about.id ) ).toHaveText(
            'About · Page · Desktop'
        );
        await expect( review( page ) ).toHaveText( 'Review changes' );
        await expect( review( page ) ).toBeDisabled();
        await expect( selected ).toHaveAttribute(
            'data-wfd-artboard',
            about.id
        );
        await expect( canvas ).toBeFocused();

        // An empty name is not kept.
        await page.keyboard.press( 'F2' );
        await field( page ).fill( '   ' );
        await page.keyboard.press( 'Enter' );
        await expect( field( page ) ).toHaveCount( 0 );
        await expect( labelOf( page, about.id ) ).toHaveText(
            'About · Page · Desktop'
        );
        await expect( review( page ) ).toBeDisabled();

        // A click elsewhere keeps what was typed.
        await page.keyboard.press( 'F2' );
        await field( page ).fill( 'Who we are' );
        await page
            .locator( '[data-wfd-region="right"]' )
            .getByRole( 'heading', { name: 'About' } )
            .click();
        await expect( field( page ) ).toHaveCount( 0 );
        await expect( labelOf( page, about.id ) ).toHaveText(
            'Who we are · Page · Desktop'
        );
        await expect( review( page ) ).toHaveText( 'Review 1 change' );

        // With several selected F2 does nothing.
        const hero = artboardOf( fixture, 'pattern' );
        await page.locator( `[data-wfd-row="${ about.id }"]` ).click();
        await page
            .locator( `[data-wfd-row="${ hero.id }"]` )
            .click( { modifiers: [ 'ControlOrMeta' ] } );
        await expect( selected ).toHaveCount( 2 );
        await canvas.focus();
        await page.keyboard.press( 'F2' );
        await expect( field( page ) ).toHaveCount( 0 );
    } );

    test( 'AC-NAME-03 The label of a page artboard in edit is renamed by a double-click, and edit goes on; a double-click on the label of a template or template part artboard, and F2 with one selected, rename nothing', async ( {
        page,
    } ) => {
        const about = artboardOf( fixture, 'page' );
        const live = page.locator( '[data-wfd-tier="live"]' );
        await enterEdit( page, about.id );
        await expect( live ).toHaveAttribute( 'data-wfd-artboard', about.id );
        await labelOf( page, about.id )
            .locator( '.wfd-artboard__label-text' )
            .dblclick();
        await expect( field( page ) ).toBeFocused();
        await expect( field( page ) ).toHaveValue( 'About' );
        // The device menu stays in the label.
        await expect(
            labelOf( page, about.id ).getByRole( 'button', {
                name: 'Artboard device',
            } )
        ).toBeVisible();
        await page.keyboard.type( 'Named in edit' );
        await page.keyboard.press( 'Enter' );
        await expect( field( page ) ).toHaveCount( 0 );
        await expect( live ).toHaveAttribute( 'data-wfd-artboard', about.id );
        await expect( page.locator( '[data-wfd-control="H7"]' ) ).toHaveText(
            'Named in edit · Page'
        );

        // Esc in the field leaves the name, and does not leave edit.
        await labelOf( page, about.id )
            .locator( '.wfd-artboard__label-text' )
            .dblclick();
        await page.keyboard.type( 'Dropped' );
        await page.keyboard.press( 'Escape' );
        await expect( field( page ) ).toHaveCount( 0 );
        await expect( live ).toHaveAttribute( 'data-wfd-artboard', about.id );
        await expect( page.locator( '[data-wfd-control="H7"]' ) ).toHaveText(
            'Named in edit · Page'
        );
        await page.getByRole( 'button', { name: 'Back to the board' } ).click();
        await expect( live ).toHaveCount( 0 );

        // A template and a template part are not named on the board.
        const canvas = page.locator( '[data-wfd-region="canvas"]' );
        await canvas.focus();
        await page.keyboard.press( 'Shift+Digit1' );
        await page.waitForTimeout( 300 );
        for ( const kind of [ 'template', 'template-part' ] as const ) {
            const artboard = artboardOf( fixture, kind );
            await labelOf( page, artboard.id )
                .locator( '.wfd-artboard__label-text' )
                .dblclick();
            await expect( field( page ) ).toHaveCount( 0 );
            await expect( live ).toHaveCount( 0 );
            await page.locator( `[data-wfd-row="${ artboard.id }"]` ).click();
            await canvas.focus();
            await page.keyboard.press( 'F2' );
            await expect( field( page ) ).toHaveCount( 0 );
        }
    } );
} );
