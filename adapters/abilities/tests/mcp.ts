/**
 * The stand-in for an agent (spec/acceptance.md): it speaks MCP to the MCP
 * Adapter's default server over HTTP with an application password, and does
 * no more than a client must.
 */
import { request } from '@playwright/test';

const ENDPOINT = '/wp-json/mcp/mcp-adapter-default-server';
const DISCOVER = 'mcp-adapter-discover-abilities';
const INFO = 'mcp-adapter-get-ability-info';
const EXECUTE = 'mcp-adapter-execute-ability';

/**
 * Starts a session as a WordPress user, signed in with an application
 * password.
 *
 * @param baseURL  The site's address.
 * @param user     The user's login name.
 * @param password The user's application password.
 */
export async function connect(
    baseURL: string,
    user: string,
    password: string
) {
    const context = await request.newContext( {
        baseURL,
        // The test runner would add the signed-in admin's cookies.
        storageState: { cookies: [], origins: [] },
        extraHTTPHeaders: {
            Accept: 'application/json, text/event-stream',
            Authorization:
                'Basic ' +
                Buffer.from( `${ user }:${ password }` ).toString( 'base64' ),
        },
    } );
    let session = '';
    let nextId = 1;

    const send = ( method: string, params: object, id?: number ) =>
        context.post( ENDPOINT, {
            headers: session ? { 'Mcp-Session-Id': session } : {},
            data: { jsonrpc: '2.0', method, params, id },
            timeout: 90000,
        } );

    /**
     * Calls one of the default server's tools and gives its result.
     *
     * @param tool The tool's name.
     * @param args Its arguments.
     */
    const call = async ( tool: string, args: object ) => {
        const response = await send(
            'tools/call',
            { name: tool, arguments: args },
            nextId++
        );
        const { result } = await response.json();
        if ( ! result ) {
            throw new Error( `${ tool }: ${ await response.text() }` );
        }
        return result;
    };

    /**
     * A tool's data, when it is expected to succeed.
     *
     * @param tool The tool's name.
     * @param args Its arguments.
     */
    const data = async ( tool: string, args: object ) => {
        const result = await call( tool, args );
        if ( result.isError ) {
            throw new Error(
                `${ tool } failed: ${ JSON.stringify( result ) }`
            );
        }
        return result.structuredContent;
    };

    const hello = await send(
        'initialize',
        {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: { name: 'stand-in', version: '1' },
        },
        nextId++
    );
    session = hello.headers()[ 'mcp-session-id' ];
    await send( 'notifications/initialized', {} );

    return {
        // What the discovery tool lists.
        abilities: async (): Promise<
            { name: string; label: string; description: string }[]
        > => ( await data( DISCOVER, {} ) ).abilities,

        // One ability, as the info tool gives it.
        info: ( name: string ) => data( INFO, { ability_name: name } ),

        // Runs an ability that is expected to succeed and gives its result.
        run: async ( name: string, parameters: object = {} ) =>
            ( await data( EXECUTE, { ability_name: name, parameters } ) ).data,

        // Runs an ability that is expected to fail and gives the error's text.
        fail: async (
            name: string,
            parameters: object = {}
        ): Promise< string > => {
            const result = await call( EXECUTE, {
                ability_name: name,
                parameters,
            } );
            if ( ! result.isError ) {
                throw new Error(
                    `${ name } did not fail: ${ JSON.stringify( result ) }`
                );
            }
            return result.content[ 0 ].text;
        },

        // Ends the stand-in's HTTP client.
        close: () => context.dispose(),
    };
}

export type Session = Awaited< ReturnType< typeof connect > >;
