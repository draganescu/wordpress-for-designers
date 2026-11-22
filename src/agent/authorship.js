/**
 * Authorship: who made each unsaved change (spec/agent/surface.md,
 * Authorship). The unit is a Review item. An item is the agent's when its
 * edits changed during a tool call, or within a second after a tool that
 * changed it and before the designer acted there (D81); the designer's when
 * they changed at any other time; and both when both have changed it. The
 * record is kept in the page, for as long as the unsaved edits.
 */
import { subscribe } from '@wordpress/data';
import { frameOf } from '../artboard-frame/rects';
import { actions } from './board';
import { editor } from './edit';

// How long after a tool that changed an item a change to that item still
// counts as the tool's: a block the tool has just changed can go on changing
// itself for a moment, as an inserted block does when it is first drawn
// (decision D81).
const SECOND = 1000;

const authors = new Map();
// Records of items that are no longer unsaved, for an undo that brings one
// back.
const shelved = new Map();
let marks = new Map();
let calls = 0;
// The items the running call has changed.
const touched = new Set();
// The items a call that has ended changed, each with when its second is
// over. The designer's first key or pointer press ends them all.
const seconds = new Map();
let stopWatching = null;
const listeners = new Set();

const isAgents = ( key ) => calls > 0 || seconds.get( key ) > Date.now();

function attribute( key ) {
    const who = isAgents( key ) ? 'agent' : 'you';
    if ( calls > 0 ) {
        touched.add( key );
    }
    const had = authors.get( key );
    authors.set( key, had && had !== who ? 'both' : who );
}

/**
 * The second is over: the designer has pressed a key or a pointer button in
 * the artboard in edit or in its chrome, or the time has passed.
 */
function endSeconds() {
    seconds.clear();
    stopWatching?.();
    stopWatching = null;
}

/**
 * Watches for the designer's first key or pointer press in the artboard in
 * edit or in its chrome, while a second is running.
 */
function watchDesigner() {
    // A watch started by an earlier call is on the editor that was in edit
    // then, and ends when that call's second does: start again for this one.
    stopWatching?.();
    const liveId = editor()?.liveId();
    const onPress = ( event ) => {
        // WordPress copies the canvas's events onto its iframe element;
        // the designer's own are the trusted ones.
        if ( ! event.isTrusted ) {
            return;
        }
        // Another artboard or a note is neither that artboard nor its
        // chrome.
        const other = event.target.closest?.(
            '[data-wfd-artboard], [data-wfd-note]'
        );
        if ( other && other.getAttribute( 'data-wfd-artboard' ) !== liveId ) {
            return;
        }
        endSeconds();
    };
    const documents = [ document ];
    const canvas = liveId ? frameOf( liveId ).document : null;
    if ( canvas ) {
        documents.push( canvas );
    }
    for ( const doc of documents ) {
        doc.addEventListener( 'keydown', onPress, true );
        doc.addEventListener( 'pointerdown', onPress, true );
    }
    const timer = window.setTimeout( endSeconds, SECOND );
    stopWatching = () => {
        window.clearTimeout( timer );
        for ( const doc of documents ) {
            doc.removeEventListener( 'keydown', onPress, true );
            doc.removeEventListener( 'pointerdown', onPress, true );
        }
    };
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
    touched.clear();
    calls++;
}

/**
 * Marks the end of a tool call. The items it changed have a second in which
 * a change to them is still the agent's; a call that changed nothing starts
 * none.
 */
export function endCall() {
    check();
    calls--;
    if ( touched.size ) {
        const until = Date.now() + SECOND;
        touched.forEach( ( key ) => seconds.set( key, until ) );
        touched.clear();
        watchDesigner();
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
