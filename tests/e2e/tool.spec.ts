import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import path from 'node:path';
import type { Page } from '@playwright/test';
import {
    resetFixture,
    openBoard,
    enterEdit,
    editorFrame,
    viewportOf,
    setViewport,
    tiersOf,
    boardAtRest,
    frameBox,
    artboardOf,
    openInserter,
    postLock,
} from './utils';
import { callTool, wp } from './agent-utils';

const SAMPLE = path.join( __dirname, 'assets', 'wfd-sample.png' );
const review = ( page: Page ) => page.locator( '[data-wfd-control="H9"]' );
const undo = ( page: Page ) => page.locator( '[data-wfd-control="H3"]' );
const frame = ( page: Page, id: string ) =>
    page.locator( `[data-wfd-artboard="${ id }"]` );

/**
 * Makes an unsaved change to a pattern without a tool.
 *
 * @param page The board page.
 * @param id   The pattern.
 */
const editPattern = ( page: Page, id: number ) =>
    page.evaluate( ( post ) => {
        ( window as any ).wp.data
            .dispatch( 'core' )
            .editEntityRecord( 'postType', 'wp_block', post, {
                content:
                    '<!-- wp:paragraph --><p>Changed by the designer.</p><!-- /wp:paragraph -->',
            } );
    }, id );

/**
 * Whether an artboard's frame is wholly inside the canvas area.
 *
 * @param page The board page.
 * @param id   The artboard.
 */
async function isInView( page: Page, id: string ) {
    const area = ( await page
        .locator( '[data-wfd-region="canvas"]' )
        .boundingBox() )!;
    const box = ( await frameBox( frame( page, id ) ) )!;
    return (
        box.x >= area.x - 1 &&
        box.y >= area.y - 1 &&
        box.x + box.width <= area.x + area.width + 1 &&
        box.y + box.height <= area.y + area.height + 1
    );
}

test.describe( 'TOOL', () => {
    test( 'AC-TOOL-01 board-get returns the board, its artboards and notes in left-panel order, the selection, the edit and the zoom', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        const note = {
            id: '0c0ffee0-0000-4000-8000-000000000001',
            x: 100,
            y: -300,
            text: 'Check the header\nsecond line',
            color: 'green',
        };
        await requestUtils.rest( {
            method: 'POST',
            path: `/wp/v2/wfd-boards/${ fixture.boardId }`,
            data: { layout: { ...fixture.layout, notes: [ note ] } },
        } );
        await openBoard( page, fixture.boardId );
        await boardAtRest( page );

        const first = await callTool( page, 'board-get' );
        expect( first.ok ).toBe( true );
        const board = first.result;
        expect( board.board ).toEqual( {
            id: fixture.boardId,
            title: 'Fixture board',
        } );
        // Left-panel order.
        const rows = await page
            .locator( '[data-wfd-panel="artboards"] [data-wfd-row]' )
            .evaluateAll( ( els ) =>
                els.map( ( el ) => el.getAttribute( 'data-wfd-row' ) )
            );
        expect( [
            ...board.artboards.map( ( a: any ) => a.id ),
            ...board.notes.map( ( n: any ) => n.id ),
        ] ).toEqual( rows );
        expect( board.artboards ).toHaveLength( 9 );
        const tiers = await tiersOf( page );
        for ( const artboard of board.artboards ) {
            const saved = fixture.layout.artboards.find(
                ( a ) => a.id === artboard.id
            )!;
            expect( Object.keys( artboard ) ).toEqual( [
                'id',
                'ref',
                'kind',
                'name',
                'entityId',
                'device',
                'x',
                'y',
                'width',
                'height',
                'tier',
            ] );
            expect( artboard.ref ).toBe( `wfd-ref-a_${ artboard.id }` );
            expect( artboard.kind ).toBe( saved.kind );
            expect( artboard.entityId ).toBe( saved.entityId );
            expect( artboard.device ).toBe( saved.device );
            expect( artboard.x ).toBe( saved.x );
            expect( artboard.y ).toBe( saved.y );
            expect( artboard.width ).toBe(
                { desktop: 1440, tablet: 780, mobile: 360 }[ saved.device ]
            );
            expect( artboard.tier ).toBe( tiers[ artboard.id ] );
            const label = await page
                .locator(
                    `[data-wfd-artboard="${ artboard.id }"] .wfd-artboard__label`
                )
                .innerText();
            expect( label.startsWith( artboard.name + ' · ' ) ).toBe( true );
            expect( artboard.height ).toBeGreaterThan( 0 );
        }
        expect( board.notes ).toEqual(
            [ { ...note, ref: `wfd-ref-n_${ note.id }` } ].map(
                ( { id, ref, text, color, x, y } ) => ( {
                    id,
                    ref,
                    text,
                    color,
                    x,
                    y,
                } )
            )
        );
        expect( board.selection ).toEqual( [] );
        expect( board.edit ).toBeNull();
        expect( board.zoom ).toBeCloseTo(
            ( await viewportOf( page ) ).zoom,
            5
        );

        // The selection, then the artboard in edit.
        const header = board.artboards.find(
            ( a: any ) => a.kind === 'template-part' && a.device === 'mobile'
        );
        await page.locator( `[data-wfd-row="${ header.id }"]` ).click();
        const selected = ( await callTool( page, 'board-get' ) ).result;
        expect( selected.selection ).toEqual( [ header.id ] );
        expect( selected.edit ).toBeNull();

        await enterEdit( page, header.id );
        const editing = ( await callTool( page, 'board-get' ) ).result;
        expect( editing.edit ).toBe( header.id );
        expect( editing.selection ).toEqual( [ header.id ] );
        expect(
            editing.artboards.find( ( a: any ) => a.id === header.id ).tier
        ).toBe( 'live' );
        expect( editing.zoom ).toBeCloseTo(
            ( await viewportOf( page ) ).zoom,
            5
        );
    } );

    test( 'AC-TOOL-02 board-select selects one artboard and brings it into view, fits two, and ends edit first', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        await boardAtRest( page );
        const hero = artboardOf( fixture, 'pattern' );
        const header = artboardOf( fixture, 'template-part' );
        const footer = artboardOf( fixture, 'template-part', 'desktop', 1 );

        // Far from the pattern, at a zoom that stays.
        await setViewport( page, { x: 5000, y: 5000, zoom: 0.25 } );
        expect( await isInView( page, hero.id ) ).toBe( false );
        const one = await callTool( page, 'board-select', {
            artboards: [ hero.id ],
        } );
        expect( one ).toEqual( {
            ok: true,
            result: { selection: [ hero.id ] },
        } );
        await expect( frame( page, hero.id ) ).toHaveClass( /is-selected/ );
        await expect.poll( () => isInView( page, hero.id ) ).toBe( true );
        expect( ( await viewportOf( page ) ).zoom ).toBeCloseTo( 0.25, 5 );

        // Two: both selected, and fitted.
        const two = await callTool( page, 'board-select', {
            artboards: [ header.id, `wfd-ref-a_${ footer.id }` ],
        } );
        expect( two.result ).toEqual( { selection: [ header.id, footer.id ] } );
        await expect( frame( page, header.id ) ).toHaveClass( /is-selected/ );
        await expect( frame( page, footer.id ) ).toHaveClass( /is-selected/ );
        await expect( frame( page, hero.id ) ).not.toHaveClass( /is-selected/ );
        await expect.poll( () => isInView( page, header.id ) ).toBe( true );
        await expect.poll( () => isInView( page, footer.id ) ).toBe( true );
        expect( ( await viewportOf( page ) ).zoom ).not.toBeCloseTo( 0.25, 3 );

        // With an artboard in edit, edit ends first.
        await enterEdit( page, header.id );
        const third = await callTool( page, 'board-select', {
            artboards: [ hero.id ],
        } );
        expect( third.result ).toEqual( { selection: [ hero.id ] } );
        await expect( page.locator( '[data-wfd-tier="live"]' ) ).toHaveCount(
            0
        );
        expect(
            ( await callTool( page, 'board-get' ) ).result.edit
        ).toBeNull();

        const missing = await callTool( page, 'board-select', {
            artboards: [ 'no-such-artboard' ],
        } );
        expect( missing ).toEqual( {
            ok: false,
            error: {
                code: 'not_found',
                message: 'Artboard no-such-artboard was not found.',
            },
        } );
    } );

    test( 'AC-TOOL-03 board-refresh shows a title changed on the site and keeps an unsaved change', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        await boardAtRest( page );
        const about = fixture.layout.artboards.find(
            ( a ) => a.entityId === fixture.pages.about
        )!;
        const label = frame( page, about.id ).locator( '.wfd-artboard__label' );
        await expect( label ).toHaveText( 'About · Page · Desktop' );
        await editPattern( page, fixture.patterns.hero );
        await expect( review( page ) ).toHaveText( 'Review 1 change' );

        const updated = await wp( [
            'post',
            'update',
            String( fixture.pages.about ),
            '--post_title=About us',
        ] );
        expect( updated.code ).toBe( 0 );
        await page.waitForTimeout( 500 );
        await expect( label ).toHaveText( 'About · Page · Desktop' );

        expect( await callTool( page, 'board-refresh' ) ).toEqual( {
            ok: true,
            result: { refreshed: true },
        } );
        await expect( label ).toHaveText( 'About us · Page · Desktop' );
        await expect( review( page ) ).toHaveText( 'Review 1 change' );
        expect(
            ( await callTool( page, 'board-get' ) ).result.artboards.find(
                ( a: any ) => a.id === about.id
            ).name
        ).toBe( 'About us' );
    } );

    test( "AC-TOOL-04 artboard-add opens a page where its row's click would, adds a browser, ends edit first, and fails on an unknown item", async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        await boardAtRest( page );
        await setViewport( page, { x: 300, y: 200, zoom: 0.2 } );
        const positions = async () =>
            ( await callTool( page, 'board-get' ) ).result.artboards;

        // Where a click on the page's inserter row puts it.
        const panel = await openInserter( page, 'Pages' );
        await panel
            .getByRole( 'tabpanel' )
            .locator( '.wfd-row' )
            .filter( {
                has: page.locator( '.wfd-row__name', { hasText: /^About$/ } ),
            } )
            .click();
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 10 );
        const clicked = ( await positions() ).find(
            ( a: any ) =>
                ! fixture.layout.artboards.some( ( b ) => b.id === a.id )
        );
        const view = await viewportOf( page );
        await page.locator( '[data-wfd-region="canvas"]' ).click( {
            position: { x: 5, y: 5 },
        } );
        await undo( page ).click();
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 9 );
        await setViewport( page, view );
        // Put the board back where the click found it.
        await setViewport( page, { x: 300, y: 200, zoom: 0.2 } );

        const added = await callTool( page, 'artboard-add', {
            kind: 'page',
            entityId: fixture.pages.about,
            device: 'tablet',
        } );
        expect( added.ok ).toBe( true );
        expect( added.result ).toMatchObject( {
            kind: 'page',
            name: 'About',
            entityId: fixture.pages.about,
            device: 'tablet',
            x: clicked.x,
            y: clicked.y,
            width: 780,
        } );
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 10 );
        await expect( frame( page, added.result.id ) ).toHaveAttribute(
            'data-wfd-device',
            'tablet'
        );
        expect(
            ( await callTool( page, 'board-get' ) ).result.selection
        ).toEqual( [ added.result.id ] );

        // A browser at an address.
        const browser = await callTool( page, 'artboard-add', {
            kind: 'browser',
            path: '/?s=hello',
        } );
        expect( browser.ok ).toBe( true );
        expect( browser.result ).toMatchObject( {
            kind: 'browser',
            name: '/?s=hello',
            path: '/?s=hello',
            device: 'desktop',
            height: 900,
        } );
        expect( browser.result ).not.toHaveProperty( 'entityId' );
        expect( browser.result ).not.toHaveProperty( 'tier' );
        await expect( frame( page, browser.result.id ) ).toHaveAttribute(
            'data-wfd-kind',
            'browser'
        );

        // In edit: edit ends first, and the page does not go into the part.
        const header = artboardOf( fixture, 'template-part' );
        await page.locator( '[data-wfd-control="H2"]' ).click();
        await page.locator( '[data-wfd-region="canvas"]' ).focus();
        await page.keyboard.press( 'Shift+Digit1' );
        await enterEdit( page, header.id );
        const inEdit = await callTool( page, 'artboard-add', {
            kind: 'page',
            entityId: fixture.pages.member,
        } );
        expect( inEdit.ok ).toBe( true );
        await expect( page.locator( '[data-wfd-tier="live"]' ) ).toHaveCount(
            0
        );
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 12 );
        await expect( review( page ) ).toHaveText( 'Review changes' );

        // Unknown items.
        expect(
            await callTool( page, 'artboard-add', {
                kind: 'page',
                entityId: 99999999,
            } )
        ).toEqual( {
            ok: false,
            error: {
                code: 'not_found',
                message: 'Page 99999999 was not found.',
            },
        } );
        expect(
            (
                await callTool( page, 'artboard-add', {
                    kind: 'template',
                    entityId: 'twentytwentyfive//no-such-template',
                } )
            ).error
        ).toEqual( {
            code: 'not_found',
            message:
                'Template twentytwentyfive//no-such-template was not found.',
        } );
        expect(
            (
                await callTool( page, 'artboard-add', {
                    kind: 'page',
                    entityId: 'about',
                } )
            ).error.code
        ).toBe( 'invalid_args' );
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 12 );
    } );

    test( 'AC-TOOL-05 artboard-new creates a draft page at once, a part only in the session, places at x and y, and refuses a purpose that exists', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        await boardAtRest( page );

        const made = await callTool( page, 'artboard-new', {
            kind: 'page',
            x: 9000,
            y: -400,
        } );
        expect( made.ok ).toBe( true );
        expect( made.result ).toMatchObject( {
            kind: 'page',
            name: 'Untitled page',
            device: 'desktop',
            x: 9000,
            y: -400,
        } );
        const created = await requestUtils.rest< any >( {
            path: `/wp/v2/pages/${ made.result.entityId }`,
            params: { context: 'edit' },
        } );
        expect( created.status ).toBe( 'draft' );
        expect( created.title.raw ).toBe( 'Untitled page' );
        // Left as the New row leaves it: in edit.
        await expect( frame( page, made.result.id ) ).toHaveAttribute(
            'data-wfd-tier',
            'live'
        );

        // A template part exists only in the session.
        const part = await callTool( page, 'artboard-new', {
            kind: 'template-part',
        } );
        expect( part.ok ).toBe( true );
        expect( part.result ).toMatchObject( {
            kind: 'template-part',
            name: 'Untitled part',
        } );
        const parts = await requestUtils.rest< any[] >( {
            path: '/wp/v2/template-parts',
            params: { per_page: 100 },
        } );
        expect( parts.some( ( item ) => /untitled/.test( item.slug ) ) ).toBe(
            false
        );
        await expect( review( page ) ).toHaveText( 'Review 1 change' );

        // A purpose the theme already has a template for.
        const before = ( await callTool( page, 'board-get' ) ).result.artboards
            .length;
        const taken = await callTool( page, 'artboard-new', {
            kind: 'template',
            purpose: 'archive',
        } );
        expect( taken.ok ).toBe( false );
        expect( taken.error.code ).toBe( 'invalid_args' );
        expect( taken.error.message ).toContain( 'purpose' );
        expect(
            (
                await callTool( page, 'artboard-new', {
                    kind: 'page',
                    x: 10,
                } )
            ).error
        ).toEqual( {
            code: 'invalid_args',
            message: 'x and y must be given together.',
        } );
        expect(
            ( await callTool( page, 'board-get' ) ).result.artboards.length
        ).toBe( before );

        // One the theme has no template for.
        const singular = await callTool( page, 'artboard-new', {
            kind: 'template',
            purpose: 'singular',
        } );
        expect( singular.ok ).toBe( true );
        expect( singular.result ).toMatchObject( {
            kind: 'template',
            name: 'Single item',
        } );
        const templates = await requestUtils.rest< any[] >( {
            path: '/wp/v2/templates',
            params: { per_page: 100 },
        } );
        expect( templates.some( ( item ) => item.slug === 'singular' ) ).toBe(
            false
        );
    } );

    test( 'AC-TOOL-06 artboard-update changes the device and the position, each as one named layout undo step', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        await boardAtRest( page );
        const hero = artboardOf( fixture, 'pattern' );

        const device = await callTool( page, 'artboard-update', {
            artboard: hero.id,
            device: 'mobile',
        } );
        expect( device.result ).toMatchObject( {
            id: hero.id,
            device: 'mobile',
            width: 360,
        } );
        await expect( frame( page, hero.id ) ).toHaveAttribute(
            'data-wfd-device',
            'mobile'
        );
        await expect( undo( page ) ).toHaveAccessibleName(
            'Undo change device, on the board'
        );

        const moved = await callTool( page, 'artboard-update', {
            artboard: `#wfd-ref-a_${ hero.id }`,
            x: hero.x + 120,
            y: hero.y - 60,
        } );
        expect( moved.result ).toMatchObject( {
            id: hero.id,
            x: hero.x + 120,
            y: hero.y - 60,
            device: 'mobile',
        } );
        await expect( undo( page ) ).toHaveAccessibleName(
            'Undo move artboard, on the board'
        );

        // One step each.
        const state = async () => {
            const {
                x,
                y,
                device: d,
            } = ( await callTool( page, 'board-get' ) ).result.artboards.find(
                ( a: any ) => a.id === hero.id
            );
            return { x, y, device: d };
        };
        await undo( page ).click();
        expect( await state() ).toEqual( {
            x: hero.x,
            y: hero.y,
            device: 'mobile',
        } );
        await expect( undo( page ) ).toHaveAccessibleName(
            'Undo change device, on the board'
        );
        await undo( page ).click();
        expect( await state() ).toEqual( {
            x: hero.x,
            y: hero.y,
            device: 'desktop',
        } );
        await expect( undo( page ) ).toBeDisabled();

        expect(
            ( await callTool( page, 'artboard-update', { artboard: hero.id } ) )
                .error
        ).toEqual( {
            code: 'invalid_args',
            message: 'One of device and x, y is required.',
        } );
        expect(
            (
                await callTool( page, 'artboard-update', {
                    artboard: hero.id,
                    x: 1,
                } )
            ).error.code
        ).toBe( 'invalid_args' );
    } );

    test( 'AC-TOOL-07 artboard-remove takes artboards off the board with no dialog, leaves their items, and Undo brings them back', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        await boardAtRest( page );
        const about = fixture.layout.artboards.find(
            ( a ) => a.entityId === fixture.pages.about
        )!;
        const hero = artboardOf( fixture, 'pattern' );

        const removed = await callTool( page, 'artboard-remove', {
            artboards: [ about.id, `wfd-ref-a_${ hero.id }` ],
        } );
        expect( removed ).toEqual( {
            ok: true,
            result: { removed: [ about.id, hero.id ] },
        } );
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 7 );
        await expect( page.getByRole( 'dialog' ) ).toHaveCount( 0 );
        await expect( page.getByRole( 'alertdialog' ) ).toHaveCount( 0 );
        const saved = await requestUtils.rest< any >( {
            path: `/wp/v2/pages/${ fixture.pages.about }`,
            params: { context: 'edit' },
        } );
        expect( saved.status ).toBe( 'publish' );
        const pattern = await requestUtils.rest< any >( {
            path: `/wp/v2/blocks/${ fixture.patterns.hero }`,
            params: { context: 'edit' },
        } );
        expect( pattern.status ).toBe( 'publish' );
        await expect( review( page ) ).toHaveText( 'Review changes' );

        await expect( undo( page ) ).toHaveAccessibleName(
            'Undo remove artboard, on the board'
        );
        await undo( page ).click();
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 9 );
        await expect( frame( page, about.id ) ).toHaveCount( 1 );
        await expect( frame( page, hero.id ) ).toHaveCount( 1 );
    } );

    test( 'AC-TOOL-08 artboard-edit makes the artboard Live with the zoom of D37, fails on media and on a lock, and edit-leave leaves edit', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        const image = ( await requestUtils.uploadMedia( SAMPLE ) ) as any;
        await requestUtils.rest( {
            method: 'POST',
            path: `/wp/v2/wfd-boards/${ fixture.boardId }`,
            data: {
                layout: {
                    version: 1,
                    artboards: [
                        ...fixture.layout.artboards,
                        {
                            id: '0c0ffee0-0000-4000-8000-0000000000aa',
                            kind: 'media',
                            entityId: image.id,
                            x: 6400,
                            y: 0,
                            width: 40,
                            height: 30,
                        },
                    ],
                },
            },
        } );
        await openBoard( page, fixture.boardId, 10 );
        await boardAtRest( page );
        const header = artboardOf( fixture, 'template-part' );
        expect( ( await viewportOf( page ) ).zoom ).toBeLessThan( 0.3 );

        const entered = await callTool( page, 'artboard-edit', {
            artboard: header.id,
        } );
        expect( entered ).toEqual( { ok: true, result: { edit: header.id } } );
        await expect( frame( page, header.id ) ).toHaveAttribute(
            'data-wfd-tier',
            'live'
        );
        await editorFrame( page, header.id )
            .locator( '.is-root-container' )
            .waitFor();
        // From below 30% the zoom fits the artboard's width, 30% at least.
        const area = ( await page
            .locator( '[data-wfd-region="canvas"]' )
            .boundingBox() )!;
        const view = await viewportOf( page );
        expect( view.zoom ).toBeCloseTo(
            Math.min( 1, Math.max( 0.3, ( area.width - 48 ) / 1440 ) ),
            3
        );

        // In edit already: nothing changes.
        const again = await callTool( page, 'artboard-edit', {
            artboard: `wfd-ref-a_${ header.id }`,
        } );
        expect( again ).toEqual( { ok: true, result: { edit: header.id } } );
        expect( await viewportOf( page ) ).toEqual( view );

        // edit-leave keeps it selected.
        expect( await callTool( page, 'edit-leave' ) ).toEqual( {
            ok: true,
            result: { edit: null },
        } );
        await expect( page.locator( '[data-wfd-tier="live"]' ) ).toHaveCount(
            0
        );
        await expect( frame( page, header.id ) ).toHaveClass( /is-selected/ );
        expect(
            ( await callTool( page, 'board-get' ) ).result.selection
        ).toEqual( [ header.id ] );
        expect( ( await callTool( page, 'edit-leave' ) ).result ).toEqual( {
            edit: null,
        } );

        // A media object.
        const media = await callTool( page, 'artboard-edit', {
            artboard: '0c0ffee0-0000-4000-8000-0000000000aa',
        } );
        expect( media.ok ).toBe( false );
        expect( media.error.code ).toBe( 'not_editable' );
        expect( media.error.message ).toMatch( /^.+ cannot be edited\.$/ );

        // A page another user holds the lock of.
        await postLock(
            requestUtils,
            fixture.pages.about,
            fixture.users.wfd_admin2
        );
        const about = fixture.layout.artboards.find(
            ( a ) => a.entityId === fixture.pages.about
        )!;
        const tierBefore = ( await tiersOf( page ) )[ about.id ];
        const locked = await callTool( page, 'artboard-edit', {
            artboard: about.id,
        } );
        expect( locked ).toEqual( {
            ok: false,
            error: {
                code: 'locked',
                message: 'About is being edited by Second Admin.',
            },
        } );
        await page.waitForTimeout( 500 );
        expect( ( await tiersOf( page ) )[ about.id ] ).toBe( tierBefore );
        await expect( page.locator( '[data-wfd-tier="live"]' ) ).toHaveCount(
            0
        );
        await expect( page.getByRole( 'dialog' ) ).toHaveCount( 0 );
        await expect( page.getByRole( 'alertdialog' ) ).toHaveCount( 0 );
        expect(
            ( await callTool( page, 'board-get' ) ).result.selection
        ).toEqual( [ header.id ] );
        expect( await postLock( requestUtils, fixture.pages.about ) ).toBe(
            fixture.users.wfd_admin2
        );
    } );

    test( 'AC-TOOL-23 With the Review drawer open, and in a narrow window, every tool fails with unavailable and changes nothing', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        await boardAtRest( page );
        const hero = artboardOf( fixture, 'pattern' );
        const header = artboardOf( fixture, 'template-part' );
        await editPattern( page, fixture.patterns.hero );
        await expect( review( page ) ).toHaveText( 'Review 1 change' );
        const tools: Record< string, object > = {
            'board-get': {},
            'board-select': { artboards: [ hero.id ] },
            'board-refresh': {},
            'artboard-add': { kind: 'page', entityId: fixture.pages.about },
            'artboard-new': { kind: 'page' },
            'artboard-update': { artboard: hero.id, device: 'mobile' },
            'artboard-remove': { artboards: [ hero.id ] },
            'artboard-edit': { artboard: header.id },
            'edit-leave': {},
            'blocks-get': { artboard: header.id },
            'block-update': {
                artboard: header.id,
                path: [ 0, 0 ],
                attributes: { content: 'Nope' },
            },
            'blocks-insert': {
                artboard: header.id,
                markup: '<!-- wp:paragraph --><p>Nope</p><!-- /wp:paragraph -->',
            },
            'blocks-remove': { artboard: header.id, paths: [ [ 0, 0 ] ] },
            'blocks-move': { artboard: header.id, path: [ 0, 0 ], index: 0 },
            'styles-get': {},
            'token-set': { kind: 'color', slug: 'base', value: '#123456' },
            'styles-set': {
                kind: 'style',
                path: 'color.background',
                value: '#123456',
            },
            'styles-set-variation': { name: 'Default' },
            'token-show-uses': { kind: 'color', slug: 'base' },
            'review-list': {},
            'review-discard': {
                key: `postType/wp_block/${ fixture.patterns.hero }`,
            },
        };
        const declared = await page.evaluate( async () =>
            ( await ( window as any ).wfdAgent.ready() ).tools.map(
                ( tool: any ) => tool.name
            )
        );
        expect( Object.keys( tools ) ).toEqual( declared );
        const state = () =>
            page.evaluate( () => {
                const { select } = ( window as any ).wp.data;
                const board = select( 'wfd/board' );
                return JSON.stringify( [
                    board
                        .getArtboards()
                        .map( ( a: any ) => [ a.id, a.x, a.y, a.device ] ),
                    board.getSelectedIds(),
                    board.getEditId(),
                    select( 'core' )
                        .__experimentalGetDirtyEntityRecords()
                        .map( ( r: any ) => r.key ),
                ] );
            } );
        const allUnavailable = async () => {
            const before = await state();
            for ( const [ name, input ] of Object.entries( tools ) ) {
                expect( await callTool( page, name, input ), name ).toEqual( {
                    ok: false,
                    error: {
                        code: 'unavailable',
                        message: 'The board cannot be used right now.',
                    },
                } );
            }
            expect( await state() ).toBe( before );
        };

        // The Review drawer is open.
        await review( page ).click();
        await expect( page.locator( '.wfd-review' ) ).toBeVisible();
        await allUnavailable();
        await page.getByRole( 'button', { name: 'Keep editing' } ).click();
        await expect( page.locator( '.wfd-review' ) ).toHaveCount( 0 );
        expect( ( await callTool( page, 'board-get' ) ).ok ).toBe( true );

        // The window is narrower than 1180 px.
        await page.setViewportSize( { width: 1100, height: 900 } );
        await expect(
            page.locator( '[data-wfd-region="needs-space"]' )
        ).toBeVisible();
        await allUnavailable();
        await page.setViewportSize( { width: 1440, height: 900 } );
        await expect(
            page.locator( '[data-wfd-region="needs-space"]' )
        ).toHaveCount( 0 );
        expect( ( await callTool( page, 'board-get' ) ).ok ).toBe( true );
        await expect( review( page ) ).toHaveText( 'Review 1 change' );
    } );
} );
