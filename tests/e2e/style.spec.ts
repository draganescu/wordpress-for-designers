import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import type { Page } from '@playwright/test';
import {
    resetFixture,
    openBoard,
    setViewport,
    enterEdit,
    editorFrame,
    artboardOf,
    counters,
    type Fixture,
} from './utils';

const right = ( page: Page ) => page.locator( '[data-wfd-region="right"]' );

/**
 * The computed style of an element inside an artboard's document.
 * @param page
 * @param artboardId
 * @param selector
 * @param property
 */
const styleIn = async (
    page: Page,
    artboardId: string,
    selector: string,
    property: string
) =>
    page
        .locator( `[data-wfd-artboard="${ artboardId }"] iframe` )
        .first()
        .evaluate(
            ( frame: HTMLIFrameElement, [ sel, prop ] ) => {
                const element = frame.contentDocument?.querySelector( sel );
                return element
                    ? frame.contentWindow!.getComputedStyle( element )[
                          prop as any
                      ]
                    : null;
            },
            [ selector, property ]
        );

const stylesId = ( page: Page ) =>
    page.evaluate( () =>
        ( window as any ).wp.data
            .select( 'core' )
            .__experimentalGetCurrentGlobalStylesId()
    );

const setColor = async ( page: Page, name: string, hex: string ) => {
    await right( page )
        .locator( '.wfd-row', {
            has: page.locator( '.wfd-row__name', {
                hasText: new RegExp( `^${ name }$` ),
            } ),
        } )
        .click();
    await page
        .locator( '.components-color-palette__custom-color-button' )
        .click();
    const input = page
        .locator(
            '.components-color-picker input[type="text"], .components-color-picker input.components-input-control__input'
        )
        .first();
    await input.fill( hex.replace( '#', '' ) );
    await input.press( 'Enter' );
};

test.describe( 'STYLE', () => {
    let fixture: Fixture;
    test.beforeEach( async ( { page, requestUtils } ) => {
        fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
    } );

    test( 'AC-STYLE-01 Styles is shown only in the right panel and only when nothing is selected', async ( {
        page,
    } ) => {
        const heading = page.getByRole( 'heading', {
            name: 'Styles',
            exact: true,
        } );
        await expect( heading ).toHaveCount( 1 );
        await expect(
            right( page ).getByRole( 'heading', {
                name: 'Styles',
                exact: true,
            } )
        ).toBeVisible();
        await expect( page.locator( '.wfd-styles' ) ).toHaveCount( 1 );
        await expect( right( page ).locator( '.wfd-styles' ) ).toHaveCount( 1 );
        // No Styles button or mode anywhere else.
        await expect(
            page
                .locator( '[data-wfd-region="header"]' )
                .getByRole( 'button', { name: /styles/i } )
        ).toHaveCount( 0 );
        await expect(
            page
                .locator( '[data-wfd-region="left"]' )
                .getByText( 'Styles', { exact: true } )
        ).toHaveCount( 0 );

        // Selected: artboard settings instead.
        const hero = artboardOf( fixture, 'pattern' );
        await page.locator( `[data-wfd-row="${ hero.id }"]` ).click();
        await expect( page.locator( '.wfd-styles' ) ).toHaveCount( 0 );
        await expect( heading ).toHaveCount( 0 );

        // In edit: the editing tabs instead.
        await enterEdit( page, hero.id );
        await expect( page.locator( '.wfd-styles' ) ).toHaveCount( 0 );
        await expect( heading ).toHaveCount( 0 );

        // Nothing selected again: Styles is back.
        await page.getByRole( 'button', { name: 'Back to the board' } ).click();
        await page.locator( '[data-wfd-region="canvas"]' ).focus();
        await page.keyboard.press( 'Escape' );
        await expect( right( page ).locator( '.wfd-styles' ) ).toHaveCount( 1 );
    } );

    test( 'AC-STYLE-02 Changing a colour token repaints every Preview and Live artboard without saving, and adds Styles to Review', async ( {
        page,
        requestUtils,
    } ) => {
        const hero = artboardOf( fixture, 'pattern' );
        const about = artboardOf( fixture, 'page' );
        await setViewport( page, { x: -300, y: -120, zoom: 0.25 } );
        const paragraph = '.has-accent-1-background-color';
        await expect
            .poll( () =>
                styleIn( page, hero.id, paragraph, 'backgroundColor' )
            )
            .toBe( 'rgb(255, 238, 88)' );
        await expect
            .poll( () =>
                styleIn( page, about.id, paragraph, 'backgroundColor' )
            )
            .toBe( 'rgb(255, 238, 88)' );

        await setColor( page, 'Accent 1', '#112233' );
        await expect
            .poll( () =>
                styleIn( page, hero.id, paragraph, 'backgroundColor' )
            )
            .toBe( 'rgb(17, 34, 51)' );
        await expect
            .poll( () =>
                styleIn( page, about.id, paragraph, 'backgroundColor' )
            )
            .toBe( 'rgb(17, 34, 51)' );
        await expect( page.locator( '[data-wfd-control="H9"]' ) ).toHaveText(
            'Review 1 change'
        );
        await page.keyboard.press( 'Escape' );
        await page.keyboard.press( 'Escape' );

        // The Live artboard repaints too.
        await enterEdit( page, hero.id );
        await expect
            .poll( () =>
                styleIn( page, hero.id, paragraph, 'backgroundColor' )
            )
            .toBe( 'rgb(17, 34, 51)' );
        await page.getByRole( 'button', { name: 'Back to the board' } ).click();

        await page.locator( '[data-wfd-control="H9"]' ).click();
        const drawer = page.getByRole( 'dialog', { name: 'Review changes' } );
        await expect( drawer ).toContainText( 'Styles' );
        await expect( drawer ).toContainText( 'Site-wide' );

        // Not saved.
        const id = await stylesId( page );
        const saved = await requestUtils.rest< { settings: any } >( {
            path: `/wp/v2/global-styles/${ id }`,
            params: { context: 'edit' },
        } );
        expect( JSON.stringify( saved.settings ?? {} ) ).not.toContain(
            '112233'
        );
    } );

    test( 'AC-STYLE-03 One style change triggers exactly one style generation, whatever the number of artboards', async ( {
        page,
        requestUtils,
    } ) => {
        const change = async () => {
            await expect
                .poll( async () => ( await counters( page ) ).styleGenerations )
                .toBeGreaterThan( 0 );
            await page.waitForTimeout( 500 );
            const before = ( await counters( page ) ).styleGenerations;
            await setColor( page, 'Accent 2', '#445566' );
            await page.waitForTimeout( 800 );
            return ( await counters( page ) ).styleGenerations - before;
        };
        await setViewport( page, { x: 40, y: 40, zoom: 0.25 } );
        expect( await change() ).toBe( 1 );

        // The same with 30 artboards.
        const big = await resetFixture( requestUtils, { extra: 21 } );
        await openBoard( page, big.boardId, 30 );
        await setViewport( page, { x: -1560, y: 20, zoom: 0.25 } );
        await expect
            .poll( () =>
                page.locator( '[data-wfd-tier="preview"] iframe' ).count()
            )
            .toBe( 12 );
        expect( await change() ).toBe( 1 );
    } );

    test( 'AC-STYLE-04 Blocks tab lists blocks, shows change counts, and opens the stock styles panel for a block', async ( {
        page,
        requestUtils,
    } ) => {
        const id = await stylesId( page );
        await requestUtils.rest( {
            method: 'POST',
            path: `/wp/v2/global-styles/${ id }`,
            data: {
                styles: {
                    blocks: {
                        'core/button': {
                            color: { background: '#123456', text: '#ffffff' },
                        },
                        'core/quote': { typography: { fontStyle: 'italic' } },
                    },
                },
            },
        } );
        await page.reload();
        await page.locator( '[data-wfd-artboard]' ).first().waitFor();
        const panel = right( page );
        await panel.getByRole( 'tab', { name: 'Blocks' } ).click();
        const search = panel.getByRole( 'searchbox' );
        await expect( search ).toHaveAttribute(
            'placeholder',
            'Search blocks'
        );
        await expect( panel ).toContainText(
            'Each block opens the same styles panel the Site Editor uses.'
        );
        const rows = panel.getByRole( 'tabpanel' ).locator( '.wfd-row' );
        expect( await rows.count() ).toBeGreaterThan( 30 );
        const row = ( title: string ) =>
            rows.filter( {
                has: page.locator( '.wfd-row__name', {
                    hasText: new RegExp( `^${ title }$` ),
                } ),
            } );
        await expect( row( 'Button' ) ).toContainText( '2 changes' );
        await expect( row( 'Quote' ) ).toContainText( '1 change' );
        await expect( row( 'Paragraph' ) ).not.toContainText( 'change' );

        await search.fill( 'butt' );
        await expect( rows ).toHaveCount( await rows.count() );
        for ( const name of await rows
            .locator( '.wfd-row__name' )
            .allInnerTexts() ) {
            expect( name.toLowerCase() ).toContain( 'butt' );
        }

        // The stock styles panel for the block, with a way back.
        await row( 'Button' ).click();
        const stock = panel.locator( '.wfd-styles__block-styles' );
        await expect( stock ).toBeVisible();
        await expect( stock.getByText( 'Typography' ).first() ).toBeVisible();
        await expect( stock.getByText( 'Color' ).first() ).toBeVisible();
        await expect( rows ).toHaveCount( 0 );
        await panel
            .locator( '.wfd-styles__block-back' )
            .getByRole( 'button' )
            .click();
        await expect( stock ).toHaveCount( 0 );
        await expect( rows.first() ).toBeVisible();
    } );

    test( 'AC-STYLE-05 History lists revisions; picking one shows the banner and repaints; Restore makes it the edited styles; Stop previewing reverts', async ( {
        page,
        requestUtils,
    } ) => {
        const id = await stylesId( page );
        const save = ( color: string ) =>
            requestUtils.rest( {
                method: 'POST',
                path: `/wp/v2/global-styles/${ id }`,
                data: {
                    settings: {
                        color: {
                            palette: {
                                theme: [
                                    {
                                        slug: 'base',
                                        name: 'Base',
                                        color: '#FFFFFF',
                                    },
                                    {
                                        slug: 'contrast',
                                        name: 'Contrast',
                                        color: '#111111',
                                    },
                                    {
                                        slug: 'accent-1',
                                        name: 'Accent 1',
                                        color,
                                    },
                                ],
                            },
                        },
                    },
                },
            } );
        await save( '#aa0000' );
        await save( '#00aa00' );
        await page.reload();
        await page.locator( '[data-wfd-artboard]' ).first().waitFor();
        const hero = artboardOf( fixture, 'pattern' );
        const paragraph = '.has-accent-1-background-color';
        await setViewport( page, { x: -300, y: -120, zoom: 0.25 } );
        await expect
            .poll( () =>
                styleIn( page, hero.id, paragraph, 'backgroundColor' )
            )
            .toBe( 'rgb(0, 170, 0)' );

        const panel = right( page );
        await panel.getByRole( 'tab', { name: 'History' } ).click();
        const rows = panel.getByRole( 'tabpanel' ).locator( '.wfd-row' );
        await expect( rows ).toHaveCount( 3 );
        await expect( rows.last() ).toContainText( 'Theme default' );
        await expect( rows.first() ).toContainText( 'admin' );
        const restore = panel.getByRole( 'button', { name: 'Restore' } );
        const stop = panel.getByRole( 'button', { name: 'Stop previewing' } );

        // Preview the older revision.
        await rows.nth( 1 ).click();
        const banner = page.locator( '[data-wfd-banner="preview"]' );
        await expect( banner ).toContainText(
            /^Previewing styles from .+, .+ on every artboard$/
        );
        await expect( rows.nth( 1 ) ).toHaveAttribute( 'aria-current', 'true' );
        await expect
            .poll( () =>
                styleIn( page, hero.id, paragraph, 'backgroundColor' )
            )
            .toBe( 'rgb(170, 0, 0)' );
        // Previewing is not an edit.
        await expect( page.locator( '[data-wfd-control="H9"]' ) ).toHaveText(
            'Review changes'
        );

        // Stop previewing reverts the board.
        await stop.click();
        await expect( banner ).toHaveCount( 0 );
        await expect
            .poll( () =>
                styleIn( page, hero.id, paragraph, 'backgroundColor' )
            )
            .toBe( 'rgb(0, 170, 0)' );

        // Theme default previews the theme's own colour.
        await rows.last().click();
        await expect
            .poll( () =>
                styleIn( page, hero.id, paragraph, 'backgroundColor' )
            )
            .toBe( 'rgb(255, 238, 88)' );
        await stop.click();

        // Restore makes the revision the edited styles.
        await rows.nth( 1 ).click();
        await restore.click();
        await expect( banner ).toHaveCount( 0 );
        await expect
            .poll( () =>
                styleIn( page, hero.id, paragraph, 'backgroundColor' )
            )
            .toBe( 'rgb(170, 0, 0)' );
        await expect( page.locator( '[data-wfd-control="H9"]' ) ).toHaveText(
            'Review 1 change'
        );
        await expect( rows.first() ).toContainText( 'Unsaved' );
        await expect( rows ).toHaveCount( 4 );
    } );

    test( 'AC-STYLE-06 "Style applies to": "All {block}" changes the block\'s global style everywhere; "This block" changes only the selected block', async ( {
        page,
    } ) => {
        const hero = artboardOf( fixture, 'pattern' );
        const about = artboardOf( fixture, 'page' );
        await enterEdit( page, hero.id );
        const frame = editorFrame( page, hero.id );
        await frame.locator( 'h2' ).click();
        const panel = right( page );
        const group = panel.getByRole( 'radiogroup', {
            name: 'Style applies to',
        } );
        await expect( group.getByRole( 'radio' ) ).toHaveText( [
            'This block',
            'All Heading',
        ] );
        await expect( panel ).toContainText(
            'Switch to change every Heading block on the site.'
        );
        await expect(
            group.getByRole( 'radio', { name: 'This block' } )
        ).toBeChecked();
        await expect(
            panel.locator( '.block-editor-block-inspector' )
        ).toBeVisible();

        // All Heading: the stock global styles panel for the block.
        await group.getByRole( 'radio', { name: 'All Heading' } ).click();
        await expect(
            panel.locator( '.block-editor-block-inspector' )
        ).toBeHidden();
        await panel.getByRole( 'button', { name: 'Uppercase' } ).click();
        await expect
            .poll( () => styleIn( page, hero.id, 'h2', 'textTransform' ) )
            .toBe( 'uppercase' );
        // Every Heading on the board, here the About page's Preview.
        await expect
            .poll( () =>
                styleIn(
                    page,
                    about.id,
                    'h2.wp-block-heading',
                    'textTransform'
                )
            )
            .toBe( 'uppercase' );
        // The paragraph is another block type and is untouched.
        expect(
            await styleIn(
                page,
                hero.id,
                'p.has-accent-1-background-color',
                'textTransform'
            )
        ).toBe( 'none' );
        await expect( page.locator( '[data-wfd-control="H9"]' ) ).toHaveText(
            'Review 1 change'
        );

        // This block: only the selected block changes.
        await group.getByRole( 'radio', { name: 'This block' } ).click();
        await expect(
            panel.locator( '.block-editor-block-inspector' )
        ).toBeVisible();
        await frame.locator( 'p', { hasText: 'Hero paragraph.' } ).click();
        await expect( group.getByRole( 'radio' ).nth( 1 ) ).toHaveText(
            'All Paragraph'
        );
        const heroText = () =>
            styleIn(
                page,
                hero.id,
                'p.has-accent-1-background-color',
                'fontSize'
            );
        const aboutText = () =>
            styleIn(
                page,
                about.id,
                'p.has-accent-1-background-color',
                'fontSize'
            );
        const before = await aboutText();
        await panel
            .getByRole( 'radio', { name: 'Extra Large', exact: true } )
            .click();
        await expect.poll( heroText ).not.toBe( before );
        expect( await aboutText() ).toBe( before );
        await expect( page.locator( '[data-wfd-control="H9"]' ) ).toHaveText(
            'Review 2 changes'
        );
    } );

    test( 'AC-STYLE-07 Choosing a variation repaints the board once and adds Styles to Review', async ( {
        page,
    } ) => {
        await setViewport( page, { x: 40, y: 40, zoom: 0.25 } );
        const index = artboardOf( fixture, 'template' );
        await expect
            .poll( () => styleIn( page, index.id, 'body', 'backgroundColor' ) )
            .toBe( 'rgb(255, 255, 255)' );
        await page.waitForTimeout( 500 );
        const before = ( await counters( page ) ).styleGenerations;

        const menu = right( page ).getByRole( 'button', {
            name: 'Variation: Default',
        } );
        await menu.click();
        const items = page.getByRole( 'menuitemradio' );
        expect( await items.count() ).toBeGreaterThan( 2 );
        await expect( items.filter( { hasText: 'Evening' } ) ).toHaveCount( 1 );
        await items.filter( { hasText: 'Evening' } ).click();
        await expect(
            right( page ).getByRole( 'button', { name: 'Variation: Evening' } )
        ).toBeVisible();
        await expect
            .poll( () => styleIn( page, index.id, 'body', 'backgroundColor' ) )
            .not.toBe( 'rgb(255, 255, 255)' );
        await page.waitForTimeout( 800 );
        expect( ( await counters( page ) ).styleGenerations - before ).toBe(
            1
        );
        await expect( page.locator( '[data-wfd-control="H9"]' ) ).toHaveText(
            'Review 1 change'
        );
        await page.locator( '[data-wfd-control="H9"]' ).click();
        await expect(
            page.getByRole( 'dialog', { name: 'Review changes' } )
        ).toContainText( 'Styles' );
    } );
} );
