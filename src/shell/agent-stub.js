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
// The pause before a failed send of results is tried again, in ms.
const RETRY = 1000;

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
 * Sends a call's results, trying again after a failed send for as long as
 * the command can still be waiting for them (spec/agent/relay.md).
 *
 * @param {Object} config   The relay's routes.
 * @param {Object} data     The body: `id`, `client` and `results`.
 * @param {number} deadline When the command stops waiting, in ms.
 */
async function sendResults( config, data, deadline ) {
    for (;;) {
        try {
            await apiFetch( { path: config.send, method: 'POST', data } );
            return;
        } catch {
            if ( Date.now() + RETRY > deadline ) {
                return;
            }
            await new Promise( ( resolve ) =>
                window.setTimeout( resolve, RETRY )
            );
        }
    }
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
        let answer = null;
        try {
            answer = await apiFetch( {
                path: config.poll,
                method: 'POST',
                data: {
                    board: board.getBoardId(),
                    client,
                    title: board.getTitle(),
                },
            } );
        } catch {
            // The relay could not be reached: it is asked again in turn,
            // and until a poll succeeds the board does not show a session.
            if ( loading ) {
                await load().then(
                    ( { relay } ) => relay( { active: false, call: null } ),
                    () => {}
                );
            }
        }
        if ( answer ) {
            const received = Date.now();
            try {
                if ( answer.active || answer.call || isActive ) {
                    const { relay } = await load();
                    await relay(
                        answer,
                        ( results, deadline ) =>
                            sendResults(
                                config,
                                { id: answer.call.id, client, results },
                                deadline
                            ),
                        received
                    );
                }
            } catch {
                // The surface could not be loaded: it is tried again in
                // turn.
            }
            isActive = !! answer.active;
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
