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
    counters,
    frameBox,
    artboardOf,
    openInserter,
    postLock,
} from './utils';
import { callTool, php, wp } from './agent-utils';

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
            address: '/?s=hello',
        } );
        expect( browser.ok ).toBe( true );
        expect( browser.result ).toMatchObject( {
            kind: 'browser',
            name: '/?s=hello',
            address: '/?s=hello',
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

    test( 'AC-TOOL-23 With the Review drawer open, and in a narrow window, every tool fails with unavailable and changes nothing, also when its input is wrong', async ( {
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
                block: [ 0, 0 ],
                attributes: { content: 'Nope' },
            },
            'blocks-insert': {
                artboard: header.id,
                markup: '<!-- wp:paragraph --><p>Nope</p><!-- /wp:paragraph -->',
            },
            'blocks-remove': { artboard: header.id, blocks: [ [ 0, 0 ] ] },
            'blocks-move': { artboard: header.id, block: [ 0, 0 ], index: 0 },
            'styles-get': {},
            'token-set': { kind: 'color', slug: 'base', value: '#123456' },
            'styles-set': {
                kind: 'style',
                property: 'color.background',
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
            // Also when the input is wrong: it is not looked at.
            for ( const name of Object.keys( tools ) ) {
                expect(
                    await callTool( page, name, { nope: 1 } ),
                    `${ name } with a wrong input`
                ).toEqual( {
                    ok: false,
                    error: {
                        code: 'unavailable',
                        message: 'The board cannot be used right now.',
                    },
                } );
            }
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

    test( 'AC-TOOL-09 A block tool puts its artboard in edit first, the one in edit leaves, and no block changes outside the Live artboard', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        await boardAtRest( page );
        const header = artboardOf( fixture, 'template-part' );
        const hero = artboardOf( fixture, 'pattern' );
        expect(
            ( await callTool( page, 'artboard-edit', { artboard: header.id } ) )
                .ok
        ).toBe( true );
        await expect( frame( page, header.id ) ).toHaveAttribute(
            'data-wfd-tier',
            'live'
        );

        // Which artboard is Live each time the pattern's edits change.
        await page.evaluate( ( id ) => {
            const { select, subscribe } = ( window as any ).wp.data;
            const seen: string[] = [];
            ( window as any ).wfdSeen = seen;
            let last = select( 'core' ).getEntityRecordEdits(
                'postType',
                'wp_block',
                id
            );
            subscribe( () => {
                const now = select( 'core' ).getEntityRecordEdits(
                    'postType',
                    'wp_block',
                    id
                );
                if ( now !== last ) {
                    last = now;
                    seen.push( String( select( 'wfd/board' ).getLiveId() ) );
                }
            } );
        }, fixture.patterns.hero );

        const updated = await callTool( page, 'block-update', {
            artboard: hero.id,
            block: [ 0 ],
            attributes: { content: 'Changed in the pattern' },
        } );
        expect( updated.ok ).toBe( true );
        await expect( frame( page, hero.id ) ).toHaveAttribute(
            'data-wfd-tier',
            'live'
        );
        await expect( frame( page, header.id ) ).not.toHaveAttribute(
            'data-wfd-tier',
            'live'
        );
        await expect( page.locator( '[data-wfd-tier="live"]' ) ).toHaveCount(
            1
        );
        const seen = await page.evaluate( () => ( window as any ).wfdSeen );
        expect( seen.length ).toBeGreaterThan( 0 );
        expect( new Set( seen ) ).toEqual( new Set( [ hero.id ] ) );
        await expect( editorFrame( page, hero.id ).locator( 'h2' ) ).toHaveText(
            'Changed in the pattern'
        );
        // The part that was in edit is unchanged.
        await expect( review( page ) ).toHaveText( 'Review 1 change' );

        // A browser has no blocks.
        const browser = await callTool( page, 'artboard-add', {
            kind: 'browser',
            address: '/',
        } );
        const refused = await callTool( page, 'blocks-get', {
            artboard: browser.result.id,
        } );
        expect( refused ).toEqual( {
            ok: false,
            error: { code: 'not_editable', message: '/ cannot be edited.' },
        } );
    } );

    test( 'AC-TOOL-10 blocks-get returns paths, names, titles, text and attributes to the depth asked, and says what is editable', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        await boardAtRest( page );
        const header = artboardOf( fixture, 'template-part' );
        const all = await callTool( page, 'blocks-get', {
            artboard: header.id,
        } );
        expect( all.ok ).toBe( true );
        expect( all.result.artboard ).toBe( header.id );
        expect( all.result.blocks ).toHaveLength( 1 );
        const group = all.result.blocks[ 0 ];
        expect( group ).toMatchObject( {
            path: [ 0 ],
            ref: `wfd-ref-a_${ header.id }_b_0`,
            name: 'core/group',
            title: 'Group',
            text: 'Fixture header text',
            editable: true,
            innerCount: 1,
        } );
        expect( group.attributes.layout ).toEqual( { type: 'constrained' } );
        expect( group.inner ).toHaveLength( 1 );
        expect( group.inner[ 0 ] ).toMatchObject( {
            path: [ 0, 0 ],
            ref: `wfd-ref-a_${ header.id }_b_0_0`,
            name: 'core/paragraph',
            title: 'Paragraph',
            text: 'Fixture header text',
            editable: true,
            innerCount: 0,
            inner: [],
        } );
        expect( group.inner[ 0 ].attributes.content ).toBe(
            'Fixture header text'
        );

        // Depth 0: no inner blocks listed.
        const shallow = await callTool( page, 'blocks-get', {
            artboard: header.id,
            depth: 0,
        } );
        expect( shallow.result.blocks[ 0 ].innerCount ).toBe( 1 );
        expect( shallow.result.blocks[ 0 ] ).not.toHaveProperty( 'inner' );

        // One block, by path.
        const one = await callTool( page, 'blocks-get', {
            artboard: header.id,
            block: [ 0, 0 ],
        } );
        expect( one.result.blocks ).toHaveLength( 1 );
        expect( one.result.blocks[ 0 ].path ).toEqual( [ 0, 0 ] );
        expect(
            (
                await callTool( page, 'blocks-get', {
                    artboard: header.id,
                    block: [ 3 ],
                } )
            ).error
        ).toEqual( { code: 'not_found', message: 'Block [3] was not found.' } );

        // A page: the template around it is not editable, its own blocks are.
        const about = fixture.layout.artboards.find(
            ( a ) => a.entityId === fixture.pages.about
        )!;
        const page10 = await callTool( page, 'blocks-get', {
            artboard: about.id,
            depth: 10,
        } );
        expect( page10.ok ).toBe( true );
        const flat: any[] = [];
        const walk = ( blocks: any[] ) =>
            blocks.forEach( ( block ) => {
                flat.push( block );
                walk( block.inner ?? [] );
            } );
        walk( page10.result.blocks );
        const part = flat.find( ( b ) => b.name === 'core/template-part' );
        expect( part.editable ).toBe( false );
        // Every block of the template is locked: all but the page's own
        // blocks and the blocks that show the page (its title, its
        // featured image and its Content).
        const content = flat.find( ( b ) => b.name === 'core/post-content' );
        const isInContent = ( b: any ) =>
            b.path.length > content.path.length &&
            content.path.every(
                ( index: number, depth: number ) => b.path[ depth ] === index
            );
        const ofThePage = [
            'core/post-content',
            'core/post-title',
            'core/post-featured-image',
        ];
        const template = flat.filter(
            ( b ) => ! isInContent( b ) && ! ofThePage.includes( b.name )
        );
        expect( template.length ).toBeGreaterThan( 20 );
        expect(
            template.filter( ( b ) => b.editable ).map( ( b ) => b.name )
        ).toEqual( [] );
        expect( flat.filter( isInContent ).every( ( b ) => b.editable ) ).toBe(
            true
        );
        const heading = flat.find(
            ( b ) => b.name === 'core/heading' && b.text === 'About'
        );
        expect( heading.editable ).toBe( true );
        const paragraph = flat.find(
            ( b ) =>
                b.name === 'core/paragraph' && b.text === 'About paragraph.'
        );
        expect( paragraph.editable ).toBe( true );
        expect( paragraph.attributes.backgroundColor ).toBe( 'accent-1' );
        expect(
            flat
                .filter( ( b ) => b.name === 'core/post-content' )
                .every( ( b ) => b.innerCount === 2 )
        ).toBe( true );
    } );

    test( 'AC-TOOL-11 block-update changes the text in every artboard that shows the item, lists it in Review, and undoes as one step', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        await boardAtRest( page );
        const header = artboardOf( fixture, 'template-part' );
        const mobile = artboardOf( fixture, 'template-part', 'mobile' );
        await setViewport( page, {
            x: 40 - header.x * 0.4,
            y: 60 - header.y * 0.4,
            zoom: 0.4,
        } );
        await expect( frame( page, mobile.id ) ).toHaveAttribute(
            'data-wfd-tier',
            'preview'
        );

        const updated = await callTool( page, 'block-update', {
            artboard: header.id,
            block: [ 0, 0 ],
            attributes: { content: 'Changed by a tool' },
        } );
        expect( updated.ok ).toBe( true );
        expect( updated.result ).toMatchObject( {
            path: [ 0, 0 ],
            name: 'core/paragraph',
            text: 'Changed by a tool',
        } );
        expect( updated.result ).not.toHaveProperty( 'inner' );
        const live = editorFrame( page, header.id ).locator( 'p' );
        await expect( live ).toHaveText( 'Changed by a tool' );
        const other = page
            .frameLocator( `[data-wfd-artboard="${ mobile.id }"] iframe` )
            .locator( 'p' );
        await expect( other ).toHaveText( 'Changed by a tool' );
        await expect( review( page ) ).toHaveText( 'Review 1 change' );
        await review( page ).click();
        await expect(
            page.locator( '.wfd-review__item' ).first()
        ).toContainText( 'Header' );
        await page.getByRole( 'button', { name: 'Keep editing' } ).click();

        // Cmd/Ctrl + Z in the artboard.
        await live.click();
        await page.keyboard.press( 'ControlOrMeta+z' );
        await expect( live ).toHaveText( 'Fixture header text' );
        await expect( other ).toHaveText( 'Fixture header text' );
        await expect( review( page ) ).toHaveText( 'Review changes' );
        await expect( review( page ) ).toBeDisabled();
    } );

    test( 'AC-TOOL-12 blocks-insert inserts markup and a pattern, and what the editor does not allow fails with not_allowed', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        await boardAtRest( page );
        const header = artboardOf( fixture, 'template-part' );
        const names = async ( artboard: string ) => {
            const out: string[] = [];
            const walk = ( blocks: any[] ) =>
                blocks.forEach( ( block ) => {
                    out.push( `${ block.path.join( '.' ) } ${ block.name }` );
                    walk( block.inner ?? [] );
                } );
            walk(
                (
                    await callTool( page, 'blocks-get', {
                        artboard,
                        depth: 10,
                    } )
                ).result.blocks
            );
            return out;
        };
        const heading =
            '<!-- wp:heading --><h2 class="wp-block-heading">Inserted</h2><!-- /wp:heading -->';
        const inserted = await callTool( page, 'blocks-insert', {
            artboard: header.id,
            parent: [ 0 ],
            index: 0,
            markup:
                heading +
                '\n\n<!-- wp:paragraph --><p>And a paragraph</p><!-- /wp:paragraph -->',
        } );
        expect( inserted ).toEqual( {
            ok: true,
            result: {
                inserted: [
                    [ 0, 0 ],
                    [ 0, 1 ],
                ],
            },
        } );
        expect( await names( header.id ) ).toEqual( [
            '0 core/group',
            '0.0 core/heading',
            '0.1 core/paragraph',
            '0.2 core/paragraph',
        ] );
        await expect(
            editorFrame( page, header.id ).locator( 'h2' )
        ).toHaveText( 'Inserted' );

        // Without an index: after the last, at the top level.
        const last = await callTool( page, 'blocks-insert', {
            artboard: header.id,
            markup: heading,
        } );
        expect( last.result ).toEqual( { inserted: [ [ 1 ] ] } );

        // A pattern of the active theme, by name: the inserted blocks are
        // that pattern's.
        const patterns = await page.evaluate( async () => {
            const { resolveSelect } = ( window as any ).wp.data;
            const all = await resolveSelect( 'core' ).getBlockPatterns();
            const themed = all.find(
                ( item: any ) =>
                    ( ! item.source || item.source === 'theme' ) &&
                    item.inserter !== false
            );
            const other = all.find(
                ( item: any ) => item.source && item.source !== 'theme'
            );
            return {
                name: themed.name,
                blocks: ( window as any ).wp.blocks
                    .parse( themed.content )
                    .map( ( block: any ) => block.name ),
                unlisted: other?.name ?? null,
            };
        } );
        const pattern = patterns.name;
        const before = ( await names( header.id ) ).length;
        const byName = await callTool( page, 'blocks-insert', {
            artboard: header.id,
            pattern,
        } );
        expect( byName.ok ).toBe( true );
        expect( byName.result.inserted ).toEqual(
            patterns.blocks.map( ( name: string, index: number ) => [
                2 + index,
            ] )
        );
        const topNames = async () =>
            (
                await callTool( page, 'blocks-get', {
                    artboard: header.id,
                    depth: 0,
                } )
            ).result.blocks.map( ( block: any ) => block.name );
        expect(
            ( await topNames() ).slice( 2, 2 + patterns.blocks.length )
        ).toEqual( patterns.blocks );
        expect( ( await names( header.id ) ).length ).toBeGreaterThan( before );

        // A pattern of the site, by its id: a synced pattern goes in by
        // reference, as its inserter row puts it.
        const bySite = await callTool( page, 'blocks-insert', {
            artboard: header.id,
            index: 0,
            pattern: String( fixture.patterns.sign ),
        } );
        expect( bySite.result ).toEqual( { inserted: [ [ 0 ] ] } );
        const synced = (
            await callTool( page, 'blocks-get', {
                artboard: header.id,
                block: [ 0 ],
            } )
        ).result.blocks[ 0 ];
        expect( synced.name ).toBe( 'core/block' );
        expect( synced.attributes.ref ).toBe( fixture.patterns.sign );
        expect( synced.text ).toBe( 'Until Sunday.' );
        expect(
            (
                await callTool( page, 'blocks-remove', {
                    artboard: header.id,
                    blocks: [ [ 0 ] ],
                } )
            ).ok
        ).toBe( true );

        // A pattern the inserter does not list: one WordPress registers.
        expect( patterns.unlisted ).toBeTruthy();
        expect(
            (
                await callTool( page, 'blocks-insert', {
                    artboard: header.id,
                    pattern: patterns.unlisted,
                } )
            ).error
        ).toEqual( {
            code: 'not_found',
            message: `Pattern ${ patterns.unlisted } was not found.`,
        } );
        expect(
            (
                await callTool( page, 'blocks-insert', {
                    artboard: header.id,
                    pattern: 'no/such-pattern',
                } )
            ).error
        ).toEqual( {
            code: 'not_found',
            message: 'Pattern no/such-pattern was not found.',
        } );

        // A block the editor does not allow there: nothing is inserted.
        const count = ( await names( header.id ) ).length;
        const refused = await callTool( page, 'blocks-insert', {
            artboard: header.id,
            markup:
                heading +
                '<!-- wp:list-item --><li>Alone</li><!-- /wp:list-item -->',
        } );
        expect( refused ).toEqual( {
            ok: false,
            error: {
                code: 'not_allowed',
                message: 'The editor does not allow this change.',
            },
        } );
        expect( ( await names( header.id ) ).length ).toBe( count );
        expect(
            (
                await callTool( page, 'blocks-insert', {
                    artboard: header.id,
                    markup: '   ',
                } )
            ).error.code
        ).toBe( 'invalid_args' );
        expect(
            (
                await callTool( page, 'blocks-insert', {
                    artboard: header.id,
                } )
            ).error.code
        ).toBe( 'invalid_args' );

        // A block whose editing mode is disabled cannot be changed.
        const about = fixture.layout.artboards.find(
            ( a ) => a.entityId === fixture.pages.about
        )!;
        const top = (
            await callTool( page, 'blocks-get', {
                artboard: about.id,
                depth: 0,
            } )
        ).result.blocks;
        const locked = top.find( ( block: any ) => ! block.editable );
        expect( locked ).toBeTruthy();
        expect(
            await callTool( page, 'block-update', {
                artboard: about.id,
                block: locked.path,
                attributes: { className: 'nope' },
            } )
        ).toEqual( {
            ok: false,
            error: {
                code: 'not_allowed',
                message: 'The editor does not allow this change.',
            },
        } );
        const into = await callTool( page, 'blocks-insert', {
            artboard: about.id,
            markup: heading,
        } );
        expect( into.error.code ).toBe( 'not_allowed' );
    } );

    test( 'AC-TOOL-13 blocks-remove removes the blocks at the paths given, or none when one cannot be removed', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        await boardAtRest( page );
        const hero = artboardOf( fixture, 'pattern' );
        const top = async ( artboard: string ) =>
            (
                await callTool( page, 'blocks-get', { artboard, depth: 0 } )
            ).result.blocks.map( ( block: any ) => block.name );
        expect( await top( hero.id ) ).toEqual( [
            'core/heading',
            'core/paragraph',
        ] );
        await callTool( page, 'blocks-insert', {
            artboard: hero.id,
            markup: '<!-- wp:separator --><hr class="wp-block-separator has-alpha-channel-opacity"/><!-- /wp:separator -->',
        } );
        expect( await top( hero.id ) ).toHaveLength( 3 );
        const removed = await callTool( page, 'blocks-remove', {
            artboard: hero.id,
            blocks: [ [ 0 ], [ 2 ] ],
        } );
        expect( removed ).toEqual( { ok: true, result: { removed: 2 } } );
        expect( await top( hero.id ) ).toEqual( [ 'core/paragraph' ] );

        // By a block reference alone.
        const byRef = await callTool( page, 'blocks-remove', {
            artboard: `wfd-ref-a_${ hero.id }_b_0`,
        } );
        expect( byRef.result ).toEqual( { removed: 1 } );
        // The editor leaves an empty paragraph in an artboard with no
        // block, as it does when the designer deletes the last one.
        const left = (
            await callTool( page, 'blocks-get', { artboard: hero.id } )
        ).result.blocks;
        expect(
            left.map( ( block: any ) => `${ block.name } "${ block.text }"` )
        ).toEqual( [ 'core/paragraph ""' ] );

        // One of them cannot be removed: none is.
        const about = fixture.layout.artboards.find(
            ( a ) => a.entityId === fixture.pages.about
        )!;
        const flat: any[] = [];
        const walk = ( blocks: any[] ) =>
            blocks.forEach( ( block ) => {
                flat.push( block );
                walk( block.inner ?? [] );
            } );
        const read = async () => {
            flat.length = 0;
            walk(
                (
                    await callTool( page, 'blocks-get', {
                        artboard: about.id,
                        depth: 10,
                    } )
                ).result.blocks
            );
            return flat.map( ( b ) => `${ b.path.join( '.' ) } ${ b.name }` );
        };
        const before = await read();
        const own = flat.find(
            ( b ) =>
                b.name === 'core/paragraph' && b.text === 'About paragraph.'
        );
        const locked = flat.find( ( b ) => ! b.editable );
        const refused = await callTool( page, 'blocks-remove', {
            artboard: about.id,
            blocks: [ own.path, locked.path ],
        } );
        expect( refused ).toEqual( {
            ok: false,
            error: {
                code: 'not_allowed',
                message: 'The editor does not allow this change.',
            },
        } );
        expect( await read() ).toEqual( before );
        // Alone, the page's own block can be removed.
        expect(
            (
                await callTool( page, 'blocks-remove', {
                    artboard: about.id,
                    blocks: [ own.path ],
                } )
            ).result
        ).toEqual( { removed: 1 } );
        expect( ( await read() ).length ).toBe( before.length - 1 );
    } );

    test( 'AC-TOOL-14 blocks-move moves a block to another parent and index and returns its new path', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        await boardAtRest( page );
        const header = artboardOf( fixture, 'template-part' );
        const names = async () => {
            const out: string[] = [];
            const walk = ( blocks: any[] ) =>
                blocks.forEach( ( block ) => {
                    out.push( `${ block.path.join( '.' ) } ${ block.name }` );
                    walk( block.inner ?? [] );
                } );
            walk(
                (
                    await callTool( page, 'blocks-get', {
                        artboard: header.id,
                        depth: 10,
                    } )
                ).result.blocks
            );
            return out;
        };
        await callTool( page, 'blocks-insert', {
            artboard: header.id,
            markup: '<!-- wp:heading --><h2 class="wp-block-heading">Mover</h2><!-- /wp:heading -->',
        } );
        expect( await names() ).toEqual( [
            '0 core/group',
            '0.0 core/paragraph',
            '1 core/heading',
        ] );

        // Into the group, before its paragraph.
        const into = await callTool( page, 'blocks-move', {
            artboard: header.id,
            block: [ 1 ],
            parent: [ 0 ],
            index: 0,
        } );
        expect( into ).toEqual( { ok: true, result: { path: [ 0, 0 ] } } );
        expect( await names() ).toEqual( [
            '0 core/group',
            '0.0 core/heading',
            '0.1 core/paragraph',
        ] );

        // Within its parent: the index is counted after it has left.
        const within = await callTool( page, 'blocks-move', {
            artboard: `wfd-ref-a_${ header.id }_b_0_0`,
            parent: [ 0 ],
            index: 1,
        } );
        expect( within.result ).toEqual( { path: [ 0, 1 ] } );
        expect( await names() ).toEqual( [
            '0 core/group',
            '0.0 core/paragraph',
            '0.1 core/heading',
        ] );

        // Back to the top level, first.
        const out = await callTool( page, 'blocks-move', {
            artboard: header.id,
            block: [ 0, 1 ],
            index: 0,
        } );
        expect( out.result ).toEqual( { path: [ 0 ] } );
        expect( await names() ).toEqual( [
            '0 core/heading',
            '1 core/group',
            '1.0 core/paragraph',
        ] );

        expect(
            (
                await callTool( page, 'blocks-move', {
                    artboard: header.id,
                    block: [ 1 ],
                    parent: [ 1, 0 ],
                    index: 0,
                } )
            ).error.code
        ).toBe( 'invalid_args' );
        expect(
            (
                await callTool( page, 'blocks-move', {
                    artboard: header.id,
                    block: [ 0 ],
                    index: 5,
                } )
            ).error
        ).toEqual( {
            code: 'invalid_args',
            message: 'index must be 1 or less.',
        } );
        expect(
            (
                await callTool( page, 'blocks-move', {
                    artboard: header.id,
                    block: [ 7 ],
                    index: 0,
                } )
            ).error.code
        ).toBe( 'not_found' );
    } );

    test( "AC-TOOL-24 The tree read from a Preview and from a Snapshot equals the Live editor's tree, and no preview copy has a path or a target", async ( {
        page,
        requestUtils,
    } ) => {
        test.setTimeout( 300000 );
        const fixture = await resetFixture( requestUtils );
        const seeded = await requestUtils.rest< any >( {
            method: 'POST',
            path: '/wfd-test/v1/seed-blocks',
            data: { board: fixture.boardId },
        } );
        const artboards = seeded.layout.artboards;
        expect( artboards ).toHaveLength( 10 );
        await openBoard( page, fixture.boardId, 10 );
        await boardAtRest( page );
        // The surface is loaded; nothing is in edit.
        await page.evaluate( () => ( window as any ).wfdAgent.ready() );

        // A document's tree, read once it has stopped changing.
        const documentTree = async ( id: string ) => {
            let last = '';
            let since = Date.now();
            for (;;) {
                const now = JSON.stringify(
                    await page.evaluate(
                        ( artboard ) =>
                            ( window as any ).wfdTest.documentBlocks(
                                artboard
                            ),
                        id
                    )
                );
                if ( now !== last ) {
                    last = now;
                    since = Date.now();
                } else if ( now !== 'null' && Date.now() - since > 1200 ) {
                    return JSON.parse( now ) as string[];
                }
                await page.waitForTimeout( 150 );
            }
        };
        const elements = ( id: string ) =>
            page
                .locator( `[data-wfd-artboard="${ id }"] iframe` )
                .last()
                .evaluate(
                    ( el: HTMLIFrameElement ) =>
                        el.contentDocument!.querySelectorAll( '[data-block]' )
                            .length
                );
        const blockRefs = ( id: string ) =>
            page.evaluate(
                async ( artboard ) =>
                    ( await ( window as any ).wfdAgent.ready() )
                        .targets()
                        .filter(
                            ( target: any ) =>
                                target.kind === 'block' &&
                                target.ref.startsWith(
                                    `wfd-ref-a_${ artboard }_b_`
                                )
                        )
                        .map( ( target: any ) => target.ref ),
                id
            );

        // Every artboard is a Snapshot when the board opens fitted.
        const snapshots: Record< string, string[] > = {};
        for ( const artboard of artboards ) {
            expect( ( await tiersOf( page ) )[ artboard.id ] ).toBe(
                'snapshot'
            );
            snapshots[ artboard.id ] = await documentTree( artboard.id );
        }
        // What can be pointed at in each frozen copy.
        const frozenTargets: Record< string, string[] > = {};
        for ( const artboard of artboards ) {
            frozenTargets[ artboard.id ] = await blockRefs( artboard.id );
        }
        // The seeded template's Query Loop and Comment Template draw
        // copies of their blocks, in the frozen copy as in a Preview.
        const copiesIn = ( id: string ) =>
            page
                .locator( `[data-wfd-artboard="${ id }"] iframe` )
                .last()
                .evaluate( ( el: HTMLIFrameElement ) => {
                    const doc = el.contentDocument!;
                    const mark = '.block-editor-block-preview__live-content';
                    return {
                        posts: doc.querySelectorAll(
                            `li.wp-block-post${ mark }`
                        ).length,
                        blocks: [
                            ...doc.querySelectorAll( '[data-block]' ),
                        ].filter( ( block ) =>
                            block.parentElement?.closest( mark )
                        ).length,
                    };
                } );
        const seededTemplate = artboards[ 9 ].id;
        const frozenCopies = await copiesIn( seededTemplate );
        // Three posts: the one in edit has a hidden copy beside its blocks.
        expect( frozenCopies.posts ).toBe( 3 );
        expect( frozenCopies.blocks ).toBeGreaterThan( 20 );
        expect( frozenTargets[ seededTemplate ].length ).toBeGreaterThan( 5 );

        let copies = 0;
        for ( const artboard of artboards ) {
            await setViewport( page, {
                x: 40 - artboard.x * 0.3,
                y: 60 - artboard.y * 0.3,
                zoom: 0.3,
            } );
            await expect( frame( page, artboard.id ) ).toHaveAttribute(
                'data-wfd-tier',
                'preview'
            );
            const preview = await documentTree( artboard.id );
            const drawn = await elements( artboard.id );
            const targets = await blockRefs( artboard.id );

            const read = await callTool( page, 'blocks-get', {
                artboard: artboard.id,
                depth: 10,
            } );
            expect( read.ok, artboard.entityId ).toBe( true );
            const tree: string[] = [];
            const refs = new Set< string >();
            const walk = ( blocks: any[] ) =>
                blocks.forEach( ( block ) => {
                    tree.push( `${ block.path.join( '.' ) } ${ block.name }` );
                    refs.add( block.ref );
                    expect( block.innerCount ).toBe( block.inner.length );
                    walk( block.inner );
                } );
            walk( read.result.blocks );

            expect( preview, `${ artboard.entityId } preview` ).toEqual( tree );
            expect(
                snapshots[ artboard.id ],
                `${ artboard.entityId } snapshot`
            ).toEqual( tree );
            // The Live canvas, appender and all.
            expect(
                await documentTree( artboard.id ),
                `${ artboard.entityId } live`
            ).toEqual( tree );
            // Every block target is a block of the tree, in the Preview and
            // in the frozen copy: a preview copy has no target.
            expect( targets.length ).toBeGreaterThan( 0 );
            for ( const ref of [
                ...targets,
                ...frozenTargets[ artboard.id ],
            ] ) {
                expect( refs.has( ref ), ref ).toBe( true );
            }
            if ( artboard.id === seededTemplate ) {
                const previewCopies = await copiesIn( seededTemplate );
                expect( previewCopies.posts ).toBe( 3 );
                expect( previewCopies.blocks ).toBe( frozenCopies.blocks );
                // Fewer targets than drawn blocks: the copies are left out.
                expect( targets.length ).toBeLessThanOrEqual( tree.length );
                expect( drawn ).toBeGreaterThan( tree.length + 20 );
            }
            copies += drawn - tree.length;
            await callTool( page, 'edit-leave' );
        }
        // The seeded template and the fixture's own draw preview copies.
        expect( copies ).toBeGreaterThan( 20 );
        const seededId = artboards[ 9 ].id;
        const seededTree = (
            await callTool( page, 'blocks-get', {
                artboard: seededId,
                depth: 10,
            } )
        ).result.blocks;
        const all: any[] = [];
        const collect = ( blocks: any[] ) =>
            blocks.forEach( ( block ) => {
                all.push( block );
                collect( block.inner );
            } );
        collect( seededTree );
        const count = ( name: string ) =>
            all.filter( ( block ) => block.name === name ).length;
        // Each is in the tree once, whatever number of posts is drawn.
        expect( count( 'core/post-template' ) ).toBe( 1 );
        expect( count( 'core/post-title' ) ).toBe( 1 );
        expect( count( 'core/comment-template' ) ).toBe( 1 );
        expect( count( 'core/comment-content' ) ).toBe( 1 );
        expect( count( 'core/navigation-link' ) ).toBe( 3 );
        expect( count( 'core/navigation-submenu' ) ).toBe( 1 );
        expect( count( 'core/block' ) ).toBe( 1 );
        expect(
            all.find( ( block ) => block.name === 'core/block' ).innerCount
        ).toBe( 1 );
    } );

    test( 'AC-TOOL-25 targets() lists artboards, notes, blocks of mounted artboards and token rows, each within 1 px of its box, and changes no tier', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        const note = {
            id: '0c0ffee0-0000-4000-8000-000000000002',
            x: 3200,
            y: -500,
            text: 'First line\nsecond line',
            color: 'pink',
        };
        await requestUtils.rest( {
            method: 'POST',
            path: `/wp/v2/wfd-boards/${ fixture.boardId }`,
            data: { layout: { ...fixture.layout, notes: [ note ] } },
        } );
        await openBoard( page, fixture.boardId );
        await boardAtRest( page );
        const header = artboardOf( fixture, 'template-part' );
        const targetsOf = () =>
            page.evaluate( async () =>
                ( await ( window as any ).wfdAgent.ready() ).targets()
            );
        const near = ( rect: any, box: any, what: string ) => {
            for ( const side of [ 'x', 'y', 'width', 'height' ] ) {
                expect(
                    Math.abs( rect[ side ] - box[ side ] ),
                    `${ what } ${ side }`
                ).toBeLessThanOrEqual( 1 );
            }
        };

        const tiers = await tiersOf( page );
        const fitted = await targetsOf();
        expect( await tiersOf( page ) ).toEqual( tiers );
        expect( Object.keys( fitted[ 0 ] ) ).toEqual( [
            'ref',
            'kind',
            'rect',
            'label',
            'where',
            'text',
        ] );
        // Every artboard, as the board opens fitted.
        const artboardTargets = fitted.filter(
            ( t: any ) => t.kind === 'artboard'
        );
        expect( artboardTargets.map( ( t: any ) => t.ref ).sort() ).toEqual(
            fixture.layout.artboards
                .map( ( a ) => `wfd-ref-a_${ a.id }` )
                .sort()
        );
        for ( const artboard of fixture.layout.artboards ) {
            const target = artboardTargets.find(
                ( t: any ) => t.ref === `wfd-ref-a_${ artboard.id }`
            );
            near(
                target.rect,
                await frameBox( frame( page, artboard.id ) ),
                artboard.id
            );
            expect( target.text ).toBe( '' );
        }
        expect(
            artboardTargets.find(
                ( t: any ) => t.ref === `wfd-ref-a_${ header.id }`
            )
        ).toMatchObject( {
            label: 'Header',
            where: 'Template part · Desktop',
        } );
        // The note.
        const noteTarget = fitted.find( ( t: any ) => t.kind === 'note' );
        expect( noteTarget ).toMatchObject( {
            ref: `wfd-ref-n_${ note.id }`,
            label: 'Note',
            where: '',
            text: 'First line',
        } );
        near(
            noteTarget.rect,
            await page
                .locator( `[data-wfd-note="${ note.id }"]` )
                .boundingBox(),
            'note'
        );
        // A block of a frozen copy.
        const frozen = fitted.find(
            ( t: any ) => t.ref === `wfd-ref-a_${ header.id }_b_0_0`
        );
        expect( frozen ).toMatchObject( {
            kind: 'block',
            label: 'Paragraph',
            where: 'Header · Desktop',
            text: 'Fixture header text',
        } );
        near(
            frozen.rect,
            await page
                .frameLocator( `[data-wfd-artboard="${ header.id }"] iframe` )
                .locator( 'p' )
                .boundingBox(),
            'frozen block'
        );
        // The rows of the Tokens tab.
        const tokens = fitted.filter( ( t: any ) => t.kind === 'token' );
        const rows = page.locator( '[data-wfd-token]' );
        const panel = ( await page
            .locator( '[data-wfd-region="right"]' )
            .boundingBox() )!;
        const boxes = await rows.evaluateAll( ( els ) =>
            els.map( ( el ) => el.getBoundingClientRect().toJSON() )
        );
        expect( tokens.length ).toBe(
            boxes.filter(
                ( box ) =>
                    box.bottom > panel.y && box.top < panel.y + panel.height
            ).length
        );
        expect( tokens.length ).toBeGreaterThan( 5 );
        const base = tokens.find(
            ( t: any ) => t.ref === 'wfd-ref-t_color_base'
        );
        expect( base ).toMatchObject( {
            label: 'Base',
            where: 'Styles',
            text: '#FFFFFF',
        } );
        near(
            base.rect,
            await page.locator( '[data-wfd-token="color:base"]' ).boundingBox(),
            'token'
        );
        expect(
            tokens.some( ( t: any ) =>
                t.ref.startsWith( 'wfd-ref-t_font-size_' )
            )
        ).toBe( true );
        // A row scrolled out of the panel is not listed; scrolled in, it is.
        await page
            .locator( '[data-wfd-token^="font-family:"]' )
            .first()
            .scrollIntoViewIfNeeded();
        expect(
            ( await targetsOf() ).some( ( t: any ) =>
                t.ref.startsWith( 'wfd-ref-t_font-family_' )
            )
        ).toBe( true );
        // Ordered so that a thing comes after what contains it.
        const kinds = fitted.map( ( t: any ) => t.kind );
        expect( kinds ).toEqual(
            [ 'artboard', 'block', 'note', 'token' ].flatMap( ( kind ) =>
                kinds.filter( ( k: string ) => k === kind )
            )
        );

        // A Preview, and an artboard out of view.
        await setViewport( page, {
            x: 40 - header.x * 0.5,
            y: 60 - header.y * 0.5,
            zoom: 0.5,
        } );
        await expect( frame( page, header.id ) ).toHaveAttribute(
            'data-wfd-tier',
            'preview'
        );
        await page
            .frameLocator( `[data-wfd-artboard="${ header.id }"] iframe` )
            .locator( 'p' )
            .waitFor();
        await boardAtRest( page );
        const before = await tiersOf( page );
        const zoomed = await targetsOf();
        expect( await tiersOf( page ) ).toEqual( before );
        const block = zoomed.find(
            ( t: any ) => t.ref === `wfd-ref-a_${ header.id }_b_0_0`
        );
        near(
            block.rect,
            await page
                .frameLocator( `[data-wfd-artboard="${ header.id }"] iframe` )
                .locator( 'p' )
                .boundingBox(),
            'preview block'
        );
        // Something of each is inside the canvas area.
        const area = ( await page
            .locator( '[data-wfd-region="canvas"]' )
            .boundingBox() )!;
        for ( const target of zoomed.filter(
            ( t: any ) => t.kind !== 'token'
        ) ) {
            expect( target.rect.width ).toBeGreaterThan( 0 );
            expect( target.rect.height ).toBeGreaterThan( 0 );
            expect( target.rect.x ).toBeLessThan( area.x + area.width );
            expect( target.rect.x + target.rect.width ).toBeGreaterThan(
                area.x
            );
            expect( target.rect.y ).toBeLessThan( area.y + area.height );
            expect( target.rect.y + target.rect.height ).toBeGreaterThan(
                area.y
            );
        }
        // A Ghost has a target only while part of it is in the canvas area.
        const index = artboardOf( fixture, 'template' );
        expect(
            zoomed.some( ( t: any ) => t.ref === `wfd-ref-a_${ index.id }` )
        ).toBe( false );

        // The artboard in edit.
        await enterEdit( page, header.id );
        const editing = await targetsOf();
        const live = editing.find(
            ( t: any ) => t.ref === `wfd-ref-a_${ header.id }_b_0_0`
        );
        near(
            live.rect,
            await editorFrame( page, header.id ).locator( 'p' ).boundingBox(),
            'live block'
        );
        // The Tokens tab is not shown in edit.
        expect( editing.some( ( t: any ) => t.kind === 'token' ) ).toBe(
            false
        );
    } );

    test( 'AC-TOOL-26 A reference is accepted in place of an artboard or a path, with or without a leading #', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        await boardAtRest( page );
        const board = ( await callTool( page, 'board-get' ) ).result;
        const header = board.artboards.find(
            ( a: any ) =>
                a.kind === 'template-part' &&
                a.device === 'desktop' &&
                a.name === 'Header'
        );
        expect( header.ref ).toBe( `wfd-ref-a_${ header.id }` );

        // An artboard's reference, where a tool takes an artboard.
        for ( const artboard of [ header.ref, '#' + header.ref ] ) {
            const read = await callTool( page, 'blocks-get', { artboard } );
            expect( read.ok ).toBe( true );
            expect( read.result.artboard ).toBe( header.id );
            expect( read.result.blocks ).toHaveLength( 1 );
        }
        // A block's reference gives the artboard and the path.
        const blocks = (
            await callTool( page, 'blocks-get', {
                artboard: header.ref,
            } )
        ).result.blocks;
        const paragraph = blocks[ 0 ].inner[ 0 ];
        expect( paragraph.ref ).toBe( `wfd-ref-a_${ header.id }_b_0_0` );
        const one = await callTool( page, 'blocks-get', {
            artboard: paragraph.ref,
        } );
        expect( one.result.blocks ).toHaveLength( 1 );
        expect( one.result.blocks[ 0 ].name ).toBe( 'core/paragraph' );
        const changed = await callTool( page, 'block-update', {
            artboard: '#' + paragraph.ref,
            attributes: { content: 'By reference' },
        } );
        expect( changed.ok ).toBe( true );
        expect( changed.result.text ).toBe( 'By reference' );
        // A path given as well wins over the reference's.
        const both = await callTool( page, 'blocks-get', {
            artboard: paragraph.ref,
            block: [ 0 ],
        } );
        expect( both.result.blocks[ 0 ].name ).toBe( 'core/group' );
        // Where a tool takes several artboards.
        expect(
            (
                await callTool( page, 'board-select', {
                    artboards: [ '#' + header.ref, paragraph.ref ],
                } )
            ).result
        ).toEqual( { selection: [ header.id ] } );

        // A token's reference, where a tool takes a slug.
        await callTool( page, 'edit-leave' );
        const accent = (
            await callTool( page, 'styles-get' )
        ).result.colors.find( ( c: any ) => c.slug === 'accent-1' );
        expect( accent.ref ).toBe( 'wfd-ref-t_color_accent-1' );
        for ( const [ slug, value ] of [
            [ accent.ref, '#112233' ],
            [ '#' + accent.ref, '#445566' ],
        ] ) {
            const set = await callTool( page, 'token-set', {
                kind: 'color',
                slug,
                value,
            } );
            expect( set.ok ).toBe( true );
            expect( set.result ).toMatchObject( { slug: 'accent-1', value } );
        }
        expect(
            ( await callTool( page, 'token-show-uses', { slug: accent.ref } ) )
                .ok
        ).toBe( true );
        await callTool( page, 'token-show-uses' );
        expect(
            (
                await callTool( page, 'token-set', {
                    kind: 'color',
                    slug: 'wfd-ref-t_font-size_large',
                    value: '#000000',
                } )
            ).error.code
        ).toBe( 'invalid_args' );
        expect(
            (
                await callTool( page, 'token-set', {
                    kind: 'color',
                    slug: 'wfd-ref-t_color_no-such-colour',
                    value: '#000000',
                } )
            ).error
        ).toEqual( {
            code: 'not_found',
            message: 'Token no-such-colour was not found.',
        } );

        // Strings that do not parse.
        for ( const artboard of [
            'wfd-ref-x_nothing',
            'wfd-ref-a_',
            `wfd-ref-a_${ header.id }_b_`,
            `wfd-ref-a_${ header.id }_b_0_x`,
            `wfd-ref-a_${ header.id } `,
            'wfd-ref-t_color_',
        ] ) {
            const failed = await callTool( page, 'blocks-get', { artboard } );
            expect( failed.ok, artboard ).toBe( false );
            expect( failed.error.code, artboard ).toBe( 'invalid_args' );
            expect( failed.error.message ).toContain( 'artboard' );
        }
        // A note or a token where an artboard is asked for.
        expect(
            (
                await callTool( page, 'artboard-edit', {
                    artboard: 'wfd-ref-t_color_base',
                } )
            ).error.code
        ).toBe( 'invalid_args' );
        // Strings that parse and name nothing.
        expect(
            (
                await callTool( page, 'blocks-get', {
                    artboard: 'wfd-ref-a_11111111-2222-4333-8444-555555555555',
                } )
            ).error
        ).toEqual( {
            code: 'not_found',
            message:
                'Artboard wfd-ref-a_11111111-2222-4333-8444-555555555555 was not found.',
        } );
        expect(
            (
                await callTool( page, 'blocks-get', {
                    artboard: `wfd-ref-a_${ header.id }_b_9_9`,
                } )
            ).error
        ).toEqual( {
            code: 'not_found',
            message: 'Block [9,9] was not found.',
        } );
    } );

    test( 'AC-TOOL-15 styles-get returns the rows of the Tokens tab with their names, values and use counts, and the variation the menu shows', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        await boardAtRest( page );
        const got = await callTool( page, 'styles-get' );
        expect( got.ok ).toBe( true );
        const styles = got.result;
        expect( Object.keys( styles ) ).toEqual( [
            'variation',
            'variations',
            'colors',
            'fontSizes',
            'fontFamilies',
            'spacing',
        ] );

        // The colour rows.
        const colorRows = await page
            .locator( '[data-wfd-token^="color:"]' )
            .evaluateAll( ( rows ) =>
                rows.map( ( row ) => ( {
                    slug: row.getAttribute( 'data-wfd-token' )!.slice( 6 ),
                    name: row.querySelector( '.wfd-row__name' )!.textContent,
                    value: row.querySelector( '.wfd-styles__hex' )!.textContent,
                    uses: Number(
                        row.querySelector( '.wfd-styles__uses' )!.textContent
                    ),
                } ) )
            );
        expect( colorRows.length ).toBeGreaterThan( 3 );
        expect( styles.colors ).toEqual(
            colorRows.map( ( row ) => ( {
                ...row,
                ref: `wfd-ref-t_color_${ row.slug }`,
            } ) )
        );
        expect(
            styles.colors.find( ( c: any ) => c.slug === 'accent-1' ).uses
        ).toBeGreaterThanOrEqual( 3 );

        // The typography rows: font sizes, then font families.
        const typeRows = async ( kind: string ) =>
            page.locator( `[data-wfd-token^="${ kind }:"]` ).evaluateAll(
                ( rows, prefix ) =>
                    rows.map( ( row ) => ( {
                        slug: row
                            .getAttribute( 'data-wfd-token' )!
                            .slice( prefix.length + 1 ),
                        name: row.querySelector( '.wfd-row__name' )!
                            .textContent,
                        line: row.querySelector( '.wfd-row__second-line' )!
                            .textContent,
                        uses: Number(
                            row.querySelector( '.wfd-row__suffix' )!.textContent
                        ),
                    } ) ),
                kind
            );
        const sizes = await typeRows( 'font-size' );
        expect( styles.fontSizes ).toHaveLength( sizes.length );
        styles.fontSizes.forEach( ( size: any, index: number ) => {
            expect( size.slug ).toBe( sizes[ index ].slug );
            expect( size.name ).toBe( sizes[ index ].name );
            expect( size.uses ).toBe( sizes[ index ].uses );
            expect( sizes[ index ].line ).toContain( `· ${ size.value } /` );
            expect( size.ref ).toBe( `wfd-ref-t_font-size_${ size.slug }` );
        } );
        const families = await typeRows( 'font-family' );
        expect( styles.fontFamilies ).toHaveLength( families.length );
        expect( families.length ).toBeGreaterThan( 0 );
        styles.fontFamilies.forEach( ( family: any, index: number ) => {
            expect( family.slug ).toBe( families[ index ].slug );
            expect( family.name ).toBe( families[ index ].name );
            expect( family.uses ).toBe( families[ index ].uses );
            expect( typeof family.value ).toBe( 'string' );
            expect( family.ref ).toBe(
                `wfd-ref-t_font-family_${ family.slug }`
            );
        } );
        // One square per spacing preset.
        expect( styles.spacing ).toHaveLength(
            await page.locator( '.wfd-styles__spacing > *' ).count()
        );
        for ( const size of styles.spacing ) {
            expect( Object.keys( size ) ).toEqual( [
                'slug',
                'name',
                'value',
            ] );
        }

        // The variation menu.
        const trigger = page.getByRole( 'button', { name: /^Variation: / } );
        await expect( trigger ).toHaveText( 'Variation: Default' );
        expect( styles.variation ).toBe( 'Default' );
        await trigger.click();
        await page.getByRole( 'menuitemradio' ).first().waitFor();
        const items = await page.getByRole( 'menuitemradio' ).allInnerTexts();
        await page.keyboard.press( 'Escape' );
        expect( items[ 0 ] ).toBe( 'Default' );
        expect( styles.variations ).toEqual( items.slice( 1 ) );
        expect( styles.variations.length ).toBeGreaterThan( 0 );
        expect( styles ).not.toHaveProperty( 'changed' );
    } );

    test( 'AC-TOOL-16 token-set repaints the artboards that use the colour with one style compile, saves nothing, and lists Styles in Review', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        await boardAtRest( page );
        const hero = artboardOf( fixture, 'pattern' );
        // The three artboards that use the colour are all mounted.
        const users = [
            hero.id,
            artboardOf( fixture, 'page', 'desktop', 0 ).id,
            artboardOf( fixture, 'page', 'desktop', 1 ).id,
        ];
        await setViewport( page, { x: -300, y: -120, zoom: 0.25 } );
        for ( const id of users ) {
            await expect( frame( page, id ) ).toHaveAttribute(
                'data-wfd-tier',
                'preview'
            );
        }
        const backgroundOf = ( id: string ) =>
            page
                .locator( `[data-wfd-artboard="${ id }"] iframe` )
                .first()
                .evaluate( ( el: HTMLIFrameElement ) => {
                    const p = el.contentDocument!.querySelector(
                        'p.has-accent-1-background-color'
                    );
                    return p
                        ? el.contentWindow!.getComputedStyle( p )
                              .backgroundColor
                        : null;
                } );
        for ( const id of users ) {
            await expect.poll( () => backgroundOf( id ) ).toMatch( /^rgb\(/ );
        }
        const background = () =>
            page
                .locator( `[data-wfd-artboard="${ hero.id }"] iframe` )
                .first()
                .evaluate( ( el: HTMLIFrameElement ) => {
                    const p = el.contentDocument!.querySelector(
                        'p.has-accent-1-background-color'
                    )!;
                    return el.contentWindow!.getComputedStyle( p )
                        .backgroundColor;
                } );
        await expect.poll( background ).not.toBe( 'rgb(18, 52, 86)' );
        await boardAtRest( page );
        const before = ( await counters( page ) ).styleGenerations;

        const set = await callTool( page, 'token-set', {
            kind: 'color',
            slug: 'accent-1',
            value: '#123456',
        } );
        expect( set.ok ).toBe( true );
        expect( set.result ).toMatchObject( {
            slug: 'accent-1',
            name: 'Accent 1',
            value: '#123456',
            ref: 'wfd-ref-t_color_accent-1',
        } );
        expect( typeof set.result.uses ).toBe( 'number' );
        await expect.poll( background ).toBe( 'rgb(18, 52, 86)' );
        // Every mounted artboard that uses it.
        for ( const id of users ) {
            await expect
                .poll( () => backgroundOf( id ) )
                .toBe( 'rgb(18, 52, 86)' );
        }
        await page.waitForTimeout( 500 );
        expect( ( await counters( page ) ).styleGenerations - before ).toBe(
            1
        );
        await expect( review( page ) ).toHaveText( 'Review 1 change' );
        await expect(
            page.locator( '[data-wfd-token="color:accent-1"] .wfd-styles__hex' )
        ).toHaveText( '#123456' );
        // Nothing is saved.
        const saved = await page.evaluate( () => {
            const { select } = ( window as any ).wp.data;
            const id =
                select( 'core' ).__experimentalGetCurrentGlobalStylesId();
            return JSON.stringify(
                select( 'core' ).getEntityRecord( 'root', 'globalStyles', id )
                    .settings
            );
        } );
        expect( saved ).not.toContain( '#123456' );
        expect( ( await callTool( page, 'styles-get' ) ).result.changed ).toBe(
            'agent'
        );

        expect(
            (
                await callTool( page, 'token-set', {
                    kind: 'color',
                    slug: 'accent-1',
                    value: 'red',
                } )
            ).error.code
        ).toBe( 'invalid_args' );
        expect(
            (
                await callTool( page, 'token-set', {
                    kind: 'color',
                    slug: 'no-such-colour',
                    value: '#000000',
                } )
            ).error
        ).toEqual( {
            code: 'not_found',
            message: 'Token no-such-colour was not found.',
        } );
        await expect( review( page ) ).toHaveText( 'Review 1 change' );
    } );

    test( 'AC-TOOL-17 styles-set changes a style for the site and for one block type, and a setting', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        await boardAtRest( page );
        const hero = artboardOf( fixture, 'pattern' );
        await setViewport( page, {
            x: 40 - hero.x * 0.3,
            y: 60 - hero.y * 0.3,
            zoom: 0.3,
        } );
        await expect( frame( page, hero.id ) ).toHaveAttribute(
            'data-wfd-tier',
            'preview'
        );
        const edited = () =>
            page.evaluate( () => {
                const { select } = ( window as any ).wp.data;
                const id =
                    select( 'core' ).__experimentalGetCurrentGlobalStylesId();
                const record = select( 'core' ).getEditedEntityRecord(
                    'root',
                    'globalStyles',
                    id
                );
                return { settings: record.settings, styles: record.styles };
            } );
        const inPreview = ( read: string ) =>
            page
                .locator( `[data-wfd-artboard="${ hero.id }"] iframe` )
                .first()
                .evaluate( ( el: HTMLIFrameElement, what ) => {
                    const doc = el.contentDocument!;
                    const view = el.contentWindow!;
                    if ( what === 'body' ) {
                        return view.getComputedStyle( doc.body )
                            .backgroundColor;
                    }
                    if ( what === 'heading' ) {
                        return view.getComputedStyle(
                            doc.querySelector( 'h2' )!
                        ).color;
                    }
                    return view
                        .getComputedStyle( doc.body )
                        .getPropertyValue( what )
                        .trim();
                }, read );

        // A style for the site.
        expect(
            await callTool( page, 'styles-set', {
                kind: 'style',
                property: 'color.background',
                value: '#101820',
            } )
        ).toEqual( { ok: true, result: { changed: true } } );
        expect( ( await edited() ).styles.color.background ).toBe( '#101820' );
        await expect
            .poll( () => inPreview( 'body' ) )
            .toBe( 'rgb(16, 24, 32)' );

        // A style for one block type.
        expect(
            (
                await callTool( page, 'styles-set', {
                    kind: 'style',
                    property: 'color.text',
                    value: '#ff0000',
                    block: 'core/heading',
                } )
            ).ok
        ).toBe( true );
        const after = await edited();
        expect( after.styles.blocks[ 'core/heading' ].color.text ).toBe(
            '#ff0000'
        );
        // The site's style is still there.
        expect( after.styles.color.background ).toBe( '#101820' );
        await expect
            .poll( () => inPreview( 'heading' ) )
            .toBe( 'rgb(255, 0, 0)' );

        // A setting.
        expect(
            (
                await callTool( page, 'styles-set', {
                    kind: 'setting',
                    property: 'color.palette.custom',
                    value: [
                        {
                            slug: 'tool-teal',
                            name: 'Tool teal',
                            color: '#008080',
                        },
                    ],
                } )
            ).ok
        ).toBe( true );
        expect( ( await edited() ).settings.color.palette.custom ).toEqual( [
            { slug: 'tool-teal', name: 'Tool teal', color: '#008080' },
        ] );
        await expect
            .poll( () => inPreview( '--wp--preset--color--tool-teal' ) )
            .toBe( '#008080' );
        expect(
            ( await callTool( page, 'styles-get' ) ).result.colors.some(
                ( c: any ) => c.slug === 'tool-teal' && c.value === '#008080'
            )
        ).toBe( true );
        await expect( review( page ) ).toHaveText( 'Review 1 change' );

        expect(
            (
                await callTool( page, 'styles-set', {
                    kind: 'style',
                    property: 'color.text',
                    value: '#000',
                    block: 'no/such-block',
                } )
            ).error.code
        ).toBe( 'invalid_args' );
    } );

    test( "AC-TOOL-18 styles-set-variation makes the menu read that variation, and Default the theme's own", async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        await boardAtRest( page );
        const trigger = page.getByRole( 'button', { name: /^Variation: / } );
        await expect( trigger ).toHaveText( 'Variation: Default' );
        const { variations } = ( await callTool( page, 'styles-get' ) ).result;
        const name = variations[ 0 ];

        expect(
            await callTool( page, 'styles-set-variation', { name } )
        ).toEqual( { ok: true, result: { variation: name } } );
        await expect( trigger ).toHaveText( `Variation: ${ name }` );
        expect(
            ( await callTool( page, 'styles-get' ) ).result.variation
        ).toBe( name );
        await expect( review( page ) ).toHaveText( 'Review 1 change' );

        expect(
            await callTool( page, 'styles-set-variation', { name: 'Default' } )
        ).toEqual( { ok: true, result: { variation: 'Default' } } );
        await expect( trigger ).toHaveText( 'Variation: Default' );

        expect(
            await callTool( page, 'styles-set-variation', {
                name: 'No such variation',
            } )
        ).toEqual( {
            ok: false,
            error: {
                code: 'not_found',
                message: 'Variation No such variation was not found.',
            },
        } );
        await expect( trigger ).toHaveText( 'Variation: Default' );
    } );

    test( "AC-TOOL-19 token-show-uses shows the banner, the label counts and the outlines, returns the banner's numbers, and clears them", async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        await boardAtRest( page );
        const hero = artboardOf( fixture, 'pattern' );
        const about = artboardOf( fixture, 'page', 'desktop', 0 );
        const member = artboardOf( fixture, 'page', 'desktop', 1 );
        const header = artboardOf( fixture, 'template-part' );
        await setViewport( page, { x: -300, y: -120, zoom: 0.25 } );
        await expect(
            page.locator( `[data-wfd-artboard="${ hero.id }"] iframe` )
        ).toBeAttached();
        const label = ( id: string ) =>
            frame( page, id ).locator( '.wfd-artboard__label' );
        const banner = page.locator( '[data-wfd-banner="usage"]' );
        const outline = () =>
            page
                .locator( `[data-wfd-artboard="${ hero.id }"] iframe` )
                .first()
                .evaluate( ( el: HTMLIFrameElement ) => {
                    const p = el.contentDocument!.querySelector(
                        'p.has-accent-1-background-color'
                    )!;
                    const style = el.contentWindow!.getComputedStyle( p );
                    return `${ style.outlineStyle } ${ style.outlineWidth }`;
                } );

        const shown = await callTool( page, 'token-show-uses', {
            kind: 'color',
            slug: 'accent-1',
        } );
        expect( shown.ok ).toBe( true );
        expect( shown.result.places ).toBe( 3 );
        expect( [ ...shown.result.artboards ].sort() ).toEqual(
            [ hero.id, about.id, member.id ].sort()
        );
        await expect( banner ).toContainText(
            'Showing where Accent 1 is used: 3 places on 3 artboards'
        );
        await expect( label( hero.id ) ).toHaveText( 'Hero · Pattern · 1 use' );
        await expect( label( header.id ) ).toHaveText(
            'Header · Template part · Desktop'
        );
        await expect.poll( outline ).toBe( 'solid 2px' );
        await expect(
            page.locator( '[data-wfd-token="color:accent-1"]' )
        ).toHaveAttribute( 'aria-current', 'true' );
        // The colour picker is not opened, and no artboard is selected.
        await expect( page.getByRole( 'dialog' ) ).toHaveCount( 0 );
        expect(
            ( await callTool( page, 'board-get' ) ).result.selection
        ).toEqual( [] );

        // With no fields the selected token is cleared.
        expect( await callTool( page, 'token-show-uses' ) ).toEqual( {
            ok: true,
            result: { places: 0, artboards: [] },
        } );
        await expect( banner ).toHaveCount( 0 );
        await expect( label( hero.id ) ).toHaveText(
            'Hero · Pattern · Desktop'
        );
        await expect.poll( outline ).not.toContain( 'solid' );

        // By a token's reference alone.
        const byRef = await callTool( page, 'token-show-uses', {
            slug: '#wfd-ref-t_color_accent-1',
        } );
        expect( byRef.result.places ).toBe( 3 );
        await expect( banner ).toContainText( '3 places on 3 artboards' );
        await callTool( page, 'token-show-uses' );

        expect(
            ( await callTool( page, 'token-show-uses', { kind: 'color' } ) )
                .error.code
        ).toBe( 'invalid_args' );
        expect(
            ( await callTool( page, 'token-show-uses', { slug: 'accent-1' } ) )
                .error.code
        ).toBe( 'invalid_args' );
        expect(
            (
                await callTool( page, 'token-show-uses', {
                    kind: 'font-size',
                    slug: 'no-such-size',
                } )
            ).error
        ).toEqual( {
            code: 'not_found',
            message: 'Token no-such-size was not found.',
        } );
        await expect( banner ).toHaveCount( 0 );
    } );

    test( 'AC-TOOL-21 review-list returns the items of the Review drawer with the same names and lines, each with its author', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        await boardAtRest( page );
        const header = artboardOf( fixture, 'template-part' );
        expect( ( await callTool( page, 'review-list' ) ).result ).toEqual( {
            items: [],
        } );

        // The designer changes a pattern; the agent a part and a colour.
        await editPattern( page, fixture.patterns.hero );
        await callTool( page, 'block-update', {
            artboard: header.id,
            block: [ 0, 0 ],
            attributes: { content: 'Changed by the agent' },
        } );
        await callTool( page, 'blocks-insert', {
            artboard: header.id,
            markup: '<!-- wp:heading --><h2 class="wp-block-heading">Added</h2><!-- /wp:heading -->',
        } );
        await callTool( page, 'token-set', {
            kind: 'color',
            slug: 'accent-1',
            value: '#123456',
        } );
        await callTool( page, 'edit-leave' );
        await expect( review( page ) ).toHaveText( 'Review 3 changes' );

        const listed = ( await callTool( page, 'review-list' ) ).result.items;
        for ( const item of listed ) {
            expect( Object.keys( item ) ).toEqual( [
                'key',
                'type',
                'name',
                'isNew',
                'lines',
                'author',
            ] );
        }
        const authors = Object.fromEntries(
            listed.map( ( item: any ) => [ item.type, item.author ] )
        );
        expect( authors ).toEqual( {
            styles: 'agent',
            'template-part': 'agent',
            pattern: 'you',
        } );
        expect(
            listed.find( ( item: any ) => item.type === 'pattern' ).key
        ).toBe( `postType/wp_block/${ fixture.patterns.hero }` );
        expect(
            listed.find( ( item: any ) => item.type === 'template-part' ).key
        ).toBe( `postType/wp_template_part/${ header.entityId }` );

        // The drawer's cards.
        await review( page ).click();
        const cards = await page
            .locator( '.wfd-review__item' )
            .evaluateAll( ( items ) =>
                items.map( ( item ) => ( {
                    name: item.querySelector( 'label' )!.textContent,
                    lines: [
                        ...item.querySelectorAll( '.wfd-review__lines li' ),
                    ].map( ( line ) => line.textContent ),
                } ) )
            );
        expect( cards ).toHaveLength( 3 );
        expect(
            listed.map( ( item: any ) => ( {
                name: item.name,
                lines: item.lines,
            } ) )
        ).toEqual( cards );
        expect(
            listed.find( ( item: any ) => item.type === 'template-part' ).lines
        ).toContain( 'Heading: added' );
        expect( listed.every( ( item: any ) => item.isNew === false ) ).toBe(
            true
        );
    } );

    test( 'AC-TOOL-22 review-discard discards an item only the agent changed, and refuses one the designer also changed', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        await boardAtRest( page );
        const header = artboardOf( fixture, 'template-part' );
        const hero = artboardOf( fixture, 'pattern' );
        const heroKey = `postType/wp_block/${ fixture.patterns.hero }`;
        const headerKey = `postType/wp_template_part/${ header.entityId }`;

        // The designer changes the pattern, then the agent does too.
        await editPattern( page, fixture.patterns.hero );
        await page.waitForTimeout( 1200 );
        await callTool( page, 'blocks-insert', {
            artboard: hero.id,
            markup: '<!-- wp:paragraph --><p>And the agent.</p><!-- /wp:paragraph -->',
        } );
        // Only the agent changes the part.
        await callTool( page, 'block-update', {
            artboard: header.id,
            block: [ 0, 0 ],
            attributes: { content: 'Changed by the agent' },
        } );
        await expect( review( page ) ).toHaveText( 'Review 2 changes' );
        const authors = async () =>
            Object.fromEntries(
                ( await callTool( page, 'review-list' ) ).result.items.map(
                    ( item: any ) => [ item.key, item.author ]
                )
            );
        expect( await authors() ).toEqual( {
            [ heroKey ]: 'both',
            [ headerKey ]: 'agent',
        } );

        expect(
            await callTool( page, 'review-discard', { key: heroKey } )
        ).toEqual( {
            ok: false,
            error: {
                code: 'not_agents',
                message: 'Hero also has changes made by the designer.',
            },
        } );
        await expect( review( page ) ).toHaveText( 'Review 2 changes' );

        expect(
            await callTool( page, 'review-discard', { key: headerKey } )
        ).toEqual( { ok: true, result: { discarded: headerKey } } );
        await expect( review( page ) ).toHaveText( 'Review 1 change' );
        await expect(
            editorFrame( page, header.id ).locator( 'p' )
        ).toHaveText( 'Fixture header text' );
        await expect( page.getByRole( 'alertdialog' ) ).toHaveCount( 0 );
        expect( await authors() ).toEqual( { [ heroKey ]: 'both' } );

        expect(
            ( await callTool( page, 'review-discard', { key: headerKey } ) )
                .error
        ).toEqual( {
            code: 'not_found',
            message: `Review item ${ headerKey } was not found.`,
        } );

        // An item only the designer changed.
        await callTool( page, 'edit-leave' );
        await page.waitForTimeout( 1200 );
        await page.evaluate( ( id ) => {
            ( window as any ).wp.data
                .dispatch( 'core' )
                .editEntityRecord( 'postType', 'page', id, {
                    title: 'About, renamed',
                } );
        }, fixture.pages.about );
        const aboutKey = `postType/page/${ fixture.pages.about }`;
        expect( ( await authors() )[ aboutKey ] ).toBe( 'you' );
        expect(
            ( await callTool( page, 'review-discard', { key: aboutKey } ) )
                .error.code
        ).toBe( 'not_agents' );
        await expect( review( page ) ).toHaveText( 'Review 2 changes' );
    } );

    test( 'AC-TOOL-20 After every tool has been called nothing on the site is saved, published, trashed or deleted; the only new items are the drafts of a new page and pattern', async ( {
        page,
        requestUtils,
    } ) => {
        test.setTimeout( 240000 );
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        await boardAtRest( page );
        await page.evaluate( () => ( window as any ).wfdAgent.ready() );
        await page.waitForTimeout( 2000 );

        // Every item of the site, except boards, whose layout saves itself.
        const site = async () => {
            const { stdout } = await wp( [
                'post',
                'list',
                '--post_type=page,post,wp_block,wp_template,wp_template_part,wp_navigation,wp_global_styles,attachment',
                '--post_status=any,trash,auto-draft',
                '--fields=ID,post_type,post_status,post_title,post_name,post_modified_gmt,post_content',
                '--format=json',
                '--posts_per_page=-1',
            ] );
            return new Map< number, string >(
                JSON.parse( stdout ).map( ( post: any ) => [
                    Number( post.ID ),
                    JSON.stringify( post ),
                ] )
            );
        };
        const before = await site();
        expect( before.size ).toBeGreaterThan( 4 );

        const hero = artboardOf( fixture, 'pattern' );
        const header = artboardOf( fixture, 'template-part' );
        const footer = artboardOf( fixture, 'template-part', 'desktop', 1 );
        const called = new Set< string >();
        const ok = async ( name: string, input: object = {} ) => {
            const envelope = await callTool( page, name, input );
            expect(
                envelope.ok,
                `${ name }: ${ JSON.stringify( envelope ) }`
            ).toBe( true );
            called.add( name );
            return envelope.result;
        };

        await ok( 'board-get' );
        await ok( 'board-select', { artboards: [ hero.id ] } );
        await ok( 'artboard-update', { artboard: hero.id, device: 'tablet' } );
        await ok( 'artboard-add', {
            kind: 'page',
            entityId: fixture.pages.about,
        } );
        await ok( 'artboard-add', { kind: 'browser', address: '/' } );
        const newPage = await ok( 'artboard-new', { kind: 'page' } );
        const newPattern = await ok( 'artboard-new', { kind: 'pattern' } );
        await ok( 'artboard-new', { kind: 'template-part' } );
        await ok( 'artboard-new', { kind: 'template', purpose: 'singular' } );
        await ok( 'artboard-edit', { artboard: header.id } );
        await ok( 'blocks-get', { artboard: header.id } );
        await ok( 'block-update', {
            artboard: header.id,
            block: [ 0, 0 ],
            attributes: { content: 'Changed and not saved' },
        } );
        await ok( 'blocks-insert', {
            artboard: header.id,
            markup: '<!-- wp:heading --><h2 class="wp-block-heading">Inserted</h2><!-- /wp:heading -->',
        } );
        await ok( 'blocks-move', {
            artboard: header.id,
            block: [ 1 ],
            parent: [ 0 ],
            index: 0,
        } );
        await ok( 'blocks-remove', {
            artboard: header.id,
            blocks: [ [ 0, 1 ] ],
        } );
        // A page and a pattern, which take a post lock.
        await ok( 'blocks-insert', {
            artboard: hero.id,
            markup: '<!-- wp:paragraph --><p>Not saved.</p><!-- /wp:paragraph -->',
        } );
        await ok( 'edit-leave' );
        const styles = await ok( 'styles-get' );
        await ok( 'token-set', {
            kind: 'color',
            slug: 'accent-1',
            value: '#123456',
        } );
        await ok( 'styles-set', {
            kind: 'style',
            property: 'color.background',
            value: '#fafafa',
        } );
        await ok( 'styles-set-variation', { name: styles.variations[ 0 ] } );
        await ok( 'token-show-uses', { kind: 'color', slug: 'accent-1' } );
        await ok( 'token-show-uses' );
        const listed = await ok( 'review-list' );
        const mine = listed.items.find(
            ( item: any ) => item.type === 'styles' && item.author === 'agent'
        );
        expect( mine ).toBeTruthy();
        await ok( 'review-discard', { key: mine.key } );
        await ok( 'artboard-remove', { artboards: [ footer.id ] } );
        await ok( 'board-refresh' );

        const declared = await page.evaluate( async () =>
            ( await ( window as any ).wfdAgent.ready() ).tools.map(
                ( tool: any ) => tool.name
            )
        );
        expect( [ ...called ].sort() ).toEqual( [ ...declared ].sort() );

        // The layout has saved itself by now; nothing else may have.
        await page.waitForTimeout( 3500 );
        const after = await site();
        for ( const [ id, item ] of before ) {
            expect( after.get( id ), `item ${ id }` ).toBe( item );
        }
        const added = [ ...after.keys() ]
            .filter( ( id ) => ! before.has( id ) )
            .map( ( id ) => JSON.parse( after.get( id )! ) );
        expect(
            added
                .map(
                    ( post ) =>
                        `${ post.post_type } ${ post.post_status } ${ post.post_title } "${ post.post_content }"`
                )
                .sort()
        ).toEqual( [
            'page draft Untitled page ""',
            'wp_block draft Untitled pattern ""',
        ] );
        expect( added.map( ( post ) => Number( post.ID ) ).sort() ).toEqual(
            [ newPage.entityId, newPattern.entityId ].sort()
        );
        // What was changed waits in Review.
        await expect( review( page ) ).not.toHaveText( 'Review changes' );
    } );

    test( 'AC-TOOL-27 A block tool returns the whole tree on its first call, a style tool returns with the stylesheet in the artboards, and a load held back fails with not_ready', async ( {
        page,
        requestUtils,
    } ) => {
        test.setTimeout( 120000 );
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        await boardAtRest( page );
        const about = fixture.layout.artboards.find(
            ( a ) => a.entityId === fixture.pages.about
        )!;
        const hero = artboardOf( fixture, 'pattern' );
        const header = artboardOf( fixture, 'template-part' );
        await setViewport( page, { x: -300, y: -120, zoom: 0.25 } );
        await expect( frame( page, about.id ) ).toHaveAttribute(
            'data-wfd-tier',
            'preview'
        );
        await boardAtRest( page );
        const flat = ( blocks: any[] ) => {
            const out: string[] = [];
            const walk = ( list: any[] ) =>
                list.forEach( ( block ) => {
                    out.push( `${ block.path.join( '.' ) } ${ block.name }` );
                    walk( block.inner ?? [] );
                } );
            walk( blocks );
            return out;
        };

        // The first call on an artboard that is not in edit: a page, with
        // its template's parts and its own content.
        const drawn = await page.evaluate( async ( id ) => {
            await ( window as any ).wfdAgent.ready();
            return ( window as any ).wfdTest.documentBlocks( id );
        }, about.id );
        const timed = await page.evaluate( async ( id ) => {
            const agent = await ( window as any ).wfdAgent.ready();
            const started = performance.now();
            const first = await agent.call( 'blocks-get', {
                artboard: id,
                depth: 10,
            } );
            const took = performance.now() - started;
            const again = performance.now();
            const second = await agent.call( 'blocks-get', {
                artboard: id,
                depth: 10,
            } );
            return { first, took, second, repeat: performance.now() - again };
        }, about.id );
        expect( timed.first.ok ).toBe( true );
        const tree = flat( timed.first.result.blocks );
        expect(
            tree.filter( ( line ) => / core\/template-part$/.test( line ) )
        ).toHaveLength( 2 );
        // The parts hold their blocks, and Content holds the page's.
        const part = timed.first.result.blocks.find(
            ( block: any ) => block.name === 'core/template-part'
        );
        expect( part.innerCount ).toBeGreaterThan( 0 );
        expect( tree ).toContain(
            `${ tree.find( ( line ) => / core\/post-content$/.test( line ) )!.split( ' ' )[ 0 ] }.0 core/heading`
        );
        // It is what a later call reads, and what the Preview drew.
        expect( flat( timed.second.result.blocks ) ).toEqual( tree );
        await page.waitForTimeout( 2000 );
        expect(
            flat(
                (
                    await callTool( page, 'blocks-get', {
                        artboard: about.id,
                        depth: 10,
                    } )
                ).result.blocks
            )
        ).toEqual( tree );
        expect( drawn ).toEqual( tree );
        // No fixed pause: on the artboard already in edit the tool answers
        // at once.
        expect( timed.repeat ).toBeLessThan( 150 );
        expect( timed.took ).toBeLessThan( 5000 );
        await callTool( page, 'edit-leave' );

        // A style tool answers with the stylesheet already in the mounted
        // artboards.
        await setViewport( page, { x: -300, y: -120, zoom: 0.25 } );
        await expect( frame( page, hero.id ) ).toHaveAttribute(
            'data-wfd-tier',
            'preview'
        );
        await boardAtRest( page );
        const painted = await page.evaluate(
            async ( ids ) => {
                const agent = await ( window as any ).wfdAgent.ready();
                const set = await agent.call( 'token-set', {
                    kind: 'color',
                    slug: 'accent-1',
                    value: '#123456',
                } );
                // Read in the same task the tool answered in.
                return {
                    ok: set.ok,
                    colors: ids.map( ( id: string ) => {
                        const iframe = document.querySelector(
                            `[data-wfd-artboard="${ id }"] iframe`
                        ) as HTMLIFrameElement;
                        const p = iframe.contentDocument!.querySelector(
                            'p.has-accent-1-background-color'
                        )!;
                        return iframe.contentWindow!.getComputedStyle( p )
                            .backgroundColor;
                    } ),
                };
            },
            [ hero.id, about.id ]
        );
        expect( painted ).toEqual( {
            ok: true,
            colors: [ 'rgb(18, 52, 86)', 'rgb(18, 52, 86)' ],
        } );

        // Loading held back past the safety limit.
        await page.route( /template-parts/, async ( route ) => {
            await new Promise( ( resolve ) => setTimeout( resolve, 14000 ) );
            await route.continue().catch( () => {} );
        } );
        await page.evaluate( () =>
            ( window as any ).wp.data
                .dispatch( 'core' )
                .invalidateResolutionForStore()
        );
        const started = Date.now();
        const late = await callTool( page, 'blocks-get', {
            artboard: header.id,
        } );
        expect( late ).toEqual( {
            ok: false,
            error: {
                code: 'not_ready',
                message: 'Header did not finish loading.',
            },
        } );
        expect( Date.now() - started ).toBeGreaterThanOrEqual( 9500 );
        expect( Date.now() - started ).toBeLessThan( 13500 );
        await page.unroute( /template-parts/ );
    } );

    test( 'AC-TOOL-29 An artboard that never meets the settling conditions is read at the limit, one whose editor cannot mount fails with not_ready, and a refresh that never answers fails with unavailable', async ( {
        page,
        requestUtils,
    } ) => {
        test.setTimeout( 150000 );
        const fixture = await resetFixture( requestUtils );
        // A pattern holding a block that mounts one of its two inner
        // blocks; a pattern that holds itself; and a third pattern, whose
        // record is never answered.
        const made = await php(
            `$half = wp_insert_post( array( 'post_type' => 'wp_block', 'post_status' => 'publish', 'post_title' => 'Half', 'post_content' => '<!-- wp:test/half-mounted --><div class="wp-block-test-half-mounted"><!-- wp:paragraph --><p>Shown</p><!-- /wp:paragraph --><!-- wp:test/unmounted /--></div><!-- /wp:test/half-mounted -->' ) );
            $itself = wp_insert_post( array( 'post_type' => 'wp_block', 'post_status' => 'publish', 'post_title' => 'Itself', 'post_content' => '' ) );
            wp_update_post( array( 'ID' => $itself, 'post_content' => '<!-- wp:paragraph --><p>Before</p><!-- /wp:paragraph --><!-- wp:block {"ref":' . $itself . '} /-->' ) );
            $hidden = wp_insert_post( array( 'post_type' => 'wp_block', 'post_status' => 'private', 'post_title' => 'Unreachable', 'post_content' => '<!-- wp:paragraph --><p>x</p><!-- /wp:paragraph -->' ) );
            echo wp_json_encode( array( $half, $itself, $hidden ) );`
        );
        const [ half, itself, hidden ] = JSON.parse( made.stdout );
        await openBoard( page, fixture.boardId );
        const names = ( blocks: any[] ): string[] =>
            blocks.flatMap( ( block ) => [
                block.name,
                ...names( block.inner ?? [] ),
            ] );

        // The block that never draws its second child: read once the limit
        // has passed, with the blocks that are there.
        const halfBoard = await callTool( page, 'artboard-add', {
            kind: 'pattern',
            entityId: half,
        } );
        expect( halfBoard.ok ).toBe( true );
        let started = Date.now();
        const halfRead = await callTool( page, 'blocks-get', {
            artboard: halfBoard.result.id,
            depth: 5,
        } );
        const tookHalf = Date.now() - started;
        expect( halfRead.ok ).toBe( true );
        expect( names( halfRead.result.blocks ) ).toEqual( [
            'test/half-mounted',
            'core/paragraph',
            'test/unmounted',
        ] );
        expect( tookHalf ).toBeGreaterThanOrEqual( 9500 );
        expect( tookHalf ).toBeLessThan( 13500 );

        // The pattern that holds itself: its record is counted once.
        const selfBoard = await callTool( page, 'artboard-add', {
            kind: 'pattern',
            entityId: itself,
        } );
        expect( selfBoard.ok ).toBe( true );
        const selfRead = await callTool( page, 'blocks-get', {
            artboard: selfBoard.result.id,
            depth: 5,
        } );
        expect( selfRead.ok ).toBe( true );
        expect( names( selfRead.result.blocks ).slice( 0, 2 ) ).toEqual( [
            'core/paragraph',
            'core/block',
        ] );

        // An artboard whose editor cannot mount: its record is asked for
        // and never answered. It is put on the board as a layout step.
        await callTool( page, 'edit-leave' );
        const held = new RegExp( `wp(/|%2F)v2(/|%2F)blocks(/|%2F)${ hidden }` );
        await page.route( held, () => {} );
        const unreachable = '00000000-0000-4000-8000-000000000029';
        await page.evaluate(
            ( [ id, entityId ] ) =>
                ( window as any ).wp.data.dispatch( 'wfd/board' ).addArtboard( {
                    id,
                    kind: 'pattern',
                    entityId,
                    device: 'desktop',
                    x: 1580,
                    y: 3200,
                    height: 400,
                } ),
            [ unreachable, hidden ] as const
        );
        started = Date.now();
        const never = await callTool( page, 'blocks-get', {
            artboard: unreachable,
        } );
        expect( never.ok ).toBe( false );
        expect( never.error.code ).toBe( 'not_ready' );
        expect( never.error.message ).toMatch( /did not finish loading\.$/ );
        expect( Date.now() - started ).toBeGreaterThanOrEqual( 9500 );
        expect( Date.now() - started ).toBeLessThan( 13500 );
        await page.unroute( held );
        await callTool( page, 'edit-leave' );

        // A refresh whose request never answers ends at the limit, and the
        // next call runs.
        const pages = /wp(\/|%2F)v2(\/|%2F)pages/;
        await page.route( pages, () => {} );
        started = Date.now();
        const refreshed = await callTool( page, 'board-refresh' );
        expect( refreshed ).toEqual( {
            ok: false,
            error: {
                code: 'unavailable',
                message: 'The board cannot be used right now.',
            },
        } );
        expect( Date.now() - started ).toBeGreaterThanOrEqual( 9500 );
        expect( Date.now() - started ).toBeLessThan( 13500 );
        started = Date.now();
        const next = await callTool( page, 'board-get' );
        expect( next.ok ).toBe( true );
        expect( Date.now() - started ).toBeLessThan( 2000 );
        await page.unroute( pages );
    } );

    test( 'AC-TOOL-28 artboard-remove takes a never-saved new part off the board when only the agent changed it, and refuses once the designer has typed in it', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        await boardAtRest( page );

        // Only the agent changed it.
        const first = await callTool( page, 'artboard-new', {
            kind: 'template-part',
        } );
        expect( first.ok ).toBe( true );
        await callTool( page, 'blocks-insert', {
            artboard: first.result.id,
            markup: '<!-- wp:paragraph --><p>From the agent.</p><!-- /wp:paragraph -->',
        } );
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 10 );
        expect(
            await callTool( page, 'artboard-remove', {
                artboards: [ first.result.id ],
            } )
        ).toEqual( { ok: true, result: { removed: [ first.result.id ] } } );
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 9 );
        await expect( review( page ) ).toHaveText( 'Review changes' );

        // The designer has typed in it.
        const second = await callTool( page, 'artboard-new', {
            kind: 'template-part',
        } );
        expect( second.ok ).toBe( true );
        await callTool( page, 'blocks-insert', {
            artboard: second.result.id,
            markup: '<!-- wp:paragraph --><p>From the agent.</p><!-- /wp:paragraph -->',
        } );
        const paragraph = editorFrame( page, second.result.id )
            .locator( 'p' )
            .filter( { hasText: 'From the agent.' } );
        await paragraph.click();
        await page.keyboard.press( 'End' );
        await page.keyboard.type( ' And the designer.' );
        await expect( paragraph ).toHaveText(
            'From the agent. And the designer.'
        );
        const hero = artboardOf( fixture, 'pattern' );
        expect(
            await callTool( page, 'artboard-remove', {
                artboards: [ hero.id, second.result.id ],
            } )
        ).toEqual( {
            ok: false,
            error: {
                code: 'not_agents',
                message: 'Untitled part also has changes made by the designer.',
            },
        } );
        // None of them is removed, and the content stays.
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 10 );
        await expect( frame( page, hero.id ) ).toHaveCount( 1 );
        await expect( frame( page, second.result.id ) ).toHaveAttribute(
            'data-wfd-tier',
            'live'
        );
        await expect( paragraph ).toHaveText(
            'From the agent. And the designer.'
        );
        await expect( review( page ) ).toHaveText( 'Review 1 change' );
        expect(
            ( await callTool( page, 'review-list' ) ).result.items[ 0 ]
        ).toMatchObject( { isNew: true, author: 'both' } );
    } );

    test( 'AC-TOOL-30 A tool refuses a Custom HTML block, markup that runs script, custom CSS and an address of wp-admin', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        await boardAtRest( page );
        const header = artboardOf( fixture, 'template-part' );
        const refused = ( message: string ) => ( {
            ok: false,
            error: { code: 'invalid_args', message },
        } );
        const markup =
            'markup must not hold a Custom HTML block, a script or an event handler.';
        for ( const blocks of [
            '<!-- wp:html --><b>Raw</b><!-- /wp:html -->',
            '<!-- wp:group --><div class="wp-block-group"><!-- wp:html --><b>Raw</b><!-- /wp:html --></div><!-- /wp:group -->',
            '<!-- wp:paragraph --><p>Hi<script>alert(1)</script></p><!-- /wp:paragraph -->',
            '<!-- wp:paragraph --><p>Hi <img src="x" onerror="alert(1)"></p><!-- /wp:paragraph -->',
        ] ) {
            expect(
                await callTool( page, 'blocks-insert', {
                    artboard: header.id,
                    markup: blocks,
                } )
            ).toEqual( refused( markup ) );
        }

        expect(
            await callTool( page, 'block-update', {
                artboard: header.id,
                block: [ 0, 0 ],
                attributes: {
                    content: '<a href="javascript:alert(1)">Go</a>',
                },
            } )
        ).toEqual(
            refused( 'attributes must not hold a script or an event handler.' )
        );

        expect(
            await callTool( page, 'styles-set', {
                kind: 'style',
                property: 'css',
                value: 'body { display: none; }',
            } )
        ).toEqual( refused( 'property must not be css.' ) );

        for ( const address of [
            '/wp-admin/',
            '/WP-Admin/plugins.php',
            '/%77p-admin/',
            '/wp-login.php?action=logout',
        ] ) {
            expect(
                await callTool( page, 'artboard-add', {
                    kind: 'browser',
                    address,
                } )
            ).toEqual(
                refused(
                    'address must not be in wp-admin, wp-login.php or xmlrpc.php.'
                )
            );
        }
        await expect( review( page ) ).toHaveText( 'Review changes' );
    } );
} );
