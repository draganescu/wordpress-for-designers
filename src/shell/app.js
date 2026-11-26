/**
 * The board app: loads the board and connects the shell regions to state.
 */
import { __, sprintf } from '@wordpress/i18n';
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    useMemo,
} from '@wordpress/element';
import { useDispatch, useRegistry, useSelect } from '@wordpress/data';
import { store as coreStore, useEntityRecord } from '@wordpress/core-data';
import { ShortcutProvider } from '@wordpress/keyboard-shortcuts';
import { SlotFillProvider, Popover } from '@wordpress/components';
import { useResizeObserver } from '@wordpress/compose';
import { Skeleton, useEnableWpCompatOverlaySlot } from '@wordpress/ui';
import { store as boardStore } from '../board-store';
import { useLayoutAutosave } from '../board-store/use-layout-autosave';
import { createViewport } from '../viewport';
import { ArtboardEditor } from '../artboard-editor';
import {
    ArtboardError,
    ArtboardFrame,
    ArtboardMedia,
    TierContent,
    BrowserArtboard,
    browserTier,
    usePreview,
} from '../artboard-frame';
import {
    ArtboardPreview,
    ArtboardPreviewOnce,
    isLoading,
} from '../artboard-preview';
import { ArtboardSnapshot, createSnapshotStore } from '../artboard-snapshot';
import { useTiers } from '../tier-scheduler';
import { InserterPanel } from '../inserter/inserter-panel';
import { useInserterActions } from '../inserter/use-inserter-actions';
import { useInserterData, withBoardNames } from '../inserter/use-inserter-data';
import { StylesPanel } from '../styles/styles-panel';
import { useGlobalStyles } from '../styles/use-global-styles';
import { useStylesPanel } from '../styles/use-styles-panel';
import { ReviewDrawer } from '../review/review-drawer';
import { useReview } from '../review/use-review';
import { changedEntries } from '../review/entries';
import { artboardsLine, moreLine } from '../review/format';
import { brandColor, highlightCss, useUsageIndex } from '../usage-index';
import {
    ArtboardsPanel,
    ListViewPanel,
    orderedArtboards,
} from './artboards-panel';
import {
    Canvas,
    EmptyBoard,
    PlacementOutline,
    PreviewBanner,
    SavingBanner,
    UsageBanner,
} from './canvas';
import { KINDS, hasDevice } from './constants';
import { LockDialog, RemoveDialog } from './dialogs';
import { ShortcutsButton, ShortcutsDialog } from './shortcuts-dialog';
import { Snackbars } from './snackbars';
import { Note, NoteSettings } from './notes';
import { Guide, GuideDrag, GuideSettings, guideRange } from './guides';
import { Rulers, useRulerContext } from './rulers';
import { Header } from './header';
import {
    artboardLabel,
    kindAndDevice,
    liveLabel,
    nameAndDevice,
} from './labels';
import { ArtboardSettings, EditingPanel } from './right-panel';
import { Shell } from './shell';
import { useDeviceWidths } from './device-widths';
import { bootEditor, serverSettings } from './editor-settings';
import { counters, countRender, expose } from './test-hooks';
import {
    selectArtboards as readArtboards,
    useArtboards,
} from './use-artboards';
import {
    actionsSeam,
    editSeam,
    historyStep,
    isHistoryStep,
    useMarks,
} from './seams';
import { windowHasRoom } from './space-gate';
import { rectOf, useCanvasInteractions } from './use-canvas-interactions';
import { tidyMoves } from './tidy';
import { uuid } from './uuid';
import { useEditing } from './use-editing';
import { useEntityInfo } from './use-entity-info';
import { NEW_ARTBOARD_HEIGHT, usePlacement } from './use-placement';
import { useRename } from './use-rename';
import {
    readStoredViewport,
    readViewChoices,
    storeViewChoices,
    storeViewport,
} from './view-prefs';
import { removalInfo, useRemoval } from './use-removal';

const { boardId, boardsUrl, theme, homeUrl } = window.wfdConfig;
bootEditor();

/**
 * Names of layout changes, for the Undo and Redo tooltips.
 */
/**
 * Board units between a clicked inserter item and what it was moved past.
 */
const PLACEMENT_GAP = 80;

const NO_GUIDES = [];

const LAYOUT_ACTIONS = {
    move: __( 'move artboard', 'wordpress-for-designers' ),
    tidy: __( 'tidy up', 'wordpress-for-designers' ),
    device: __( 'change device', 'wordpress-for-designers' ),
    add: __( 'add artboard', 'wordpress-for-designers' ),
    remove: __( 'remove artboard', 'wordpress-for-designers' ),
    'resize-browser': __( 'resize browser', 'wordpress-for-designers' ),
    'add-note': __( 'add note', 'wordpress-for-designers' ),
    'move-note': __( 'move note', 'wordpress-for-designers' ),
    'edit-note': __( 'edit note', 'wordpress-for-designers' ),
    'note-color': __( 'change note color', 'wordpress-for-designers' ),
    'remove-note': __( 'remove note', 'wordpress-for-designers' ),
    'add-guide': __( 'add guide', 'wordpress-for-designers' ),
    'move-guide': __( 'move guide', 'wordpress-for-designers' ),
    'remove-guide': __( 'remove guide', 'wordpress-for-designers' ),
};

function useBoard() {
    const { record } = useEntityRecord( 'postType', 'wfd_board', boardId );
    const { setBoard } = useDispatch( boardStore );
    const isLoaded = useSelect(
        ( select ) => select( boardStore ).isLoaded(),
        []
    );
    useEffect( () => {
        if ( record && ! isLoaded ) {
            setBoard(
                record.id,
                record.title?.raw ?? '',
                record.layout?.artboards ?? [],
                record.layout?.notes ?? [],
                record.layout?.guides ?? []
            );
        }
    }, [ record, isLoaded, setBoard ] );
    return isLoaded;
}

/**
 * The key of the Review item an artboard shows, or null when it shows none.
 *
 * @param {Object} artboard The artboard.
 * @return {string|null} The key.
 */
const itemKeyOf = ( artboard ) =>
    KINDS[ artboard.kind ].postType
        ? `postType/${ KINDS[ artboard.kind ].postType }/${ artboard.entityId }`
        : null;

function layoutTooltip( name, isUndo ) {
    if ( ! name ) {
        return isUndo
            ? __( 'Undo', 'wordpress-for-designers' )
            : __( 'Redo', 'wordpress-for-designers' );
    }
    if ( isUndo ) {
        return sprintf(
            /* translators: %s: what is undone, for example "move artboard". */
            __( 'Undo %s, on the board', 'wordpress-for-designers' ),
            LAYOUT_ACTIONS[ name ]
        );
    }
    return sprintf(
        /* translators: %s: what is redone, for example "move artboard". */
        __( 'Redo %s, on the board', 'wordpress-for-designers' ),
        LAYOUT_ACTIONS[ name ]
    );
}

function contentTooltip( name, isUndo ) {
    if ( isUndo ) {
        return sprintf(
            /* translators: %s: artboard name. */
            __( 'Undo edit, in %s', 'wordpress-for-designers' ),
            name
        );
    }
    return sprintf(
        /* translators: %s: artboard name. */
        __( 'Redo edit, in %s', 'wordpress-for-designers' ),
        name
    );
}

export function App() {
    countRender();
    useEnableWpCompatOverlaySlot();
    const registry = useRegistry();
    const isLoaded = useBoard();
    useLayoutAutosave();
    const preview = usePreview();
    const viewportRef = useRef();
    if ( ! viewportRef.current ) {
        viewportRef.current = createViewport();
        expose( 'viewport', viewportRef.current );
    }
    const viewport = viewportRef.current;
    const areaRef = useRef();
    const snapshotsRef = useRef();
    if ( ! snapshotsRef.current ) {
        snapshotsRef.current = createSnapshotStore();
        expose( 'snapshots', snapshotsRef.current );
    }
    const snapshots = snapshotsRef.current;
    const surfaceRef = useRef();

    const artboards = useArtboards();
    const {
        title,
        selectedId,
        selectedIds,
        anchorId,
        liveId,
        browsingId,
        isInserterOpen,
        isListViewOpen,
        zoom,
        undoName,
        redoName,
        removingId,
        notes,
        selectedNoteId,
        editingNoteId,
        isNoteToolArmed,
        shownGuides,
        selectedGuideId,
    } = useSelect( ( select ) => {
        const board = select( boardStore );
        return {
            notes: board.getNotes(),
            selectedNoteId: board.getSelectedNoteId(),
            editingNoteId: board.getEditingNoteId(),
            isNoteToolArmed: board.isNoteToolArmed(),
            shownGuides: board.getShownGuides(),
            selectedGuideId: board.getSelectedGuideId(),
            title: board.getTitle(),
            selectedId: board.getSelectedId(),
            selectedIds: board.getSelectedIds(),
            anchorId: board.getSelectionAnchorId(),
            liveId: board.getLiveId(),
            browsingId: board.getBrowsingId(),
            isInserterOpen: board.isInserterOpen(),
            isListViewOpen: board.isListViewOpen(),
            zoom: board.getViewport().zoom,
            undoName: board.getUndoName(),
            redoName: board.getRedoName(),
            removingId: board.getRemovingId(),
        };
    }, [] );
    const {
        selectArtboard,
        selectArtboards,
        toggleArtboardSelection,
        setInserterOpen,
        setListViewOpen,
        setViewport,
        setRemovingId,
        setArtboardDevice,
        updateArtboard,
        moveArtboards,
        undoLayout,
        redoLayout,
        setNoteToolArmed,
        addNote,
        setNoteColor,
        setNoteText,
        setNoteHeight,
        startNoteEdit,
        endNoteEdit,
        moveGuide,
        removeGuide,
        selectGuide,
        reloadBrowser,
    } = useDispatch( boardStore );
    // Hidden panels (D32): kept for the session only.
    const [ isLeftHidden, setLeftHidden ] = useState( false );
    const [ isRightHidden, setRightHidden ] = useState( false );
    const togglePanels = useRef( null );
    const [ isShortcutsOpen, setShortcutsOpen ] = useState( false );
    // Whether rulers and guides are shown (D109): kept in the browser.
    const [ view, setView ] = useState( readViewChoices );
    const changeView = ( change ) => {
        const next = { ...view, ...change };
        setView( next );
        storeViewChoices( next );
    };
    const toggleRulers = () => changeView( { rulers: ! view.rulers } );
    const toggleGuides = () => {
        // A hidden guide is not left selected.
        selectGuide( null );
        changeView( { guides: ! view.guides } );
    };
    const rulersRef = useRef();
    const guides = view.guides ? shownGuides : NO_GUIDES;
    const [ inserterQuery, setInserterQuery ] = useState( '' );
    const [ inserterTab, setInserterTab ] = useState( 'blocks' );
    const [ selectedToken, setSelectedToken ] = useState( null );
    const [ scope, setScope ] = useState( 'block' );
    const [ editingTab, setEditingTab ] = useState( 'entity' );
    const review = useReview();
    // What the agent surface asks to have marked; nothing until it is loaded.
    const marks = useMarks();

    const widths = useDeviceWidths();
    const widthOf = useCallback( ( device ) => widths[ device ], [ widths ] );
    const artboardsRef = useRef( artboards );
    artboardsRef.current = artboards;
    const editing = useEditing( {
        viewport,
        areaRef,
        getArtboards: () => artboardsRef.current,
        widthOf,
    } );
    const onEdit = editing.enterEdit;
    const { hasContentUndo, hasContentRedo } = useSelect(
        ( select ) => ( {
            hasContentUndo: select( coreStore ).hasUndo(),
            hasContentRedo: select( coreStore ).hasRedo(),
        } ),
        []
    );
    const { undo: undoContent, redo: redoContent } = useDispatch( coreStore );
    const selectedBlockId = editing.selectedBlock?.clientId;
    useEffect( () => {
        // "Block" is selected when a block is selected (E1).
        setEditingTab( selectedBlockId ? 'block' : 'entity' );
    }, [ selectedBlockId, liveId ] );

    const canvas = useCanvasInteractions( {
        areaRef,
        viewport,
        widthOf,
        getNames: () => artboardsRef.current,
        onEdit,
        onLeaveEdit: editing.leaveEdit,
        onRename: ( id ) => rename.start( id ),
        onTogglePanels: () => togglePanels.current?.(),
        onToggleShortcuts: () => setShortcutsOpen( ( isOpen ) => ! isOpen ),
        onRemoveMany: ( ids ) => removeMany( ids ),
        rulersRef,
        onToggleRulers: toggleRulers,
        onToggleGuides: toggleGuides,
        onShowGuides: () => view.guides || changeView( { guides: true } ),
        isReady: isLoaded,
    } );
    const rulerContext = useRulerContext( {
        isShown: view.rulers,
        widthOf,
        selectedBlockId,
    } );
    const rename = useRename( {
        artboards,
        reveal: ( id ) => canvas.reveal( id ),
        areaRef,
    } );

    useEffect( () => {
        if ( ! isLoaded || ! surfaceRef.current ) {
            return;
        }
        viewport.attach( surfaceRef.current, areaRef.current );
        const stored = readStoredViewport();
        if ( stored ) {
            viewport.set( stored, { immediate: true } );
        } else {
            // A board never opened in this browser opens fitted.
            viewport.fit(
                artboardsRef.current.map( ( artboard ) =>
                    rectOf( artboard, widthOf )
                )
            );
        }
        setViewport( viewport.get() );
        const stop = viewport.onSettle( ( state ) => {
            setViewport( state );
            storeViewport( state );
        } );
        return () => {
            stop();
            viewport.detach();
        };
    }, [ isLoaded, viewport, setViewport, widthOf ] );

    // A clicked item lands in the middle of the board in view, moved right
    // past anything it would cover, and is brought into view.
    const findSpace = ( size ) => {
        const box = areaRef.current.getBoundingClientRect();
        const rect = {
            width: widthOf( 'desktop' ),
            height: NEW_ARTBOARD_HEIGHT,
            ...size,
        };
        const middle = viewport.toBoard( {
            x: box.width / 2,
            y: box.height / 2,
        } );
        const start = Math.round( middle.x - rect.width / 2 );
        rect.x = start;
        rect.y = Math.round( middle.y - rect.height / 2 );
        const others = readArtboards( registry.select ).map( ( artboard ) =>
            rectOf( artboard, widthOf )
        );
        const covered = () =>
            others.find(
                ( other ) =>
                    rect.x < other.x + other.width &&
                    other.x < rect.x + rect.width &&
                    rect.y < other.y + other.height &&
                    other.y < rect.y + rect.height
            );
        for ( let other = covered(); other; other = covered() ) {
            rect.x = other.x + other.width + PLACEMENT_GAP;
        }
        if ( rect.x !== start ) {
            viewport.panBy( ( start - rect.x ) * viewport.get().zoom, 0 );
        }
        return { x: rect.x, y: rect.y };
    };
    const findSpaceRef = useRef( findSpace );
    findSpaceRef.current = findSpace;
    const inserterData = useInserterData( editing.allowedBlocks );
    const inserter = useInserterActions( {
        lookup: inserterData.lookup,
        bridgeRef: editing.bridgeRef,
        toBoard: ( event ) => {
            const box = areaRef.current.getBoundingClientRect();
            return viewport.toBoard( {
                x: event.clientX - box.left,
                y: event.clientY - box.top,
            } );
        },
        findSpace: ( size ) => findSpaceRef.current( size ),
    } );
    const inserterRef = useRef( inserter );
    inserterRef.current = inserter;
    const inserterDataRef = useRef( inserterData );
    inserterDataRef.current = inserterData;
    const placing = usePlacement( { theme, enterEdit: onEdit } );
    const remove = useRemoval();
    const [ ghost, setGhost ] = useState( null );
    const { removeArtboards } = useDispatch( boardStore );
    const { invalidateResolution } = useDispatch( coreStore );

    // An artboard whose entity no longer exists leaves the board.
    const missingIds = artboards
        .filter( ( artboard ) => artboard.status === 'missing' )
        .map( ( artboard ) => artboard.id )
        .join( ',' );
    // Several artboards leave the board at once, with no dialog and no
    // change to the site. One never saved is dropped with its edits, as
    // when it is removed alone.
    const removeMany = ( ids ) => {
        const leaving = readArtboards( registry.select ).filter( ( a ) =>
            ids.includes( a.id )
        );
        leaving
            .filter( ( a ) => a.draft )
            .forEach( ( a ) => remove( a, false ) );
        // Notes leave with the artboards (D46).
        removeArtboards(
            ids.filter(
                ( id ) => ! leaving.some( ( a ) => a.id === id && a.draft )
            ),
            { undoable: true }
        );
    };

    useEffect( () => {
        if ( missingIds ) {
            removeArtboards( missingIds.split( ',' ) );
        }
    }, [ missingIds, removeArtboards ] );

    const focused = artboards.find(
        ( artboard ) => artboard.id === ( liveId || browsingId || selectedId )
    );
    const entityInfo = useEntityInfo( focused );
    const [ resizeListener, areaSize ] = useResizeObserver();
    const size = useMemo(
        () => ( {
            width: areaSize.width ?? 0,
            height: areaSize.height ?? 0,
        } ),
        [ areaSize.width, areaSize.height ]
    );
    const layout = useSelect(
        ( select ) => select( boardStore ).getArtboards(),
        []
    );
    const rects = useMemo(
        () =>
            layout
                // Media objects are images and browsers are pages of the
                // site, both outside the tiers.
                .filter( ( artboard ) => KINDS[ artboard.kind ].isTiered )
                .map( ( artboard ) => ( {
                    id: artboard.id,
                    ...rectOf( artboard, widthOf ),
                } ) ),
        [ layout, widthOf ]
    );
    const settledViewport = useSelect(
        ( select ) => select( boardStore ).getViewport(),
        []
    );
    const warmIds = useSelect(
        ( select ) => select( boardStore ).getWarmIds(),
        []
    );
    const styles = useGlobalStyles( serverSettings );
    // The number of the stylesheet each artboard's frozen copy was made
    // with. An artboard rendered once for a copy that gave nothing to freeze
    // has the number of that render.
    const [ rendered, setRendered ] = useState( () => new Map() );
    const noteRendered = useCallback(
        ( id, number ) =>
            setRendered( ( current ) =>
                current.get( id ) === number
                    ? current
                    : new Map( current ).set( id, number )
            ),
        []
    );
    const failedKey = artboards
        .filter( ( artboard ) => artboard.status === 'failed' )
        .map( ( artboard ) => artboard.id )
        .join( ' ' );
    // A frozen copy made with an older stylesheet than the settled one does
    // not count: the artboard is rendered once more to renew it (D51).
    const settledStyles = styles.settledVersion;
    const hasCopy = useCallback(
        ( id ) =>
            failedKey.split( ' ' ).includes( id ) ||
            rendered.get( id ) >= settledStyles,
        [ rendered, failedKey, settledStyles ]
    );
    const { tiers, mounted, source } = useTiers( {
        rects,
        viewport: settledViewport,
        size,
        liveId,
        warmIds,
        onMount: ( id ) => counters.mountOrder.push( id ),
        hasCopy,
    } );
    // The Board actions seam of the agent surface (spec/agent/surface.md,
    // Seams): what the board shows, read from the stores as they are now.
    const tiersRef = useRef( tiers );
    tiersRef.current = tiers;
    const readBoard = () => {
        const board = registry.select( boardStore );
        return {
            id: board.getBoardId(),
            title: board.getTitle(),
            artboards: orderedArtboards( readArtboards( registry.select ) ),
            notes: board.getNotes(),
            selection: board.getSelectedIds(),
            edit: board.getEditId(),
            zoom: board.getViewport().zoom,
            tierOf: ( id ) => tiersRef.current.get( id ) || 'ghost',
            widthOf: ( artboard ) =>
                hasDevice( artboard )
                    ? widthOf( artboard.device )
                    : artboard.width,
        };
    };
    const usage = useUsageIndex( artboards, styles.merged );
    const stylesPanel = useStylesPanel( {
        styles,
        serverSettings,
        usesOf: usage.usesOf,
    } );
    // The token picked in the Tokens tab, and where it is used.
    const token = useMemo( () => {
        if ( ! selectedToken ) {
            return null;
        }
        if ( selectedToken.type === 'color' ) {
            return { type: 'color', slug: selectedToken.slug };
        }
        return selectedToken.slug.startsWith( 'family:' )
            ? {
                  type: 'font-family',
                  slug: selectedToken.slug.slice( 'family:'.length ),
              }
            : { type: 'font-size', slug: selectedToken.slug };
    }, [ selectedToken ] );
    const located = useMemo(
        () => ( token ? usage.locate( token.type, token.slug ) : null ),
        [ token, usage ]
    );
    const previewSettings = useMemo( () => {
        if ( ! token ) {
            return styles.editorSettings;
        }
        const brand = brandColor();
        return {
            ...styles.editorSettings,
            styles: [
                ...( styles.editorSettings.styles ?? [] ),
                { css: highlightCss( token.type, token.slug, brand ) },
            ],
        };
    }, [ styles.editorSettings, token ] );
    // What every Preview is rendered from: the shared styles and the content
    // of the board's entities. A Snapshot taken from an older version is
    // stale until it becomes a Preview again.
    const versionRef = useRef( { settings: null, usage: null, value: 0 } );
    if (
        versionRef.current.settings !== styles.editorSettings ||
        versionRef.current.usage !== usage.entities
    ) {
        versionRef.current = {
            settings: styles.editorSettings,
            usage: usage.entities,
            value: versionRef.current.value + 1,
        };
    }
    const renderVersion = versionRef.current.value;

    // A browser stops browsing when it is no longer selected (D38, D55), for
    // example when the inserter places something.
    const isBrowsingSelected = selectedIds.includes( browsingId );
    const leaveEdit = editing.leaveEdit;
    useEffect( () => {
        if ( browsingId && ! isBrowsingSelected ) {
            leaveEdit();
        }
    }, [ browsingId, isBrowsingSelected, leaveEdit ] );

    // The seams of the agent surface (spec/agent/surface.md, Seams): each
    // function is the one a control calls, onto the hooks above. They are
    // filled once the render is committed; the surface's own logic is in
    // `src/agent/`. What a seam function reads after an await is read from a
    // ref, since the board may have drawn in between. They stay empty until
    // the board has loaded, and read what the render below defines.
    useEffect( () => {
        if ( ! isLoaded ) {
            return;
        }
        editSeam.current = {
            bridgeRef: editing.bridgeRef,
            // A click on the row, then Enter (L4, D6). A held lock opens no
            // dialog.
            enter: async ( id ) => {
                const result = await editing.enterEdit( id, { quiet: true } );
                if ( result === 'entered' ) {
                    canvas.reveal( id );
                }
                return result;
            },
            leave: editing.leaveEdit,
            liveId: () => registry.select( boardStore ).getLiveId(),
        };
        actionsSeam.current = {
            registry,
            board: readBoard,
            // What the targets say an artboard, and a block of it, is.
            whereOf: kindAndDevice,
            whereOfBlocks: nameAndDevice,
            noteLabel: __( 'Note', 'wordpress-for-designers' ),
            stylesLabel: __( 'Styles', 'wordpress-for-designers' ),
            // The Styles panel: its rows, its colour picker, its stock
            // screens and its variation menu.
            stylesPanel: () => stylesPanel,
            // The styles part says when a change is compiled and in the
            // artboards.
            whenStylesCompiled: () => styles.whenCompiled(),
            // The Review key of the Styles item.
            stylesKey: () =>
                styles.id ? `root/globalStyles/${ styles.id }` : null,
            // A click on a token's row (S4, S5), without the colour picker;
            // with no kind, the selected token is cleared. Gives the banner's
            // numbers.
            showUses: ( kind, slug ) => {
                if ( ! kind ) {
                    setSelectedToken( null );
                    return { places: 0, artboards: [] };
                }
                if ( kind === 'color' ) {
                    setSelectedToken( { type: 'color', slug } );
                } else {
                    setSelectedToken( {
                        type: 'typography',
                        slug:
                            kind === 'font-family' ? `family:${ slug }` : slug,
                    } );
                }
                const found = usage.locate( kind, slug );
                return {
                    places: found.places,
                    artboards: [ ...found.perArtboard.keys() ],
                };
            },
            // The cards of the Review drawer.
            reviewItems: () =>
                review.readItems().map( ( item ) => ( {
                    key: item.key,
                    type: item.type,
                    name: item.name,
                    isNew: item.isNew,
                    lines: [
                        ...item.lines,
                        ...( item.moreCount > 0
                            ? [ moreLine( item.moreCount ) ]
                            : [] ),
                        ...( item.artboardCount !== undefined
                            ? [ artboardsLine( item.artboardCount ) ]
                            : [] ),
                    ],
                } ) ),
            // "Discard" on a card, after its confirmation (D48).
            discardItem: review.discardKey,
            // For authorship: each unsaved item with its edits as they are now,
            // the item an artboard shows, and whether history is being stepped.
            changeMarks: () =>
                changedEntries( registry.select ).map( ( entry ) => [
                    entry.key,
                    registry
                        .select( coreStore )
                        .getEntityRecordEdits(
                            entry.kind,
                            entry.name,
                            entry.id
                        ),
                ] ),
            itemKeyOf,
            isHistoryStep,
            // The inserter: its lists, and what a row does.
            inserterData: () => inserterDataRef.current,
            inserter: () => inserterRef.current,
            // A New row and the click that places it (D63); by default in a
            // free place in view.
            place: ( choice, point ) =>
                placing.create(
                    placing.named( choice ),
                    point ?? findSpaceRef.current( null )
                ),
            // While the designer cannot use the board either (D49, and an open
            // dialog or drawer).
            isBlocked: () =>
                ! windowHasRoom() ||
                review.isOpen ||
                !! editing.lockDialog ||
                !! removing ||
                isShortcutsOpen,
            // A click on a row (L4); several rows selected together, then "Fit
            // selection" (D41, H8).
            selectRows: ( ids ) => {
                if ( ids.length === 1 ) {
                    selectArtboard( ids[ 0 ] );
                    canvas.reveal( ids[ 0 ] );
                } else {
                    selectArtboards( ids );
                    canvas.zoom( 'fit-selection' );
                }
            },
            // The device control (E6) and a drag of the artboard (A3).
            setDevice: setArtboardDevice,
            move: ( id, x, y ) => moveArtboards( [ { id, x, y } ] ),
            // A browser's address field (D55).
            setAddress: ( id, path ) => updateArtboard( id, { path } ),
            // Delete with several artboards selected (D41).
            remove: removeMany,
        };
    } );

    if ( ! isLoaded ) {
        return null;
    }

    const selected = artboards.find( ( a ) => a.id === selectedId );
    const live = artboards.find( ( a ) => a.id === liveId );
    const selectedGuide = guides.find(
        ( guide ) => guide.id === selectedGuideId
    );
    // The artboard in edit: the Live editor, or the browser being browsed,
    // which has no blocks (D55).
    const inEdit =
        live ?? artboards.find( ( a ) => a.id === browsingId ) ?? null;
    const removing = artboards.find( ( a ) => a.id === removingId );
    let banner = null;
    if ( styles.preview?.banner ) {
        banner = <PreviewBanner { ...styles.preview.banner } />;
    } else if ( token && located && ! inEdit && ! selected ) {
        const picked =
            stylesPanel.panelProps.colors.find(
                ( color ) => token.type === 'color' && color.slug === token.slug
            ) ||
            stylesPanel.panelProps.typography.find(
                ( row ) => row.slug === selectedToken.slug
            );
        banner = (
            <UsageBanner
                usage={ {
                    name: picked?.name ?? token.slug,
                    color: picked?.color,
                    places: located.places,
                    artboards: located.artboards,
                } }
            />
        );
    }
    if ( preview.isFailing ) {
        // Above the banner of the Styles screens, when there is one (D61).
        banner = (
            <>
                <SavingBanner />
                { banner }
            </>
        );
    }
    const pointOf = ( event ) => {
        const box = areaRef.current.getBoundingClientRect();
        return viewport.toBoard( {
            x: event.clientX - box.left,
            y: event.clientY - box.top,
        } );
    };
    const focusBoard = () => areaRef.current?.focus( { preventScroll: true } );

    let left = null;
    if ( isInserterOpen ) {
        const named = withBoardNames( inserterData, artboards );
        left = (
            <InserterPanel
                query={ inserterQuery }
                onQueryChange={ setInserterQuery }
                tab={ inserterTab }
                onTabChange={ setInserterTab }
                liveArtboardName={ live?.name ?? null }
                blocks={ inserterData.blocks }
                pages={ named.pages }
                newRows={ placing.newRows }
                onNewClick={ placing.arm }
                patterns={ named.patterns }
                templates={ inserterData.templates }
                templateParts={ inserterData.templateParts }
                media={ inserterData.media }
                { ...inserter.panelProps }
            />
        );
    } else if ( live ) {
        left = isListViewOpen ? (
            <ListViewPanel onClose={ () => setListViewOpen( false ) } />
        ) : null;
    } else {
        left = (
            <ArtboardsPanel
                artboards={ artboards }
                notes={ notes }
                selectedIds={ selectedIds }
                onEditNote={ startNoteEdit }
                onSelect={ ( id, event ) => {
                    const ordered = [
                        ...orderedArtboards( artboards ),
                        ...notes,
                    ].map( ( item ) => item.id );
                    const from = ordered.indexOf( anchorId );
                    if ( event?.shiftKey && from !== -1 ) {
                        // Shift + click selects from the row clicked last
                        // to this one.
                        const to = ordered.indexOf( id );
                        selectArtboards(
                            ordered.slice(
                                Math.min( from, to ),
                                Math.max( from, to ) + 1
                            )
                        );
                    } else if ( event?.metaKey || event?.ctrlKey ) {
                        toggleArtboardSelection( id );
                    } else {
                        selectArtboard( id );
                        canvas.reveal( id );
                    }
                } }
                onEdit={ onEdit }
                onRemove={ () => {
                    // Delete on a row acts on the selection, as on the
                    // board.
                    if ( selectedId ) {
                        setRemovingId( selectedId );
                    } else if ( selectedIds.length ) {
                        removeMany( selectedIds );
                        // The focused row may be gone.
                        focusBoard();
                    }
                } }
            />
        );
    }

    // The left panel is shown when it is not hidden and has something in it.
    const isLeftShown = ! isLeftHidden && !! left;
    const showLeft = () => {
        setLeftHidden( false );
        if ( live && ! isInserterOpen && ! isListViewOpen ) {
            setListViewOpen( true );
        }
    };
    togglePanels.current = () => {
        if ( isLeftShown || ! isRightHidden ) {
            setLeftHidden( true );
            setRightHidden( true );
        } else {
            showLeft();
            setRightHidden( false );
        }
    };

    let right;
    if ( live ) {
        right = (
            <EditingPanel
                artboard={ live }
                info={ entityInfo }
                tab={ editingTab }
                onTabChange={ setEditingTab }
                onDeviceChange={ ( device ) =>
                    setArtboardDevice( live.id, device )
                }
                blockTitle={ editing.selectedBlock?.title }
                scope={ scope }
                onScopeChange={ setScope }
                blockStyles={
                    editing.selectedBlock && scope === 'all'
                        ? stylesPanel.blockStylesFor(
                              editing.selectedBlock.name,
                              () => setScope( 'block' )
                          )
                        : null
                }
            />
        );
    } else if ( selectedGuide ) {
        const owner = artboards.find(
            ( artboard ) => artboard.id === selectedGuide.artboard
        );
        right = (
            <GuideSettings
                guide={ selectedGuide }
                artboardName={ owner?.name }
                range={ guideRange( selectedGuide.axis, owner, widthOf ) }
                onMove={ ( at ) => moveGuide( selectedGuide.id, at ) }
                onRemove={ () => {
                    removeGuide( selectedGuide.id );
                    focusBoard();
                } }
            />
        );
    } else if ( selectedNoteId ) {
        right = (
            <NoteSettings
                note={ notes.find( ( note ) => note.id === selectedNoteId ) }
                onColorChange={ ( color ) =>
                    setNoteColor( selectedNoteId, color )
                }
                onRemove={ () => {
                    removeMany( [ selectedNoteId ] );
                    focusBoard();
                } }
            />
        );
    } else if ( selected ) {
        right = (
            <ArtboardSettings
                artboard={ selected }
                info={ entityInfo }
                onDeviceChange={ ( device ) =>
                    setArtboardDevice( selected.id, device )
                }
                onEdit={ () => onEdit( selected.id ) }
                onRemove={ () => setRemovingId( selected.id ) }
                isBrowsing={ selected.id === browsingId }
                onReload={ () => reloadBrowser( selected.id ) }
                onShowsChange={ ( shows ) =>
                    updateArtboard( selected.id, { shows } )
                }
            />
        );
    } else {
        right = (
            <StylesPanel
                { ...stylesPanel.panelProps }
                selectedToken={ selectedToken }
                onSelectToken={ setSelectedToken }
            />
        );
    }

    return (
        <SlotFillProvider>
            <ShortcutProvider className="wfd-shortcuts">
                <Shell
                    header={
                        <Header
                            boardsUrl={ boardsUrl }
                            boardName={ title }
                            liveName={ inEdit ? liveLabel( inEdit ) : null }
                            isInserterOpen={ isInserterOpen }
                            onToggleInserter={ () => {
                                if ( ! isInserterOpen ) {
                                    setLeftHidden( false );
                                }
                                setInserterOpen( ! isInserterOpen );
                            } }
                            onBack={ editing.leaveEdit }
                            undo={
                                live
                                    ? {
                                          label: hasContentUndo
                                              ? contentTooltip(
                                                    live.name,
                                                    true
                                                )
                                              : __(
                                                    'Undo',
                                                    'wordpress-for-designers'
                                                ),
                                          disabled: ! hasContentUndo,
                                          onClick: () =>
                                              historyStep( undoContent ),
                                      }
                                    : {
                                          label: layoutTooltip(
                                              undoName,
                                              true
                                          ),
                                          disabled: ! undoName,
                                          onClick: undoLayout,
                                      }
                            }
                            redo={
                                live
                                    ? {
                                          label: hasContentRedo
                                              ? contentTooltip(
                                                    live.name,
                                                    false
                                                )
                                              : __(
                                                    'Redo',
                                                    'wordpress-for-designers'
                                                ),
                                          disabled: ! hasContentRedo,
                                          onClick: () =>
                                              historyStep( redoContent ),
                                      }
                                    : {
                                          label: layoutTooltip(
                                              redoName,
                                              false
                                          ),
                                          disabled: ! redoName,
                                          onClick: redoLayout,
                                      }
                            }
                            isListViewOpen={ !! live && isListViewOpen }
                            isListViewDisabled={ ! live }
                            onToggleListView={ () => {
                                if ( ! isListViewOpen ) {
                                    setLeftHidden( false );
                                }
                                setListViewOpen( ! isListViewOpen );
                            } }
                            isLeftShown={ isLeftShown }
                            onToggleLeft={ () =>
                                isLeftShown ? setLeftHidden( true ) : showLeft()
                            }
                            isRightShown={ ! isRightHidden }
                            onToggleRight={ () =>
                                setRightHidden( ! isRightHidden )
                            }
                            zoomPercent={ Math.round( zoom * 100 ) }
                            onZoom={ canvas.zoom }
                            canFitSelection={ selectedIds.length > 0 }
                            isRulersShown={ view.rulers }
                            isGuidesShown={ view.guides }
                            onToggleRulers={ toggleRulers }
                            onToggleGuides={ toggleGuides }
                            isNoteToolArmed={ isNoteToolArmed }
                            isNoteToolDisabled={ !! inEdit }
                            onToggleNoteTool={ () =>
                                setNoteToolArmed( ! isNoteToolArmed )
                            }
                            canTidy={ ! inEdit && artboards.length > 1 }
                            onTidy={ () => {
                                moveArtboards(
                                    tidyMoves( artboards, widthOf ),
                                    'tidy'
                                );
                                canvas.zoom( 'fit-all' );
                            } }
                            reviewCount={ review.count }
                            onReview={ review.open }
                            agentChip={ marks.chip }
                        />
                    }
                    left={ isLeftHidden ? null : left }
                    onRevealLeft={ showLeft }
                    onRevealRight={ () => setRightHidden( false ) }
                    canvas={
                        <Canvas
                            ref={ areaRef }
                            surfaceRef={ surfaceRef }
                            resizeListener={ resizeListener }
                            { ...inserter.canvasDropProps }
                            banner={ banner }
                            rulers={
                                view.rulers ? (
                                    <Rulers
                                        ref={ rulersRef }
                                        viewport={ viewport }
                                        context={ rulerContext }
                                        guides={ guides }
                                        onPull={ ( axis, event ) =>
                                            canvas.pullGuide( axis, event )
                                        }
                                    />
                                ) : null
                            }
                            overlay={
                                inserter.dropTarget ? (
                                    <PlacementOutline
                                        rect={ {
                                            x: inserter.dropTarget.x,
                                            y: inserter.dropTarget.y,
                                            width: widthOf( 'desktop' ),
                                            height: NEW_ARTBOARD_HEIGHT,
                                            ...inserter.dropTarget.size,
                                        } }
                                        label={ artboardLabel( {
                                            name: inserter.dropTarget.name,
                                            kind: inserter.dropTarget.kind,
                                            device: 'desktop',
                                        } ) }
                                        hint={ __(
                                            'Drop to open as an artboard',
                                            'wordpress-for-designers'
                                        ) }
                                    />
                                ) : (
                                    placing.placement &&
                                    ghost && (
                                        <PlacementOutline
                                            rect={ {
                                                ...ghost,
                                                width: widthOf( 'desktop' ),
                                                height: NEW_ARTBOARD_HEIGHT,
                                            } }
                                            label={ artboardLabel( {
                                                name: placing.placement.name,
                                                kind: placing.placement.kind,
                                                device: 'desktop',
                                            } ) }
                                            hint={ __(
                                                'Click to place',
                                                'wordpress-for-designers'
                                            ) }
                                        />
                                    )
                                )
                            }
                            placer={
                                isNoteToolArmed && ! inEdit ? (
                                    <div
                                        className="wfd-canvas__placer"
                                        data-wfd-placer="note"
                                        onPointerDown={ ( event ) =>
                                            event.stopPropagation()
                                        }
                                        onPointerUp={ ( event ) => {
                                            event.stopPropagation();
                                            if ( event.button === 0 ) {
                                                const at = pointOf( event );
                                                addNote( {
                                                    id: uuid(),
                                                    x: Math.round( at.x ),
                                                    y: Math.round( at.y ),
                                                } );
                                            }
                                        } }
                                    />
                                ) : (
                                    placing.placement && (
                                        <div
                                            className="wfd-canvas__placer"
                                            data-wfd-placer
                                            onPointerMove={ ( event ) =>
                                                setGhost( pointOf( event ) )
                                            }
                                            onPointerDown={ ( event ) =>
                                                event.stopPropagation()
                                            }
                                            onPointerUp={ ( event ) => {
                                                event.stopPropagation();
                                                if ( event.button === 0 ) {
                                                    setGhost( null );
                                                    placing.place(
                                                        pointOf( event )
                                                    );
                                                }
                                            } }
                                        />
                                    )
                                )
                            }
                            emptyState={
                                artboards.length || placing.placement ? null : (
                                    <EmptyBoard
                                        onAdd={ () => {
                                            setLeftHidden( false );
                                            setInserterOpen( true );
                                        } }
                                    />
                                )
                            }
                        >
                            { artboards.map( ( artboard ) => {
                                const isMedia = artboard.kind === 'media';
                                const isBrowser = artboard.kind === 'browser';
                                let tier = isMedia
                                    ? 'media'
                                    : tiers.get( artboard.id ) || 'ghost';
                                if ( isBrowser ) {
                                    tier = browserTier( artboard, {
                                        browsingId,
                                        rect: rectOf( artboard, widthOf ),
                                        viewport: settledViewport,
                                        size,
                                    } );
                                }
                                const width = hasDevice( artboard )
                                    ? widthOf( artboard.device )
                                    : artboard.width;
                                const hasFailed = artboard.status === 'failed';
                                const ownGuides = guides.filter(
                                    ( guide ) => guide.artboard === artboard.id
                                );
                                const hasCopyNow = snapshots.has( artboard.id );
                                // What the artboard showed before may stay
                                // over what it now shows until that is
                                // drawn (D100).
                                const canHandOver =
                                    ! isMedia &&
                                    ! isBrowser &&
                                    ! hasFailed &&
                                    // A frozen copy is needed on either
                                    // side of a Snapshot.
                                    ( tier === 'live' ||
                                        tier === 'warm' ||
                                        hasCopyNow );
                                const onHeight = ( height ) =>
                                    updateArtboard( artboard.id, { height } );
                                const contentFor = ( outgoing ) => {
                                    let content = null;
                                    // The one render of a Snapshot artboard
                                    // that has no frozen copy, or whose copy
                                    // was made with older styles (D51). It
                                    // takes the styles without the highlight
                                    // of the picked token, which a frozen
                                    // copy would keep after the token is
                                    // let go.
                                    const once = tier === 'snapshot' &&
                                        source === artboard.id &&
                                        ! hasCopy( artboard.id ) && (
                                            <ArtboardPreviewOnce
                                                key="once"
                                                artboard={ artboard }
                                                width={ width }
                                                settings={
                                                    styles.editorSettings
                                                }
                                                isBusy={ viewport.isGesturing }
                                                onSettled={ (
                                                    element,
                                                    height
                                                ) => {
                                                    if ( height ) {
                                                        onHeight( height );
                                                    }
                                                    snapshots.capture(
                                                        artboard.id,
                                                        element,
                                                        renderVersion
                                                    );
                                                    noteRendered(
                                                        artboard.id,
                                                        settledStyles
                                                    );
                                                } }
                                            />
                                        );
                                    // The Preview and the frozen copy keep
                                    // their keys in every tier, so that one
                                    // left over another is the same element
                                    // and is not loaded again.
                                    const previewOf = ( isOver, isHeld ) => (
                                        <ArtboardPreview
                                            key="preview"
                                            artboard={ artboard }
                                            width={ width }
                                            settings={ previewSettings }
                                            onHeight={ onHeight }
                                            isOver={ isOver }
                                            isHeld={ isHeld }
                                            onFreeze={ ( element ) => {
                                                // A Preview that leaves
                                                // while a block in it is
                                                // loading is not copied:
                                                // the artboard is rendered
                                                // once for its copy.
                                                if (
                                                    ! isLoading( element ) &&
                                                    snapshots.capture(
                                                        artboard.id,
                                                        element,
                                                        renderVersion
                                                    )
                                                ) {
                                                    noteRendered(
                                                        artboard.id,
                                                        styles.version
                                                    );
                                                }
                                            } }
                                        />
                                    );
                                    const copyOf = ( isOver ) => (
                                        <ArtboardSnapshot
                                            key="copy"
                                            id={ artboard.id }
                                            store={ snapshots }
                                            isOver={ isOver }
                                        />
                                    );
                                    let incoming = false;
                                    if ( isMedia ) {
                                        content = (
                                            <ArtboardMedia
                                                record={ artboard.record }
                                            />
                                        );
                                    } else if (
                                        isBrowser &&
                                        tier !== 'ghost'
                                    ) {
                                        content = (
                                            <BrowserArtboard
                                                artboard={ artboard }
                                                isBrowsing={ tier === 'live' }
                                                homeUrl={ homeUrl }
                                                preview={ preview }
                                                onEscape={ editing.leaveEdit }
                                                onWheel={ canvas.forwardWheel }
                                            />
                                        );
                                    } else if (
                                        tier === 'live' ||
                                        tier === 'warm'
                                    ) {
                                        incoming = true;
                                        content = [
                                            <ArtboardEditor
                                                key="editor"
                                                artboard={ artboard }
                                                settings={ previewSettings }
                                                isActive={ tier === 'live' }
                                                onHeight={ onHeight }
                                                onWheel={ canvas.forwardWheel }
                                                onDocument={
                                                    canvas.watchDocument
                                                }
                                                onKeyDownCapture={
                                                    editing.noteKeyDown
                                                }
                                                bridgeRef={ editing.bridgeRef }
                                                onSelection={
                                                    editing.setSelectedBlock
                                                }
                                                onAllowedBlocks={
                                                    editing.setAllowedBlocks
                                                }
                                            />,
                                            outgoing === 'preview' &&
                                                previewOf( true ),
                                        ];
                                    } else if (
                                        tier === 'preview' &&
                                        mounted.has( artboard.id )
                                    ) {
                                        incoming = true;
                                        content = [
                                            // Under the copy it replaces, its
                                            // height waits: it changes several
                                            // times before it has settled, and
                                            // the artboard would follow.
                                            previewOf(
                                                false,
                                                outgoing === 'snapshot'
                                            ),
                                            outgoing === 'snapshot' &&
                                                copyOf( true ),
                                        ];
                                    } else if (
                                        tier === 'preview' &&
                                        outgoing === 'snapshot'
                                    ) {
                                        // Waiting for its turn in the queue.
                                        content = [ copyOf( false ) ];
                                    } else if (
                                        tier === 'snapshot' &&
                                        hasCopyNow
                                    ) {
                                        // The frozen copy of its last Preview.
                                        // After a style change it lies over
                                        // the render that will replace it.
                                        incoming = true;
                                        content = [
                                            once,
                                            copyOf( !! once ),
                                            outgoing === 'preview' &&
                                                previewOf( true ),
                                        ];
                                    } else if ( once ) {
                                        // Never rendered: rendered once here to
                                        // make its frozen copy.
                                        content = [
                                            once,
                                            <Skeleton
                                                key="skeleton"
                                                className="wfd-artboard__skeleton"
                                            />,
                                        ];
                                    } else if (
                                        tier === 'preview' ||
                                        ( tier === 'snapshot' &&
                                            ! rendered.has( artboard.id ) )
                                    ) {
                                        // Never rendered yet.
                                        content = (
                                            <Skeleton className="wfd-artboard__skeleton" />
                                        );
                                    }
                                    if ( hasFailed ) {
                                        content = (
                                            <ArtboardError
                                                kind={ artboard.kind }
                                                onRetry={ () =>
                                                    invalidateResolution(
                                                        'getEntityRecord',
                                                        [
                                                            'postType',
                                                            KINDS[
                                                                artboard.kind
                                                            ].postType,
                                                            artboard.entityId,
                                                        ]
                                                    )
                                                }
                                            />
                                        );
                                    }
                                    return { content, incoming };
                                };
                                return (
                                    <ArtboardFrame
                                        key={ artboard.id }
                                        artboard={ artboard }
                                        width={ width }
                                        tier={ tier }
                                        isSelected={ selectedIds.includes(
                                            artboard.id
                                        ) }
                                        guides={
                                            ownGuides.length > 0 &&
                                            ownGuides.map( ( guide ) => (
                                                <Guide
                                                    key={ guide.id }
                                                    guide={ guide }
                                                    isSelected={
                                                        guide.id ===
                                                        selectedGuideId
                                                    }
                                                    range={ guideRange(
                                                        guide.axis,
                                                        artboard,
                                                        widthOf
                                                    ) }
                                                />
                                            ) )
                                        }
                                        uses={ located?.perArtboard.get(
                                            artboard.id
                                        ) }
                                        isChanged={ review.changedArtboardIds?.has(
                                            artboard.id
                                        ) }
                                        isAgentWorking={ marks.working.includes(
                                            artboard.id
                                        ) }
                                        isAgentChanged={ [
                                            'agent',
                                            'both',
                                        ].includes(
                                            marks.authors[
                                                itemKeyOf( artboard )
                                            ]
                                        ) }
                                        hasError={ hasFailed }
                                        isStale={
                                            tier === 'snapshot' &&
                                            snapshots.isStale(
                                                artboard.id,
                                                renderVersion
                                            )
                                        }
                                        onDeviceChange={ ( device ) =>
                                            setArtboardDevice(
                                                artboard.id,
                                                device
                                            )
                                        }
                                        isRenaming={
                                            rename.renamingId === artboard.id
                                        }
                                        onRename={ rename.end }
                                        onAddress={ ( path ) =>
                                            updateArtboard( artboard.id, {
                                                path,
                                            } )
                                        }
                                        onReload={ () =>
                                            reloadBrowser( artboard.id )
                                        }
                                    >
                                        <TierContent
                                            tier={ tier }
                                            canHandOver={ canHandOver }
                                            contentFor={ contentFor }
                                        />
                                    </ArtboardFrame>
                                );
                            } ) }
                            { guides
                                .filter( ( guide ) => ! guide.artboard )
                                .map( ( guide ) => (
                                    <Guide
                                        key={ guide.id }
                                        guide={ guide }
                                        isSelected={
                                            guide.id === selectedGuideId
                                        }
                                    />
                                ) ) }
                            { ( view.rulers || guides.length > 0 ) && (
                                <GuideDrag />
                            ) }
                            { notes.map( ( note ) => (
                                <Note
                                    key={ note.id }
                                    note={ note }
                                    isSelected={ selectedIds.includes(
                                        note.id
                                    ) }
                                    isEditing={ editingNoteId === note.id }
                                    onText={ ( text ) =>
                                        setNoteText( note.id, text )
                                    }
                                    onEndEdit={ ( refocus ) => {
                                        endNoteEdit();
                                        if ( refocus ) {
                                            focusBoard();
                                        }
                                    } }
                                    onHeight={ ( height ) =>
                                        setNoteHeight( note.id, height )
                                    }
                                />
                            ) ) }
                        </Canvas>
                    }
                    right={ isRightHidden ? null : right }
                    corner={
                        <>
                            <Snackbars />
                            <ShortcutsButton
                                onClick={ () => setShortcutsOpen( true ) }
                            />
                        </>
                    }
                    overlays={
                        <>
                            { isShortcutsOpen && (
                                <ShortcutsDialog
                                    ownerDocument={
                                        areaRef.current.ownerDocument
                                    }
                                    onClose={ () => setShortcutsOpen( false ) }
                                />
                            ) }
                            <ReviewDrawer
                                { ...review.drawerProps }
                                authors={ marks.authors }
                            />
                            { editing.lockDialog && (
                                <LockDialog
                                    state={ editing.lockDialog.state }
                                    userName={ editing.lockDialog.userName }
                                    onTakeOver={ editing.takeOver }
                                    onClose={ () => {
                                        editing.closeLockDialog();
                                        focusBoard();
                                    } }
                                />
                            ) }
                            { removing && (
                                <RemoveDialog
                                    artboard={ removing }
                                    { ...removalInfo( removing ) }
                                    onCancel={ () => {
                                        setRemovingId( null );
                                        focusBoard();
                                    } }
                                    onConfirm={ async ( alsoActOnEntity ) => {
                                        await remove(
                                            removing,
                                            alsoActOnEntity
                                        );
                                        setRemovingId( null );
                                        focusBoard();
                                    } }
                                />
                            ) }
                        </>
                    }
                />
            </ShortcutProvider>
            <Popover.Slot />
        </SlotFillProvider>
    );
}
