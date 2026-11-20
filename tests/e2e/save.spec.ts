import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import type { Page } from '@playwright/test';
import {
    resetFixture,
    openBoard,
    enterEdit,
    editorFrame,
    artboardOf,
    viewportOf,
    setViewport,
    armNew,
    type Fixture,
} from './utils';

const review = ( page: Page ) => page.locator( '[data-wfd-control="H9"]' );
const drawer = ( page: Page ) =>
    page.getByRole( 'dialog', { name: 'Review changes' } );

/**
 * Types into the first paragraph that contains the given text.
 * @param page
 * @param id
 * @param text
 * @param addition
 */
const editText = async (
    page: Page,
    id: string,
    text: string,
    addition: string
) => {
    // Bring the artboard's top-left corner into view: the board does not
    // scroll, so a block outside the canvas area cannot be clicked.
    const frame = ( await page
        .locator( `[data-wfd-artboard="${ id }"] .wfd-artboard__frame` )
        .boundingBox() )!;
    const canvas = ( await page
        .locator( '[data-wfd-region="canvas"]' )
        .boundingBox() )!;
    const viewport = await viewportOf( page );
    await setViewport( page, {
        zoom: viewport.zoom,
        x: viewport.x - ( frame.x - canvas.x ) + 40,
        y: viewport.y - ( frame.y - canvas.y ) + 40,
    } );
    await enterEdit( page, id );
    const paragraph = editorFrame( page, id )
        .locator( 'p', { hasText: text } )
        .first();
    await paragraph.click();
    await page.keyboard.press( 'End' );
    await page.keyboard.type( addition );
    await page.getByRole( 'button', { name: 'Back to the board' } ).click();
};

const changeStyles = async ( page: Page ) => {
    await page.locator( '[data-wfd-region="canvas"]' ).focus();
    await page.keyboard.press( 'Escape' );
    const menu = page
        .locator( '[data-wfd-region="right"]' )
        .getByRole( 'button', { name: /^Variation:/ } );
    await menu.click();
    await page.getByRole( 'menuitemradio', { name: 'Evening' } ).click();
};

/**
 * Clicks the board at a point of the canvas area, as a placement does.
 * @param page
 * @param dx
 * @param dy
 */
const placeAt = async ( page: Page, dx: number, dy: number ) => {
    const canvas = ( await page
        .locator( '[data-wfd-region="canvas"]' )
        .boundingBox() )!;
    await page.mouse.move( canvas.x + dx - 20, canvas.y + dy - 20 );
    await page.mouse.move( canvas.x + dx, canvas.y + dy, { steps: 2 } );
    await page.mouse.down();
    await page.mouse.up();
};

/**
 * Places a new template part, which becomes Live.
 * @param page
 * @param dx
 * @param dy
 */
const placeNewPart = async ( page: Page, dx = 300, dy = 620 ) => {
    await armNew( page, 'Templates', 'New template part' );
    await placeAt( page, dx, dy );
};

const card = ( page: Page, name: string ) =>
    drawer( page ).locator( '.wfd-review__item', {
        has: page.getByRole( 'checkbox', { name, exact: true } ),
    } );

test.describe( 'SAVE', () => {
    let fixture: Fixture;
    test.beforeEach( async ( { page, requestUtils } ) => {
        fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
    } );

    test( 'AC-SAVE-01 The Review button counts changed entities, including global styles and new templates and parts', async ( {
        page,
    } ) => {
        await expect( review( page ) ).toHaveText( 'Review changes' );
        await expect( review( page ) ).toBeDisabled();
        await editText(
            page,
            artboardOf( fixture, 'template-part' ).id,
            'Fixture header text',
            ' one'
        );
        await expect( review( page ) ).toHaveText( 'Review 1 change' );
        await expect( review( page ) ).toBeEnabled();
        await changeStyles( page );
        await expect( review( page ) ).toHaveText( 'Review 2 changes' );

        // A new template.
        await armNew( page, 'Templates', 'Single item' );
        await placeAt( page, 300, 620 );
        await expect(
            page.locator( '[data-wfd-tier="live"]' )
        ).toHaveAttribute( 'data-wfd-kind', 'template' );
        await expect( review( page ) ).toHaveText( 'Review 3 changes' );
        // A new part.
        await page.getByRole( 'button', { name: 'Back to the board' } ).click();
        await placeNewPart( page, 500, 720 );
        await expect( review( page ) ).toHaveText( 'Review 4 changes' );
    } );

    test( 'AC-SAVE-02 The drawer lists each changed item with its second line and change lines', async ( {
        page,
    } ) => {
        await editText(
            page,
            artboardOf( fixture, 'template-part' ).id,
            'Fixture header text',
            ' two'
        );
        await editText(
            page,
            artboardOf( fixture, 'page', 'desktop', 1 ).id,
            'Become a member paragraph.',
            ' more'
        );
        await changeStyles( page );
        await review( page ).click();
        const panel = drawer( page );
        await expect( panel ).toContainText(
            'Nothing reaches the site until you save. Artboard positions on the board save on their own.'
        );
        await expect( panel.locator( '.wfd-review__item' ) ).toHaveCount( 3 );
        await expect( panel.getByRole( 'checkbox' ) ).toHaveCount( 3 );
        for ( const box of await panel.getByRole( 'checkbox' ).all() ) {
            await expect( box ).toBeChecked();
        }

        const styles = card( page, 'Styles' );
        await expect( styles ).toContainText( /Site-wide · \d+ changes/ );
        await expect( styles ).toContainText( 'Shows on 9 artboards' );
        expect(
            await styles.locator( '.wfd-review__lines li' ).count()
        ).toBeGreaterThan( 0 );

        const header = card( page, 'Header' );
        await expect( header ).toContainText(
            /Template part · used by \d+ templates/
        );
        await expect( header.locator( '.wfd-review__lines li' ) ).toHaveText( [
            'Paragraph: changed',
        ] );

        const member = card( page, 'Become a member' );
        await expect( member ).toContainText( 'Page · draft' );
        await expect( member.locator( '.wfd-review__lines li' ) ).toHaveText( [
            'Paragraph: changed',
        ] );

        await expect(
            panel.getByRole( 'button', { name: 'Discard all' } )
        ).toBeVisible();
        await expect(
            panel.getByRole( 'button', { name: 'Keep editing' } )
        ).toBeVisible();
        await expect(
            panel.getByRole( 'button', { name: 'Save 3 changes' } )
        ).toBeVisible();

        // Artboards with changes are marked while the drawer is open.
        const headerArtboard = page.locator(
            `[data-wfd-artboard="${ artboardOf( fixture, 'template-part' ).id }"]`
        );
        await expect(
            headerArtboard.locator( '.wfd-artboard__label' )
        ).toContainText( '· Changed' );
        await expect( headerArtboard ).toHaveClass( /is-changed/ );
        await expect(
            page.locator(
                `[data-wfd-artboard="${ artboardOf( fixture, 'template-part', 'mobile' ).id }"] .wfd-artboard__label`
            )
        ).toContainText( '· Changed' );
        await expect(
            page.locator(
                `[data-wfd-artboard="${ artboardOf( fixture, 'pattern' ).id }"] .wfd-artboard__label`
            )
        ).not.toContainText( 'Changed' );

        await panel.getByRole( 'button', { name: 'Keep editing' } ).click();
        await expect( panel ).toHaveCount( 0 );
        await expect(
            headerArtboard.locator( '.wfd-artboard__label' )
        ).not.toContainText( 'Changed' );
        await expect( review( page ) ).toHaveText( 'Review 3 changes' );
    } );

    test( 'AC-SAVE-03 Save with one item unchecked saves the others and leaves that one changed', async ( {
        page,
        requestUtils,
    } ) => {
        await editText(
            page,
            artboardOf( fixture, 'template-part' ).id,
            'Fixture header text',
            ' saved'
        );
        await editText(
            page,
            artboardOf( fixture, 'pattern' ).id,
            'Hero paragraph.',
            ' kept back'
        );
        await review( page ).click();
        const panel = drawer( page );
        await expect(
            panel.getByRole( 'button', { name: 'Save 2 changes' } )
        ).toBeVisible();
        await panel
            .getByRole( 'checkbox', { name: 'Hero', exact: true } )
            .uncheck();
        const save = panel.getByRole( 'button', { name: 'Save 1 change' } );
        await expect( save ).toBeVisible();

        const requests: string[] = [];
        page.on( 'request', ( request ) => {
            if (
                request.method() !== 'GET' &&
                /template-parts|blocks/.test( request.url() )
            ) {
                requests.push( request.url() );
            }
        } );
        await save.click();
        await expect( panel.locator( '.wfd-review__item' ) ).toHaveCount( 1 );
        await expect( card( page, 'Hero' ) ).toBeVisible();
        await expect( review( page ) ).toHaveText( 'Review 1 change' );
        // One request, for the checked item only.
        expect( requests ).toHaveLength( 1 );
        expect( decodeURIComponent( requests[ 0 ] ) ).toContain(
            'template-parts'
        );

        const header = await requestUtils.rest< { content: { raw: string } } >(
            {
                path: `/wp/v2/template-parts/${ fixture.theme }//header`,
                params: { context: 'edit' },
            }
        );
        expect( header.content.raw ).toContain( 'Fixture header text saved' );
        const hero = await requestUtils.rest< { content: { raw: string } } >( {
            path: `/wp/v2/blocks/${ fixture.patterns.hero }`,
            params: { context: 'edit' },
        } );
        expect( hero.content.raw ).not.toContain( 'kept back' );
    } );

    test( 'AC-SAVE-04 When a save request fails, the item stays with the error notice and the button reads "Retry 1 change"', async ( {
        page,
        requestUtils,
    } ) => {
        await editText(
            page,
            artboardOf( fixture, 'template-part' ).id,
            'Fixture header text',
            ' flaky'
        );
        await editText(
            page,
            artboardOf( fixture, 'pattern' ).id,
            'Hero paragraph.',
            ' fine'
        );
        const failing = ( route: any ) =>
            route.request().method() === 'GET'
                ? route.continue()
                : route.abort();
        await page.route( /template-parts/, failing );
        await review( page ).click();
        const panel = drawer( page );
        await panel.getByRole( 'button', { name: 'Save 2 changes' } ).click();

        // The item that saved leaves the list; the failed one stays, checked.
        await expect( panel.locator( '.wfd-review__item' ) ).toHaveCount( 1 );
        const header = card( page, 'Header' );
        await expect( header ).toContainText(
            "Couldn't save Header. Check your connection and try again."
        );
        await expect(
            panel.getByRole( 'checkbox', { name: 'Header', exact: true } )
        ).toBeChecked();
        const retry = panel.getByRole( 'button', { name: 'Retry 1 change' } );
        await expect( retry ).toBeVisible();
        await expect( review( page ) ).toHaveText( 'Review 1 change' );
        const hero = await requestUtils.rest< { content: { raw: string } } >( {
            path: `/wp/v2/blocks/${ fixture.patterns.hero }`,
            params: { context: 'edit' },
        } );
        expect( hero.content.raw ).toContain( 'Hero paragraph. fine' );

        // Retry once the connection is back.
        await page.unroute( /template-parts/, failing );
        await retry.click();
        await expect( panel.locator( '.wfd-review__item' ) ).toHaveCount( 0 );
        const saved = await requestUtils.rest< { content: { raw: string } } >( {
            path: `/wp/v2/template-parts/${ fixture.theme }//header`,
            params: { context: 'edit' },
        } );
        expect( saved.content.raw ).toContain( 'Fixture header text flaky' );
    } );

    test( 'AC-SAVE-05 Saving a template changes the template on the front end at once; saving a draft page leaves it a draft', async ( {
        page,
        requestUtils,
    } ) => {
        // A template and a draft page.
        const single = artboardOf( fixture, 'template', 'desktop', 1 );
        await enterEdit( page, single.id );
        const frame = editorFrame( page, single.id );
        await frame.locator( '.wp-block-post-title' ).first().click();
        await page
            .locator( '[data-wfd-region="header"]' )
            .getByRole( 'button', { name: 'Block inserter', exact: true } )
            .click();
        await page
            .locator( '.wfd-inserter' )
            .getByRole( 'button', { name: 'Paragraph', exact: true } )
            .click();
        const added = frame.locator( 'p[data-empty="true"]' ).first();
        await added.click();
        await page.keyboard.type( 'LIVE-NOW' );
        await expect(
            frame.locator( 'p', { hasText: 'LIVE-NOW' } )
        ).toHaveCount( 1 );
        await page
            .locator( '[data-wfd-region="header"]' )
            .getByRole( 'button', { name: 'Close block inserter' } )
            .click();
        await page.getByRole( 'button', { name: 'Back to the board' } ).click();
        await editText(
            page,
            artboardOf( fixture, 'page', 'desktop', 1 ).id,
            'Become a member paragraph.',
            ' still draft'
        );

        await review( page ).click();
        const panel = drawer( page );
        await expect( card( page, 'Single Posts' ) ).toContainText(
            'Template'
        );
        await expect( card( page, 'Become a member' ) ).toContainText(
            'Page · draft'
        );
        await panel
            .getByRole( 'button', { name: /^Save \d changes$/ } )
            .click();
        await expect( panel.locator( '.wfd-review__item' ) ).toHaveCount( 0 );

        // The front end shows the template at once.
        const front = await page.request.get( '/?p=1' );
        expect( front.status() ).toBe( 200 );
        expect( await front.text() ).toContain( 'LIVE-NOW' );

        const member = await requestUtils.rest< {
            status: string;
            content: { raw: string };
        } >( {
            path: `/wp/v2/pages/${ fixture.pages.member }`,
            params: { context: 'edit' },
        } );
        expect( member.status ).toBe( 'draft' );
        expect( member.content.raw ).toContain( 'still draft' );
    } );

    test( 'AC-SAVE-06 Discard all, after confirmation, reverts every edited record as one step that Undo and Redo act on, and removes unsaved new templates and parts from the board', async ( {
        page,
        requestUtils,
    } ) => {
        const header = artboardOf( fixture, 'template-part' );
        await editText( page, header.id, 'Fixture header text', ' doomed' );
        await changeStyles( page );
        await placeNewPart( page );
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 10 );
        await page.getByRole( 'button', { name: 'Back to the board' } ).click();
        await expect( review( page ) ).toHaveText( 'Review 3 changes' );

        await review( page ).click();
        const panel = drawer( page );
        const items = panel.locator( '.wfd-review__item' );
        const discardAll = panel.getByRole( 'button', { name: 'Discard all' } );
        await discardAll.click();
        const confirm = page.getByRole( 'alertdialog' );
        await expect( confirm ).toContainText( 'Discard all changes?' );
        // The new part cannot be brought back.
        await expect( confirm ).toContainText( "This can't be undone." );
        await expect( confirm.getByRole( 'button' ) ).toHaveText( [
            'Cancel',
            'Discard',
        ] );
        // Cancel keeps everything.
        await confirm.getByRole( 'button', { name: 'Cancel' } ).click();
        await expect( items ).toHaveCount( 3 );

        await discardAll.click();
        await confirm.getByRole( 'button', { name: 'Discard' } ).click();
        await expect( items ).toHaveCount( 0 );
        await expect( panel ).toContainText( 'No changes to review' );
        await page.keyboard.press( 'Escape' );
        await expect( review( page ) ).toHaveText( 'Review changes' );
        await expect( review( page ) ).toBeDisabled();
        // The new part left the board; the others are still there.
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 9 );
        await expect(
            page
                .locator( '[data-wfd-region="right"]' )
                .getByRole( 'button', { name: 'Variation: Default' } )
        ).toBeVisible();
        // The Header shows its saved text again.
        await enterEdit( page, header.id );
        const paragraph = editorFrame( page, header.id ).locator( 'p', {
            hasText: 'Fixture header text',
        } );
        await expect( paragraph ).toHaveText( 'Fixture header text' );

        // One Undo brings back the Header and the styles, not the new part;
        // one Redo discards both again.
        const undo = page.locator( '[data-wfd-control="H3"]' );
        const redo = page.locator( '[data-wfd-control="H4"]' );
        await undo.click();
        await expect( paragraph ).toHaveText( 'Fixture header text doomed' );
        await expect( review( page ) ).toHaveText( 'Review 2 changes' );
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 9 );
        await redo.click();
        await expect( paragraph ).toHaveText( 'Fixture header text' );
        await expect( review( page ) ).toHaveText( 'Review changes' );

        // With saved items only, nothing says it can't be undone.
        await undo.click();
        await review( page ).click();
        await expect( items ).toHaveCount( 2 );
        await discardAll.click();
        await expect( confirm ).toContainText( 'Discard all changes?' );
        await expect( confirm ).not.toContainText( "This can't be undone." );
        await confirm.getByRole( 'button', { name: 'Discard' } ).click();
        await expect( panel ).toContainText( 'No changes to review' );
        const saved = await requestUtils.rest< { content: { raw: string } } >( {
            path: `/wp/v2/template-parts/${ fixture.theme }//header`,
            params: { context: 'edit' },
        } );
        expect( saved.content.raw ).not.toContain( 'doomed' );
    } );

    test( 'AC-SAVE-07 Closing the tab with unsaved changes triggers the leave warning; with none it does not', async ( {
        page,
    } ) => {
        const warned = () =>
            page.evaluate( () => {
                const event = new Event( 'beforeunload', { cancelable: true } );
                window.dispatchEvent( event );
                return event.defaultPrevented;
            } );
        expect( await warned() ).toBe( false );

        await editText(
            page,
            artboardOf( fixture, 'template-part' ).id,
            'Fixture header text',
            ' unsaved'
        );
        await expect( review( page ) ).toHaveText( 'Review 1 change' );
        expect( await warned() ).toBe( true );

        // The browser's own dialog on a real navigation.
        let dialogType = '';
        page.once( 'dialog', async ( dialog ) => {
            dialogType = dialog.type();
            await dialog.dismiss();
        } );
        await page.getByRole( 'link', { name: 'All boards' } ).click();
        await expect.poll( () => dialogType ).toBe( 'beforeunload' );
        await expect(
            page.locator( '[data-wfd-region="canvas"]' )
        ).toBeVisible();

        // Saved: no warning any more.
        await review( page ).click();
        await drawer( page )
            .getByRole( 'button', { name: 'Save 1 change' } )
            .click();
        await expect(
            drawer( page ).locator( '.wfd-review__item' )
        ).toHaveCount( 0 );
        expect( await warned() ).toBe( false );
    } );

    test( 'AC-SAVE-08 Discard on one item, after confirmation, reverts that record alone as one step that Undo and Redo act on, or removes that unsaved new template or part from the board; the other items stay changed', async ( {
        page,
        requestUtils,
    } ) => {
        const header = artboardOf( fixture, 'template-part' );
        await editText( page, header.id, 'Fixture header text', ' doomed' );
        await changeStyles( page );
        await placeNewPart( page );
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 10 );
        await page.getByRole( 'button', { name: 'Back to the board' } ).click();
        // A step of the board's history that has the new part in it.
        await page.keyboard.press( 'ArrowRight' );
        const undo = page.locator( '[data-wfd-control="H3"]' );
        const redo = page.locator( '[data-wfd-control="H4"]' );
        await expect( undo ).toHaveAccessibleName(
            'Undo move artboard, on the board'
        );
        // A page whose only edit is to its meta, as a footnote makes.
        await page.evaluate( ( id ) => {
            const { select, dispatch } = ( window as any ).wp.data;
            const args = [ 'postType', 'page', id ];
            const { meta } = select( 'core' ).getEntityRecord( ...args );
            dispatch( 'core' ).editEntityRecord( ...args, {
                meta: { ...meta, footnotes: '[{"id":"a","content":"note"}]' },
            } );
        }, fixture.pages.member );
        await expect( review( page ) ).toHaveText( 'Review 4 changes' );

        await review( page ).click();
        const panel = drawer( page );
        const items = panel.locator( '.wfd-review__item' );
        const confirm = page.getByRole( 'alertdialog' );
        const discardOf = ( name: string ) =>
            panel.getByRole( 'button', {
                name: `Discard changes to ${ name }`,
                exact: true,
            } );
        const discard = async ( name: string ) => {
            await discardOf( name ).click();
            await expect( confirm ).toContainText(
                `Discard changes to ${ name }?`
            );
            await expect( confirm.getByRole( 'button' ) ).toHaveText( [
                'Cancel',
                'Discard',
            ] );
        };
        await expect(
            panel.getByRole( 'button', { name: /^Discard changes to / } )
        ).toHaveCount( 4 );

        // The page: its meta edit goes too.
        await discard( 'Become a member' );
        await confirm.getByRole( 'button', { name: 'Discard' } ).click();
        await expect( card( page, 'Become a member' ) ).toHaveCount( 0 );
        await expect( items ).toHaveCount( 3 );

        // The Header, after a save of it alone has failed.
        await card( page, 'Styles' ).getByRole( 'checkbox' ).uncheck();
        await card( page, 'Untitled part' ).getByRole( 'checkbox' ).uncheck();
        const failing = ( route: any ) =>
            route.request().method() === 'GET'
                ? route.continue()
                : route.abort();
        await page.route( /template-parts/, failing );
        await panel.getByRole( 'button', { name: 'Save 1 change' } ).click();
        await expect( card( page, 'Header' ) ).toContainText(
            "Couldn't save Header."
        );
        await page.unroute( /template-parts/, failing );
        // Unchecked as well: the checkbox makes no difference.
        await card( page, 'Header' ).getByRole( 'checkbox' ).uncheck();
        await discard( 'Header' );
        // A saved item's discard can be undone, so nothing says it can't.
        await expect( confirm ).not.toContainText( "This can't be undone." );
        // Cancel keeps everything.
        await confirm.getByRole( 'button', { name: 'Cancel' } ).click();
        await expect( items ).toHaveCount( 3 );
        await expect( discardOf( 'Header' ) ).toBeFocused();

        await discard( 'Header' );
        await confirm.getByRole( 'button', { name: 'Discard' } ).click();
        await expect( confirm ).toHaveCount( 0 );
        await expect( items ).toHaveCount( 2 );
        // The item is gone, so focus stays in the drawer, on its close button.
        await expect(
            panel.getByRole( 'button', { name: 'Close' } )
        ).toBeFocused();
        await expect( card( page, 'Header' ) ).toHaveCount( 0 );
        await expect( card( page, 'Styles' ) ).toHaveCount( 1 );

        // The new part leaves the board, which cannot be undone.
        await discard( 'Untitled part' );
        await expect( confirm ).toContainText( "This can't be undone." );
        await confirm.getByRole( 'button', { name: 'Discard' } ).click();
        await expect( items ).toHaveCount( 1 );
        await expect( card( page, 'Styles' ) ).toHaveCount( 1 );
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 9 );

        await panel.getByRole( 'button', { name: 'Keep editing' } ).click();
        await expect( review( page ) ).toHaveText( 'Review 1 change' );
        // Undo on the board does not bring the new part back.
        await undo.click();
        await expect( redo ).toBeEnabled();
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 9 );
        // The styles change is still there.
        await expect(
            page
                .locator( '[data-wfd-region="right"]' )
                .getByRole( 'button', { name: 'Variation: Evening' } )
        ).toBeVisible();
        // The Header shows its saved text again.
        await enterEdit( page, header.id );
        const paragraph = editorFrame( page, header.id ).locator( 'p', {
            hasText: 'Fixture header text',
        } );
        await expect( paragraph ).toHaveText( 'Fixture header text' );

        // Undo brings the Header's changes back: checked, and with no error
        // left from the save that failed.
        await undo.click();
        await expect( paragraph ).toHaveText( 'Fixture header text doomed' );
        await expect( review( page ) ).toHaveText( 'Review 2 changes' );
        await review( page ).click();
        await expect(
            card( page, 'Header' ).getByRole( 'checkbox' )
        ).toBeChecked();
        await expect( card( page, 'Header' ) ).not.toContainText(
            "Couldn't save Header."
        );
        await panel.getByRole( 'button', { name: 'Keep editing' } ).click();
        // Redo discards them again.
        await redo.click();
        await expect( paragraph ).toHaveText( 'Fixture header text' );
        await expect( review( page ) ).toHaveText( 'Review 1 change' );
        const saved = await requestUtils.rest< { content: { raw: string } } >( {
            path: `/wp/v2/template-parts/${ fixture.theme }//header`,
            params: { context: 'edit' },
        } );
        expect( saved.content.raw ).not.toContain( 'doomed' );
    } );

    test( 'AC-SAVE-09 Each item\'s Discard control shows "Discard" and has the accessible name "Discard changes to {name}"', async ( {
        page,
    } ) => {
        await editText(
            page,
            artboardOf( fixture, 'template-part' ).id,
            'Fixture header text',
            ' named'
        );
        await changeStyles( page );
        await review( page ).click();
        for ( const name of [ 'Header', 'Styles' ] ) {
            const button = card( page, name ).getByRole( 'button' );
            await expect( button ).toHaveText( 'Discard' );
            await expect( button ).toHaveAccessibleName(
                `Discard changes to ${ name }`
            );
        }
    } );
} );
