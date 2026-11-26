import fs from 'fs';
import path from 'path';
import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import {
    resetFixture,
    openBoard,
    enterEdit,
    editorFrame,
    artboardOf,
    viewportOf,
    setViewport,
    postLock,
    tiersOf,
    armNew,
    openInserter,
    type Fixture,
} from './utils';

test.describe( 'EDIT', () => {
    let fixture: Fixture;
    test.beforeEach( async ( { page, requestUtils } ) => {
        fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
    } );

    test( 'AC-EDIT-01 Double-click or Enter enters edit: document bar, list view, device menu on the label', async ( {
        page,
    } ) => {
        const header = artboardOf( fixture, 'template-part' );
        await enterEdit( page, header.id );
        const bar = page.locator( '[data-wfd-control="H7"]' );
        await expect( bar ).toHaveText( 'Header · Template part' );
        await expect(
            bar.getByRole( 'button', { name: 'Back to the board' } )
        ).toBeVisible();
        const left = page.locator( '[data-wfd-region="left"]' );
        await expect(
            left.getByRole( 'heading', { name: 'List view' } )
        ).toBeVisible();
        await expect(
            left.getByRole( 'treegrid' ).getByRole( 'row' ).first()
        ).toBeVisible();
        await expect(
            page.locator( '[data-wfd-control="H5"]' )
        ).toHaveAttribute( 'aria-pressed', 'true' );
        const label = page.locator(
            `[data-wfd-artboard="${ header.id }"] .wfd-artboard__label`
        );
        await expect( label ).toContainText( 'Header · Template part' );
        const device = label.getByRole( 'button', { name: 'Artboard device' } );
        await expect( device ).toHaveText( 'Artboard deviceDesktop' );
        await expect( device ).toHaveAccessibleName(
            'Artboard device Desktop'
        );
        await device.click();
        await expect( page.getByRole( 'menuitemradio' ) ).toHaveText( [
            'Desktop',
            'Tablet',
            'Mobile',
        ] );
        await page.keyboard.press( 'Escape' );
        await bar.getByRole( 'button', { name: 'Back to the board' } ).click();
        await expect( page.locator( '[data-wfd-tier="live"]' ) ).toHaveCount(
            0
        );

        // Enter on a selected artboard.
        const hero = artboardOf( fixture, 'pattern' );
        await page.locator( `[data-wfd-row="${ hero.id }"]` ).click();
        await page.locator( '[data-wfd-region="canvas"]' ).focus();
        await page.keyboard.press( 'Enter' );
        await expect(
            page.locator( `[data-wfd-artboard="${ hero.id }"]` )
        ).toHaveAttribute( 'data-wfd-tier', 'live' );
        await expect( bar ).toHaveText( 'Hero · Pattern' );
    } );

    test( 'AC-EDIT-02 With a block selected the stock block toolbar is in the header, never over the canvas', async ( {
        page,
    } ) => {
        const header = artboardOf( fixture, 'template-part' );
        await enterEdit( page, header.id );
        await expect(
            page.locator( '.block-editor-block-toolbar' )
        ).toHaveCount( 0 );
        await editorFrame( page, header.id )
            .locator( 'p', { hasText: 'Fixture header text' } )
            .click();
        const toolbar = page.locator(
            '[data-wfd-control="H6"] .block-editor-block-toolbar'
        );
        await expect( toolbar ).toBeVisible();
        await expect(
            page.locator( '.block-editor-block-toolbar' )
        ).toHaveCount( 1 );
        await expect(
            page.locator(
                '[data-wfd-region="canvas"] .block-editor-block-toolbar, .components-popover .block-editor-block-toolbar'
            )
        ).toHaveCount( 0 );
        // It is the stock toolbar for the selected block.
        await expect(
            toolbar.getByRole( 'button', { name: 'Bold' } )
        ).toBeVisible();
        const headerBox = ( await page
            .locator( '[data-wfd-region="header"]' )
            .boundingBox() )!;
        const box = ( await toolbar.boundingBox() )!;
        expect( box.y + box.height ).toBeLessThanOrEqual(
            headerBox.y + headerBox.height + 1
        );
    } );

    test( 'AC-EDIT-03 The Block tab shows the stock inspector for the selected block', async ( {
        page,
    } ) => {
        const header = artboardOf( fixture, 'template-part' );
        await enterEdit( page, header.id );
        const right = page.locator( '[data-wfd-region="right"]' );
        await expect( right.getByRole( 'tab' ) ).toHaveText( [
            'Template part',
            'Block',
        ] );
        await expect(
            right.getByRole( 'tab', { name: 'Template part' } )
        ).toHaveAttribute( 'aria-selected', 'true' );
        await editorFrame( page, header.id )
            .locator( 'p', { hasText: 'Fixture header text' } )
            .click();
        await expect(
            right.getByRole( 'tab', { name: 'Block' } )
        ).toHaveAttribute( 'aria-selected', 'true' );
        const inspector = right.locator( '.block-editor-block-inspector' );
        await expect( inspector ).toBeVisible();
        await expect(
            inspector.locator( '.block-editor-block-card__title' )
        ).toContainText( 'Paragraph' );
        await expect(
            inspector.getByText( 'Typography' ).first()
        ).toBeVisible();
    } );

    test( 'AC-EDIT-04 A new empty artboard shows only the stock empty paragraph with its placeholder and add-block button', async ( {
        page,
    } ) => {
        await armNew( page, 'Patterns', 'New pattern' );
        const canvas = ( await page
            .locator( '[data-wfd-region="canvas"]' )
            .boundingBox() )!;
        await page.mouse.move( canvas.x + 280, canvas.y + 480 );
        await page.mouse.move( canvas.x + 300, canvas.y + 500, { steps: 2 } );
        await page.mouse.down();
        await page.mouse.up();
        const live = page.locator( '[data-wfd-tier="live"]' );
        await expect( live ).toHaveAttribute( 'data-wfd-kind', 'pattern' );
        const id = ( await live.getAttribute( 'data-wfd-artboard' ) )!;
        const frame = editorFrame( page, id );

        // The stock empty state: one empty paragraph with its placeholder.
        const paragraph = frame.locator( '.is-root-container p' );
        await expect( paragraph ).toHaveCount( 1 );
        await expect( paragraph )
            .toHaveAttribute(
                'data-rich-text-placeholder',
                'Type / to choose a block'
            )
            .catch( async () => {
                await expect(
                    frame.locator(
                        '[data-rich-text-placeholder="Type / to choose a block"]'
                    )
                ).toHaveCount( 1 );
            } );
        await expect( paragraph ).toHaveText( '' );
        // Its add-block button is the stock inserter toggle.
        await paragraph.click();
        const add = page.getByRole( 'button', { name: 'Add block' } );
        await expect( add ).toBeVisible();
        const addBox = ( await add.boundingBox() )!;
        const paragraphBox = ( await paragraph.boundingBox() )!;
        const frameBoxInPage = ( await live
            .locator( 'iframe[name="editor-canvas"]' )
            .boundingBox() )!;
        // Bounding boxes of elements in the canvas document are already in
        // page coordinates.
        const centre = addBox.y + addBox.height / 2;
        expect( centre ).toBeGreaterThan( paragraphBox.y - 8 );
        expect( centre ).toBeLessThan(
            paragraphBox.y + paragraphBox.height + 8
        );
        expect( addBox.x ).toBeGreaterThanOrEqual( frameBoxInPage.x );
        expect( addBox.x + addBox.width ).toBeLessThanOrEqual(
            frameBoxInPage.x + frameBoxInPage.width + 1
        );

        // No plugin element inside the artboard's document, and nothing but
        // the stock canvas inside its frame.
        const pluginNodes = await frame
            .locator( 'body' )
            .evaluate(
                ( body ) =>
                    body.ownerDocument.querySelectorAll(
                        '[class*="wfd-"], [data-wfd-artboard], [id^="wfd"]'
                    ).length
            );
        expect( pluginNodes ).toBe( 0 );
        const bodyChildren = await frame.locator( 'body' ).evaluate( ( body ) =>
            Array.from( body.children )
                // WordPress adds style elements and an SVG with its duotone
                // filter definitions next to the blocks.
                .filter(
                    ( el ) =>
                        ! [ 'style', 'link', 'svg' ].includes(
                            el.tagName.toLowerCase()
                        )
                )
                .map( ( el ) => String( el.getAttribute( 'class' ) ) )
        );
        expect( bodyChildren ).toHaveLength( 1 );
        expect( bodyChildren[ 0 ] ).toContain( 'is-root-container' );
        // The frame holds the stock canvas and nothing of the plugin's.
        await expect( live.locator( '.wfd-artboard__frame > *' ) ).toHaveCount(
            1
        );
        await expect(
            live.locator( '.wfd-artboard__frame [class*="wfd-"]' )
        ).toHaveCount( 0 );
        await expect(
            live.locator(
                '.wfd-artboard__frame > .block-editor-block-canvas, .wfd-artboard__frame > .block-editor-tools-back-compat, .wfd-artboard__frame > div'
            )
        ).toHaveCount( 1 );
    } );

    test( 'AC-EDIT-05 A page artboard shows its template around the content and template blocks cannot be edited', async ( {
        page,
    } ) => {
        const about = artboardOf( fixture, 'page' );
        await enterEdit( page, about.id );
        const frame = editorFrame( page, about.id );
        // The page's own content, inside the template's header and footer.
        const content = frame.locator( 'p', { hasText: 'About paragraph.' } );
        await expect( content ).toBeVisible();
        const headerPart = frame.locator( 'header.wp-block-template-part' );
        const footerPart = frame.locator( 'footer.wp-block-template-part' );
        await expect( headerPart ).toBeVisible();
        await expect( footerPart ).toBeVisible();
        const y = async ( locator: typeof content ) =>
            ( await locator.boundingBox() )!.y;
        expect( await y( headerPart ) ).toBeLessThan( await y( content ) );
        expect( await y( content ) ).toBeLessThan( await y( footerPart ) );

        // Page content is editable.
        await content.click();
        await page.keyboard.press( 'End' );
        await page.keyboard.type( ' Edited' );
        await expect( content ).toHaveText( 'About paragraph. Edited' );

        // Template blocks are not: clicking one selects nothing editable and
        // typing changes nothing.
        const templateText = headerPart.locator( 'p', {
            hasText: 'Fixture header text',
        } );
        await expect( templateText ).toBeVisible();
        await page.keyboard.press( 'Escape' );
        await templateText.click( { force: true } );
        await page.keyboard.type( 'ZZZ' );
        await expect( templateText ).toHaveText( 'Fixture header text' );
        await expect( content ).toHaveText( 'About paragraph. Edited' );
        await expect(
            page
                .locator( '[data-wfd-control="H6"]' )
                .getByRole( 'button', { name: 'Bold' } )
        ).toHaveCount( 0 );
        const mode = await page.evaluate( () => {
            const registry = ( window as any ).wfdTest.editorBridge.current
                .registry;
            const store = registry.select( 'core/block-editor' );
            return store
                .getClientIdsWithDescendants()
                .filter( ( id: string ) => {
                    const name = store.getBlockName( id );
                    return (
                        name === 'core/template-part' ||
                        name === 'core/site-title'
                    );
                } )
                .map( ( id: string ) => store.getBlockEditingMode( id ) );
        } );
        expect( mode.length ).toBeGreaterThan( 0 );
        expect( new Set( mode ) ).toEqual( new Set( [ 'disabled' ] ) );
    } );

    test( 'AC-EDIT-06 Entering edit on a page takes the post lock and leaving releases it; a held lock shows the dialog', async ( {
        page,
        requestUtils,
    } ) => {
        const about = artboardOf( fixture, 'page' );
        const artboard = page.locator( `[data-wfd-artboard="${ about.id }"]` );
        expect( await postLock( requestUtils, fixture.pages.about ) ).toBe( 0 );
        await enterEdit( page, about.id );
        await expect
            .poll( () => postLock( requestUtils, fixture.pages.about ) )
            .toBe( 1 );
        await page.getByRole( 'button', { name: 'Back to the board' } ).click();
        await expect
            .poll( () => postLock( requestUtils, fixture.pages.about ) )
            .toBe( 0 );

        // Another user holds the lock.
        await postLock(
            requestUtils,
            fixture.pages.about,
            fixture.users.wfd_admin2
        );
        await artboard.locator( '.wfd-artboard__frame' ).dblclick( {
            position: { x: 10, y: 10 },
        } );
        const dialog = page.getByRole( 'alertdialog' );
        await expect( dialog ).toContainText(
            'This post is already being edited'
        );
        await expect( dialog ).toContainText(
            'Second Admin is currently working on this post, which means you cannot make changes, unless you take over.'
        );
        await expect( artboard ).not.toHaveAttribute( 'data-wfd-tier', 'live' );
        await expect( page.locator( '[data-wfd-tier="live"]' ) ).toHaveCount(
            0
        );
        await dialog.getByRole( 'button', { name: 'Cancel' } ).click();
        await expect( dialog ).toHaveCount( 0 );
        expect( ( await tiersOf( page ) )[ about.id ] ).not.toBe( 'live' );
        await expect( artboard ).toHaveClass( /is-selected/ );
        expect( await postLock( requestUtils, fixture.pages.about ) ).toBe(
            fixture.users.wfd_admin2
        );

        // Take over.
        await page.locator( '[data-wfd-region="canvas"]' ).focus();
        await page.keyboard.press( 'Enter' );
        await expect( dialog ).toBeVisible();
        await dialog.getByRole( 'button', { name: 'Take over' } ).click();
        await expect( artboard ).toHaveAttribute( 'data-wfd-tier', 'live' );
        await expect
            .poll( () => postLock( requestUtils, fixture.pages.about ) )
            .toBe( 1 );
        const content = editorFrame( page, about.id ).locator( 'p', {
            hasText: 'About paragraph.',
        } );
        await content.click();
        await page.keyboard.type( 'X' );
        await expect( content ).toContainText( 'X' );

        // Someone else takes it while this user is editing.
        await postLock(
            requestUtils,
            fixture.pages.about,
            fixture.users.wfd_admin2
        );
        await page.evaluate( () => ( window as any ).wfdTest.refreshLock?.() );
        const taken = page.getByRole( 'dialog' );
        await expect( taken ).toContainText(
            'Someone else has taken over this post'
        );
        await expect( taken ).toContainText(
            'Second Admin now has editing control of this post.'
        );
        await expect( page.locator( '[data-wfd-tier="live"]' ) ).toHaveCount(
            0
        );
        await taken.getByRole( 'button', { name: 'OK' } ).click();
        await expect( taken ).toHaveCount( 0 );
    } );

    test( 'AC-EDIT-07 The back button and Esc leave edit', async ( {
        page,
    } ) => {
        const header = artboardOf( fixture, 'template-part' );
        const artboard = page.locator( `[data-wfd-artboard="${ header.id }"]` );
        await enterEdit( page, header.id );
        await page.getByRole( 'button', { name: 'Back to the board' } ).click();
        await expect( artboard ).not.toHaveAttribute( 'data-wfd-tier', 'live' );
        await expect( artboard ).toHaveClass( /is-selected/ );
        await expect( page.locator( '[data-wfd-control="H7"]' ) ).toHaveText(
            'Fixture board'
        );

        await enterEdit( page, header.id );
        await page.locator( '[data-wfd-region="canvas"]' ).focus();
        await page.keyboard.press( 'Escape' );
        await expect( artboard ).not.toHaveAttribute( 'data-wfd-tier', 'live' );
        await expect( artboard ).toHaveClass( /is-selected/ );
    } );

    test( 'AC-EDIT-08 A page\'s "Template" select, in the artboard settings and in the Page tab, lists "Default template" and the site\'s custom templates; choosing one redraws the artboard, lists the page in Review with "Template: changed", and saving stores it on the page', async ( {
        page,
        requestUtils,
    } ) => {
        const about = artboardOf( fixture, 'page' );
        const artboard = page.locator( `[data-wfd-artboard="${ about.id }"]` );
        await page.locator( `[data-wfd-row="${ about.id }"]` ).click();
        const settings = page.locator( '[data-wfd-panel="settings"]' );
        const select = settings.getByRole( 'combobox', { name: 'Template' } );
        await expect( select ).toHaveValue( '' );
        const options = await select.locator( 'option' ).allInnerTexts();
        expect( options[ 0 ] ).toBe( 'Default template' );
        expect( options ).toContain( 'Page No Title' );
        // Only custom templates: the theme's Index is not one.
        expect( options ).not.toContain( 'Index' );

        // The default template shows the page's title; the other does not.
        await enterEdit( page, about.id );
        const frame = editorFrame( page, about.id );
        await expect( frame.locator( '.wp-block-post-title' ) ).toHaveCount(
            1
        );
        const tab = page.locator( '[data-wfd-panel="editing"]' );
        await tab.getByRole( 'tab', { name: 'Page' } ).click();
        const inTab = tab.getByRole( 'combobox', { name: 'Template' } );
        await expect( inTab ).toHaveValue( '' );
        await inTab.selectOption( { label: 'Page No Title' } );
        await expect( artboard ).toHaveAttribute( 'data-wfd-tier', 'live' );
        await expect(
            editorFrame( page, about.id ).locator( 'p', {
                hasText: 'About paragraph.',
            } )
        ).toBeVisible();
        await expect(
            editorFrame( page, about.id ).locator( '.wp-block-post-title' )
        ).toHaveCount( 0 );
        await expect( inTab ).toHaveValue( 'page-no-title' );

        // Back to the default is no change at all.
        const review = page.locator( '[data-wfd-control="H9"]' );
        await expect( review ).toHaveText( 'Review 1 change' );
        await inTab.selectOption( { label: 'Default template' } );
        await expect( review ).toBeDisabled();
        await inTab.selectOption( { label: 'Page No Title' } );
        await expect( review ).toHaveText( 'Review 1 change' );

        // The selected artboard's settings show the same value.
        await page.getByRole( 'button', { name: 'Back to the board' } ).click();
        await expect(
            settings.getByRole( 'combobox', { name: 'Template' } )
        ).toHaveValue( 'page-no-title' );

        // Review lists it under the page, and saving stores it.
        await review.click();
        const drawer = page.getByRole( 'dialog', { name: 'Review changes' } );
        const card = drawer.locator( '.wfd-review__item', {
            hasText: 'About',
        } );
        await expect( card ).toContainText( 'Template: changed' );
        await drawer.getByRole( 'button', { name: 'Save 1 change' } ).click();
        await expect( drawer.locator( '.wfd-review__item' ) ).toHaveCount( 0 );
        const saved = await requestUtils.rest< { template: string } >( {
            path: `/wp/v2/pages/${ fixture.pages.about }`,
            params: { context: 'edit' },
        } );
        expect( saved.template ).toBe( 'page-no-title' );
    } );

    test( 'AC-EDIT-09 At 30%, 50% and 75% zoom the editor works as at 100%: a click puts the caret in the block under the pointer, the block toolbar is in the header at full size, and the add-block button, slash inserter and link popover sit at the block they belong to', async ( {
        page,
    } ) => {
        test.setTimeout( 90000 );
        const hero = artboardOf( fixture, 'pattern' );
        const artboard = page.locator( `[data-wfd-artboard="${ hero.id }"]` );
        const frame = editorFrame( page, hero.id );
        const paragraph = frame.locator( 'p', { hasText: 'Hero paragraph.' } );
        const heading = frame.locator( 'h2', { hasText: 'Hero' } );
        const empty = frame.locator( 'p[data-empty="true"]' );
        const errors: string[] = [];
        page.on( 'pageerror', ( error ) => errors.push( error.message ) );

        for ( const zoom of [ 0.3, 0.5, 0.75 ] ) {
            await setViewport( page, {
                x: 37.5 - hero.x * zoom,
                y: 91.25 - hero.y * zoom,
                zoom,
            } );
            await enterEdit( page, hero.id );
            expect( ( await viewportOf( page ) ).zoom ).toBe( zoom );

            // The content is drawn at the zoom, at the device's width.
            const iframe = artboard.locator( 'iframe[name="editor-canvas"]' );
            const shown = ( await iframe.boundingBox() )!;
            expect( shown.width ).toBeCloseTo( 1440 * zoom, 0 );
            expect(
                await iframe.evaluate(
                    ( element: HTMLIFrameElement ) =>
                        element.contentWindow!.innerWidth
                )
            ).toBe( 1440 );

            // The iframe is as tall as its content: the last block is not
            // cut off when the first block has a top margin.
            await expect
                .poll( () =>
                    iframe.evaluate( ( element: HTMLIFrameElement ) => {
                        const last =
                            element.contentDocument!.querySelector(
                                '.is-root-container'
                            )!.lastElementChild!;
                        return (
                            element.contentWindow!.innerHeight -
                            last.getBoundingClientRect().bottom
                        );
                    } )
                )
                .toBeGreaterThanOrEqual( 0 );

            // A click lands in the block under the pointer.
            await heading.click();
            await expect
                .poll( () =>
                    heading.evaluate( ( element ) =>
                        element.contains(
                            element.ownerDocument.getSelection()?.anchorNode ??
                                null
                        )
                    )
                )
                .toBe( true );
            await paragraph.click();
            await page.keyboard.press( 'End' );
            await page.keyboard.type( 'Z' );
            await expect( paragraph ).toHaveText( /Hero paragraph\.Z+$/ );

            // The block toolbar is in the header, at full size.
            const toolbar = page.locator(
                '[data-wfd-control="H6"] .block-editor-block-toolbar'
            );
            await expect( toolbar ).toBeVisible();
            await expect(
                page.locator( '.block-editor-block-toolbar' )
            ).toHaveCount( 1 );
            const bold = ( await toolbar
                .getByRole( 'button', { name: 'Bold' } )
                .boundingBox() )!;
            expect( bold.height ).toBeGreaterThanOrEqual( 30 );

            // The link popover sits by the paragraph, at full size.
            await page.keyboard.press( 'Shift+ArrowLeft' );
            await page.keyboard.press( 'ControlOrMeta+k' );
            const link = page.locator( '.block-editor-link-control' );
            await expect( link ).toBeVisible();
            const linkBox = ( await link.boundingBox() )!;
            const textBox = ( await paragraph.boundingBox() )!;
            expect( linkBox.width ).toBeGreaterThanOrEqual( 300 );
            expect( linkBox.y ).toBeGreaterThanOrEqual(
                textBox.y + textBox.height - 2
            );
            expect( linkBox.y ).toBeLessThanOrEqual(
                textBox.y + textBox.height + 40
            );
            await page.keyboard.press( 'Escape' );
            await expect( link ).toHaveCount( 0 );

            // An empty paragraph: its add-block button is at its right end,
            // at its usual size.
            await paragraph.click();
            await page.keyboard.press( 'End' );
            await page.keyboard.press( 'Enter' );
            await expect( empty ).toHaveCount( 1 );
            const emptyBox = ( await empty.boundingBox() )!;
            // The button shows once typing has stopped: move the pointer.
            await page.mouse.move( emptyBox.x + 20, emptyBox.y + 2 );
            await page.mouse.move( emptyBox.x + 30, emptyBox.y + 3 );
            const add = page.getByRole( 'button', { name: 'Add block' } );
            await expect( add ).toBeVisible();
            const addBox = ( await add.boundingBox() )!;
            expect( addBox.width ).toBeCloseTo( 24, 0 );
            expect( addBox.height ).toBeCloseTo( 24, 0 );
            expect( addBox.x + addBox.width ).toBeCloseTo(
                emptyBox.x + emptyBox.width,
                -0.5
            );
            expect( addBox.y ).toBeGreaterThanOrEqual( emptyBox.y - 4 );
            expect( addBox.y ).toBeLessThanOrEqual(
                emptyBox.y + emptyBox.height + 4
            );

            // The slash inserter opens under that paragraph, at full size.
            await page.keyboard.type( '/' );
            const slash = page.locator( '.components-autocomplete__popover' );
            await expect( slash ).toBeVisible();
            const slashBox = ( await slash.boundingBox() )!;
            expect( slashBox.width ).toBeGreaterThanOrEqual( 150 );
            expect( slashBox.x ).toBeGreaterThanOrEqual( emptyBox.x - 4 );
            expect( slashBox.x ).toBeLessThanOrEqual( emptyBox.x + 60 );
            expect( slashBox.y ).toBeGreaterThanOrEqual( emptyBox.y );
            expect( slashBox.y ).toBeLessThanOrEqual(
                emptyBox.y + emptyBox.height + 40
            );
            // Choosing an item inserts that block.
            await page.keyboard.type( 'separ', { delay: 40 } );
            await expect(
                slash.getByRole( 'option', { name: 'Separator' } )
            ).toBeVisible();
            await page.keyboard.press( 'Enter' );
            await expect(
                frame.locator( '[data-type="core/separator"]' )
            ).toHaveCount( 1 );

            // Start over for the next zoom.
            await page
                .getByRole( 'button', { name: 'Back to the board' } )
                .click();
            await page.evaluate( () => {
                const data = ( window as any ).wp.data;
                while ( data.select( 'core' ).hasUndo() ) {
                    data.dispatch( 'core' ).undo();
                }
            } );
            await expect(
                page.locator( '[data-wfd-control="H9"]' )
            ).toBeDisabled();
        }
        expect( errors ).toEqual( [] );
    } );

    test( 'AC-EDIT-10 Deselecting ends edit: a click on empty board leaves edit and clears the selection; a click on another artboard leaves edit and selects that one', async ( {
        page,
    } ) => {
        const hero = artboardOf( fixture, 'pattern' );
        const artboard = page.locator( `[data-wfd-artboard="${ hero.id }"]` );
        await setViewport( page, {
            x: 40 - hero.x * 0.3,
            y: 80 - hero.y * 0.3,
            zoom: 0.3,
        } );
        await enterEdit( page, hero.id );
        const paragraph = editorFrame( page, hero.id ).locator( 'p', {
            hasText: 'Hero paragraph.',
        } );
        await paragraph.click();
        await page.keyboard.type( 'Q' );

        // What is under each point of a grid over the canvas area.
        const spots = await page.evaluate( () => {
            const area = document
                .querySelector( '[data-wfd-region="canvas"]' )!
                .getBoundingClientRect();
            const found: { x: number; y: number; id: string | null }[] = [];
            for ( let y = area.top + 20; y < area.bottom - 10; y += 30 ) {
                for ( let x = area.left + 20; x < area.right - 10; x += 30 ) {
                    const element = document.elementFromPoint( x, y );
                    if (
                        ! element ||
                        ! element.closest( '[data-wfd-region="canvas"]' )
                    ) {
                        continue;
                    }
                    const owner = element.closest( '[data-wfd-artboard]' );
                    if (
                        owner &&
                        ! element.closest( '.wfd-artboard__frame' )
                    ) {
                        continue;
                    }
                    found.push( {
                        x,
                        y,
                        id: owner?.getAttribute( 'data-wfd-artboard' ) ?? null,
                    } );
                }
            }
            return found;
        } );
        const other = spots.find( ( spot ) => spot.id && spot.id !== hero.id )!;
        const nothing = spots.find( ( spot ) => spot.id === null )!;
        expect( other ).toBeTruthy();
        expect( nothing ).toBeTruthy();

        // Another artboard: edit ends and that one is selected.
        await page.mouse.click( other.x, other.y );
        await expect( page.locator( '[data-wfd-tier="live"]' ) ).toHaveCount(
            0
        );
        await expect(
            page.locator( `[data-wfd-artboard="${ other.id }"]` )
        ).toHaveClass( /is-selected/ );
        await expect( artboard ).not.toHaveClass( /is-selected/ );
        await expect( page.locator( '[data-wfd-control="H7"]' ) ).toHaveText(
            'Fixture board'
        );
        // The edit made is kept.
        await expect( page.locator( '[data-wfd-control="H9"]' ) ).toHaveText(
            'Review 1 change'
        );

        // Empty board: edit ends and nothing is selected.
        await enterEdit( page, hero.id );
        await expect( artboard ).toHaveAttribute( 'data-wfd-tier', 'live' );
        await page.mouse.click( nothing.x, nothing.y );
        await expect( page.locator( '[data-wfd-tier="live"]' ) ).toHaveCount(
            0
        );
        await expect( page.locator( '.wfd-artboard.is-selected' ) ).toHaveCount(
            0
        );
        await expect(
            page
                .locator( '[data-wfd-region="right"]' )
                .getByRole( 'heading', { name: 'Styles', exact: true } )
        ).toBeVisible();

        // Clicks in the panels and the header do not end edit.
        await enterEdit( page, hero.id );
        await page
            .locator( '[data-wfd-panel="editing"]' )
            .getByRole( 'tab', { name: 'Pattern' } )
            .click();
        // An empty part of the header, between the document bar and H12.
        const bar = ( await page
            .locator( '[data-wfd-control="H7"]' )
            .boundingBox() )!;
        const tidy = ( await page
            .locator( '[data-wfd-control="H12"]' )
            .boundingBox() )!;
        await page.mouse.click(
            ( bar.x + bar.width + tidy.x ) / 2,
            bar.y + bar.height / 2
        );
        await expect( artboard ).toHaveAttribute( 'data-wfd-tier', 'live' );
    } );

    test( 'AC-EDIT-12 An Image block added to an artboard in edit has "Upload", "Media Library" and "Insert from URL" in its placeholder', async ( {
        page,
    } ) => {
        const about = artboardOf( fixture, 'page' );
        await enterEdit( page, about.id );
        const frame = editorFrame( page, about.id );
        await frame.locator( 'p', { hasText: 'About paragraph.' } ).click();
        const panel = await openInserter( page, 'Blocks' );
        await panel
            .getByRole( 'button', { name: 'Image', exact: true } )
            .click();
        const placeholder = frame.locator( '.wp-block-image' );
        for ( const name of [ 'Upload', 'Media Library', 'Insert from URL' ] ) {
            await expect(
                placeholder.getByRole( 'button', { name, exact: true } )
            ).toBeVisible();
        }
        // The button opens WordPress's media dialog in the board's page.
        await placeholder
            .getByRole( 'button', { name: 'Media Library', exact: true } )
            .click();
        await expect( page.locator( '.media-modal' ) ).toBeVisible();
    } );

    test( 'AC-EDIT-13 An image uploaded from an Image block\'s placeholder, with "Upload" or in the dialog of "Media Library", is listed in the inserter\'s Media tab without a reload', async ( {
        page,
    } ) => {
        const about = artboardOf( fixture, 'page' );
        await enterEdit( page, about.id );
        const frame = editorFrame( page, about.id );
        await frame.locator( 'p', { hasText: 'About paragraph.' } ).click();
        const panel = await openInserter( page, 'Blocks' );
        await panel
            .getByRole( 'button', { name: 'Image', exact: true } )
            .click();
        await panel.getByRole( 'tab', { name: 'Media' } ).click();
        const list = panel.getByRole( 'tabpanel' );
        const uploaded = list.locator( '.wfd-row', { hasText: 'wfd-upload' } );
        await expect(
            list.getByRole( 'button', { name: 'Upload' } )
        ).toBeVisible();
        await expect( uploaded ).toHaveCount( 0 );
        await frame
            .locator( '.wp-block-image input[type="file"]' )
            .setInputFiles(
                path.join( __dirname, 'assets', 'wfd-upload.png' )
            );
        await expect( frame.locator( '.wp-block-image img' ) ).toHaveAttribute(
            'src',
            /^http.*wfd-upload/,
            { timeout: 20000 }
        );
        await expect( uploaded ).toHaveCount( 1 );

        // The same from the dialog of "Media Library".
        await frame.locator( 'p', { hasText: 'About paragraph.' } ).click();
        await panel.getByRole( 'tab', { name: 'Blocks' } ).click();
        await panel
            .getByRole( 'button', { name: 'Image', exact: true } )
            .click();
        await panel.getByRole( 'tab', { name: 'Media' } ).click();
        const sample = list.locator( '.wfd-row', { hasText: 'wfd-sample' } );
        await expect( sample ).toHaveCount( 0 );
        await frame
            .locator( '.wp-block-image' )
            .getByRole( 'button', { name: 'Media Library', exact: true } )
            .click();
        const modal = page.locator( '.media-modal' );
        await modal.getByRole( 'tab', { name: 'Upload files' } ).click();
        await modal
            .locator( 'input[type="file"]' )
            .setInputFiles(
                path.join( __dirname, 'assets', 'wfd-sample.png' )
            );
        const select = modal.getByRole( 'button', {
            name: 'Select',
            exact: true,
        } );
        await expect( select ).toBeEnabled( { timeout: 20000 } );
        await select.click();
        await expect( modal ).toBeHidden();
        await expect( sample ).toHaveCount( 1 );
    } );

    test( "AC-EDIT-14 A file that cannot be uploaded from a block's placeholder shows its error in a snackbar at the bottom left of the canvas area", async ( {
        page,
    } ) => {
        const about = artboardOf( fixture, 'page' );
        await enterEdit( page, about.id );
        const frame = editorFrame( page, about.id );
        await frame.locator( 'p', { hasText: 'About paragraph.' } ).click();
        const panel = await openInserter( page, 'Blocks' );
        await panel
            .getByRole( 'button', { name: 'Image', exact: true } )
            .click();
        await expect( page.locator( '.wfd-snackbars' ) ).toHaveCount( 0 );
        await frame
            .locator( '.wp-block-image input[type="file"]' )
            .setInputFiles( {
                name: 'notes.txt',
                mimeType: 'text/plain',
                buffer: Buffer.from( 'Not an image.' ),
            } );
        const snackbar = page.locator( '.wfd-snackbars .components-snackbar' );
        await expect( snackbar ).toBeVisible();
        await expect( snackbar ).toContainText( 'not supported' );
        // Above the keyboard shortcuts control, at the same left edge.
        const box = ( await snackbar.boundingBox() )!;
        const control = ( await page
            .locator( '.wfd-shortcuts-button' )
            .boundingBox() )!;
        expect( Math.abs( box.x - control.x ) ).toBeLessThan( 2 );
        expect( box.y + box.height ).toBeLessThanOrEqual( control.y );
    } );

    test( 'AC-EDIT-15 A file held by a block of a template part that several artboards show is uploaded once', async ( {
        page,
    } ) => {
        const header = artboardOf( fixture, 'template-part' );
        let uploads = 0;
        page.on( 'request', ( request ) => {
            if (
                request.method() === 'POST' &&
                /wp\/v2\/media/.test( decodeURIComponent( request.url() ) )
            ) {
                uploads++;
            }
        } );
        await enterEdit( page, header.id );
        // The templates and pages that show the header are drawn as well.
        await expect
            .poll(
                async () =>
                    Object.values( await tiersOf( page ) ).filter(
                        ( tier ) => tier === 'preview'
                    ).length
            )
            .toBeGreaterThan( 2 );
        // What dropping a file leaves in the part: an Image block that holds
        // the file as a blob, not yet uploaded.
        const data = fs
            .readFileSync( path.join( __dirname, 'assets', 'wfd-upload.png' ) )
            .toString( 'base64' );
        await page.evaluate(
            ( [ base64, id ] ) => {
                const wp = ( window as any ).wp;
                const bytes = Uint8Array.from( atob( base64 ), ( char ) =>
                    char.charCodeAt( 0 )
                );
                const file = new File( [ bytes ], 'wfd-upload.png', {
                    type: 'image/png',
                } );
                const record = wp.data
                    .select( 'core' )
                    .getEditedEntityRecord(
                        'postType',
                        'wp_template_part',
                        id
                    );
                const blocks =
                    record.blocks ||
                    wp.blocks.parse(
                        typeof record.content === 'string'
                            ? record.content
                            : record.content.raw
                    );
                wp.data
                    .dispatch( 'core' )
                    .editEntityRecord( 'postType', 'wp_template_part', id, {
                        blocks: [
                            ...blocks,
                            wp.blocks.createBlock( 'core/image', {
                                blob: wp.blob.createBlobURL( file ),
                            } ),
                        ],
                    } );
            },
            [ data, header.entityId ] as const
        );
        await expect(
            editorFrame( page, header.id ).locator( '.wp-block-image img' )
        ).toHaveAttribute( 'src', /^http.*wfd-upload/, { timeout: 20000 } );
        // Time for any other artboard to have started an upload of its own.
        await page.waitForTimeout( 2000 );
        expect( uploads ).toBe( 1 );
    } );

    test( 'AC-EDIT-16 For a user who may not upload files, an Image block\'s placeholder has "Insert from URL" and neither "Upload" nor "Media Library"', async ( {
        page,
    } ) => {
        // The board's page as the server gives it to such a user.
        await page.addInitScript( () => {
            let config: any;
            Object.defineProperty( window, 'wfdConfig', {
                configurable: true,
                get: () => config,
                set: ( value ) => {
                    config = { ...value, canUpload: false };
                },
            } );
        } );
        await openBoard( page, fixture.boardId );
        const about = artboardOf( fixture, 'page' );
        await enterEdit( page, about.id );
        const frame = editorFrame( page, about.id );
        await frame.locator( 'p', { hasText: 'About paragraph.' } ).click();
        const panel = await openInserter( page, 'Blocks' );
        await panel
            .getByRole( 'button', { name: 'Image', exact: true } )
            .click();
        const placeholder = frame.locator( '.wp-block-image' );
        await expect(
            placeholder.getByRole( 'button', {
                name: 'Insert from URL',
                exact: true,
            } )
        ).toBeVisible();
        for ( const name of [ 'Upload', 'Media Library' ] ) {
            await expect(
                placeholder.getByRole( 'button', { name, exact: true } )
            ).toHaveCount( 0 );
        }
    } );

    test( 'AC-EDIT-11 A block that is not being edited moves when pressed on its text and dragged; a press without a drag puts the caret there, after which dragging selects text and a double-click selects a word; a template block around a page does not move', async ( {
        page,
    } ) => {
        const about = artboardOf( fixture, 'page' );
        await enterEdit( page, about.id );
        const frame = editorFrame( page, about.id );
        const heading = frame.locator( '.wp-block-post-content h2' );
        const paragraph = frame.locator( '.wp-block-post-content p' );
        const order = () =>
            frame
                .locator( '.wp-block-post-content > [data-block]' )
                .evaluateAll( ( nodes ) =>
                    nodes.map( ( node ) => node.textContent )
                );
        const selectedText = () =>
            frame
                .locator( 'body' )
                .evaluate( ( body ) =>
                    body.ownerDocument.defaultView!.getSelection()!.toString()
                );
        const drag = async (
            from: { x: number; y: number },
            to: { x: number; y: number }
        ) => {
            await page.mouse.move( from.x, from.y );
            await page.mouse.down();
            for ( let step = 1; step <= 12; step++ ) {
                await page.mouse.move(
                    from.x + ( ( to.x - from.x ) * step ) / 12,
                    from.y + ( ( to.y - from.y ) * step ) / 12
                );
                await page.waitForTimeout( 40 );
            }
            // The editor works out the drop position at most every 200 ms.
            await page.waitForTimeout( 300 );
            await page.mouse.move( to.x + 2, to.y );
            await page.waitForTimeout( 300 );
        };
        expect( await order() ).toEqual( [ 'About', 'About paragraph.' ] );

        // Hovering the text of a block that is not being edited shows its
        // outline and the grab cursor.
        const from = ( await heading.boundingBox() )!;
        const start = { x: from.x + 30, y: from.y + from.height / 2 };
        await page.mouse.move( start.x, start.y );
        await expect( heading ).toHaveClass( /is-hovered-drag-anywhere/ );
        await expect( heading ).toHaveCSS( 'cursor', 'grab' );
        expect(
            await heading.evaluate(
                ( node ) =>
                    node.ownerDocument.defaultView!.getComputedStyle(
                        node,
                        '::after'
                    ).outlineStyle
            )
        ).toBe( 'solid' );

        // Pressing on the text and dragging moves the block, with the stock
        // drop indicator.
        const target = ( await paragraph.boundingBox() )!;
        await drag( start, {
            x: target.x + 60,
            y: target.y + target.height * 0.75,
        } );
        await expect(
            page.locator(
                '.block-editor-block-list__insertion-point-indicator'
            )
        ).toBeVisible();
        await page.mouse.up();
        await expect.poll( order ).toEqual( [ 'About paragraph.', 'About' ] );
        await expect( heading ).toHaveAttribute( 'contenteditable', 'true' );
        await expect( heading ).not.toHaveAttribute( 'draggable' );

        // A press without a drag puts the caret where the press was.
        const box = ( await paragraph.boundingBox() )!;
        const middle = box.y + box.height / 2;
        await page.mouse.click( box.x + 80, middle );
        await expect( paragraph ).toHaveClass( /is-selected/ );
        await expect( paragraph ).not.toHaveClass( /is-hovered-drag-anywhere/ );
        const caret = await frame.locator( 'body' ).evaluate( ( body ) => {
            const selection = body.ownerDocument.defaultView!.getSelection()!;
            return {
                collapsed: selection.isCollapsed,
                offset: selection.anchorOffset,
                text: selection.anchorNode?.textContent,
            };
        } );
        expect( caret.collapsed ).toBe( true );
        expect( caret.text ).toBe( 'About paragraph.' );
        expect( caret.offset ).toBeGreaterThan( 0 );
        await page.keyboard.type( 'X' );
        await expect( paragraph ).toHaveText( /^A.+X.+\.$/ );
        await page.keyboard.press( 'Backspace' );

        // From then on dragging over its text selects text and the block
        // stays where it is.
        await drag(
            { x: box.x + 20, y: middle },
            { x: box.x + 120, y: middle }
        );
        await page.mouse.up();
        expect( ( await selectedText() ).length ).toBeGreaterThan( 2 );
        expect( await order() ).toEqual( [ 'About paragraph.', 'About' ] );

        // A double-click on a block that is not being edited selects a word.
        const other = ( await heading.boundingBox() )!;
        await page.mouse.dblclick( other.x + 20, other.y + other.height / 2 );
        expect( await selectedText() ).toBe( 'About' );

        // A block of the template around the page does not move.
        const templateText = frame.locator( 'header.wp-block-template-part p', {
            hasText: 'Fixture header text',
        } );
        const locked = ( await templateText.boundingBox() )!;
        await page.mouse.move( locked.x + 20, locked.y + locked.height / 2 );
        await page.waitForTimeout( 200 );
        await expect( templateText ).not.toHaveClass(
            /is-hovered-drag-anywhere/
        );
        await drag(
            { x: locked.x + 20, y: locked.y + locked.height / 2 },
            { x: box.x + 60, y: box.y + box.height * 0.75 }
        );
        await expect( frame.locator( '[data-block].is-dragging' ) ).toHaveCount(
            0
        );
        await page.mouse.up();
        await expect( templateText ).toBeVisible();
        expect( await order() ).toEqual( [ 'About paragraph.', 'About' ] );
    } );
} );
