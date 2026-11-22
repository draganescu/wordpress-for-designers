import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import { resetFixture, openBoard, loginAs, restNonce } from './utils';
import {
    wp,
    wfd,
    php,
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
        ] );

        try {
            await wp( [ 'plugin', 'deactivate', PLUGIN ] );
            expect( await scheduled() ).toBe( false );
            expect( ( await agentOptions() ).length ).toBe( 3 );
            // The uninstall procedure alone: the files stay.
            await wp( [ 'plugin', 'uninstall', PLUGIN, '--skip-delete' ] );
            expect( await agentOptions() ).toEqual( [] );
        } finally {
            await wp( [ 'plugin', 'activate', PLUGIN ] );
        }
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
} );
