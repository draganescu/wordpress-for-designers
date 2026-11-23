/**
 * The `wfd/board` store: artboard list, selection, which artboard is Live,
 * panel toggles and layout history.
 */
import { createReduxStore, register } from '@wordpress/data';
import { KINDS } from '../shell/constants';

export const STORE_NAME = 'wfd/board';

const DEFAULT_STATE = {
    boardId: null,
    title: '',
    isLoaded: false,
    artboards: [],
    // Notes on the board (D46), with their measured `height` (not saved).
    notes: [],
    // Guides on the board and on its artboards (D110, D113).
    guides: [],
    // The selected guide; it is selected alone (D112).
    selectedGuideId: null,
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
    // The browser being browsed (D55). It counts as the artboard in edit,
    // and has no editor: at most one of liveId and browsingId is set.
    browsingId: null,
    warmIds: [],
    isInserterOpen: false,
    isListViewOpen: false,
    viewport: { x: 0, y: 0, zoom: 1 },
    past: [],
    future: [],
    removingId: null,
    // Goes up each time Review has saved something; browsers reload (D55).
    siteVersion: 0,
    // How many times Reload was pressed for each browser, by id.
    browserReloads: {},
};

/**
 * Restores an earlier list of artboards or of notes, keeping the heights
 * measured since.
 *
 * @param {Array} snapshot The earlier list.
 * @param {Array} current  The current list.
 * @return {Array} The list to use.
 */
function restore( snapshot, current ) {
    const heights = new Map( current.map( ( a ) => [ a.id, a.height ] ) );
    return snapshot.map( ( item ) =>
        // A height set by hand is part of the history (D56); a measured
        // one stays as it is now. A note has no kind and is measured.
        ! KINDS[ item.kind ]?.isResized && heights.has( item.id )
            ? { ...item, height: heights.get( item.id ) }
            : item
    );
}

function keepSelection(
    state,
    artboards,
    notes = state.notes,
    guides = state.guides
) {
    const exists = ( id ) =>
        artboards.some( ( a ) => a.id === id ) ||
        notes.some( ( note ) => note.id === id );
    return {
        // A guide that is gone, or no longer shown (D111), is not selected.
        selectedGuideId: shownGuides( guides, artboards ).some(
            ( guide ) => guide.id === state.selectedGuideId
        )
            ? state.selectedGuideId
            : null,
        editingNoteId: notes.some( ( note ) => note.id === state.editingNoteId )
            ? state.editingNoteId
            : null,
        selectedIds: state.selectedIds.every( exists )
            ? state.selectedIds
            : state.selectedIds.filter( exists ),
        anchorId: exists( state.anchorId ) ? state.anchorId : null,
        liveId: exists( state.liveId ) ? state.liveId : null,
        browsingId: exists( state.browsingId ) ? state.browsingId : null,
        warmIds: state.warmIds.filter( exists ),
    };
}

function reduce( state, action ) {
    switch ( action.type ) {
        case 'SET_BOARD':
            return {
                ...state,
                boardId: action.boardId,
                title: action.title,
                artboards: action.artboards,
                notes: action.notes,
                guides: action.guides,
                isLoaded: true,
            };
        case 'SELECT': {
            const { ids } = action;
            const anchorId =
                action.anchorId === undefined
                    ? state.anchorId
                    : action.anchorId;
            // Whatever is selected here, a guide no longer is (D112).
            return anchorId === state.anchorId &&
                state.selectedGuideId === null &&
                ids.length === state.selectedIds.length &&
                ids.every( ( id, index ) => id === state.selectedIds[ index ] )
                ? state
                : {
                      ...state,
                      selectedIds: ids,
                      anchorId,
                      selectedGuideId: null,
                  };
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
            const guides = action.guides ?? state.guides;
            return {
                ...state,
                artboards,
                notes,
                guides,
                ...keepSelection( state, artboards, notes, guides ),
                past: [
                    ...state.past,
                    {
                        name: action.name,
                        artboards: state.artboards,
                        notes: state.notes,
                        guides: state.guides,
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
            const guides = action.guides ?? state.guides;
            return {
                ...state,
                artboards,
                notes,
                guides,
                ...keepSelection( state, artboards, notes, guides ),
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
            // A guide has nothing measured: it comes back as it was.
            const { guides } = entry;
            const current = {
                name: entry.name,
                artboards: state.artboards,
                notes: state.notes,
                guides: state.guides,
            };
            const to = isUndo ? state.future : state.past;
            return {
                ...state,
                artboards,
                notes,
                guides,
                ...keepSelection( state, artboards, notes, guides ),
                [ isUndo ? 'past' : 'future' ]: from.slice( 0, -1 ),
                [ isUndo ? 'future' : 'past' ]: [ ...to, current ],
            };
        }
        case 'SET_LIVE': {
            if ( state.liveId === action.id ) {
                return action.id && state.browsingId
                    ? { ...state, browsingId: null }
                    : state;
            }
            // The two editors that were Live most recently stay warm.
            const warmIds = [ state.liveId, ...state.warmIds ]
                .filter( ( id ) => id && id !== action.id )
                .slice( 0, 2 );
            return {
                ...state,
                liveId: action.id,
                browsingId: action.id ? null : state.browsingId,
                warmIds,
                selectedIds: action.id ? [ action.id ] : state.selectedIds,
                anchorId: action.id ?? state.anchorId,
                isListViewOpen: action.id ? true : state.isListViewOpen,
            };
        }
        case 'SET_BROWSING': {
            if ( state.browsingId === action.id ) {
                return state;
            }
            // Browsing ends edit; the editor that was Live stays warm.
            const next = action.id
                ? reduce( state, { type: 'SET_LIVE', id: null } )
                : state;
            return {
                ...next,
                browsingId: action.id,
                selectedIds: action.id ? [ action.id ] : next.selectedIds,
                anchorId: action.id ?? next.anchorId,
            };
        }
        case 'PATCH':
            return { ...state, ...action.patch };
    }
    return state;
}

function reducer( state = DEFAULT_STATE, action ) {
    const next = reduce( state, action );
    // A guide is selected alone (D112): whatever selects an artboard or a
    // note, by any action, deselects it. SELECT deselects it by itself, also
    // when it selects nothing.
    return next.selectedGuideId &&
        next.selectedIds.length &&
        next.selectedIds !== state.selectedIds
        ? { ...next, selectedGuideId: null }
        : next;
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

const changeGuides = ( name, update ) =>
    function ( { select, dispatch } ) {
        const before = select.getGuides();
        const after = update( before );
        if ( after !== before ) {
            dispatch( { type: 'LAYOUT', name, guides: after } );
        }
    };

/**
 * The guides left when artboards are taken off the board: an artboard's
 * guides leave with it, in the same step (D113).
 *
 * @param {Array}    guides The guides.
 * @param {string[]} ids    The artboards taken off the board.
 * @return {Array} The same list when no guide leaves.
 */
function withoutGuidesOf( guides, ids ) {
    return guides.some( ( guide ) => ids.includes( guide.artboard ) )
        ? guides.filter( ( guide ) => ! ids.includes( guide.artboard ) )
        : guides;
}

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
    setBoard: ( boardId, title, artboards, notes = [], guides = [] ) => ( {
        type: 'SET_BOARD',
        boardId,
        title,
        artboards,
        notes,
        guides,
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
    setBrowsingId: ( id ) => ( { type: 'SET_BROWSING', id } ),
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
                guides: withoutGuidesOf( select.getGuides(), [ id ] ),
            } );
        },
    /**
     * Updates artboards outside the history: measured heights, an
     * artboard's entity once a new template or part has been saved, and the
     * address a browser is on and what it shows (D55, D57).
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
                guides: withoutGuidesOf( select.getGuides(), ids ),
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
     * Reloads one browser's page.
     *
     * @param {string} id The browser.
     */
    reloadBrowser:
        ( id ) =>
        ( { select, dispatch } ) => {
            dispatch( {
                type: 'PATCH',
                patch: {
                    browserReloads: {
                        ...select.getAllBrowserReloads(),
                        [ id ]: select.getBrowserReloads( id ) + 1,
                    },
                },
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
    /**
     * Adds a guide, as one "add guide" step, and selects it unless told not
     * to (D110, D114).
     *
     * @param {Object}  guide            The guide: id, axis, at, and for an
     *                                   artboard's guide artboard and device.
     * @param {Object}  [options]
     * @param {boolean} [options.select] Whether to select it. Default true.
     */
    addGuide:
        ( guide, { select = true } = {} ) =>
        ( { dispatch } ) => {
            dispatch(
                changeGuides( 'add-guide', ( guides ) => [ ...guides, guide ] )
            );
            if ( select ) {
                dispatch( actions.selectGuide( guide.id ) );
            }
        },
    /**
     * Moves a guide along its axis, as one "move guide" step.
     *
     * @param {string} id The guide.
     * @param {number} at Its new position, a whole number.
     */
    moveGuide: ( id, at ) =>
        changeGuides( 'move-guide', ( guides ) =>
            guides.some( ( guide ) => guide.id === id && guide.at !== at )
                ? guides.map( ( guide ) =>
                      guide.id === id ? { ...guide, at } : guide
                  )
                : guides
        ),
    /**
     * Takes a guide off the board, as one "remove guide" step.
     *
     * @param {string} id The guide.
     */
    removeGuide: ( id ) =>
        changeGuides( 'remove-guide', ( guides ) =>
            guides.some( ( guide ) => guide.id === id )
                ? guides.filter( ( guide ) => guide.id !== id )
                : guides
        ),
    /**
     * Selects a guide alone, or no guide with null (D112).
     *
     * @param {string|null} id The guide.
     */
    selectGuide: ( id ) => ( {
        type: 'PATCH',
        patch: id
            ? { selectedGuideId: id, selectedIds: [], anchorId: null }
            : { selectedGuideId: null },
    } ),
    undoLayout: () => ( { type: 'UNDO' } ),
    redoLayout: () => ( { type: 'REDO' } ),
};

// What getShownGuides last answered, and for which lists.
let shown = { guides: null, artboards: null, result: [] };

/**
 * The guides to draw: board guides, and each artboard's guides for the device
 * the artboard is on (D111). The answer is the same array for as long as it
 * holds the same guides.
 *
 * @param {Array} guides    The guides.
 * @param {Array} artboards The artboards.
 * @return {Array} The guides shown.
 */
function shownGuides( guides, artboards ) {
    if ( shown.guides !== guides || shown.artboards !== artboards ) {
        const result = guides.filter(
            ( guide ) =>
                ! guide.artboard ||
                artboards.some(
                    ( artboard ) =>
                        artboard.id === guide.artboard &&
                        artboard.device === guide.device
                )
        );
        const isSame =
            result.length === shown.result.length &&
            result.every( ( guide, index ) => guide === shown.result[ index ] );
        shown = {
            guides,
            artboards,
            result: isSame ? shown.result : result,
        };
    }
    return shown.result;
}

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
    getGuides: ( state ) => state.guides,
    getGuide: ( state, id ) =>
        state.guides.find( ( guide ) => guide.id === id ) || null,
    getShownGuides: ( state ) => shownGuides( state.guides, state.artboards ),
    getSelectedGuideId: ( state ) => state.selectedGuideId,
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
    getBrowsingId: ( state ) => state.browsingId,
    // The artboard in edit: the Live editor, or the browser being browsed.
    getEditId: ( state ) => state.liveId ?? state.browsingId,
    getWarmIds: ( state ) => state.warmIds,
    isInserterOpen: ( state ) => state.isInserterOpen,
    isListViewOpen: ( state ) => state.isListViewOpen,
    getViewport: ( state ) => state.viewport,
    getRemovingId: ( state ) => state.removingId,
    getSiteVersion: ( state ) => state.siteVersion,
    getAllBrowserReloads: ( state ) => state.browserReloads,
    getBrowserReloads: ( state, id ) => state.browserReloads[ id ] ?? 0,
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
 * The layout as it is stored on the board: saved artboards only, notes, and
 * guides, with exactly the fields of spec/data-model.md.
 *
 * @param {Array} artboards The artboards in the store.
 * @param {Array} notes     The notes in the store.
 * @param {Array} guides    The guides in the store.
 * @return {Object} The layout.
 */
export function toLayout( artboards, notes = [], guides = [] ) {
    const saved = artboards.filter( ( artboard ) => ! artboard.draft );
    // The guides of an artboard that is not written yet wait for it.
    const written = guides.filter(
        ( guide ) =>
            ! guide.artboard ||
            saved.some( ( artboard ) => artboard.id === guide.artboard )
    );
    return {
        version: 1,
        artboards: saved.map( ( artboard ) =>
            Object.fromEntries(
                KINDS[ artboard.kind ].layout.map( ( field ) => [
                    field,
                    artboard[ field ],
                ] )
            )
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
        // And so does a board with no guides (C37).
        ...( written.length && {
            guides: written.map( ( { id, axis, at, artboard, device } ) =>
                artboard ? { id, axis, at, artboard, device } : { id, axis, at }
            ),
        } ),
    };
}
