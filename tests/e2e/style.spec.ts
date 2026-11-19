import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import type { Page } from '@playwright/test';
import {
    resetFixture,
    openBoard,
    setViewport,
    setZoom,
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

    test( 'AC-STYLE-01 Styles is shown only in the right panel and only when no artboard, or more than one, is selected', async ( {
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
        await expect.poll( () => rows.count() ).toBeGreaterThan( 30 );
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

    test( 'AC-STYLE-07 Choosing a variation repaints the board once, Snapshot artboards included, and adds Styles to Review', async ( {
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
        await expect( items.first() ).toBeVisible();
        // The theme's whole variations only: its colour-only and type-only
        // presets are not variations.
        await expect( items ).toHaveText( [
            'Default',
            'Evening',
            'Noon',
            'Dusk',
            'Afternoon',
            'Twilight',
            'Morning',
            'Sunrise',
            'Midnight',
        ] );
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

        // A frozen copy takes a variation too, without becoming a Preview
        // (D51).
        await setZoom( page, 0.15 );
        const frame = page.locator( `[data-wfd-artboard="${ index.id }"]` );
        await expect( frame ).toHaveAttribute( 'data-wfd-tier', 'snapshot' );
        const frozenBackground = () =>
            frame
                .locator( '.wfd-snapshot__copy iframe' )
                .first()
                .evaluate( ( el: HTMLIFrameElement ) =>
                    el.contentDocument?.body
                        ? el.contentWindow!.getComputedStyle(
                              el.contentDocument.body
                          ).backgroundColor
                        : null
                )
                .catch( () => null );
        await expect.poll( frozenBackground ).not.toBeNull();
        const evening = await frozenBackground();
        await right( page )
            .getByRole( 'button', { name: 'Variation: Evening' } )
            .click();
        await items.filter( { hasText: /^Noon$/ } ).click();
        await expect
            .poll( frozenBackground, { timeout: 30000 } )
            .toBe( 'rgb(248, 247, 245)' );
        expect( evening ).not.toBe( 'rgb(248, 247, 245)' );
        await expect( frame ).toHaveAttribute( 'data-wfd-tier', 'snapshot' );

        await expect( page.locator( '[data-wfd-control="H9"]' ) ).toHaveText(
            'Review 1 change'
        );
        await page.locator( '[data-wfd-control="H9"]' ).click();
        await expect(
            page.getByRole( 'dialog', { name: 'Review changes' } )
        ).toContainText( 'Styles' );
    } );

    test( 'AC-STYLE-08 In the Tokens tab, Edit on a group and the Background and Shadows rows open the stock styles screens', async ( {
        page,
    } ) => {
        await setViewport( page, { x: 40, y: 40, zoom: 0.25 } );
        const panel = right( page );
        const tokens = panel.getByRole( 'tabpanel' );
        const back = panel.getByRole( 'button', { name: 'Back', exact: true } );
        const edit = ( group: string ) =>
            panel.getByRole( 'button', {
                name: `Edit ${ group }`,
                exact: true,
            } );
        const row = ( name: string ) =>
            tokens.locator( '.wfd-row', {
                has: page.locator( '.wfd-row__name', {
                    hasText: new RegExp( `^${ name }$` ),
                } ),
            } );

        // Each entry opens its stock screen in place of the tokens, and the
        // screen's own Back control returns to them.
        const entries: [ ReturnType< typeof edit >, string ][] = [
            [ edit( 'Colors' ), 'Colors' ],
            [ edit( 'Typography' ), 'Typography' ],
            [ edit( 'Spacing' ), 'Layout' ],
            [ row( 'Background' ), 'Background' ],
            [ row( 'Shadows' ), 'Shadows' ],
        ];
        for ( const [ entry, title ] of entries ) {
            await expect( entry ).toHaveText( /^(Edit|Background|Shadows)$/ );
            await entry.click();
            const stock = panel.locator(
                '.global-styles-ui-sidebar__navigator-provider'
            );
            await expect( stock ).toBeVisible();
            await expect(
                stock
                    .getByRole( 'heading', { name: title, exact: true } )
                    .first()
            ).toBeVisible();
            await expect( back ).toHaveCount( 1 );
            await expect( edit( 'Colors' ) ).toHaveCount( 0 );
            await expect( tokens.locator( '.wfd-row' ) ).toHaveCount( 0 );
            await back.click();
            await expect( stock ).toHaveCount( 0 );
            await expect( edit( 'Colors' ) ).toBeVisible();
        }

        // A screen under the stock screen goes back to it, not to the tokens.
        await edit( 'Typography' ).click();
        // The base text's screen opens (it needs a stock styles package
        // that matches the WordPress in use).
        await panel
            .getByRole( 'button', { name: 'Text', exact: true } )
            .click();
        await expect( panel ).toContainText(
            'Manage the fonts used on the site.'
        );
        await back.click();
        await panel
            .getByRole( 'button', { name: 'Font size presets' } )
            .click();
        await expect(
            panel.getByRole( 'heading', { name: 'Font size presets' } )
        ).toBeVisible();
        await back.click();
        await expect(
            panel.getByRole( 'heading', { name: 'Typography', exact: true } )
        ).toBeVisible();
        await back.click();
        await expect( edit( 'Typography' ) ).toBeVisible();

        // A change made in a stock screen repaints the board and is a
        // Styles change in Review.
        const index = artboardOf( fixture, 'template' );
        const contentSize = () =>
            page
                .locator( `[data-wfd-artboard="${ index.id }"] iframe` )
                .first()
                .evaluate( ( frame: HTMLIFrameElement ) =>
                    frame.contentDocument?.body
                        ? frame
                              .contentWindow!.getComputedStyle(
                                  frame.contentDocument.body
                              )
                              .getPropertyValue(
                                  '--wp--style--global--content-size'
                              )
                              .trim()
                        : null
                )
                .catch( () => null );
        await expect.poll( contentSize ).toBe( '645px' );
        await expect( page.locator( '[data-wfd-control="H9"]' ) ).toHaveText(
            'Review changes'
        );
        await edit( 'Spacing' ).click();
        const width = panel.getByRole( 'spinbutton', {
            name: 'Content width',
        } );
        await width.fill( '500' );
        await width.press( 'Enter' );
        await expect.poll( contentSize ).toBe( '500px' );
        await expect( page.locator( '[data-wfd-control="H9"]' ) ).toHaveText(
            'Review 1 change'
        );
        await page.locator( '[data-wfd-control="H9"]' ).click();
        await expect(
            page.getByRole( 'dialog', { name: 'Review changes' } )
        ).toContainText( 'Styles' );
    } );

    test( 'AC-STYLE-09 The Blocks tab lists the elements in groups before the blocks, and an element row opens the stock styles screen for it', async ( {
        page,
    } ) => {
        await setViewport( page, { x: 40, y: 40, zoom: 0.25 } );
        const panel = right( page );
        await panel.getByRole( 'tab', { name: 'Blocks' } ).click();
        const list = panel.getByRole( 'tabpanel' );
        await expect( list.getByRole( 'heading' ) ).toHaveText( [
            'Elements',
            'Headings',
            'Form controls',
            'Blocks',
        ] );
        const names = list.locator( '.wfd-row__name' );
        await expect( names.nth( 13 ) ).toBeVisible();
        expect( ( await names.allInnerTexts() ).slice( 0, 14 ) ).toEqual( [
            'Link',
            'Caption',
            'Citation',
            'All headings',
            'Heading 1',
            'Heading 2',
            'Heading 3',
            'Heading 4',
            'Heading 5',
            'Heading 6',
            'Form input',
            'Form select',
            'Form button',
            'Paragraph',
        ] );

        // The search finds an element by name and by its group's title.
        const search = panel.getByRole( 'searchbox' );
        await search.fill( 'h1' );
        await expect( names ).toHaveText( [ 'Heading 1' ] );
        await search.fill( 'form controls' );
        await expect( names ).toHaveText( [
            'Form input',
            'Form select',
            'Form button',
        ] );
        await expect( list.getByRole( 'heading' ) ).toHaveText( [
            'Form controls',
        ] );
        await search.fill( '' );

        // An element opens its stock screen; a change there repaints the
        // board, is counted on its row and is a Styles change in Review.
        const index = artboardOf( fixture, 'template' );
        const ratio = () =>
            page
                .locator( `[data-wfd-artboard="${ index.id }"] iframe` )
                .first()
                .evaluate( ( frame: HTMLIFrameElement ) => {
                    const heading = frame.contentDocument?.querySelector(
                        'h1, h2, h3, h4, h5, h6'
                    );
                    if ( ! heading ) {
                        return null;
                    }
                    const style =
                        frame.contentWindow!.getComputedStyle( heading );
                    return Math.round(
                        parseFloat( style.lineHeight ) /
                            parseFloat( style.fontSize )
                    );
                } )
                .catch( () => null );
        await expect.poll( ratio ).toBe( 1 );
        const row = list.locator( '.wfd-row', {
            has: page.locator( '.wfd-row__name', {
                hasText: /^All headings$/,
            } ),
        } );
        await expect( row ).not.toContainText( 'change' );
        await row.click();
        const stock = panel.locator(
            '.global-styles-ui-sidebar__navigator-provider'
        );
        await expect(
            stock.getByRole( 'heading', { name: 'All headings' } ).first()
        ).toBeVisible();
        await expect( stock ).toContainText(
            'Manage the appearance of all headings.'
        );
        const lineHeight = stock.getByRole( 'spinbutton', {
            name: 'Line height',
        } );
        await lineHeight.fill( '3' );
        await lineHeight.press( 'Enter' );
        await expect.poll( ratio ).toBe( 3 );
        await expect( page.locator( '[data-wfd-control="H9"]' ) ).toHaveText(
            'Review 1 change'
        );
        await stock
            .getByRole( 'button', { name: 'Back', exact: true } )
            .click();
        await expect( row ).toContainText( '1 change' );
        await page.locator( '[data-wfd-control="H9"]' ).click();
        await expect(
            page.getByRole( 'dialog', { name: 'Review changes' } )
        ).toContainText( 'Styles' );
    } );

    test( "AC-STYLE-10 The variation menu reads Default for the theme's own styles, the name for exactly a variation and Custom after any further change; its Default item returns to the theme's styles", async ( {
        page,
    } ) => {
        await setViewport( page, { x: 40, y: 40, zoom: 0.25 } );
        const panel = right( page );
        const trigger = panel.getByRole( 'button', { name: /^Variation:/ } );
        const items = page.getByRole( 'menuitemradio' );
        const pick = async ( name: string ) => {
            await trigger.click();
            await items
                .filter( { hasText: new RegExp( `^${ name }$` ) } )
                .click();
        };
        const index = artboardOf( fixture, 'template' );
        const background = () =>
            styleIn( page, index.id, 'body', 'backgroundColor' );
        await expect.poll( background ).toBe( 'rgb(255, 255, 255)' );

        // The theme's own styles.
        await expect( trigger ).toHaveText( 'Variation: Default' );
        await trigger.click();
        await expect( items.first() ).toHaveText( 'Default' );
        await expect( items.first() ).toHaveAttribute( 'aria-checked', 'true' );
        await page.keyboard.press( 'Escape' );

        // Exactly a variation.
        await pick( 'Sunrise' );
        await expect( trigger ).toHaveText( 'Variation: Sunrise' );
        await expect.poll( background ).not.toBe( 'rgb(255, 255, 255)' );
        await trigger.click();
        await expect(
            items.filter( { hasText: /^Sunrise$/ } )
        ).toHaveAttribute( 'aria-checked', 'true' );
        await page.keyboard.press( 'Escape' );

        // A variation with another typeset is neither.
        await panel
            .getByRole( 'button', { name: 'Edit Typography', exact: true } )
            .click();
        await panel
            .getByRole( 'button', { name: 'Beiruti & Literata', exact: true } )
            .click();
        await expect( trigger ).toHaveText( 'Variation: Custom' );
        await trigger.click();
        await expect( items.first() ).toBeVisible();
        await expect(
            page.locator( '[role="menuitemradio"][aria-checked="true"]' )
        ).toHaveCount( 0 );

        // "Default" returns to the theme's own styles.
        await items.filter( { hasText: /^Default$/ } ).click();
        await expect( trigger ).toHaveText( 'Variation: Default' );
        await expect.poll( background ).toBe( 'rgb(255, 255, 255)' );
        await expect( page.locator( '[data-wfd-control="H9"]' ) ).toHaveText(
            'Review changes'
        );

        // The theme's styles with one colour changed are custom too.
        await panel
            .getByRole( 'button', { name: 'Back', exact: true } )
            .click();
        await setColor( page, 'Accent 1', '#112233' );
        await expect( trigger ).toHaveText( 'Variation: Custom' );
    } );
} );
