import { readFileSync } from 'fs';
import { createRequire } from 'module';
import type { Page } from '@playwright/test';
import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import {
    resetFixture,
    openBoard,
    enterEdit,
    editorFrame,
    artboardOf,
} from './utils';

// The engine of the scan WordPress's end-to-end utilities use.
const AXE_SOURCE = readFileSync(
    createRequire( __filename ).resolve( 'axe-core/axe.min.js' ),
    'utf8'
);

/**
 * Runs the scan with the default rules on the plugin's document. The artboard
 * iframes hold WordPress's own editor markup and the site's content, which the
 * plugin does not produce (open question OQ-17), so the engine is not put
 * inside them.
 *
 * @param page The page.
 * @return The violations, shortened for reading.
 */
async function scan( page: Page ) {
    await page.evaluate( AXE_SOURCE );
    return page.evaluate( async () => {
        const results = await ( window as any ).axe.run( document, {
            resultTypes: [ 'violations' ],
        } );
        return results.violations.map( ( violation: any ) => ( {
            id: violation.id,
            nodes: violation.nodes
                .slice( 0, 4 )
                .map( ( node: any ) => `${ node.target.join( ' >> ' ) }` ),
        } ) );
    } );
}

/**
 * Buttons of the plugin's own chrome that show an icon and no text.
 *
 * @param page The page.
 * @return For each one, its accessible name and where it is.
 */
async function iconOnlyControls( page: Page ) {
    return page.evaluate( () =>
        [ ...document.querySelectorAll( 'button, [role="button"]' ) ]
            .filter(
                ( element ) =>
                    ! element.closest(
                        '.wfd-slot, .block-editor-block-inspector, .block-editor-list-view-tree, .block-editor-block-toolbar, [data-wfd-artboard]'
                    ) &&
                    ( element as HTMLElement ).offsetParent !== null &&
                    ! ( element.textContent ?? '' ).trim() &&
                    !! element.querySelector( 'svg' )
            )
            .map( ( element ) => ( {
                name: element.getAttribute( 'aria-label' ) ?? '',
                control:
                    element
                        .closest( '[data-wfd-control]' )
                        ?.getAttribute( 'data-wfd-control' ) ?? '',
            } ) )
    );
}

test.describe( 'A11Y', () => {
    test( 'AC-A11Y-01 Every icon-only control has an accessible name equal to the label in screens/', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        const header = page.locator( '[data-wfd-region="header"]' );
        const left = page.locator( '[data-wfd-region="left"]' );
        const nameOf = async ( control: string ) =>
            page
                .locator( `[data-wfd-control="${ control }"]` )
                .first()
                .evaluate( ( element ) =>
                    (
                        element.closest( 'button' ) ??
                        element.querySelector( 'button' ) ??
                        element
                    ).getAttribute( 'aria-label' )
                );

        // On the board.
        expect( await nameOf( 'H2' ) ).toBe( 'Block inserter' );
        expect( await nameOf( 'H3' ) ).toBe( 'Undo' );
        expect( await nameOf( 'H4' ) ).toBe( 'Redo' );
        expect( await nameOf( 'H5' ) ).toBe( 'List view' );
        expect( await nameOf( 'L2' ) ).toBe( 'Add artboard' );
        for ( const control of await iconOnlyControls( page ) ) {
            expect( control.name, JSON.stringify( control ) ).not.toBe( '' );
        }

        // Inserter open.
        await header
            .getByRole( 'button', { name: 'Block inserter', exact: true } )
            .click();
        expect( await nameOf( 'H2' ) ).toBe( 'Close block inserter' );
        for ( const control of await iconOnlyControls( page ) ) {
            expect( control.name, JSON.stringify( control ) ).not.toBe( '' );
        }
        await header
            .getByRole( 'button', { name: 'Close block inserter' } )
            .click();

        // In edit, with the list view open and one edit made.
        const hero = artboardOf( fixture, 'pattern' );
        await enterEdit( page, hero.id );
        await expect(
            header.getByRole( 'button', { name: 'Back to the board' } )
        ).toBeVisible();
        const paragraph = editorFrame( page, hero.id ).locator( 'p', {
            hasText: 'Hero paragraph.',
        } );
        await paragraph.click();
        expect( await nameOf( 'H14' ) ).toBe( 'Hide block tools' );
        await page.keyboard.type( 'x' );
        await expect.poll( () => nameOf( 'H3' ) ).toBe( 'Undo edit, in Hero' );
        await header
            .getByRole( 'button', { name: 'Undo edit, in Hero' } )
            .click();
        await expect.poll( () => nameOf( 'H4' ) ).toBe( 'Redo edit, in Hero' );
        // The list view is open while in edit.
        await expect(
            left.getByRole( 'button', { name: 'Close list view' } )
        ).toBeVisible();
        for ( const control of await iconOnlyControls( page ) ) {
            expect( control.name, JSON.stringify( control ) ).not.toBe( '' );
        }

        // Review: the drawer's close button.
        await page.keyboard.press( 'Escape' );
        await header
            .getByRole( 'button', { name: 'Redo edit, in Hero' } )
            .click();
        await page.locator( '[data-wfd-control="H9"]' ).click();
        const drawer = page.getByRole( 'dialog', { name: 'Review changes' } );
        await expect( drawer ).toBeVisible();
        const unnamed = await drawer.evaluate(
            ( element ) =>
                [ ...element.querySelectorAll( 'button' ) ].filter(
                    ( button ) =>
                        ! ( button.textContent ?? '' ).trim() &&
                        ! button.getAttribute( 'aria-label' )
                ).length
        );
        expect( unnamed ).toBe( 0 );
    } );

    test( 'AC-A11Y-02 A keyboard-only user can select an artboard, enter edit, type, leave edit, open Review and save', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        const selected = page.locator( '[data-wfd-artboard].is-selected' );
        const live = page.locator(
            '[data-wfd-artboard][data-wfd-tier="live"]'
        );

        // Tab from the top of the page until an artboard is selected.
        await page.evaluate( () =>
            document.querySelector< HTMLElement >( ':focus' )?.blur()
        );
        for ( let i = 0; i < 40 && ! ( await selected.count() ); i++ ) {
            await page.keyboard.press( 'Tab' );
        }
        await expect( selected ).toHaveCount( 1 );
        // Tab moves on to the next artboard; pick the Hero pattern.
        const hero = artboardOf( fixture, 'pattern' );
        for ( let i = 0; i < 12; i++ ) {
            if (
                ( await selected.getAttribute( 'data-wfd-artboard' ) ) ===
                hero.id
            ) {
                break;
            }
            await page.keyboard.press( 'Tab' );
        }
        await expect( selected ).toHaveAttribute(
            'data-wfd-artboard',
            hero.id
        );

        // Enter edits it.
        await page.keyboard.press( 'Enter' );
        await expect( live ).toHaveAttribute( 'data-wfd-artboard', hero.id );
        const frame = editorFrame( page, hero.id );
        await frame.locator( '.is-root-container' ).waitFor();
        const paragraph = frame.locator( 'p', { hasText: 'Hero paragraph.' } );
        // Move into the blocks and to the paragraph.
        for ( let i = 0; i < 12; i++ ) {
            const isInside = await paragraph.evaluate( ( element ) =>
                // The caret is in the paragraph.
                element.contains(
                    element.ownerDocument.getSelection()?.anchorNode ?? null
                )
            );
            if ( isInside ) {
                break;
            }
            await page.keyboard.press( 'ArrowDown' );
            await page.waitForTimeout( 100 );
        }
        await page.keyboard.type( 'Typed by keyboard. ' );
        await expect( paragraph ).toContainText( 'Typed by keyboard.' );

        // Esc leaves edit.
        for ( let i = 0; i < 3 && ( await live.count() ); i++ ) {
            await page.keyboard.press( 'Escape' );
            await page.waitForTimeout( 150 );
        }
        await expect( live ).toHaveCount( 0 );

        // Reach Review with the keyboard and open it.
        const review = page.locator( '[data-wfd-control="H9"]' );
        const isOnReview = () =>
            review.evaluate(
                ( element ) =>
                    element.matches( ':focus' ) ||
                    !! element.querySelector( ':focus' )
            );
        for ( let i = 0; i < 60 && ! ( await isOnReview() ); i++ ) {
            await page.keyboard.press( 'Shift+Tab' );
        }
        expect( await isOnReview() ).toBe( true );
        await page.keyboard.press( 'Enter' );
        const drawer = page.getByRole( 'dialog', { name: 'Review changes' } );
        await expect( drawer ).toBeVisible();

        // Tab to Save and press it.
        const save = drawer.getByRole( 'button', { name: 'Save 1 change' } );
        const isOnSave = () =>
            save.evaluate( ( element ) => element.matches( ':focus' ) );
        for ( let i = 0; i < 30 && ! ( await isOnSave() ); i++ ) {
            await page.keyboard.press( 'Tab' );
        }
        expect( await isOnSave() ).toBe( true );
        await page.keyboard.press( 'Enter' );
        // Saved: nothing is left to review.
        await expect( drawer.locator( '.wfd-review__item' ) ).toHaveCount( 0 );
        await expect
            .poll( async () => {
                const saved = await requestUtils.rest< {
                    content: { raw: string };
                } >( {
                    path: `/wp/v2/blocks/${ fixture.patterns.hero }`,
                    params: { context: 'edit' },
                } );
                return saved.content.raw;
            } )
            .toContain( 'Typed by keyboard.' );
    } );

    test( "AC-A11Y-03 The automated accessibility scan used by WordPress's end-to-end utilities reports no violations on the Overview, Main, Styles and Review states", async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );

        // Overview: the board as it opens.
        expect( await scan( page ), 'Overview' ).toEqual( [] );

        // Styles: a colour token picked.
        const right = page.locator( '[data-wfd-region="right"]' );
        await right.locator( '.wfd-styles .wfd-row' ).first().click();
        await expect(
            page.locator( '.components-color-palette__custom-color-button' )
        ).toBeVisible();
        expect( await scan( page ), 'Styles' ).toEqual( [] );

        // Main: an artboard in edit with a block selected.
        await page.keyboard.press( 'Escape' );
        const hero = artboardOf( fixture, 'pattern' );
        await enterEdit( page, hero.id );
        await editorFrame( page, hero.id )
            .locator( 'p', { hasText: 'Hero paragraph.' } )
            .click();
        await page.keyboard.type( 'x' );
        await expect(
            page.locator( '.block-editor-block-toolbar' ).first()
        ).toBeVisible();
        expect( await scan( page ), 'Main' ).toEqual( [] );

        // Review: the drawer open with one change.
        await page.locator( '[data-wfd-control="H9"]' ).click();
        await expect(
            page.getByRole( 'dialog', { name: 'Review changes' } )
        ).toBeVisible();
        expect( await scan( page ), 'Review' ).toEqual( [] );
    } );
} );
