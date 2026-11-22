import { execFile } from 'node:child_process';
import path from 'node:path';
import type { Page } from '@playwright/test';
import type { RequestUtils } from '@wordpress/e2e-test-utils-playwright';

export type Ran = {
    stdout: string;
    stderr: string;
    code: number;
    ms: number;
};

/**
 * Runs a WP-CLI command in the test environment's WP-CLI container, as
 * `wp-env run cli` does (spec/api-allowlist.md, Build and test tooling).
 *
 * @param args  The arguments after `wp`.
 * @param input Text for the command's standard input.
 */
export function wp( args: string[], input?: string ): Promise< Ran > {
    const started = Date.now();
    return new Promise( ( resolve ) => {
        const child = execFile(
            path.join( process.cwd(), 'node_modules/.bin/wp-env' ),
            [ 'run', 'cli', '--', 'wp', ...args ],
            { maxBuffer: 16 * 1024 * 1024 },
            ( error, stdout, stderr ) =>
                resolve( {
                    stdout,
                    stderr,
                    code: error ? Number( ( error as any ).code ) || 1 : 0,
                    ms: Date.now() - started,
                } )
        );
        if ( input !== undefined ) {
            child.stdin?.end( input );
        }
    } );
}

/**
 * Runs `wp wfd` with the given arguments.
 *
 * @param args  The arguments after `wp wfd`.
 * @param input Text for the command's standard input.
 */
export const wfd = ( args: string[], input?: string ) =>
    wp( [ 'wfd', ...args ], input );

/**
 * Runs PHP in the test site.
 *
 * @param code The code.
 */
export const php = ( code: string ) => wp( [ 'eval', code ] );

/**
 * The names of the agent relay's options on the site.
 */
export async function agentOptions(): Promise< string[] > {
    const { stdout } = await php(
        'global $wpdb; echo wp_json_encode( $wpdb->get_col( "SELECT option_name FROM $wpdb->options WHERE option_name LIKE \'wfd\\\\_agent\\\\_%\'" ) );'
    );
    return JSON.parse( stdout );
}

/**
 * Calls the agent surface's PHP functions in a web request, outside WP-CLI,
 * through the test helper plugin (spec/agent/relay.md, From PHP).
 *
 * @param requestUtils The REST helper.
 * @param data         Which function to run, and with what.
 */
const fromPhp = < T = any >(
    requestUtils: RequestUtils,
    data: object
): Promise< T > =>
    requestUtils.rest( { method: 'POST', path: '/wfd-test/v1/agent', data } );

type RelayArgs = { source: string; board?: number; timeout?: number };

/**
 * Runs `wfd_agent_relay`. It answers when the board has, or has not.
 *
 * @param requestUtils The REST helper.
 * @param calls        The entries.
 * @param args         The source, and a board or a timeout.
 */
export const relayFromPhp = (
    requestUtils: RequestUtils,
    calls: { tool: string; input: object }[],
    args: RelayArgs
) => fromPhp( requestUtils, { run: 'relay', calls, args } );

/**
 * Runs `wfd_agent_begin`.
 *
 * @param requestUtils The REST helper.
 * @param source       The label of the way in.
 */
export const beginFromPhp = ( requestUtils: RequestUtils, source: string ) =>
    fromPhp( requestUtils, { run: 'begin', source } );

/**
 * Runs `wfd_agent_boards`.
 *
 * @param requestUtils The REST helper.
 */
export const boardsFromPhp = ( requestUtils: RequestUtils ) =>
    fromPhp<
        { id: number; title: string; address: string; listening: boolean }[]
    >( requestUtils, { run: 'boards' } );

/**
 * What every option of the relay holds, by option name.
 *
 * @param requestUtils The REST helper.
 */
export const relayOptions = ( requestUtils: RequestUtils ) =>
    fromPhp< Record< string, any > >( requestUtils, { run: 'options' } );

/**
 * The names of the options that hold a call.
 *
 * @param names Option names.
 */
export const callRecords = ( names: string[] ) =>
    names.filter( ( name ) => name.startsWith( 'wfd_agent_call_' ) );

/**
 * Whether a request is one to the agent relay.
 *
 * @param url The request's URL.
 */
export const isRelay = ( url: string ) =>
    /wfd(\/|%2F)v1(\/|%2F)agent/.test( url );

export const isPoll = ( url: string ) =>
    /wfd(\/|%2F)v1(\/|%2F)agent(\/|%2F)poll/.test( url );

export const isResult = ( url: string ) =>
    /wfd(\/|%2F)v1(\/|%2F)agent(\/|%2F)result/.test( url );

/**
 * Waits until a board page has asked the relay, so the board is listening.
 *
 * @param page The board page.
 */
export const listening = ( page: Page ) =>
    page.waitForResponse(
        ( response ) => isPoll( response.url() ) && response.ok(),
        { timeout: 20000 }
    );

/**
 * The calls the relay hands to a page from now on, as its poll's answers
 * hold them.
 *
 * @param page The board page.
 */
export function handedTo( page: Page ) {
    const handed: any[] = [];
    page.on( 'response', async ( response ) => {
        if ( isPoll( response.url() ) && response.ok() ) {
            const { call } = await response.json();
            if ( call ) {
                handed.push( call );
            }
        }
    } );
    return handed;
}

/**
 * Holds a page's requests to the relay back until they are released.
 * `reached` settles when the first one is held.
 *
 * @param page      The board page.
 * @param predicate Whether a request, by its URL, is held.
 */
export async function holdBack(
    page: Page,
    predicate: ( url: string ) => boolean
) {
    let reach = () => {};
    let release = () => {};
    const reached = new Promise< void >( ( resolve ) => {
        reach = resolve;
    } );
    const released = new Promise< void >( ( resolve ) => {
        release = resolve;
    } );
    await page.route(
        ( url ) => predicate( url.href ),
        async ( route ) => {
            reach();
            await released;
            await route.continue();
        }
    );
    return { reached, release };
}

/**
 * Waits until a page shows a board.
 *
 * @param page The page.
 * @param id   The board's id.
 */
export async function showsBoard( page: Page, id: number ) {
    await page.locator( '[data-wfd-region="canvas"]' ).waitFor();
    await page.waitForFunction( ( board ) => {
        const store = ( window as any ).wp.data.select( 'wfd/board' );
        return store.isLoaded() && store.getBoardId() === board;
    }, id );
}

/**
 * Calls a tool through the page, with no relay (constraint C30).
 *
 * @param page  The board page.
 * @param name  The tool.
 * @param input Its input.
 */
export function callTool( page: Page, name: string, input: object = {} ) {
    return page.evaluate(
        async ( [ tool, args ] ) => {
            const agent = await ( window as any ).wfdAgent.ready();
            return agent.call( tool, args );
        },
        [ name, input ] as const
    );
}

/**
 * The plugin's folder name in the test site.
 */
export const PLUGIN = path.basename( process.cwd() );
