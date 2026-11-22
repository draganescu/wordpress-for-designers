import { execFile } from 'node:child_process';
import path from 'node:path';
import type { Page } from '@playwright/test';

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
