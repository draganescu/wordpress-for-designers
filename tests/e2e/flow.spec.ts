import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import type { Page } from '@playwright/test';
import {
    resetFixture,
    openBoard,
    editorFrame,
    setViewport,
    boardAtRest,
    artboardOf,
    type Fixture,
} from './utils';
import { wp, wfd, isResult, listening } from './agent-utils';

const review = ( page: Page ) => page.locator( '[data-wfd-control="H9"]' );
const frame = ( page: Page, id: string ) =>
    page.locator( `[data-wfd-artboard="${ id }"]` );

/**
 * Runs one tool with `wp wfd call` and gives its result.
 *
 * @param tool  The tool.
 * @param flags The command's flags.
 */
async function call( tool: string, ...flags: string[] ) {
    const ran = await wfd( [ 'call', tool, ...flags ] );
    const envelope = JSON.parse( ran.stdout );
    expect( envelope.ok, `${ tool }: ${ ran.stdout }` ).toBe( true );
    expect( ran.code ).toBe( 0 );
    return envelope.result;
}

/**
 * Opens the fixture board during an agent session.
 *
 * @param page    The page.
 * @param boardId The board.
 * @param count   The number of artboards on it.
 */
async function openListening( page: Page, boardId: number, count = 9 ) {
    await wfd( [ 'status' ] );
    const asked = listening( page );
    await openBoard( page, boardId, count );
    await asked;
    await boardAtRest( page );
}

const pageTargets = ( page: Page ) =>
    page.evaluate( async () =>
        ( await ( window as any ).wfdAgent.ready() ).targets()
    );

test.describe( 'FLOW', () => {
    let fixture: Fixture;
    test.beforeEach( async ( { requestUtils } ) => {
        fixture = await resetFixture( requestUtils );
    } );

    test( "AC-FLOW-01 Reading: status, then board-get, name the fixture's artboards and notes, and Review has nothing to save", async ( {
        page,
        requestUtils,
    } ) => {
        const note = {
            id: '0c0ffee0-0000-4000-8000-000000000003',
            x: 100,
            y: -300,
            text: 'A note for the agent',
            color: 'blue',
        };
        await requestUtils.rest( {
            method: 'POST',
            path: `/wp/v2/wfd-boards/${ fixture.boardId }`,
            data: { layout: { ...fixture.layout, notes: [ note ] } },
        } );
        await openListening( page, fixture.boardId );

        const status = JSON.parse( ( await wfd( [ 'status' ] ) ).stdout );
        expect( status.boards ).toEqual( [
            { id: fixture.boardId, title: 'Fixture board' },
        ] );
        const board = await call( 'board-get' );
        expect( board.board ).toEqual( {
            id: fixture.boardId,
            title: 'Fixture board',
        } );
        expect(
            board.artboards.map(
                ( a: any ) => `${ a.name } · ${ a.kind } · ${ a.device }`
            )
        ).toEqual( [
            'About · page · desktop',
            'Become a member · page · desktop',
            'Index · template · desktop',
            'Single Posts · template · desktop',
            'Footer · template-part · desktop',
            'Header · template-part · desktop',
            'Header · template-part · mobile',
            'Hero · pattern · desktop',
            'Sign-off · pattern · desktop',
        ] );
        expect( board.notes ).toEqual( [
            {
                id: note.id,
                ref: `wfd-ref-n_${ note.id }`,
                text: note.text,
                color: 'blue',
                x: 100,
                y: -300,
            },
        ] );
        expect( board.selection ).toEqual( [] );
        expect( board.edit ).toBeNull();
        await expect( review( page ) ).toHaveText( 'Review changes' );
        await expect( review( page ) ).toBeDisabled();
        expect( ( await call( 'review-list' ) ).items ).toEqual( [] );
    } );

    test( 'AC-FLOW-02 Pointing at blocks: one batch reads a Heading and changes it and a Button by reference, at every width of the page', async ( {
        page,
        requestUtils,
    } ) => {
        // The page has a Button, and a Mobile artboard beside the Desktop one.
        await requestUtils.rest( {
            method: 'POST',
            path: `/wp/v2/pages/${ fixture.pages.about }`,
            data: {
                content:
                    '<!-- wp:heading --><h2 class="wp-block-heading">About</h2><!-- /wp:heading -->' +
                    '<!-- wp:buttons --><div class="wp-block-buttons"><!-- wp:button --><div class="wp-block-button"><a class="wp-block-button__link wp-element-button">Join</a></div><!-- /wp:button --></div><!-- /wp:buttons -->',
            },
        } );
        const about = fixture.layout.artboards.find(
            ( a ) => a.entityId === fixture.pages.about
        )!;
        const mobileId = '0c0ffee0-0000-4000-8000-0000000000b0';
        await requestUtils.rest( {
            method: 'POST',
            path: `/wp/v2/wfd-boards/${ fixture.boardId }`,
            data: {
                layout: {
                    version: 1,
                    artboards: [
                        ...fixture.layout.artboards,
                        {
                            ...about,
                            id: mobileId,
                            device: 'mobile',
                            x: about.x - 500,
                        },
                    ],
                },
            },
        } );
        await openListening( page, fixture.boardId, 10 );

        // The references, as a harness takes them from what is pointed at.
        // Neither artboard is in edit.
        const targets = await pageTargets( page );
        const inAbout = ( t: any ) =>
            t.kind === 'block' &&
            t.ref.startsWith( `wfd-ref-a_${ about.id }_b_` );
        const heading = targets.find(
            ( t: any ) =>
                inAbout( t ) && t.label === 'Heading' && t.text === 'About'
        );
        const button = targets.find(
            ( t: any ) =>
                inAbout( t ) && t.label === 'Button' && t.text === 'Join'
        );
        const mobile = targets.find(
            ( t: any ) => t.ref === `wfd-ref-a_${ mobileId }`
        );
        expect( heading ).toBeTruthy();
        expect( button ).toBeTruthy();
        expect( mobile ).toMatchObject( {
            kind: 'artboard',
            label: 'About',
            where: 'Page · Mobile',
        } );
        await expect( page.locator( '[data-wfd-tier="live"]' ) ).toHaveCount(
            0
        );

        const ran = await wfd( [
            'batch',
            `--calls=${ JSON.stringify( [
                { tool: 'blocks-get', input: { artboard: heading.ref } },
                {
                    tool: 'block-update',
                    input: {
                        artboard: heading.ref,
                        attributes: { content: 'About the roastery' },
                    },
                },
                {
                    tool: 'block-update',
                    input: {
                        artboard: '#' + button.ref,
                        attributes: { backgroundColor: 'accent-3' },
                    },
                },
            ] ) }`,
        ] );
        expect( ran.code ).toBe( 0 );
        const batch = JSON.parse( ran.stdout );
        expect( batch.ok ).toBe( true );
        expect( batch.results ).toHaveLength( 3 );
        expect( batch.results[ 0 ].result.blocks[ 0 ] ).toMatchObject( {
            name: 'core/heading',
            text: 'About',
            editable: true,
        } );
        expect( batch.results[ 1 ].result.text ).toBe( 'About the roastery' );
        expect( batch.results[ 2 ].result.attributes.backgroundColor ).toBe(
            'accent-3'
        );
        // The Desktop artboard is in edit, with both changes.
        await expect( frame( page, about.id ) ).toHaveAttribute(
            'data-wfd-tier',
            'live'
        );
        const live = editorFrame( page, about.id );
        await expect( live.locator( '.wp-block-post-content h2' ) ).toHaveText(
            'About the roastery'
        );
        await expect( live.locator( '.wp-block-button__link' ) ).toHaveClass(
            /has-accent-3-background-color/
        );

        // The page is listed once in Review, and the agent changed it.
        const listed = ( await call( 'review-list' ) ).items;
        expect( listed ).toHaveLength( 1 );
        expect( listed[ 0 ] ).toMatchObject( {
            key: `postType/page/${ fixture.pages.about }`,
            type: 'page',
            name: 'About',
            author: 'agent',
        } );
        await expect( review( page ) ).toHaveText( 'Review 1 change' );

        // Every width of the page shows both.
        await setViewport( page, {
            x: 60 - ( about.x - 500 ) * 0.3,
            y: 60 - about.y * 0.3,
            zoom: 0.3,
        } );
        for ( const id of [ mobileId, about.id ] ) {
            const shown = page.frameLocator(
                `[data-wfd-artboard="${ id }"] iframe`
            );
            await expect(
                shown.locator( '.wp-block-post-content h2' )
            ).toHaveText( 'About the roastery' );
            await expect(
                shown.locator( '.wp-block-button__link' )
            ).toHaveClass( /has-accent-3-background-color/ );
        }
        await expect( frame( page, mobileId ) ).toHaveAttribute(
            'data-wfd-agent-changed',
            'true'
        );
    } );

    test( 'AC-FLOW-03 Two references, one ask: a block is read on one artboard and a pattern inserted after a block on a second', async ( {
        page,
    } ) => {
        await openListening( page, fixture.boardId );
        const header = artboardOf( fixture, 'template-part' );
        const hero = artboardOf( fixture, 'pattern' );
        const pattern = await page.evaluate( async () => {
            const { resolveSelect } = ( window as any ).wp.data;
            const all = await resolveSelect( 'core' ).getBlockPatterns();
            return all.find(
                ( item: any ) =>
                    ( ! item.source || item.source === 'theme' ) &&
                    item.inserter !== false
            ).name;
        } );

        const read = await call(
            'blocks-get',
            `--ref=wfd-ref-a_${ header.id }_b_0_0`
        );
        expect( read.blocks[ 0 ] ).toMatchObject( {
            name: 'core/paragraph',
            text: 'Fixture header text',
        } );
        await expect( frame( page, header.id ) ).toHaveAttribute(
            'data-wfd-tier',
            'live'
        );

        // After the referenced block: the same parent, the next index.
        const inserted = await call(
            'blocks-insert',
            `--ref=wfd-ref-a_${ hero.id }_b_0`,
            '--index=1',
            `--pattern=${ pattern }`
        );
        expect( inserted.inserted[ 0 ] ).toEqual( [ 1 ] );

        // The second artboard is in edit, with the pattern in place.
        await expect( frame( page, hero.id ) ).toHaveAttribute(
            'data-wfd-tier',
            'live'
        );
        const top = (
            await call( 'blocks-get', `--artboard=${ hero.id }`, '--depth=0' )
        ).blocks;
        expect( top[ 0 ].name ).toBe( 'core/heading' );
        expect( top.length ).toBe( 2 + inserted.inserted.length );
        expect( top[ top.length - 1 ].name ).toBe( 'core/paragraph' );
        // The first is unchanged, and no longer in edit.
        await expect( frame( page, header.id ) ).not.toHaveAttribute(
            'data-wfd-tier',
            'live'
        );
        await expect( page.locator( '[data-wfd-tier="live"]' ) ).toHaveCount(
            1
        );
        const listed = ( await call( 'review-list' ) ).items;
        expect( listed.map( ( item: any ) => item.type ) ).toEqual( [
            'pattern',
        ] );
        const board = await call( 'board-get' );
        expect( board.edit ).toBe( hero.id );
    } );

    test( "AC-FLOW-04 A token: token-set by a colour's reference repaints the artboards that use it, token-show-uses shows them, and nothing is saved", async ( {
        page,
    } ) => {
        await openListening( page, fixture.boardId );
        const hero = artboardOf( fixture, 'pattern' );
        await setViewport( page, { x: -300, y: -120, zoom: 0.25 } );
        // The frozen copy lies over the Preview until that has settled.
        await expect(
            page.locator(
                `[data-wfd-artboard="${ hero.id }"] iframe:not([sandbox])`
            )
        ).toBeAttached();
        await expect(
            page.locator( `[data-wfd-artboard="${ hero.id }"] iframe` )
        ).toHaveCount( 1 );
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

        const styles = await call( 'styles-get' );
        const accent = styles.colors.find(
            ( c: any ) => c.slug === 'accent-1'
        );
        expect( accent.ref ).toBe( 'wfd-ref-t_color_accent-1' );

        const set = await call(
            'token-set',
            `--ref=${ accent.ref }`,
            '--kind=color',
            '--value=#123456'
        );
        expect( set ).toMatchObject( { slug: 'accent-1', value: '#123456' } );
        await expect.poll( background ).toBe( 'rgb(18, 52, 86)' );
        // Every artboard that uses the colour, by what token-show-uses
        // names.
        const everyUse = async ( ids: string[] ) => {
            for ( const id of ids ) {
                await expect
                    .poll( () =>
                        page
                            .locator( `[data-wfd-artboard="${ id }"] iframe` )
                            .first()
                            .evaluate( ( el: HTMLIFrameElement ) => {
                                const p = el.contentDocument!.querySelector(
                                    'p.has-accent-1-background-color'
                                )!;
                                return el.contentWindow!.getComputedStyle( p )
                                    .backgroundColor;
                            } )
                    )
                    .toBe( 'rgb(18, 52, 86)' );
            }
        };

        const uses = await call( 'token-show-uses', `--ref=${ accent.ref }` );
        expect( uses.places ).toBe( 3 );
        expect( uses.artboards ).toHaveLength( 3 );
        expect( uses.artboards ).toContain( hero.id );
        await everyUse( uses.artboards );
        await expect(
            page.locator( '[data-wfd-banner="usage"]' )
        ).toContainText(
            'Showing where Accent 1 is used: 3 places on 3 artboards'
        );
        await expect(
            frame( page, hero.id ).locator( '.wfd-artboard__label' )
        ).toContainText( '· 1 use' );

        // Nothing is saved: Styles waits in Review.
        await expect( review( page ) ).toHaveText( 'Review 1 change' );
        const stored = await wp( [
            'post',
            'list',
            '--post_type=wp_global_styles',
            '--post_status=any',
            '--field=post_content',
        ] );
        expect( stored.stdout ).not.toContain( '123456' );
    } );

    test( 'AC-FLOW-05 A change made outside the board: a page made with wp post create is put on the board, and a change to it waits in Review', async ( {
        page,
    } ) => {
        await openListening( page, fixture.boardId );
        const made = await wp( [
            'post',
            'create',
            '--post_type=page',
            '--post_status=publish',
            '--post_title=Roasts',
            '--post_content=<!-- wp:paragraph --><p>Light, medium, dark.</p><!-- /wp:paragraph -->',
            '--porcelain',
        ] );
        expect( made.code ).toBe( 0 );
        const id = Number( made.stdout.trim() );
        expect( id ).toBeGreaterThan( 0 );

        expect( await call( 'board-refresh' ) ).toEqual( { refreshed: true } );
        const added = await call(
            'artboard-add',
            '--kind=page',
            `--entityId=${ id }`
        );
        expect( added ).toMatchObject( {
            kind: 'page',
            name: 'Roasts',
            entityId: id,
        } );
        await expect( frame( page, added.id ) ).toHaveCount( 1 );
        await expect(
            frame( page, added.id ).locator( '.wfd-artboard__label' )
        ).toContainText( 'Roasts · Page' );

        // The page's own paragraph, found in the blocks of its artboard.
        const tree = await call(
            'blocks-get',
            `--artboard=${ added.id }`,
            '--depth=10'
        );
        const all: any[] = [];
        const walk = ( blocks: any[] ) =>
            blocks.forEach( ( block ) => {
                all.push( block );
                walk( block.inner ?? [] );
            } );
        walk( tree.blocks );
        const paragraph = all.find(
            ( block ) =>
                block.name === 'core/paragraph' &&
                block.text === 'Light, medium, dark.' &&
                block.editable
        );
        expect( paragraph ).toBeTruthy();
        const changed = await call(
            'block-update',
            `--ref=${ paragraph.ref }`,
            '--attributes={"content":"Our roasts"}'
        );
        expect( changed.text ).toBe( 'Our roasts' );
        await expect( review( page ) ).toHaveText( 'Review 1 change' );
        const listed = ( await call( 'review-list' ) ).items;
        expect( listed ).toHaveLength( 1 );
        expect( listed[ 0 ] ).toMatchObject( {
            key: `postType/page/${ id }`,
            name: 'Roasts',
            author: 'agent',
        } );
        // It waits: the site still has the page as it was made.
        const saved = await wp( [
            'post',
            'get',
            String( id ),
            '--field=post_content',
        ] );
        expect( saved.stdout ).not.toContain( 'Our roasts' );
    } );

    test( 'AC-FLOW-06 Review: the agent lists and discards its Styles change; the designer saves the rest, with no command taking part', async ( {
        page,
    } ) => {
        await openListening( page, fixture.boardId );
        const header = artboardOf( fixture, 'template-part' );
        await call(
            'token-set',
            '--kind=color',
            '--slug=accent-1',
            '--value=#123456'
        );
        await call(
            'block-update',
            `--ref=wfd-ref-a_${ header.id }_b_0_0`,
            '--attributes={"content":"Saved by the designer"}'
        );
        await call( 'edit-leave' );
        await expect( review( page ) ).toHaveText( 'Review 2 changes' );

        const listed = ( await call( 'review-list' ) ).items;
        expect(
            listed
                .map( ( item: any ) => `${ item.type } ${ item.author }` )
                .sort()
        ).toEqual( [ 'styles agent', 'template-part agent' ] );
        const styles = listed.find( ( item: any ) => item.type === 'styles' );
        expect(
            await call( 'review-discard', `--key=${ styles.key }` )
        ).toEqual( { discarded: styles.key } );
        await expect( review( page ) ).toHaveText( 'Review 1 change' );

        // The designer saves from the drawer. No command runs meanwhile.
        const results: string[] = [];
        page.on( 'request', ( request ) => {
            if ( isResult( request.url() ) ) {
                results.push( request.url() );
            }
        } );
        await review( page ).click();
        await expect( page.locator( '.wfd-review__item' ) ).toHaveCount( 1 );
        await expect( page.locator( '.wfd-review__author' ) ).toHaveText(
            'Agent'
        );
        await page.getByRole( 'button', { name: 'Save 1 change' } ).click();
        await expect( page.locator( '.wfd-review__item' ) ).toHaveCount( 0 );
        expect( results ).toEqual( [] );

        // What the agent changed and did not discard reached the site.
        const part = await wp( [
            'post',
            'list',
            '--post_type=wp_template_part',
            '--name=header',
            '--field=post_content',
        ] );
        expect( part.stdout ).toContain( 'Saved by the designer' );
        // What it discarded did not.
        const stored = await wp( [
            'post',
            'list',
            '--post_type=wp_global_styles',
            '--post_status=any',
            '--field=post_content',
        ] );
        expect( stored.stdout ).not.toContain( '123456' );
        await page.keyboard.press( 'Escape' );
        await expect( review( page ) ).toHaveText( 'Review changes' );
    } );
} );
