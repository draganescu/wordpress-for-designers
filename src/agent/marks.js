/**
 * The marks: what the designer sees of the agent (spec/agent/surface.md,
 * Marks). This file says what to show; the mark slots of the shell, the
 * artboard frames and the Review cards draw it, outside the editing canvas.
 */
import { markSlots } from '../shell/seams';
import { authorsByKey, onAuthorship } from './authorship';

// How long a mark of work stays after the work ends.
const STAY = 1000;

let isSessionActive = false;
let isAnnotating = false;
let running = 0;
let lastEnded = 0;
// Artboards the calls name, each with when its mark goes; Infinity while a
// call that names it runs.
const working = new Map();
let timer = null;

function draw() {
    const now = Date.now();
    let chip = null;
    if ( running > 0 || now - lastEnded < STAY ) {
        chip = 'working';
    } else if ( isAnnotating ) {
        chip = 'annotating';
    } else if ( isSessionActive ) {
        chip = 'connected';
    }
    for ( const [ id, until ] of working ) {
        if ( until <= now ) {
            working.delete( id );
        }
    }
    const ids = [ ...working.keys() ];
    const shown = markSlots.get();
    if (
        shown.chip !== chip ||
        shown.working.length !== ids.length ||
        ids.some( ( id, index ) => shown.working[ index ] !== id )
    ) {
        markSlots.set( { chip, working: ids } );
    }
    // Drawn again when the next mark of work is due to go.
    window.clearTimeout( timer );
    const next = Math.min(
        ...[ ...working.values() ].filter( Number.isFinite ),
        running === 0 && now - lastEnded < STAY ? lastEnded + STAY : Infinity
    );
    if ( Number.isFinite( next ) ) {
        timer = window.setTimeout( draw, Math.max( 0, next - now ) + 10 );
    }
}

/**
 * A call starts.
 *
 * @param {string[]} ids The artboards the call names.
 */
export function workStarted( ids ) {
    running++;
    ids.forEach( ( id ) => working.set( id, Infinity ) );
    draw();
}

/**
 * A call ends.
 *
 * @param {string[]} ids The artboards the call named.
 */
export function workEnded( ids ) {
    running--;
    lastEnded = Date.now();
    ids.forEach( ( id ) => working.set( id, lastEnded + STAY ) );
    draw();
}

/**
 * @param {boolean} isActive Whether the last poll found a session.
 */
export function setSession( isActive ) {
    isSessionActive = isActive;
    draw();
}

/**
 * @param {boolean} isOn Whether a harness is collecting annotations.
 */
export function setAnnotating( isOn ) {
    isAnnotating = !! isOn;
    draw();
}

// Who changed what, for the artboard labels and the Review cards.
onAuthorship( () => markSlots.set( { authors: authorsByKey() } ) );
markSlots.set( { authors: authorsByKey() } );
