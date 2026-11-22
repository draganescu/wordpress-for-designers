import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import type { RequestUtils } from '@wordpress/e2e-test-utils-playwright';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import {
    resetFixture,
    openBoard,
    boardAtRest,
    artboardOf,
    editorFrame,
    type Artboard,
    type Fixture,
} from '../../../tests/e2e/utils';
import {
    relayOptions,
    callRecords,
    callTool,
    handedTo,
    holdBack,
    showsBoard,
    isRelay,
    isResult,
    listening,
} from '../../../tests/e2e/agent-utils';
import { connect, type Session } from './mcp';

const ADAPTER = path.join( __dirname, '..' );
const ROOT = path.join( ADAPTER, '..', '..' );
const MAIN = path.basename( ROOT );
const BASE = process.env.WP_BASE_URL ?? 'http://localhost:8890';

/**
 * The main plugin's declarations, which the adapter holds no copy of.
 */
const declarations: { name: string; description: string; input: any }[] =
    JSON.parse(
        fs.readFileSync(
            path.join( ROOT, 'includes/agent-tools.json' ),
            'utf8'
        )
    );

const EVERY = [
    ...declarations.map( ( tool ) => `wfd/${ tool.name }` ),
    'wfd/boards-list',
    'wfd/board-open',
    'wfd/batch',
];

/**
 * The guide, read from the spec so the check is against its text.
 */
const GUIDE = fs
    .readFileSync( path.join( ADAPTER, 'spec/abilities.md' ), 'utf8' )
    .match( /## Guide\n[\s\S]*?```text\n([\s\S]*?)\n```/ )![ 1 ];

const HEADING =
    '<!-- wp:heading --><h2 class="wp-block-heading">Inserted</h2><!-- /wp:heading -->';

type Ran = { stdout: string; stderr: string; code: number };

/**
 * Runs a WP-CLI command in the adapter's test site.
 *
 * @param args The arguments after `wp`.
 */
function wp( args: string[] ): Promise< Ran > {
    return new Promise( ( resolve ) => {
        execFile(
            path.join( ROOT, 'node_modules/.bin/wp-env' ),
            [ 'run', 'cli', '--', 'wp', ...args ],
            { cwd: ADAPTER, maxBuffer: 16 * 1024 * 1024 },
            ( error, stdout, stderr ) =>
                resolve( {
                    stdout,
                    stderr,
                    code: error ? Number( ( error as any ).code ) || 1 : 0,
                } )
        );
    } );
}

/**
 * Makes an application password for a user.
 *
 * @param requestUtils The REST helper, signed in as the administrator.
 * @param user         The user's id, or `me`.
 */
async function applicationPassword(
    requestUtils: RequestUtils,
    user: number | 'me'
) {
    const made = await requestUtils.rest< { uuid: string; password: string } >(
        {
            method: 'POST',
            path: `/wp/v2/users/${ user }/application-passwords`,
            data: { name: 'Abilities adapter tests' },
        }
    );
    return { user, uuid: made.uuid, password: made.password };
}

test.describe( 'ABIL', () => {
    let fixture: Fixture;
    let mcp: Session;
    let admin: Awaited< ReturnType< typeof applicationPassword > >;
    let editor: Awaited< ReturnType< typeof applicationPassword > >;

    /**
     * Input each ability's schema accepts, for the fixture.
     */
    const valid = (): Record< string, object > => {
        const hero = artboardOf( fixture, 'pattern' );
        const header = artboardOf( fixture, 'template-part' );
        return {
            'wfd/board-get': {},
            'wfd/board-select': { artboards: [ hero.id ] },
            'wfd/board-refresh': {},
            'wfd/artboard-add': {
                kind: 'page',
                entityId: fixture.pages.about,
            },
            'wfd/artboard-new': { kind: 'template-part' },
            'wfd/artboard-update': { artboard: hero.id, x: hero.x, y: hero.y },
            'wfd/artboard-remove': { artboards: [ hero.id ] },
            'wfd/artboard-edit': { artboard: header.id },
            'wfd/edit-leave': {},
            'wfd/blocks-get': { artboard: header.id },
            'wfd/block-update': {
                artboard: header.id,
                block: [ 0, 0 ],
                attributes: { content: 'Changed and not saved' },
            },
            'wfd/blocks-insert': { artboard: header.id, markup: HEADING },
            'wfd/blocks-remove': { artboard: header.id, blocks: [ [ 0, 1 ] ] },
            'wfd/blocks-move': {
                artboard: header.id,
                block: [ 1 ],
                parent: [ 0 ],
                index: 0,
            },
            'wfd/styles-get': {},
            'wfd/token-set': {
                kind: 'color',
                slug: 'accent-1',
                value: '#123456',
            },
            'wfd/styles-set': {
                kind: 'style',
                property: 'color.background',
                value: '#fafafa',
            },
            'wfd/styles-set-variation': { name: 'Default' },
            'wfd/token-show-uses': {},
            'wfd/review-list': {},
            'wfd/review-discard': {
                key: `postType/page/${ fixture.pages.about }`,
            },
            'wfd/boards-list': {},
            'wfd/board-open': { board: fixture.boardId },
            'wfd/batch': { calls: [ { tool: 'board-get', input: {} } ] },
        };
    };

    /**
     * Runs `wfd/board-open` for the fixture board and opens that board in
     * the page, which stands for the browser the agent controls.
     *
     * @param page The page.
     */
    async function openListening( page: Page ) {
        await mcp.run( 'wfd/board-open', { board: fixture.boardId } );
        const asked = listening( page );
        await openBoard( page, fixture.boardId );
        await asked;
        await boardAtRest( page );
    }

    test.beforeAll( async ( { requestUtils } ) => {
        const activated = await wp( [
            'plugin',
            'activate',
            MAIN,
            'wfd-abilities',
            'mcp-adapter',
        ] );
        expect( activated.code, activated.stderr ).toBe( 0 );
        // The users exist once the fixture has been seeded.
        const seeded = await resetFixture( requestUtils );
        admin = await applicationPassword( requestUtils, 'me' );
        editor = await applicationPassword(
            requestUtils,
            seeded.users.wfd_editor
        );
    } );

    test.afterAll( async ( { requestUtils } ) => {
        for ( const made of [ admin, editor ] ) {
            await requestUtils.rest( {
                method: 'DELETE',
                path: `/wp/v2/users/${ made.user }/application-passwords/${ made.uuid }`,
            } );
        }
    } );

    test.beforeEach( async ( { requestUtils } ) => {
        // A site no way in has been used on: the reset deletes every option
        // of the relay.
        fixture = await resetFixture( requestUtils );
        mcp = await connect( BASE, 'admin', admin.password );
    } );

    test.afterEach( async () => {
        await mcp.close();
    } );

    test( 'AC-ABIL-01 The discovery tool lists 24 abilities in the category wfd: wfd/boards-list, wfd/board-open, wfd/batch and one wfd/{name} for each tool of includes/agent-tools.json', async () => {
        expect( EVERY ).toHaveLength( 24 );
        expect(
            ( await mcp.abilities() )
                .map( ( ability ) => ability.name )
                .filter( ( name ) => name.startsWith( 'wfd/' ) )
        ).toEqual( EVERY );

        // The discovery tool gives no category: as WordPress holds it.
        const { stdout } = await wp( [
            'eval',
            '$names = array(); foreach ( wp_get_abilities() as $ability ) { if ( "wfd" === $ability->get_category() ) { $names[] = $ability->get_name(); } } $category = wp_get_ability_category( "wfd" ); echo wp_json_encode( array( "names" => $names, "slug" => $category->get_slug(), "label" => $category->get_label(), "description" => $category->get_description() ) );',
        ] );
        expect( JSON.parse( stdout ) ).toEqual( {
            names: EVERY,
            slug: 'wfd',
            label: 'WordPress for Designers',
            description:
                'Work on a WordPress for Designers board that is open in a browser.',
        } );
    } );

    test( "AC-ABIL-02 For every tool, the ability's description equals the declaration's, and its input schema equals the declaration's input with board added", async () => {
        for ( const tool of declarations ) {
            const info = await mcp.info( `wfd/${ tool.name }` );
            const expected: any = {
                ...tool.input,
                properties: {
                    ...tool.input.properties,
                    board: { type: 'integer', minimum: 1 },
                },
            };
            // With no required field the ability may be run with no input
            // (abilities.md, Every ability).
            if ( ! tool.input.required?.length ) {
                expected.default = {};
            }
            expect( info.label ).toBe( tool.name );
            expect( info.description, tool.name ).toBe( tool.description );
            expect( info.input_schema, tool.name ).toEqual( expected );
        }
    } );

    test( 'AC-ABIL-03 With no board open, wfd/boards-list returns every board of the fixture with listening false and an address; opening that address in the page shows the board. With the board open, its listening is true', async ( {
        page,
    } ) => {
        const closed = await mcp.run( 'wfd/boards-list' );
        expect( closed ).toEqual( {
            boards: [
                {
                    id: fixture.boardId,
                    title: 'Fixture board',
                    address: expect.any( String ),
                    listening: false,
                },
            ],
        } );
        const { address } = closed.boards[ 0 ];
        await page.goto( address );
        await showsBoard( page, fixture.boardId );

        // A board page asks the relay only once a way in has been used
        // (AC-ABIL-11), so it is listening after wfd/board-open and one
        // load.
        await mcp.run( 'wfd/board-open', { board: fixture.boardId } );
        const asked = listening( page );
        await page.goto( address );
        await asked;
        expect( await mcp.run( 'wfd/boards-list' ) ).toEqual( {
            boards: [ { ...closed.boards[ 0 ], listening: true } ],
        } );
    } );

    test( "AC-ABIL-04 wfd/board-open returns the board's entry and the guide of abilities.md, verbatim. A board opened after it shows G1 within 5 seconds of loading. For an id that is no board it fails with not_found", async ( {
        page,
        requestUtils,
    } ) => {
        // A page's id is no board's. No session is marked.
        const id = fixture.pages.about;
        expect( await mcp.fail( 'wfd/board-open', { board: id } ) ).toBe(
            `not_found: Board ${ id } was not found.`
        );
        expect( await relayOptions( requestUtils ) ).toEqual( {} );

        const [ board ] = ( await mcp.run( 'wfd/boards-list' ) ).boards;
        expect(
            await mcp.run( 'wfd/board-open', { board: fixture.boardId } )
        ).toEqual( { board, guide: GUIDE } );

        // The agent opens the address; the ability opened nothing.
        await page.goto( board.address );
        const chip = page.locator( '[data-wfd-agent]' );
        await expect( chip ).toHaveAttribute( 'data-wfd-agent', 'connected', {
            timeout: 5000,
        } );
        await expect( chip ).toHaveText( 'Agent connected' );
    } );

    test( "AC-ABIL-05 wfd/board-get returns what window.wfdAgent's call( 'board-get', {} ) returns in the page", async ( {
        page,
    } ) => {
        await openListening( page );
        const through = await mcp.run( 'wfd/board-get' );
        const inPage: any = await callTool( page, 'board-get', {} );
        expect( through ).toEqual( inPage.result );
    } );

    test( "AC-ABIL-06 wfd/block-update on a Heading of a page artboard changes its text in the page; the artboard shows G2 while the call runs, and the item is recorded as the agent's in wfd/review-list", async ( {
        page,
    } ) => {
        const about = fixture.layout.artboards.find(
            ( a ) => a.entityId === fixture.pages.about
        )!;
        await openListening( page );

        // Read before changing: the Heading the page holds.
        const flat = ( blocks: any[] ): any[] =>
            blocks.flatMap( ( block ) => [
                block,
                ...flat( block.inner ?? [] ),
            ] );
        const read = await mcp.run( 'wfd/blocks-get', {
            artboard: about.id,
            depth: 10,
        } );
        const heading = flat( read.blocks ).find(
            ( block ) => block.name === 'core/heading' && block.text === 'About'
        );

        // G2, while the board's answer is held back.
        const text = 'Changed through an ability';
        const result = await holdBack( page, isResult );
        const updated = mcp.run( 'wfd/block-update', {
            artboard: heading.ref,
            attributes: { content: text },
        } );
        await result.reached;
        await expect(
            page.locator( `[data-wfd-artboard="${ about.id }"]` )
        ).toHaveAttribute( 'data-wfd-agent-working', 'true' );
        result.release();
        await updated;

        await expect(
            editorFrame( page, about.id )
                .locator( '[data-type="core/heading"]' )
                .filter( { hasText: text } )
        ).toHaveCount( 1 );
        const { items } = await mcp.run( 'wfd/review-list' );
        expect(
            items.find(
                ( item: any ) => item.type === 'page' && item.name === 'About'
            ).author
        ).toBe( 'agent' );
    } );

    test( "AC-ABIL-07 A tool ability whose input names an artboard that is not on the board fails with the code not_found and the tool's message. One whose input breaks the schema fails before any call is queued", async ( {
        page,
        requestUtils,
    } ) => {
        await openListening( page );
        const handed = handedTo( page );

        // The tool's own answer in the page, for the same input.
        const input = { artboard: '11111111-2222-4333-8444-555555555555' };
        const inPage: any = await callTool( page, 'artboard-edit', input );
        expect( inPage.error.code ).toBe( 'not_found' );
        expect( await mcp.fail( 'wfd/artboard-edit', input ) ).toBe(
            `not_found: ${ inPage.error.message }`
        );
        // That one reached the board.
        await expect.poll( () => handed.length ).toBe( 1 );

        // Input that breaks the schema: a value outside an enum, a required
        // field left out, a field the tool does not have, a wrong type.
        const hero = artboardOf( fixture, 'pattern' );
        const broken: [ string, object ][] = [
            [ 'wfd/artboard-update', { artboard: hero.id, device: 'phone' } ],
            [ 'wfd/board-select', {} ],
            [ 'wfd/board-get', { nope: 1 } ],
            [ 'wfd/blocks-get', { artboard: hero.id, depth: 11 } ],
            [ 'wfd/board-get', { board: 'the first' } ],
        ];
        for ( const [ ability, parameters ] of broken ) {
            expect( await mcp.fail( ability, parameters ) ).toMatch(
                new RegExp( `^Ability "${ ability }" has invalid input\\.` )
            );
        }
        // Longer than two of the board's polls during a session.
        await page.waitForTimeout( 2500 );
        expect( handed ).toHaveLength( 1 );
        expect(
            callRecords( Object.keys( await relayOptions( requestUtils ) ) )
        ).toEqual( [] );
    } );

    test( "AC-ABIL-08 With no board open, a tool ability fails with no_board and the adapter's message in under 2 seconds. With two boards open it fails with several_boards and the adapter's message; with board it answers for the board named, and the page's input holds no board", async ( {
        page,
        context,
        requestUtils,
    } ) => {
        // No board open.
        const started = Date.now();
        expect( await mcp.fail( 'wfd/board-get' ) ).toBe(
            'no_board: No board is listening. Run wfd/board-open and open the address it returns in your browser. If the board is open, bring it into view, or reload it once.'
        );
        expect( Date.now() - started ).toBeLessThan( 2000 );

        // Two boards open.
        const other = await requestUtils.rest< { id: number } >( {
            method: 'POST',
            path: '/wp/v2/wfd-boards',
            data: { title: 'Second board', status: 'publish' },
        } );
        await mcp.run( 'wfd/board-open', { board: other.id } );
        const second = await context.newPage();
        const both = [ listening( page ), listening( second ) ];
        await openBoard( page, fixture.boardId );
        await openBoard( second, other.id, 0 );
        await Promise.all( both );
        const handed = handedTo( second );

        expect( await mcp.fail( 'wfd/board-get' ) ).toBe(
            `several_boards: Several boards are open: ${ fixture.boardId } "Fixture board", ${ other.id } "Second board". Pass board.`
        );

        // With board.
        const named = await mcp.run( 'wfd/board-get', { board: other.id } );
        expect( named.board ).toEqual( {
            id: other.id,
            title: 'Second board',
        } );
        await expect.poll( () => handed.length ).toBe( 1 );
        expect( handed[ 0 ].calls ).toEqual( [
            { tool: 'board-get', input: {} },
        ] );
    } );

    test( 'AC-ABIL-09 wfd/batch with three calls runs them in order and returns ok true with three envelopes. When the second fails, ok is false, the third is skipped and the first stays done. A call named wfd/board-get runs as board-get; one named boards-list fails with unknown_tool', async ( {
        page,
    } ) => {
        await openListening( page );
        const handed = handedTo( page );
        const hero = artboardOf( fixture, 'pattern' );
        const header = artboardOf( fixture, 'template-part' );
        const move = ( artboard: Artboard, x: number, y: number ) => ( {
            tool: 'artboard-update',
            input: { artboard: artboard.id, x, y },
        } );
        const placed = ( board: any ) =>
            board.artboards.find( ( a: any ) => a.id === hero.id );

        // In order: the second call moves what the first moved, and the
        // third, named with its prefix, reads the outcome.
        const all = await mcp.run( 'wfd/batch', {
            calls: [
                move( hero, 111, 222 ),
                move( hero, 333, 444 ),
                { tool: 'wfd/board-get', input: {} },
            ],
        } );
        expect( Object.keys( all ).sort() ).toEqual( [ 'ok', 'results' ] );
        expect( all.ok ).toBe( true );
        expect( all.results.map( ( one: any ) => one.ok ) ).toEqual( [
            true,
            true,
            true,
        ] );
        expect( placed( all.results[ 2 ].result ) ).toMatchObject( {
            x: 333,
            y: 444,
        } );
        // The prefix is gone before the board sees it.
        await expect.poll( () => handed.length ).toBe( 1 );
        expect( handed[ 0 ].calls.map( ( one: any ) => one.tool ) ).toEqual( [
            'artboard-update',
            'artboard-update',
            'board-get',
        ] );

        // The second of three fails.
        const mixed = await mcp.run( 'wfd/batch', {
            calls: [
                move( hero, 555, 666 ),
                {
                    tool: 'artboard-update',
                    input: { artboard: hero.id, device: 'phone' },
                },
                move( header, 777, 888 ),
            ],
        } );
        expect( mixed ).toEqual( {
            ok: false,
            results: [
                expect.objectContaining( { ok: true } ),
                {
                    ok: false,
                    error: {
                        code: 'invalid_args',
                        message:
                            'device must be one of desktop, tablet, mobile.',
                    },
                },
                {
                    ok: false,
                    error: {
                        code: 'skipped',
                        message: 'An earlier call failed.',
                    },
                },
            ],
        } );
        expect( placed( await mcp.run( 'wfd/board-get' ) ) ).toMatchObject( {
            x: 555,
            y: 666,
        } );

        // The adapter's own abilities are not tools.
        expect(
            await mcp.fail( 'wfd/batch', {
                calls: [ { tool: 'boards-list', input: {} } ],
            } )
        ).toBe( 'unknown_tool: There is no tool named boards-list.' );
    } );

    test( "AC-ABIL-10 After every ability has been run once with valid input, nothing on the site is saved: the entities' saved content, global styles and the board's layout are as before, apart from what the board itself saves with no agent", async ( {
        page,
        requestUtils,
    } ) => {
        test.setTimeout( 300000 );
        const input = valid();
        const called = new Set< string >( [ 'wfd/board-open' ] );
        const run = ( ability: string, parameters = input[ ability ] ) => {
            called.add( ability );
            return mcp.run( ability, parameters );
        };

        await run( 'wfd/boards-list' );
        await openListening( page );
        // Longer than the layout's autosave waits: the heights the board
        // measured are saved by now.
        await page.waitForTimeout( 3500 );

        // Every item of the site: the entities and the global styles.
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
            return JSON.parse( stdout )
                .map( ( post: any ) => JSON.stringify( post ) )
                .sort();
        };
        // The saved layout, without the heights, which the board measures
        // and saves with no agent.
        const layout = async () => {
            const { content } = await requestUtils.rest< { content: string } >(
                {
                    method: 'POST',
                    path: '/wfd-test/v1/board-content',
                    data: { id: fixture.boardId },
                }
            );
            const saved = JSON.parse( content );
            return {
                ...saved,
                artboards: saved.artboards
                    .map( ( { height, ...rest }: any ) => rest )
                    .sort( ( one: any, two: any ) =>
                        one.id.localeCompare( two.id )
                    ),
            };
        };
        const before = await site();
        expect( before.length ).toBeGreaterThan( 4 );
        const layoutBefore = await layout();

        const hero = artboardOf( fixture, 'pattern' );

        await run( 'wfd/board-get' );
        await run( 'wfd/board-select' );
        // What changes the layout is put back by the agent, so that what is
        // left to save is what the board saves with no agent.
        await run( 'wfd/artboard-update', {
            artboard: hero.id,
            x: hero.x + 40,
            y: hero.y + 40,
        } );
        await run( 'wfd/artboard-update' );
        const added = await run( 'wfd/artboard-add' );
        // A template part: nothing of it exists on the site until it is
        // saved from Review.
        const part = await run( 'wfd/artboard-new' );
        await run( 'wfd/artboard-edit' );
        await run( 'wfd/blocks-get' );
        await run( 'wfd/block-update' );
        await run( 'wfd/blocks-insert' );
        await run( 'wfd/blocks-move' );
        await run( 'wfd/blocks-remove' );
        // A pattern, which takes a post lock.
        await run( 'wfd/blocks-insert', {
            artboard: hero.id,
            markup: '<!-- wp:paragraph --><p>Not saved.</p><!-- /wp:paragraph -->',
        } );
        await run( 'wfd/edit-leave' );
        const styles = await run( 'wfd/styles-get' );
        await run( 'wfd/token-set' );
        await run( 'wfd/styles-set' );
        await run( 'wfd/styles-set-variation', {
            name: styles.variations[ 0 ],
        } );
        await run( 'wfd/token-show-uses', { kind: 'color', slug: 'accent-1' } );
        await run( 'wfd/token-show-uses' );
        const listed = await run( 'wfd/review-list' );
        const mine = listed.items.find(
            ( item: any ) => item.type === 'styles' && item.author === 'agent'
        );
        await run( 'wfd/review-discard', { key: mine.key } );
        await run( 'wfd/artboard-remove', {
            artboards: [ added.id, part.id ],
        } );
        await run( 'wfd/board-refresh' );
        await run( 'wfd/batch' );

        expect( [ ...called ].sort() ).toEqual( [ ...EVERY ].sort() );

        // Whatever the board saves by itself has been saved by now.
        await page.waitForTimeout( 3500 );
        expect( await site() ).toEqual( before );
        expect( await layout() ).toEqual( layoutBefore );
    } );

    test( 'AC-ABIL-11 On a site where no way in has been used, with the adapter active, wfd/boards-list leaves wfd_agent_seen absent and an open board sends no request to wfd/v1/agent in 30 seconds', async ( {
        page,
        requestUtils,
    } ) => {
        test.setTimeout( 150000 );
        expect( await relayOptions( requestUtils ) ).toEqual( {} );
        const closed = await mcp.run( 'wfd/boards-list' );
        expect( closed.boards ).toHaveLength( 1 );

        const requests: string[] = [];
        page.on( 'request', ( request ) => {
            if ( isRelay( request.url() ) ) {
                requests.push( request.url() );
            }
        } );
        await openBoard( page, fixture.boardId );
        // With the board open as well.
        expect( await mcp.run( 'wfd/boards-list' ) ).toEqual( closed );
        await page.waitForTimeout( 30000 );
        expect( requests ).toEqual( [] );
        await expect( page.locator( '[data-wfd-agent]' ) ).toHaveCount( 0 );
        expect( await relayOptions( requestUtils ) ).not.toHaveProperty(
            'wfd_agent_seen'
        );
    } );

    test( 'AC-ABIL-12 For a user without edit_theme_options, every ability is refused. With the main plugin deactivated, the discovery tool lists no ability in wfd, and WordPress shows no notice or error', async ( {
        page,
        requestUtils,
    } ) => {
        // An editor: signed in, and without the capability. The input is
        // valid, so that a refusal is for the user.
        const input = valid();
        expect( Object.keys( input ).sort() ).toEqual( [ ...EVERY ].sort() );
        const asEditor = await connect( BASE, 'wfd_editor', editor.password );
        for ( const ability of EVERY ) {
            expect(
                await asEditor.fail( ability, input[ ability ] ),
                ability
            ).toBe( 'Permission denied' );
        }
        await asEditor.close();
        // None of them ran: wfd/board-open and every call of the relay mark
        // the session before anything else.
        expect( await relayOptions( requestUtils ) ).toEqual( {} );

        // The main plugin deactivated. The MCP Adapter writes lines of its
        // own to the log for a refused call, so the log is measured from
        // here.
        const logSize = async () =>
            (
                await wp( [
                    'eval',
                    '$f = WP_CONTENT_DIR . "/debug.log"; clearstatcache(); echo file_exists( $f ) ? filesize( $f ) : 0;',
                ] )
            ).stdout.trim();
        try {
            await wp( [ 'plugin', 'deactivate', MAIN ] );
            const size = await logSize();

            const without = await connect( BASE, 'admin', admin.password );
            expect(
                ( await without.abilities() ).filter( ( ability ) =>
                    ability.name.startsWith( 'wfd/' )
                )
            ).toEqual( [] );
            await without.close();

            await page.goto( '/wp-admin/plugins.php' );
            await expect(
                page.locator(
                    ':is(.notice-error, .notice-warning, div.error):visible'
                )
            ).toHaveCount( 0 );
            expect( await logSize() ).toBe( size );
        } finally {
            await wp( [ 'plugin', 'activate', MAIN ] );
        }
    } );

    test( 'AC-ABIL-13 A call made through an ability has "source": "abilities" in its record, and wfd_agent_sources holds a time for abilities', async ( {
        page,
        requestUtils,
    } ) => {
        const from = Math.floor( Date.now() / 1000 );
        await openListening( page );

        // The record is deleted once the ability has its answer, so the
        // board's answer is held back while the record is read.
        const result = await holdBack( page, isResult );
        const answered = mcp.run( 'wfd/board-get' );
        await expect
            .poll( async () => {
                const options = await relayOptions( requestUtils );
                const [ name ] = callRecords( Object.keys( options ) );
                return options[ name ]?.source;
            } )
            .toBe( 'abilities' );
        result.release();
        await answered;

        // The site's clock and the test's are the same machine's.
        const { abilities } = ( await relayOptions( requestUtils ) )
            .wfd_agent_sources;
        expect( abilities ).toBeGreaterThanOrEqual( from - 5 );
        expect( abilities ).toBeLessThanOrEqual( Date.now() / 1000 + 5 );
    } );
} );
