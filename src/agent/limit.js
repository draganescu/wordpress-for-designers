/**
 * The one safety limit of a tool's waits (spec/agent/tools.md, Settling;
 * decisions D82 and D90).
 */
import { unavailable } from './errors';

// The limit, in ms.
export const LIMIT = 10000;

/**
 * Waits for something the board does, for as long as the safety limit.
 * A wait that has not ended by then is `unavailable`, so that no call keeps
 * the queue of calls from moving (D90).
 *
 * @param {Promise} promise What the tool waits for.
 * @return {Promise} Settles as it does, or rejects at the limit.
 */
export function withinLimit( promise ) {
    let timer = null;
    const limit = new Promise( ( resolve, reject ) => {
        timer = window.setTimeout( () => reject( unavailable() ), LIMIT );
    } );
    return Promise.race( [ promise, limit ] ).finally( () =>
        window.clearTimeout( timer )
    );
}

/**
 * Lets the board draw what the stores hold now: the next animation frame,
 * or a short timer when no frame comes, as in a hidden tab, which never
 * draws one.
 *
 * @return {Promise<void>} Resolves after the next frame, or the timer.
 */
export const nextFrame = () =>
    new Promise( ( resolve ) => {
        let isDone = false;
        let frame = 0;
        let timer = 0;
        const done = () => {
            if ( isDone ) {
                return;
            }
            isDone = true;
            window.cancelAnimationFrame( frame );
            window.clearTimeout( timer );
            window.setTimeout( resolve, 0 );
        };
        if ( ! document.hidden ) {
            frame = window.requestAnimationFrame( done );
        }
        timer = window.setTimeout( done, 50 );
    } );
