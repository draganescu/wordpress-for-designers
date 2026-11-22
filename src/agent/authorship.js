/**
 * Authorship: who made each unsaved change (spec/agent/surface.md,
 * Authorship). The unit is a Review item. An item is the agent's when its
 * edits changed during a tool call, or within a second after a tool that
 * changed it and before the designer acted there (D81); the designer's when
 * they changed at any other time, or during a call after the designer acted
 * in its artboard (D88); and both when both have changed it. The record is
 * kept in the page, for as long as the unsaved edits.
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
// The items whose artboard, or its chrome, the designer has pressed a key or
// a pointer button in while the running call runs (D88).
const pressed = new Set();
let stopPresses = null;
const listeners = new Set();

const isAgents = ( key ) => calls > 0 || seconds.get( key ) > Date.now();

function attribute( key ) {
    let who = isAgents( key ) ? 'agent' : 'you';
    if ( calls > 0 ) {
        touched.add( key );
        // The designer acted there during the call: what changes is
        // theirs as well.
        if ( pressed.has( key ) ) {
            who = 'both';
        }
    }
    const had = authors.get( key );
    authors.set( key, had && had !== who ? 'both' : who );
}

/**
 * Which artboard a press of the designer's is in.
 *
 * @param {Event}       event  The key or pointer press.
 * @param {string|null} liveId The artboard in edit.
 * @return {string|null|undefined} The artboard's id; null for its chrome
 *                                 with no artboard in edit; undefined for
 *                                 a press that is not the designer's, or
 *                                 is on a note or another artboard's label.
 */
function pressedIn( event, liveId ) {
    // WordPress copies the canvas's events onto its iframe element; the
    // designer's own are the trusted ones.
    if ( ! event.isTrusted ) {
        return undefined;
    }
    const doc = event.target.ownerDocument ?? event.target;
    if ( doc !== document ) {
        // The canvas of an artboard's editor: the artboard its frame is in.
        return (
            doc.defaultView?.frameElement
                ?.closest( '[data-wfd-artboard]' )
                ?.getAttribute( 'data-wfd-artboard' ) ?? liveId
        );
    }
    const on = event.target.closest?.( '[data-wfd-artboard], [data-wfd-note]' );
    if ( ! on ) {
        // The chrome: header, panels, inspector, list view.
        return liveId;
    }
    return on.getAttribute( 'data-wfd-artboard' ) ?? undefined;
}

/**
 * Listens for the designer's key and pointer presses in the board and in
 * the canvas of the artboard in edit. The canvas is looked for again on
 * each `refresh`, since a call can put another artboard in edit.
 *
 * @param {Function} onPress Called with the press and the artboard in edit.
 * @return {Object} `refresh` and `stop`.
 */
function listenForPresses( onPress ) {
    const documents = new Set();
    const handle = ( event ) => onPress( event, editor()?.liveId() ?? null );
    const add = ( doc ) => {
        if ( doc && ! documents.has( doc ) ) {
            documents.add( doc );
            doc.addEventListener( 'keydown', handle, true );
            doc.addEventListener( 'pointerdown', handle, true );
        }
    };
    const refresh = () => {
        add( document );
        const liveId = editor()?.liveId();
        add( liveId ? frameOf( liveId ).document : null );
    };
    refresh();
    return {
        refresh,
        stop: () => {
            for ( const doc of documents ) {
                doc.removeEventListener( 'keydown', handle, true );
                doc.removeEventListener( 'pointerdown', handle, true );
            }
            documents.clear();
        },
    };
}

/**
 * Watches the designer from the start of a call (D88): a press in an
 * artboard or its chrome makes what changes in the item it shows the
 * designer's too.
 */
function watchDuringCall() {
    stopPresses?.stop();
    pressed.clear();
    stopPresses = listenForPresses( ( event, liveId ) => {
        const id = pressedIn( event, liveId );
        if ( ! id ) {
            return;
        }
        const artboard = actions()
            ?.board()
            .artboards.find( ( item ) => item.id === id );
        const key = artboard ? actions().itemKeyOf( artboard ) : null;
        if ( key ) {
            pressed.add( key );
        }
    } );
}

function stopWatchingCall() {
    stopPresses?.stop();
    stopPresses = null;
    pressed.clear();
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
    const liveId = editor()?.liveId() ?? null;
    const presses = listenForPresses( ( event ) => {
        const id = pressedIn( event, liveId );
        // Another artboard or a note is neither that artboard nor its
        // chrome.
        if ( id === undefined || ( id !== null && id !== liveId ) ) {
            return;
        }
        endSeconds();
    } );
    const timer = window.setTimeout( endSeconds, SECOND );
    stopWatching = () => {
        window.clearTimeout( timer );
        presses.stop();
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
    // A call can put another artboard in edit: its canvas is watched too.
    stopPresses?.refresh();
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
 * Marks the start of a tool call. Nothing that can throw comes after the
 * count goes up.
 */
export function beginCall() {
    check();
    touched.clear();
    if ( calls === 0 ) {
        watchDuringCall();
    }
    calls++;
}

/**
 * Marks the end of a tool call. The items it changed have a second in which
 * a change to them is still the agent's; a call that changed nothing starts
 * none. The count goes down whatever the last look at the items throws.
 */
export function endCall() {
    try {
        check();
    } finally {
        calls--;
        const keys = [ ...touched ];
        touched.clear();
        if ( calls === 0 ) {
            stopWatchingCall();
        }
        if ( keys.length ) {
            const until = Date.now() + SECOND;
            keys.forEach( ( key ) => seconds.set( key, until ) );
            watchDesigner();
        }
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
