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
    // Every selected artboard, in the order they were selected.
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
        heights.has( artboard.id )
            ? { ...artboard, height: heights.get( artboard.id ) }
            : artboard
    );
}

function keepSelection( state, artboards ) {
    const exists = ( id ) => artboards.some( ( a ) => a.id === id );
    return {
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
            // A change to the layout that can be undone.
            return {
                ...state,
                artboards: action.artboards,
                ...keepSelection( state, action.artboards ),
                past: [
                    ...state.past,
                    { name: action.name, artboards: state.artboards },
                ],
                future: [],
            };
        }
        case 'LAYOUT_SILENT':
            // A change that is not part of the history.
            return {
                ...state,
                artboards: action.artboards,
                ...keepSelection( state, action.artboards ),
            };
        case 'UNDO': {
            const entry = state.past[ state.past.length - 1 ];
            if ( ! entry ) {
                return state;
            }
            const artboards = restore( entry.artboards, state.artboards );
            return {
                ...state,
                artboards,
                ...keepSelection( state, artboards ),
                past: state.past.slice( 0, -1 ),
                future: [
                    ...state.future,
                    { name: entry.name, artboards: state.artboards },
                ],
            };
        }
        case 'REDO': {
            const entry = state.future[ state.future.length - 1 ];
            if ( ! entry ) {
                return state;
            }
            const artboards = restore( entry.artboards, state.artboards );
            return {
                ...state,
                artboards,
                ...keepSelection( state, artboards ),
                future: state.future.slice( 0, -1 ),
                past: [
                    ...state.past,
                    { name: entry.name, artboards: state.artboards },
                ],
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

const actions = {
    setBoard: ( boardId, title, artboards ) => ( {
        type: 'SET_BOARD',
        boardId,
        title,
        artboards,
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
     * Moves several artboards as one step of the history.
     *
     * @param {Array} moves The moves, as { id, x, y }.
     */
    moveArtboards: ( moves ) =>
        change( 'move', ( artboards ) => {
            const byId = new Map( moves.map( ( move ) => [ move.id, move ] ) );
            const isMoved = ( a ) =>
                byId.has( a.id ) &&
                ( byId.get( a.id ).x !== a.x || byId.get( a.id ).y !== a.y );
            if ( ! artboards.some( isMoved ) ) {
                return artboards;
            }
            return artboards.map( ( a ) =>
                isMoved( a )
                    ? { ...a, x: byId.get( a.id ).x, y: byId.get( a.id ).y }
                    : a
            );
        } ),
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
            dispatch( {
                type: undoable ? 'LAYOUT' : 'LAYOUT_SILENT',
                name: 'remove',
                artboards: select
                    .getArtboards()
                    .filter( ( a ) => ! ids.includes( a.id ) ),
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
    // The selected artboard when exactly one is selected.
    getSelectedId: ( state ) =>
        state.selectedIds.length === 1 ? state.selectedIds[ 0 ] : null,
    getSelectedIds: ( state ) => state.selectedIds,
    getSelectionAnchorId: ( state ) => state.anchorId,
    getLiveId: ( state ) => state.liveId,
    getWarmIds: ( state ) => state.warmIds,
    isInserterOpen: ( state ) => state.isInserterOpen,
    isListViewOpen: ( state ) => state.isListViewOpen,
    getViewport: ( state ) => state.viewport,
    getRemovingId: ( state ) => state.removingId,
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
 * The layout as it is stored on the board: saved artboards only, with exactly
 * the fields of spec/data-model.md.
 *
 * @param {Array} artboards The artboards in the store.
 * @return {Object} The layout.
 */
export function toLayout( artboards ) {
    return {
        version: 1,
        artboards: artboards
            .filter( ( artboard ) => ! artboard.draft )
            .map( ( { id, kind, entityId, device, x, y, width, height } ) =>
                kind === 'media'
                    ? { id, kind, entityId, x, y, width, height }
                    : { id, kind, entityId, device, x, y, height }
            ),
    };
}
