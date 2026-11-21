/**
 * Authorship: who made each unsaved change (spec/agent/surface.md,
 * Authorship). The unit is a Review item. An item is the agent's when its
 * edits changed during a tool call, the designer's when they changed at any
 * other time, and both when both have changed it. The record is kept in the
 * page, for as long as the unsaved edits.
 */
import { subscribe } from '@wordpress/data';
import { actions } from './board';

// How long after a call that works in an editor ends a change still counts
// as the call's: what a block does to itself once it is drawn comes a moment
// after the tool.
const GRACE = 1000;

const authors = new Map();
// Records of items that are no longer unsaved, for an undo that brings one
// back.
const shelved = new Map();
let marks = new Map();
let calls = 0;
let graceUntil = 0;
const listeners = new Set();

const isAgentNow = () => calls > 0 || Date.now() < graceUntil;

function attribute( key ) {
    const who = isAgentNow() ? 'agent' : 'you';
    const had = authors.get( key );
    authors.set( key, had && had !== who ? 'both' : who );
}

/**
 * Compares the unsaved items with what they were and records who changed
 * each.
 */
function check() {
    const seam = actions();
    if ( ! seam ) {
        return;
    }
    const now = new Map( seam.changeMarks() );
    const isStep = seam.isHistoryStep();
    let hasChanged = false;
    for ( const [ key, edits ] of now ) {
        if ( ! marks.has( key ) ) {
            // New, or brought back by an undo or a redo.
            if ( isStep && shelved.has( key ) ) {
                authors.set( key, shelved.get( key ) );
            } else {
                authors.delete( key );
                attribute( key );
            }
            shelved.delete( key );
            hasChanged = true;
        } else if ( marks.get( key ) !== edits && ! isStep ) {
            // Undoing a change does not change who is recorded.
            const before = authors.get( key );
            attribute( key );
            hasChanged = hasChanged || authors.get( key ) !== before;
        }
    }
    for ( const key of marks.keys() ) {
        if ( ! now.has( key ) ) {
            // Saved, discarded or undone: forgotten.
            if ( authors.has( key ) ) {
                shelved.set( key, authors.get( key ) );
            }
            authors.delete( key );
            hasChanged = true;
        }
    }
    marks = now;
    if ( hasChanged ) {
        listeners.forEach( ( listener ) => listener() );
    }
}

let isStarted = false;

/**
 * Starts recording. What is unsaved already was changed before any call.
 */
export function startAuthorship() {
    if ( isStarted ) {
        return;
    }
    isStarted = true;
    check();
    subscribe( check );
}

/**
 * Marks the start of a tool call.
 */
export function beginCall() {
    check();
    calls++;
}

/**
 * Marks the end of a tool call.
 *
 * @param {boolean} inEditor Whether the tool worked in an editor.
 */
export function endCall( inEditor ) {
    check();
    calls--;
    if ( inEditor ) {
        graceUntil = Date.now() + GRACE;
    }
}

/**
 * @param {string|null} key A Review item's key.
 * @return {string|undefined} 'agent', 'you' or 'both'; nothing when the item
 *                            has no unsaved change.
 */
export const authorOf = ( key ) => ( key ? authors.get( key ) : undefined );

/**
 * @return {Object} Every record, by Review key.
 */
export const authorsByKey = () => Object.fromEntries( authors );

/**
 * @param {Object} artboard An artboard.
 * @return {string|undefined} Who changed the item it shows.
 */
export const changedOf = ( artboard ) =>
    authorOf( actions().itemKeyOf( artboard ) );

/**
 * @param {Function} listener Called when a record changes.
 * @return {Function} Unsubscribes.
 */
export function onAuthorship( listener ) {
    listeners.add( listener );
    return () => listeners.delete( listener );
}
