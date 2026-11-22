import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import {
    resetFixture,
    openBoard,
    loginAs,
    restNonce,
    boardAtRest,
    artboardOf,
    BOARDS_URL,
} from './utils';
import type { Artboard } from './utils';
import {
    wp,
    wfd,
    php,
    relayFromPhp,
    beginFromPhp,
    boardsFromPhp,
    relayOptions,
    callRecords,
    handedTo,
    holdBack,
    showsBoard,
    callTool,
    agentOptions,
    isRelay,
    isPoll,
    isResult,
    listening,
    PLUGIN,
} from './agent-utils';

const isChunk = ( url: string ) => /\/build\/agent\.js/.test( url );

test.describe( 'AGENT', () => {
    test( 'AC-AGENT-01 A site no agent has used sends nothing to the relay and loads no chunk', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        const seen: string[] = [];
        page.on( 'request', ( request ) => {
            if ( isRelay( request.url() ) || isChunk( request.url() ) ) {
                seen.push( request.url() );
            }
        } );
        await openBoard( page, fixture.boardId );
        await page.waitForTimeout( 30000 );
        expect( seen ).toEqual( [] );
        await expect( page.locator( '[data-wfd-agent]' ) ).toHaveCount( 0 );
        expect(
            await page.evaluate( () =>
                Object.keys( ( window as any ).wfdAgent )
            )
        ).toEqual( [ 'ready' ] );
    } );

    test( 'AC-AGENT-02 After a command the board loads the chunk and asks every second, then every 10 seconds, and not while hidden', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        expect( ( await wfd( [ 'status' ] ) ).code ).toBe( 0 );
        const polls: number[] = [];
        page.on( 'request', ( request ) => {
            if ( isPoll( request.url() ) ) {
                polls.push( Date.now() );
            }
        } );
        const chunk = page.waitForRequest(
            ( request ) => isChunk( request.url() ),
            { timeout: 15000 }
        );
        await openBoard( page, fixture.boardId );
        await chunk;

        // During the session: every second.
        const countFor = async ( ms: number ) => {
            const from = Date.now();
            await page.waitForTimeout( ms );
            return polls.filter( ( at ) => at >= from ).length;
        };
        const active = await countFor( 5000 );
        expect( active ).toBeGreaterThanOrEqual( 3 );
        expect( active ).toBeLessThanOrEqual( 6 );

        // Hidden: it does not ask.
        await page.evaluate( () => {
            Object.defineProperty( document, 'hidden', {
                configurable: true,
                get: () => true,
            } );
            document.dispatchEvent( new Event( 'visibilitychange' ) );
        } );
        await page.waitForTimeout( 1500 );
        expect( await countFor( 4000 ) ).toBe( 0 );
        await page.evaluate( () => {
            Object.defineProperty( document, 'hidden', {
                configurable: true,
                get: () => false,
            } );
            document.dispatchEvent( new Event( 'visibilitychange' ) );
        } );
        expect( await countFor( 3000 ) ).toBeGreaterThanOrEqual( 2 );

        // The session ends: every 10 seconds again.
        const ended = page.waitForResponse( async ( response ) => {
            if ( ! isPoll( response.url() ) ) {
                return false;
            }
            return ( await response.json() ).active === false;
        } );
        await php( 'update_option( "wfd_agent_seen", time() - 500, false );' );
        await ended;
        const idle = await countFor( 12000 );
        expect( idle ).toBeGreaterThanOrEqual( 1 );
        expect( idle ).toBeLessThanOrEqual( 2 );
    } );

    test( 'AC-AGENT-03 status lists listening boards once, and gives the hint with none', async ( {
        page,
        context,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        const none = await wfd( [ 'status' ] );
        expect( none.code ).toBe( 0 );
        const empty = JSON.parse( none.stdout );
        expect( empty.boards ).toEqual( [] );
        expect( empty.hint ).toBe(
            'No board is listening. Open a board in WordPress for Designers; if one is open, reload it once.'
        );
        expect( typeof empty.plugin ).toBe( 'string' );

        const second = await context.newPage();
        const both = [ listening( page ), listening( second ) ];
        await openBoard( page, fixture.boardId );
        await openBoard( second, fixture.boardId );
        await Promise.all( both );
        const two = await wfd( [ 'status' ] );
        expect( two.code ).toBe( 0 );
        const status = JSON.parse( two.stdout );
        expect( status.boards ).toEqual( [
            { id: fixture.boardId, title: 'Fixture board' },
        ] );
        expect( status ).not.toHaveProperty( 'hint' );
    } );

    test( 'AC-AGENT-04 call board-get prints an ok envelope and leaves no call option', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await wfd( [ 'status' ] );
        const asked = listening( page );
        await openBoard( page, fixture.boardId );
        await asked;
        const ran = await wfd( [ 'call', 'board-get' ] );
        expect( ran.code ).toBe( 0 );
        const envelope = JSON.parse( ran.stdout );
        expect( envelope.ok ).toBe( true );
        expect(
            envelope.result.artboards.map( ( a: any ) => a.id ).sort()
        ).toEqual( fixture.layout.artboards.map( ( a ) => a.id ).sort() );
        expect(
            ( await agentOptions() ).filter( ( name ) =>
                name.startsWith( 'wfd_agent_call_' )
            )
        ).toEqual( [] );
    } );

    test( 'AC-AGENT-05 Two boards open: several_boards names both, and --board picks one', async ( {
        page,
        context,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        const other = await requestUtils.rest< { id: number } >( {
            method: 'POST',
            path: '/wp/v2/wfd-boards',
            data: { title: 'Second board', status: 'publish' },
        } );
        await wfd( [ 'status' ] );
        const second = await context.newPage();
        const both = [ listening( page ), listening( second ) ];
        await openBoard( page, fixture.boardId );
        await openBoard( second, other.id, 0 );
        await Promise.all( both );

        const several = await wfd( [ 'call', 'board-get' ] );
        expect( several.code ).toBe( 1 );
        const [ low, high ] = [ fixture.boardId, other.id ].sort(
            ( a, b ) => a - b
        );
        const titles: Record< number, string > = {
            [ fixture.boardId ]: 'Fixture board',
            [ other.id ]: 'Second board',
        };
        expect( JSON.parse( several.stdout ) ).toEqual( {
            ok: false,
            error: {
                code: 'several_boards',
                message: `Several boards are open: ${ low } "${ titles[ low ] }", ${ high } "${ titles[ high ] }". Pass --board=<id>.`,
            },
        } );

        const named = await wfd( [
            'call',
            'board-get',
            `--board=${ other.id }`,
        ] );
        expect( named.code ).toBe( 0 );
        expect( JSON.parse( named.stdout ).result.board ).toEqual( {
            id: other.id,
            title: 'Second board',
        } );
    } );

    test( 'AC-AGENT-06 No board: no_board at once. A closed page: timeout, and the option is gone', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        const none = await wfd( [ 'call', 'board-get' ] );
        expect( none.code ).toBe( 1 );
        expect( JSON.parse( none.stdout ).error ).toEqual( {
            code: 'no_board',
            message:
                'No board is listening. Open a board in WordPress for Designers; if one is open, reload it once.',
        } );
        expect( none.ms ).toBeLessThan( 2000 );

        const asked = listening( page );
        await openBoard( page, fixture.boardId );
        await asked;
        await page.goto( 'about:blank' );
        const late = await wfd( [ 'call', 'board-get', '--timeout=2' ] );
        expect( late.code ).toBe( 1 );
        expect( JSON.parse( late.stdout ).error ).toEqual( {
            code: 'timeout',
            message: 'The board did not answer within 2 seconds.',
        } );
        expect(
            ( await agentOptions() ).filter( ( name ) =>
                name.startsWith( 'wfd_agent_call_' )
            )
        ).toEqual( [] );
    } );

    test( 'AC-AGENT-07 An editor gets a permission error from both relay routes', async ( {
        browser,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        const page = await loginAs( browser, 'wfd_editor' );
        const headers = { 'X-WP-Nonce': await restNonce( page ) };
        const client = '11111111-2222-4333-8444-555555555555';
        const poll = await page.request.post(
            '/?rest_route=/wfd/v1/agent/poll',
            {
                headers,
                data: { board: fixture.boardId, client, title: 'x' },
            }
        );
        expect( poll.status() ).toBe( 403 );
        const result = await page.request.post(
            '/?rest_route=/wfd/v1/agent/result',
            { headers, data: { id: client, client, results: [] } }
        );
        expect( result.status() ).toBe( 403 );
        expect( await agentOptions() ).toEqual( [] );
        await page.context().close();
    } );

    test( 'AC-AGENT-08 Cleanup deletes what is old, deactivation unschedules it, uninstall deletes every option', async ( {
        requestUtils,
    } ) => {
        await resetFixture( requestUtils );
        await wfd( [ 'status' ] );
        const record = ( name: string, value: object ) =>
            `add_option( "${ name }", wp_json_encode( json_decode( '${ JSON.stringify(
                value
            ) }' ) ), "", false );`;
        const now = Math.floor( Date.now() / 1000 );
        await php(
            [
                record( 'wfd_agent_call_old', {
                    id: 'old',
                    board: 1,
                    calls: [],
                    status: 'running',
                    created: now - 400,
                    expires: now - 100,
                } ),
                record( 'wfd_agent_call_fresh', {
                    id: 'fresh',
                    board: 1,
                    calls: [],
                    status: 'queued',
                    created: now,
                    expires: now + 300,
                } ),
                record( 'wfd_agent_listener_old', {
                    board: 1,
                    title: 'x',
                    seen: now - 100,
                } ),
                record( 'wfd_agent_listener_fresh', {
                    board: 1,
                    title: 'x',
                    seen: now,
                } ),
            ].join( ' ' )
        );
        const scheduled = async () =>
            (
                await wp( [ 'cron', 'event', 'list', '--field=hook' ] )
            ).stdout.includes( 'wfd_agent_cleanup' );
        expect( await scheduled() ).toBe( true );
        await wp( [ 'cron', 'event', 'run', 'wfd_agent_cleanup' ] );
        expect( ( await agentOptions() ).sort() ).toEqual( [
            'wfd_agent_call_fresh',
            'wfd_agent_listener_fresh',
            'wfd_agent_seen',
            'wfd_agent_sources',
        ] );

        try {
            await wp( [ 'plugin', 'deactivate', PLUGIN ] );
            expect( await scheduled() ).toBe( false );
            expect( ( await agentOptions() ).length ).toBe( 4 );
            // The uninstall procedure alone: the files stay.
            await wp( [ 'plugin', 'uninstall', PLUGIN, '--skip-delete' ] );
            expect( await agentOptions() ).toEqual( [] );
        } finally {
            await wp( [ 'plugin', 'activate', PLUGIN ] );
        }
    } );

    test( 'AC-AGENT-10 A batch that outlasts its timeout starts no later entry, a failed send of results is tried again, and a failed poll ends the session mark until one succeeds', async ( {
        page,
        requestUtils,
    } ) => {
        test.setTimeout( 120000 );
        const fixture = await resetFixture( requestUtils );
        await wfd( [ 'status' ] );
        const sent: any[] = [];
        page.on( 'request', ( request ) => {
            if ( isResult( request.url() ) ) {
                sent.push( request.postDataJSON() );
            }
        } );
        const asked = listening( page );
        await openBoard( page, fixture.boardId );
        await asked;
        const about = fixture.layout.artboards.find(
            ( a: any ) => a.entityId === fixture.pages.about
        )!;
        const selected = () =>
            page.evaluate( () =>
                ( window as any ).wp.data.select( 'wfd/board' ).getSelectedIds()
            );
        expect( await selected() ).toEqual( [] );

        // The first entry is held back past the command's timeout: its
        // requests answer after 5 seconds.
        const pages = /wp(\/|%2F)v2(\/|%2F)pages/;
        await page.route( pages, async ( route ) => {
            await new Promise( ( resolve ) => setTimeout( resolve, 5000 ) );
            await route.continue().catch( () => {} );
        } );
        const ran = await wfd(
            [ 'batch', '--timeout=3' ],
            JSON.stringify( [
                { tool: 'board-refresh', input: {} },
                { tool: 'board-select', input: { artboards: [ about.id ] } },
            ] )
        );
        expect( ran.code ).toBe( 1 );
        expect( JSON.parse( ran.stdout ).error ).toEqual( {
            code: 'timeout',
            message: 'The board did not answer within 3 seconds.',
        } );
        // On the board the running entry finishes, and the next is not
        // started.
        await expect.poll( () => sent.length, { timeout: 15000 } ).toBe( 1 );
        expect( sent[ 0 ].results ).toEqual( [
            { ok: true, result: { refreshed: true } },
            {
                ok: false,
                error: {
                    code: 'skipped',
                    message: 'The call ran out of time.',
                },
            },
        ] );
        expect( await selected() ).toEqual( [] );
        await page.unroute( pages );

        // A send of results that fails is tried again.
        let failures = 0;
        const resultUrl = ( url: URL ) => isResult( url.href );
        await page.route( resultUrl, async ( route ) => {
            if ( failures++ === 0 ) {
                await route.fulfill( { status: 500, body: '{}' } );
                return;
            }
            await route.continue();
        } );
        const before = sent.length;
        const answered = await wfd( [ 'call', 'board-get' ] );
        expect( answered.code ).toBe( 0 );
        expect( JSON.parse( answered.stdout ).ok ).toBe( true );
        expect( sent.length - before ).toBe( 2 );
        await page.unroute( resultUrl );

        // A poll that fails ends the session's mark until one succeeds.
        const chip = page.locator( '[data-wfd-agent]' );
        await expect( chip ).toHaveCount( 1 );
        const pollUrl = ( url: URL ) => isPoll( url.href );
        await page.route( pollUrl, ( route ) =>
            route.fulfill( { status: 500, body: '{}' } )
        );
        await expect( chip ).toHaveCount( 0, { timeout: 5000 } );
        await page.waitForTimeout( 2500 );
        await expect( chip ).toHaveCount( 0 );
        await page.unroute( pollUrl );
        await expect( chip ).toHaveCount( 1, { timeout: 5000 } );
    } );

    test( 'AC-AGENT-09 With a board open in two pages a call is handed to one page only', async ( {
        page,
        context,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await wfd( [ 'status' ] );
        const second = await context.newPage();
        const results: string[] = [];
        for ( const [ name, one ] of [
            [ 'first', page ],
            [ 'second', second ],
        ] as const ) {
            one.on( 'request', ( request ) => {
                if ( isResult( request.url() ) ) {
                    results.push( name );
                }
            } );
        }
        const both = [ listening( page ), listening( second ) ];
        await openBoard( page, fixture.boardId );
        await openBoard( second, fixture.boardId );
        await Promise.all( both );
        for ( let i = 0; i < 3; i++ ) {
            const before = results.length;
            const ran = await wfd( [ 'call', 'board-get' ] );
            expect( ran.code ).toBe( 0 );
            const lines = ran.stdout.trim().split( '\n' );
            expect( lines ).toHaveLength( 1 );
            expect( JSON.parse( lines[ 0 ] ).ok ).toBe( true );
            await page.waitForTimeout( 1200 );
            expect( results.length - before ).toBe( 1 );
        }
    } );

    test( 'AC-AGENT-11 wfd_agent_relay, called in a web request, answers for the board and leaves no call option, fails with no_board at once, and writes no record for a tool that is not declared', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        const boardGet = [ { tool: 'board-get', input: {} } ];
        const records = async () =>
            callRecords( Object.keys( await relayOptions( requestUtils ) ) );

        // No board open: no_board, at once.
        const started = Date.now();
        const none = await relayFromPhp( requestUtils, boardGet, {
            source: 'test',
        } );
        expect( Date.now() - started ).toBeLessThan( 2000 );
        expect( none ).toMatchObject( {
            ok: false,
            error: { code: 'no_board' },
        } );

        const handed = handedTo( page );
        // That call was a use of a way in, so the board asks.
        const asked = listening( page );
        await openBoard( page, fixture.boardId );
        await asked;

        const answered = await relayFromPhp( requestUtils, boardGet, {
            source: 'test',
        } );
        expect( answered ).toMatchObject( {
            ok: true,
            results: [ { ok: true } ],
        } );
        expect( answered.results ).toHaveLength( 1 );
        expect(
            answered.results[ 0 ].result.artboards
                .map( ( a: any ) => a.id )
                .sort()
        ).toEqual( fixture.layout.artboards.map( ( a ) => a.id ).sort() );
        expect( await records() ).toEqual( [] );
        await expect.poll( () => handed.length ).toBe( 1 );

        // A tool that is not declared: no record, so nothing for the board.
        const unknown = await relayFromPhp(
            requestUtils,
            [ { tool: 'nothing-here', input: {} } ],
            { source: 'test' }
        );
        expect( unknown ).toMatchObject( {
            ok: false,
            error: { code: 'unknown_tool' },
        } );
        expect( await records() ).toEqual( [] );
        await page.waitForTimeout( 2500 );
        expect( handed ).toHaveLength( 1 );
    } );

    test( 'AC-AGENT-12 After wfd_agent_begin a board that is then opened asks within 2 seconds, loads the chunk and shows G1, and the Boards screen and the dashboard send nothing to the relay', async ( {
        page,
        context,
        requestUtils,
    } ) => {
        test.setTimeout( 120000 );
        const fixture = await resetFixture( requestUtils );
        // No way in has been used.
        expect( await relayOptions( requestUtils ) ).toEqual( {} );
        await beginFromPhp( requestUtils, 'test' );

        let polledAt = 0;
        page.on( 'request', ( request ) => {
            if ( isPoll( request.url() ) && ! polledAt ) {
                polledAt = Date.now();
            }
        } );
        const chunk = page.waitForRequest(
            ( request ) => isChunk( request.url() ),
            { timeout: 15000 }
        );
        await openBoard( page, fixture.boardId );
        const loadedAt = Date.now();
        await expect
            .poll( () => polledAt, { timeout: 10000 } )
            .toBeGreaterThan( 0 );
        expect( polledAt - loadedAt ).toBeLessThan( 2000 );
        await chunk;
        const chip = page.locator( '[data-wfd-agent]' );
        await expect( chip ).toHaveAttribute( 'data-wfd-agent', 'connected' );
        await expect( chip ).toHaveText( 'Agent connected' );

        // The Boards screen and the dashboard, open for 30 seconds of a
        // session.
        await beginFromPhp( requestUtils, 'test' );
        const sent: string[] = [];
        for ( const url of [ BOARDS_URL, '/wp-admin/index.php' ] ) {
            const other = await context.newPage();
            other.on( 'request', ( request ) => {
                if ( isRelay( request.url() ) ) {
                    sent.push( `${ url }: ${ request.url() }` );
                }
            } );
            await other.goto( url );
        }
        await page.waitForTimeout( 30000 );
        expect( sent ).toEqual( [] );
        // The session was active to the end: the board is still told so.
        const still = await page.waitForResponse(
            ( response ) => isPoll( response.url() ) && response.ok()
        );
        expect( ( await still.json() ).active ).toBe( true );
    } );

    test( 'AC-AGENT-13 A call record holds its source while queued, wfd_agent_sources and the poll list each way in used, and G1, G2 and authorship are the same for a call from either', async ( {
        page,
        requestUtils,
    } ) => {
        test.setTimeout( 180000 );
        const fixture = await resetFixture( requestUtils );
        const from = Math.floor( Date.now() / 1000 );
        await beginFromPhp( requestUtils, 'test' );
        const asked = listening( page );
        await openBoard( page, fixture.boardId );
        await asked;
        await boardAtRest( page );

        // The board's polls are held back, so that the call stays queued
        // while its record is read.
        const polls = await holdBack( page, isPoll );
        await polls.reached;
        // The function waits for the board, so it is not waited for here.
        const answer = relayFromPhp(
            requestUtils,
            [ { tool: 'board-get', input: {} } ],
            { source: 'test' }
        );
        let record: any;
        await expect
            .poll( async () => {
                const options = await relayOptions( requestUtils );
                record = options[ callRecords( Object.keys( options ) )[ 0 ] ];
                return record?.status;
            } )
            .toBe( 'queued' );
        polls.release();
        expect( record.source ).toBe( 'test' );
        expect( ( await answer ).ok ).toBe( true );

        // Afterwards: a time for `test`, and after a command one for `cli`.
        const first = ( await relayOptions( requestUtils ) ).wfd_agent_sources;
        expect( Object.keys( first ) ).toEqual( [ 'test' ] );
        expect( ( await wfd( [ 'status' ] ) ).code ).toBe( 0 );
        const second = ( await relayOptions( requestUtils ) ).wfd_agent_sources;
        // The site's clock and the test's are the same machine's.
        const now = Math.floor( Date.now() / 1000 );
        for ( const source of [ 'test', 'cli' ] ) {
            expect( second[ source ] ).toBeGreaterThanOrEqual( from - 5 );
            expect( second[ source ] ).toBeLessThanOrEqual( now + 5 );
        }
        const listed = await page.waitForResponse(
            async ( response ) =>
                isPoll( response.url() ) &&
                response.ok() &&
                !! ( await response.json() ).sources?.includes( 'cli' ),
            { timeout: 15000 }
        );
        expect( [ ...( await listed.json() ).sources ].sort() ).toEqual( [
            'cli',
            'test',
        ] );

        // What a change to an artboard's first text shows, made by one way
        // in: G1 and G2 while the board's answer is held back, and who the
        // change is recorded as having made.
        const chip = page.locator( '[data-wfd-agent]' );
        const shows = async (
            artboard: Artboard,
            change: () => Promise< boolean >
        ) => {
            const frame = page.locator(
                `[data-wfd-artboard="${ artboard.id }"]`
            );
            const result = await holdBack( page, isResult );
            const made = change();
            await result.reached;
            const during = {
                chip: await chip.getAttribute( 'data-wfd-agent' ),
                working: await frame.getAttribute( 'data-wfd-agent-working' ),
            };
            result.release();
            expect( await made ).toBe( true );
            const { items } = ( await callTool( page, 'review-list' ) ).result;
            return {
                ...during,
                changed: await frame.getAttribute( 'data-wfd-agent-changed' ),
                author: items.find(
                    ( item: any ) => item.type === artboard.kind
                ).author,
            };
        };

        const header = artboardOf( fixture, 'template-part' );
        const hero = artboardOf( fixture, 'pattern' );
        const fromTest = await shows( header, async () => {
            const made = await relayFromPhp(
                requestUtils,
                [
                    {
                        tool: 'block-update',
                        input: {
                            artboard: header.id,
                            block: [ 0, 0 ],
                            attributes: { content: 'From PHP' },
                        },
                    },
                ],
                { source: 'test' }
            );
            return made.ok && made.results[ 0 ].ok;
        } );
        const fromCli = await shows( hero, async () => {
            const made = await wfd( [
                'call',
                'block-update',
                `--artboard=${ hero.id }`,
                '--block=[0]',
                '--attributes={"content":"From the command"}',
            ] );
            return made.code === 0 && JSON.parse( made.stdout ).ok;
        } );
        expect( fromTest ).toEqual( {
            chip: 'working',
            working: 'true',
            changed: 'true',
            author: 'agent',
        } );
        expect( fromCli ).toEqual( fromTest );
    } );

    test( 'AC-AGENT-14 wfd_agent_boards lists every published board with its id, title and address, listening only for a board open in a page, and marks no session', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        const other = await requestUtils.rest< { id: number } >( {
            method: 'POST',
            path: '/wp/v2/wfd-boards',
            data: { title: 'Second board', status: 'publish' },
        } );
        const expected = ( open: number[] ) =>
            [
                { id: fixture.boardId, title: 'Fixture board' },
                { id: other.id, title: 'Second board' },
            ].map( ( board ) => ( {
                ...board,
                address: expect.any( String ),
                listening: open.includes( board.id ),
            } ) );

        // On a site where no way in has been used, and it stays one.
        const boards = await boardsFromPhp( requestUtils );
        expect( boards ).toEqual( expected( [] ) );
        expect( await relayOptions( requestUtils ) ).not.toHaveProperty(
            'wfd_agent_seen'
        );

        // Each address opens its board.
        for ( const board of boards ) {
            await page.goto( board.address );
            await showsBoard( page, board.id );
        }

        // Listening: only the board that is open in a page.
        await beginFromPhp( requestUtils, 'test' );
        const asked = listening( page );
        await openBoard( page, fixture.boardId );
        await asked;
        expect( await boardsFromPhp( requestUtils ) ).toEqual(
            expected( [ fixture.boardId ] )
        );
    } );
} );
