/**
 * The seams through which the agent surface reaches the rest of the client
 * (spec/agent/surface.md, Seams). Each is filled by the part that owns what
 * it gives, and read by `src/agent/` alone. With the surface not loaded
 * nothing reads them.
 */
import { useSyncExternalStore } from '@wordpress/element';

/**
 * The editor in edit: the Live editor's bridge, which holds that editor's
 * registry, and the shell's own functions for entering and leaving edit.
 * Filled by the app.
 */
export const editSeam = { current: null };

/**
 * Board actions: the functions the controls named in spec/agent/tools.md
 * call, and what those controls show. Filled by the app.
 */
export const actionsSeam = { current: null };

/**
 * Whether a step of the content history is being undone or redone right now.
 * The surface records who made a change (spec/agent/surface.md, Authorship),
 * and undoing a change does not change who is recorded.
 */
const history = { isStepping: false };

/**
 * Runs an undo or a redo of the content history.
 *
 * @param {Function} step Dispatches the undo or the redo.
 */
export function historyStep( step ) {
    history.isStepping = true;
    try {
        step();
    } finally {
        history.isStepping = false;
    }
}

export const isHistoryStep = () => history.isStepping;

/**
 * Mark slots: what the three places a mark is drawn show (spec/agent/
 * surface.md, Marks). The surface says what to show; the header, the artboard
 * frames and the Review cards draw it. With the surface not loaded they show
 * nothing.
 *
 * - `chip`: 'connected', 'working' or 'annotating', or null (G1).
 * - `working`: ids of the artboards a running call names (G2).
 * - `authors`: who changed each unsaved item, by its Review key (G3, G4).
 */
let marks = { chip: null, working: [], authors: {} };
const markListeners = new Set();

export const markSlots = {
    get: () => marks,
    set( patch ) {
        marks = { ...marks, ...patch };
        markListeners.forEach( ( listener ) => listener() );
    },
    subscribe( listener ) {
        markListeners.add( listener );
        return () => markListeners.delete( listener );
    },
};

/**
 * @return {Object} The marks to draw.
 */
export const useMarks = () =>
    useSyncExternalStore( markSlots.subscribe, markSlots.get );
