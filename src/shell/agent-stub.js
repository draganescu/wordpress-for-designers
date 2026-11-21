/**
 * The agent surface's stub (spec/agent/surface.md, Loading; constraint C27):
 * `window.wfdAgent.ready()`, and the check for a session. Everything else of
 * the surface is in `src/agent/`, a chunk requested only when a session is
 * found or `ready()` is called.
 */
import apiFetch from '@wordpress/api-fetch';
import { select } from '@wordpress/data';
import { store as boardStore } from '../board-store';

// How often the relay is asked, in ms: with no session, and during one.
const IDLE = 10000;
const ACTIVE = 1000;

let loading = null;

/**
 * Requests the surface's chunk, once.
 *
 * @return {Promise<Object>} The chunk's module.
 */
function load() {
    loading ??= import( /* webpackChunkName: "agent" */ '../agent' );
    return loading;
}

let surface = null;

/**
 * @return {Promise<Object>} The page interface, always the same promise.
 */
function ready() {
    surface ??= load().then( ( module ) => module.surface );
    return surface;
}

/**
 * Asks the relay for a session and for calls, for as long as the page lives.
 *
 * @param {Object} config The relay's routes, from the page's config.
 */
function listen( config ) {
    const client = window.crypto.randomUUID();
    let isActive = false;
    let isAsking = false;
    let timer = null;

    const wait = ( ms ) => {
        window.clearTimeout( timer );
        timer = window.setTimeout( ask, ms );
    };

    async function ask() {
        timer = null;
        // A hidden page does not ask; it asks again when it is shown.
        if ( document.hidden || isAsking ) {
            return;
        }
        const board = select( boardStore );
        if ( ! board.isLoaded() ) {
            wait( 250 );
            return;
        }
        isAsking = true;
        try {
            const answer = await apiFetch( {
                path: config.poll,
                method: 'POST',
                data: {
                    board: board.getBoardId(),
                    client,
                    title: board.getTitle(),
                },
            } );
            if ( answer.active || answer.call || isActive ) {
                const { relay } = await load();
                await relay( answer, ( results ) =>
                    apiFetch( {
                        path: config.send,
                        method: 'POST',
                        data: { id: answer.call.id, client, results },
                    } )
                );
            }
            isActive = !! answer.active;
        } catch {
            // The relay could not be reached: it is asked again in turn.
        }
        isAsking = false;
        wait( isActive ? ACTIVE : IDLE );
    }

    document.addEventListener( 'visibilitychange', () => {
        if ( ! document.hidden && ! timer ) {
            ask();
        }
    } );
    ask();
}

/**
 * Puts `window.wfdAgent` on the page and, on a site an agent has used,
 * starts asking the relay.
 */
export function startAgentStub() {
    window.wfdAgent = { ready };
    const config = window.wfdConfig.agent;
    if ( config?.seen ) {
        listen( config );
    }
}
