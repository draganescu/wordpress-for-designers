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
    selectedId: null,
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
        selectedId: exists( state.selectedId ) ? state.selectedId : null,
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
        case 'SELECT':
            return state.selectedId === action.id
                ? state
                : { ...state, selectedId: action.id };
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
                selectedId: action.id ?? state.selectedId,
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
    selectArtboard: ( id ) => ( { type: 'SELECT', id } ),
    clearSelection: () => ( { type: 'SELECT', id: null } ),
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
        ( ids ) =>
        ( { select, dispatch } ) => {
            dispatch( {
                type: 'LAYOUT_SILENT',
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
    getSelectedId: ( state ) => state.selectedId,
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
