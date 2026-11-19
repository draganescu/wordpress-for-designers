/**
 * The `wfd/board` store: artboard list, selection, which artboard is Live,
 * panel toggles and layout history.
 */
import { createReduxStore, register } from '@wordpress/data';

export const STORE_NAME = 'wfd/board';

const DEFAULT_STATE = {
    boardId: null,
    title: '',
    isLoaded: false,
    artboards: [],
    // Notes on the board (D46), with their measured `height` (not saved).
    notes: [],
    // The note whose text is being edited.
    editingNoteId: null,
    // Whether the next click on the board places a note.
    isNoteToolArmed: false,
    // The notes as they were when the note's text edit started.
    noteEditStart: null,
    // Every selected artboard and note artboard, in the order they were selected.
    selectedIds: [],
    // Where a Shift range in the artboard list starts.
    anchorId: null,
    liveId: null,
    warmIds: [],
    isInserterOpen: false,
    isListViewOpen: false,
    viewport: { x: 0, y: 0, zoom: 1 },
    past: [],
    future: [],
    removingId: null,
    // Goes up each time Review has saved something; browsers reload (D55).
    siteVersion: 0,
    // Goes up each time the unsaved changes have been sent for browsers to
    // preview (D57); 0 until the first send.
    previewVersion: 0,
};

/**
 * Restores an earlier artboard list, keeping the heights measured since.
 *
 * @param {Array} snapshot The earlier list.
 * @param {Array} current  The current list.
 * @return {Array} The list to use.
 */
function restore( snapshot, current ) {
    const heights = new Map( current.map( ( a ) => [ a.id, a.height ] ) );
    return snapshot.map( ( artboard ) =>
        // A browser's height is set by hand, not measured (D56).
        artboard.kind !== 'browser' && heights.has( artboard.id )
            ? { ...artboard, height: heights.get( artboard.id ) }
            : artboard
    );
}

function keepSelection( state, artboards, notes = state.notes ) {
    const exists = ( id ) =>
        artboards.some( ( a ) => a.id === id ) ||
        notes.some( ( note ) => note.id === id );
    return {
        editingNoteId: notes.some( ( note ) => note.id === state.editingNoteId )
            ? state.editingNoteId
            : null,
        selectedIds: state.selectedIds.every( exists )
            ? state.selectedIds
            : state.selectedIds.filter( exists ),
        anchorId: exists( state.anchorId ) ? state.anchorId : null,
        liveId: exists( state.liveId ) ? state.liveId : null,
        warmIds: state.warmIds.filter( exists ),
    };
}

function reducer( state = DEFAULT_STATE, action ) {
    switch ( action.type ) {
        case 'SET_BOARD':
            return {
                ...state,
                boardId: action.boardId,
                title: action.title,
                artboards: action.artboards,
                notes: action.notes,
                isLoaded: true,
            };
        case 'SELECT': {
            const { ids } = action;
            const anchorId =
                action.anchorId === undefined
                    ? state.anchorId
                    : action.anchorId;
            return anchorId === state.anchorId &&
                ids.length === state.selectedIds.length &&
                ids.every( ( id, index ) => id === state.selectedIds[ index ] )
                ? state
                : { ...state, selectedIds: ids, anchorId };
        }
        case 'SET_INSERTER_OPEN':
            return { ...state, isInserterOpen: action.isOpen };
        case 'SET_LIST_VIEW_OPEN':
            return { ...state, isListViewOpen: action.isOpen };
        case 'SET_VIEWPORT':
            return { ...state, viewport: action.viewport };
        case 'SET_REMOVING':
            return { ...state, removingId: action.id };
        case 'LAYOUT': {
            // A change to the layout that can be undone. `before` is the
            // state to go back to, when it is not the current one (a note's
            // text, changed silently while it was typed).
            const artboards = action.artboards ?? state.artboards;
            const notes = action.notes ?? state.notes;
            return {
                ...state,
                artboards,
                notes,
                ...keepSelection( state, artboards, notes ),
                past: [
                    ...state.past,
                    {
                        name: action.name,
                        artboards: state.artboards,
                        notes: state.notes,
                        ...action.before,
                    },
                ],
                future: [],
            };
        }
        case 'LAYOUT_SILENT': {
            // A change that is not part of the history.
            const artboards = action.artboards ?? state.artboards;
            const notes = action.notes ?? state.notes;
            return {
                ...state,
                artboards,
                notes,
                ...keepSelection( state, artboards, notes ),
            };
        }
        case 'UNDO':
        case 'REDO': {
            const isUndo = action.type === 'UNDO';
            const from = isUndo ? state.past : state.future;
            const entry = from[ from.length - 1 ];
            if ( ! entry ) {
                return state;
            }
            const artboards = restore( entry.artboards, state.artboards );
            const notes = restore( entry.notes, state.notes );
            const current = {
                name: entry.name,
                artboards: state.artboards,
                notes: state.notes,
            };
            const to = isUndo ? state.future : state.past;
            return {
                ...state,
                artboards,
                notes,
                ...keepSelection( state, artboards, notes ),
                [ isUndo ? 'past' : 'future' ]: from.slice( 0, -1 ),
                [ isUndo ? 'future' : 'past' ]: [ ...to, current ],
            };
        }
        case 'SET_LIVE': {
            if ( state.liveId === action.id ) {
                return state;
            }
            // The two editors that were Live most recently stay warm.
            const warmIds = [ state.liveId, ...state.warmIds ]
                .filter( ( id ) => id && id !== action.id )
                .slice( 0, 2 );
            return {
                ...state,
                liveId: action.id,
                warmIds,
                selectedIds: action.id ? [ action.id ] : state.selectedIds,
                anchorId: action.id ?? state.anchorId,
                isListViewOpen: action.id ? true : state.isListViewOpen,
            };
        }
        case 'PATCH':
            return { ...state, ...action.patch };
    }
    return state;
}

const change = ( name, update ) =>
    function ( { select, dispatch } ) {
        const before = select.getArtboards();
        const after = update( before );
        if ( after !== before ) {
            dispatch( { type: 'LAYOUT', name, artboards: after } );
        }
    };

const changeNotes = ( name, update ) =>
    function ( { select, dispatch } ) {
        const before = select.getNotes();
        const after = update( before );
        if ( after !== before ) {
            dispatch( { type: 'LAYOUT', name, notes: after } );
        }
    };

/**
 * Applies moves, as { id, x, y }, to a list of artboards or notes.
 *
 * @param {Array} items The list.
 * @param {Map}   byId  The moves by id.
 * @return {Array} The same list when nothing moved.
 */
function applyMoves( items, byId ) {
    const isMoved = ( item ) =>
        byId.has( item.id ) &&
        ( byId.get( item.id ).x !== item.x ||
            byId.get( item.id ).y !== item.y );
    if ( ! items.some( isMoved ) ) {
        return items;
    }
    return items.map( ( item ) =>
        isMoved( item )
            ? { ...item, x: byId.get( item.id ).x, y: byId.get( item.id ).y }
            : item
    );
}

export const NOTE_COLORS = [ 'yellow', 'green', 'blue', 'pink' ];

const actions = {
    setBoard: ( boardId, title, artboards, notes = [] ) => ( {
        type: 'SET_BOARD',
        boardId,
        title,
        artboards,
        notes,
    } ),
    selectArtboard: ( id ) => ( {
        type: 'SELECT',
        ids: id ? [ id ] : [],
        anchorId: id ?? null,
    } ),
    clearSelection: () => ( { type: 'SELECT', ids: [], anchorId: null } ),
    /**
     * Adds an artboard to the selection, or takes it out when it is there.
     *
     * @param {string} id The artboard.
     */
    toggleArtboardSelection:
        ( id ) =>
        ( { select, dispatch } ) => {
            const ids = select.getSelectedIds();
            dispatch( {
                type: 'SELECT',
                ids: ids.includes( id )
                    ? ids.filter( ( other ) => other !== id )
                    : [ ...ids, id ],
                anchorId: id,
            } );
        },
    /**
     * Selects several artboards and leaves the start of a range where it is.
     *
     * @param {string[]} ids The artboards.
     */
    selectArtboards: ( ids ) => ( { type: 'SELECT', ids } ),
    setInserterOpen: ( isOpen ) => ( { type: 'SET_INSERTER_OPEN', isOpen } ),
    setListViewOpen: ( isOpen ) => ( { type: 'SET_LIST_VIEW_OPEN', isOpen } ),
    setViewport: ( viewport ) => ( { type: 'SET_VIEWPORT', viewport } ),
    setRemovingId: ( id ) => ( { type: 'SET_REMOVING', id } ),
    setLiveId: ( id ) => ( { type: 'SET_LIVE', id } ),
    patch: ( patch ) => ( { type: 'PATCH', patch } ),

    moveArtboard: ( id, x, y ) =>
        change( 'move', ( artboards ) => {
            const artboard = artboards.find( ( a ) => a.id === id );
            if ( ! artboard || ( artboard.x === x && artboard.y === y ) ) {
                return artboards;
            }
            return artboards.map( ( a ) =>
                a.id === id ? { ...a, x, y } : a
            );
        } ),
    /**
     * Moves several artboards and notes as one step of the history.
     *
     * @param {Array}  moves  The moves, as { id, x, y }.
     * @param {string} [name] The name of the step in the history.
     */
    moveArtboards:
        ( moves, name = 'move' ) =>
        ( { select, dispatch } ) => {
            const byId = new Map( moves.map( ( move ) => [ move.id, move ] ) );
            const artboards = applyMoves( select.getArtboards(), byId );
            const notes = applyMoves( select.getNotes(), byId );
            if (
                artboards === select.getArtboards() &&
                notes === select.getNotes()
            ) {
                return;
            }
            dispatch( {
                type: 'LAYOUT',
                // A plain move is named for notes when no artboard moved.
                name:
                    name === 'move' && artboards === select.getArtboards()
                        ? 'move-note'
                        : name,
                artboards,
                notes,
            } );
        },
    setArtboardDevice: ( id, device ) =>
        change( 'device', ( artboards ) => {
            const artboard = artboards.find( ( a ) => a.id === id );
            if ( ! artboard || artboard.device === device ) {
                return artboards;
            }
            return artboards.map( ( a ) =>
                a.id === id ? { ...a, device } : a
            );
        } ),
    addArtboard: ( artboard ) =>
        change( 'add', ( artboards ) => [ ...artboards, artboard ] ),
    removeArtboard:
        ( id, { undoable = true } = {} ) =>
        ( { select, dispatch } ) => {
            const artboards = select
                .getArtboards()
                .filter( ( a ) => a.id !== id );
            dispatch( {
                type: undoable ? 'LAYOUT' : 'LAYOUT_SILENT',
                name: 'remove',
                artboards,
            } );
        },
    /**
     * Updates artboards outside the history: measured heights, and an
     * artboard's entity once a new template or part has been saved.
     *
     * @param {string} id    The artboard.
     * @param {Object} patch Fields to change.
     */
    updateArtboard:
        ( id, patch ) =>
        ( { select, dispatch } ) => {
            const artboards = select.getArtboards();
            const artboard = artboards.find( ( a ) => a.id === id );
            if (
                ! artboard ||
                Object.keys( patch ).every(
                    ( key ) => artboard[ key ] === patch[ key ]
                )
            ) {
                return;
            }
            dispatch( {
                type: 'LAYOUT_SILENT',
                artboards: artboards.map( ( a ) =>
                    a.id === id ? { ...a, ...patch } : a
                ),
            } );
        },
    removeArtboards:
        ( ids, { undoable = false } = {} ) =>
        ( { select, dispatch } ) => {
            const artboards = select
                .getArtboards()
                .filter( ( a ) => ! ids.includes( a.id ) );
            const notes = select
                .getNotes()
                .filter( ( note ) => ! ids.includes( note.id ) );
            dispatch( {
                type: undoable ? 'LAYOUT' : 'LAYOUT_SILENT',
                // Named for notes only when no artboard left.
                name:
                    artboards.length === select.getArtboards().length
                        ? 'remove-note'
                        : 'remove',
                artboards,
                notes,
            } );
        },

    /**
     * Keeps the address a browser is on, outside the history (D55).
     *
     * @param {string} id   The browser.
     * @param {string} path The address, relative to the site's home.
     */
    setBrowserPath:
        ( id, path ) =>
        ( { select, dispatch } ) => {
            const artboards = select.getArtboards();
            const browser = artboards.find( ( a ) => a.id === id );
            if (
                ! browser ||
                browser.kind !== 'browser' ||
                browser.path === path
            ) {
                return;
            }
            dispatch( {
                type: 'LAYOUT_SILENT',
                artboards: artboards.map( ( a ) =>
                    a.id === id ? { ...a, path } : a
                ),
            } );
        },
    /**
     * Changes a browser's window height, as one step of the history (D56).
     *
     * @param {string} id     The browser.
     * @param {number} height The height in board units.
     */
    resizeBrowser: ( id, height ) =>
        change( 'resize-browser', ( artboards ) =>
            artboards.some( ( a ) => a.id === id && a.height !== height )
                ? artboards.map( ( a ) =>
                      a.id === id ? { ...a, height } : a
                  )
                : artboards
        ),
    /**
     * Chooses what a browser shows, outside the history (D57).
     *
     * @param {string} id    The browser.
     * @param {string} shows 'unsaved' or 'saved'.
     */
    setBrowserShows:
        ( id, shows ) =>
        ( { select, dispatch } ) => {
            const artboards = select.getArtboards();
            if (
                ! artboards.some( ( a ) => a.id === id && a.shows !== shows )
            ) {
                return;
            }
            dispatch( {
                type: 'LAYOUT_SILENT',
                artboards: artboards.map( ( a ) =>
                    a.id === id ? { ...a, shows } : a
                ),
            } );
        },
    /**
     * Tells browsers showing unsaved changes that they have been sent.
     */
    bumpPreviewVersion:
        () =>
        ( { select, dispatch } ) => {
            dispatch( {
                type: 'PATCH',
                patch: { previewVersion: select.getPreviewVersion() + 1 },
            } );
        },
    /**
     * Tells browsers that the site has changed.
     */
    bumpSiteVersion:
        () =>
        ( { select, dispatch } ) => {
            dispatch( {
                type: 'PATCH',
                patch: { siteVersion: select.getSiteVersion() + 1 },
            } );
        },
    setNoteToolArmed: ( isArmed ) => ( {
        type: 'PATCH',
        patch: { isNoteToolArmed: isArmed },
    } ),
    /**
     * Places a new note, selects it and starts editing its text.
     *
     * @param {Object} note The note: id, x, y.
     */
    addNote:
        ( note ) =>
        ( { dispatch } ) => {
            dispatch(
                changeNotes( 'add-note', ( notes ) => [
                    ...notes,
                    { text: '', color: 'yellow', ...note },
                ] )
            );
            dispatch( {
                type: 'PATCH',
                patch: {
                    isNoteToolArmed: false,
                    selectedIds: [ note.id ],
                    anchorId: note.id,
                    editingNoteId: note.id,
                },
            } );
        },
    setNoteColor: ( id, color ) =>
        changeNotes( 'note-color', ( notes ) =>
            notes.some( ( note ) => note.id === id && note.color !== color )
                ? notes.map( ( note ) =>
                      note.id === id ? { ...note, color } : note
                  )
                : notes
        ),
    /**
     * Starts editing a note's text; the whole edit is one step of the
     * history, recorded when it ends.
     *
     * @param {string} id The note.
     */
    startNoteEdit:
        ( id ) =>
        ( { select, dispatch } ) => {
            if ( ! select.getNote( id ) ) {
                return;
            }
            dispatch( {
                type: 'PATCH',
                patch: {
                    selectedIds: [ id ],
                    anchorId: id,
                    editingNoteId: id,
                    noteEditStart: select.getNotes(),
                },
            } );
        },
    /**
     * Changes a note's text while it is typed, outside the history.
     *
     * @param {string} id   The note.
     * @param {string} text The text.
     */
    setNoteText:
        ( id, text ) =>
        ( { select, dispatch } ) => {
            dispatch( {
                type: 'LAYOUT_SILENT',
                notes: select
                    .getNotes()
                    .map( ( note ) =>
                        note.id === id ? { ...note, text } : note
                    ),
            } );
        },
    endNoteEdit:
        () =>
        ( { select, dispatch } ) => {
            const id = select.getEditingNoteId();
            const start = select.getNoteEditStart();
            dispatch( {
                type: 'PATCH',
                patch: { editingNoteId: null, noteEditStart: null },
            } );
            const before = start?.find( ( note ) => note.id === id );
            const after = select.getNote( id );
            if ( before && after && before.text !== after.text ) {
                // One step for the whole edit.
                dispatch( {
                    type: 'LAYOUT',
                    name: 'edit-note',
                    before: { notes: start },
                } );
            }
        },
    /**
     * Keeps a note's measured height, for fitting; it is not saved.
     *
     * @param {string} id     The note.
     * @param {number} height The height in board units.
     */
    setNoteHeight:
        ( id, height ) =>
        ( { select, dispatch } ) => {
            if ( select.getNote( id )?.height === height ) {
                return;
            }
            dispatch( {
                type: 'LAYOUT_SILENT',
                notes: select
                    .getNotes()
                    .map( ( note ) =>
                        note.id === id ? { ...note, height } : note
                    ),
            } );
        },
    undoLayout: () => ( { type: 'UNDO' } ),
    redoLayout: () => ( { type: 'REDO' } ),
};

const selectors = {
    getBoardId: ( state ) => state.boardId,
    getTitle: ( state ) => state.title,
    isLoaded: ( state ) => state.isLoaded,
    getArtboards: ( state ) => state.artboards,
    getArtboard: ( state, id ) =>
        state.artboards.find( ( artboard ) => artboard.id === id ) || null,
    getNotes: ( state ) => state.notes,
    getNote: ( state, id ) =>
        state.notes.find( ( note ) => note.id === id ) || null,
    getEditingNoteId: ( state ) => state.editingNoteId,
    getNoteEditStart: ( state ) => state.noteEditStart ?? null,
    isNoteToolArmed: ( state ) => state.isNoteToolArmed,
    // The selected artboard when exactly one artboard, and nothing else, is
    // selected.
    getSelectedId: ( state ) =>
        state.selectedIds.length === 1 &&
        state.artboards.some( ( a ) => a.id === state.selectedIds[ 0 ] )
            ? state.selectedIds[ 0 ]
            : null,
    // The selected note when exactly one note, and nothing else, is selected.
    getSelectedNoteId: ( state ) =>
        state.selectedIds.length === 1 &&
        state.notes.some( ( note ) => note.id === state.selectedIds[ 0 ] )
            ? state.selectedIds[ 0 ]
            : null,
    getSelectedIds: ( state ) => state.selectedIds,
    getSelectionAnchorId: ( state ) => state.anchorId,
    getLiveId: ( state ) => state.liveId,
    getWarmIds: ( state ) => state.warmIds,
    isInserterOpen: ( state ) => state.isInserterOpen,
    isListViewOpen: ( state ) => state.isListViewOpen,
    getViewport: ( state ) => state.viewport,
    getRemovingId: ( state ) => state.removingId,
    getSiteVersion: ( state ) => state.siteVersion,
    getPreviewVersion: ( state ) => state.previewVersion,
    getUndoName: ( state ) => state.past[ state.past.length - 1 ]?.name ?? null,
    getRedoName: ( state ) =>
        state.future[ state.future.length - 1 ]?.name ?? null,
};

export const store = createReduxStore( STORE_NAME, {
    reducer,
    actions,
    selectors,
} );

register( store );

/**
 * The layout as it is stored on the board: saved artboards only, and notes,
 * with exactly the fields of spec/data-model.md.
 *
 * @param {Array} artboards The artboards in the store.
 * @param {Array} notes     The notes in the store.
 * @return {Object} The layout.
 */
export function toLayout( artboards, notes = [] ) {
    return {
        version: 1,
        artboards: artboards
            .filter( ( artboard ) => ! artboard.draft )
            .map(
                ( {
                    id,
                    kind,
                    entityId,
                    path,
                    shows,
                    device,
                    x,
                    y,
                    width,
                    height,
                } ) => {
                    if ( kind === 'browser' ) {
                        return { id, kind, path, device, x, y, height, shows };
                    }
                    return kind === 'media'
                        ? { id, kind, entityId, x, y, width, height }
                        : { id, kind, entityId, device, x, y, height };
                }
            ),
        // A board with no notes keeps the layout it always had.
        ...( notes.length && {
            notes: notes.map( ( { id, x, y, text, color } ) => ( {
                id,
                x,
                y,
                text,
                color,
            } ) ),
        } ),
    };
}
