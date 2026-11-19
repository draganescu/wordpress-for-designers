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
import { useDispatch, useSelect } from '@wordpress/data';
import { store as coreStore, useEntityRecord } from '@wordpress/core-data';
import { ShortcutProvider } from '@wordpress/keyboard-shortcuts';
import { SlotFillProvider, Popover } from '@wordpress/components';
import { useResizeObserver } from '@wordpress/compose';
import { Skeleton, useEnableWpCompatOverlaySlot } from '@wordpress/ui';
import { store as boardStore } from '../board-store';
import { useLayoutAutosave } from '../board-store/use-layout-autosave';
import { usePreviewPush } from './use-preview-push';
import { createViewport } from '../viewport';
import { ArtboardEditor } from '../artboard-editor';
import {
    ArtboardBrowser,
    ArtboardError,
    ArtboardFrame,
    ArtboardMedia,
} from '../artboard-frame';
import { ArtboardPreview, ArtboardPreviewOnce } from '../artboard-preview';
import { ArtboardSnapshot, createSnapshotStore } from '../artboard-snapshot';
import { isNearView, useTiers } from '../tier-scheduler';
import { InserterPanel } from '../inserter/inserter-panel';
import { useInserterActions } from '../inserter/use-inserter-actions';
import { useInserterData } from '../inserter/use-inserter-data';
import { StylesPanel } from '../styles/styles-panel';
import { useGlobalStyles } from '../styles/use-global-styles';
import { useStylesPanel } from '../styles/use-styles-panel';
import { ReviewDrawer } from '../review/review-drawer';
import { useReview } from '../review/use-review';
import { brandColor, highlightCss, useUsageIndex } from '../usage-index';
import { AddArtboardMenu } from './add-artboard-menu';
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
    UsageBanner,
} from './canvas';
import { KINDS } from './constants';
import { LockDialog, RemoveDialog } from './dialogs';
import { ShortcutsButton, ShortcutsDialog } from './shortcuts-dialog';
import { Note, NoteSettings } from './notes';
import { Header } from './header';
import { artboardLabel, liveLabel } from './labels';
import { ArtboardSettings, EditingPanel } from './right-panel';
import { Shell } from './shell';
import { useDeviceWidths } from './device-widths';
import { bootEditor, serverSettings } from './editor-settings';
import { counters, countRender, expose } from './test-hooks';
import { useArtboards } from './use-artboards';
import { rectOf, useCanvasInteractions } from './use-canvas-interactions';
import { tidyMoves } from './tidy';
import { useEditing } from './use-editing';
import { useEntityInfo } from './use-entity-info';
import { NEW_ARTBOARD_HEIGHT, usePlacement } from './use-placement';
import { removalInfo, useRemoval } from './use-removal';

const { boardId, boardsUrl, userId, theme, homeUrl, preview } =
    window.wfdConfig;
bootEditor();

const VIEWPORT_KEY = `wfd/viewport/${ userId }/${ boardId }`;

/**
 * Names of layout changes, for the Undo and Redo tooltips.
 */
/**
 * Board units between a clicked inserter item and what it was moved past.
 */
const PLACEMENT_GAP = 80;

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
};

function readStoredViewport() {
    try {
        const stored = JSON.parse(
            window.localStorage.getItem( VIEWPORT_KEY )
        );
        if (
            stored &&
            [ stored.x, stored.y, stored.zoom ].every( Number.isFinite )
        ) {
            return stored;
        }
    } catch {
        // Nothing stored, or storage is not available.
    }
    return null;
}

function storeViewport( state ) {
    try {
        window.localStorage.setItem( VIEWPORT_KEY, JSON.stringify( state ) );
    } catch {
        // Storage is not available; the board opens fitted next time.
    }
}

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
                record.layout?.notes ?? []
            );
        }
    }, [ record, isLoaded, setBoard ] );
    return isLoaded;
}

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
    const isLoaded = useBoard();
    useLayoutAutosave();
    usePreviewPush();
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
        siteVersion,
        previewVersion,
        previewValue,
    } = useSelect( ( select ) => {
        const board = select( boardStore );
        return {
            siteVersion: board.getSiteVersion(),
            previewVersion: board.getPreviewVersion(),
            previewValue: board.getPreviewValue() ?? preview,
            notes: board.getNotes(),
            selectedNoteId: board.getSelectedNoteId(),
            editingNoteId: board.getEditingNoteId(),
            isNoteToolArmed: board.isNoteToolArmed(),
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
    } = useDispatch( boardStore );
    // Reloads asked for each browser (D55), by id.
    const [ reloads, setReloads ] = useState( {} );
    const reload = ( id ) =>
        setReloads( ( current ) => ( {
            ...current,
            [ id ]: ( current[ id ] ?? 0 ) + 1,
        } ) );

    // Hidden panels (D32): kept for the session only.
    const [ isLeftHidden, setLeftHidden ] = useState( false );
    const [ isRightHidden, setRightHidden ] = useState( false );
    const togglePanels = useRef( null );
    const [ isShortcutsOpen, setShortcutsOpen ] = useState( false );
    const [ inserterQuery, setInserterQuery ] = useState( '' );
    const [ inserterTab, setInserterTab ] = useState( 'blocks' );
    const [ selectedToken, setSelectedToken ] = useState( null );
    const [ scope, setScope ] = useState( 'block' );
    const [ editingTab, setEditingTab ] = useState( 'entity' );
    const review = useReview();

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
        onTogglePanels: () => togglePanels.current?.(),
        onToggleShortcuts: () => setShortcutsOpen( ( isOpen ) => ! isOpen ),
        onRemoveMany: ( ids ) => removeMany( ids ),
        isReady: isLoaded,
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
        // A clicked item lands in the middle of the board in view, moved
        // right past anything it would cover, and is brought into view.
        findSpace: ( size ) => {
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
            const others = artboards.map( ( artboard ) =>
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
        },
    } );
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
        const leaving = artboards.filter( ( a ) => ids.includes( a.id ) );
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
                .filter(
                    ( artboard ) =>
                        artboard.kind !== 'media' && artboard.kind !== 'browser'
                )
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
    // Artboards whose one render for a frozen copy is over, with or without
    // a copy to show for it.
    const [ rendered, setRendered ] = useState( () => new Set() );
    const failedKey = artboards
        .filter( ( artboard ) => artboard.status === 'failed' )
        .map( ( artboard ) => artboard.id )
        .join( ' ' );
    const hasCopy = useCallback(
        ( id ) =>
            snapshots.has( id ) ||
            rendered.has( id ) ||
            failedKey.split( ' ' ).includes( id ),
        [ snapshots, rendered, failedKey ]
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
    const styles = useGlobalStyles( serverSettings );
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

    if ( ! isLoaded ) {
        return null;
    }

    const selected = artboards.find( ( a ) => a.id === selectedId );
    const live = artboards.find( ( a ) => a.id === liveId );
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
    const addMenu = (
        <AddArtboardMenu { ...placing.menu } onPick={ placing.arm } />
    );
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
        left = (
            <InserterPanel
                query={ inserterQuery }
                onQueryChange={ setInserterQuery }
                tab={ inserterTab }
                onTabChange={ setInserterTab }
                liveArtboardName={ live?.name ?? null }
                blocks={ inserterData.blocks }
                patterns={ inserterData.patterns }
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
                addMenu={ addMenu }
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
                              editing.selectedBlock.name
                          )
                        : null
                }
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
                onReload={ () => reload( selected.id ) }
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
                                          onClick: undoContent,
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
                                          onClick: redoContent,
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
                                                    id: window.crypto.randomUUID(),
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
                                        addMenu={
                                            <AddArtboardMenu
                                                trigger="button"
                                                { ...placing.menu }
                                                onPick={ placing.arm }
                                            />
                                        }
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
                                    // Loaded whenever it is near the view
                                    // (D55).
                                    if ( artboard.id === browsingId ) {
                                        tier = 'live';
                                    } else if (
                                        isNearView(
                                            rectOf( artboard, widthOf ),
                                            settledViewport,
                                            size
                                        )
                                    ) {
                                        tier = 'browser';
                                    } else {
                                        tier = 'ghost';
                                    }
                                }
                                const width = isMedia
                                    ? artboard.width
                                    : widthOf( artboard.device );
                                let content = null;
                                const onHeight = ( height ) =>
                                    updateArtboard( artboard.id, { height } );
                                if ( isMedia ) {
                                    content = (
                                        <ArtboardMedia
                                            record={ artboard.record }
                                        />
                                    );
                                } else if ( isBrowser && tier !== 'ghost' ) {
                                    // Unsaved changes are shown once they have
                                    // been sent (D57); until then, a Skeleton.
                                    const isPreview =
                                        artboard.shows === 'unsaved';
                                    content =
                                        isPreview && ! previewVersion ? (
                                            <Skeleton className="wfd-artboard__skeleton" />
                                        ) : (
                                            <ArtboardBrowser
                                                key={ artboard.shows }
                                                path={ artboard.path }
                                                homeUrl={ homeUrl }
                                                isBrowsing={ tier === 'live' }
                                                preview={
                                                    isPreview
                                                        ? previewValue
                                                        : null
                                                }
                                                reloadToken={
                                                    ( isPreview
                                                        ? previewVersion
                                                        : siteVersion ) +
                                                    ( reloads[ artboard.id ] ??
                                                        0 )
                                                }
                                                onNavigate={ ( path ) =>
                                                    updateArtboard(
                                                        artboard.id,
                                                        { path }
                                                    )
                                                }
                                                onEscape={ editing.leaveEdit }
                                                onWheel={ canvas.forwardWheel }
                                            />
                                        );
                                } else if (
                                    tier === 'live' ||
                                    tier === 'warm'
                                ) {
                                    content = (
                                        <ArtboardEditor
                                            artboard={ artboard }
                                            settings={ previewSettings }
                                            isActive={ tier === 'live' }
                                            onHeight={ onHeight }
                                            onWheel={ canvas.forwardWheel }
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
                                        />
                                    );
                                } else if (
                                    tier === 'preview' &&
                                    mounted.has( artboard.id )
                                ) {
                                    content = (
                                        <ArtboardPreview
                                            artboard={ artboard }
                                            width={ width }
                                            settings={ previewSettings }
                                            onHeight={ onHeight }
                                            onFreeze={ ( element ) =>
                                                snapshots.capture(
                                                    artboard.id,
                                                    element,
                                                    renderVersion
                                                )
                                            }
                                        />
                                    );
                                } else if (
                                    tier === 'snapshot' &&
                                    snapshots.has( artboard.id )
                                ) {
                                    // The frozen copy of its last Preview.
                                    content = (
                                        <ArtboardSnapshot
                                            id={ artboard.id }
                                            store={ snapshots }
                                        />
                                    );
                                } else if (
                                    tier === 'snapshot' &&
                                    source === artboard.id &&
                                    ! rendered.has( artboard.id )
                                ) {
                                    // Never rendered: rendered once here to
                                    // make its frozen copy.
                                    content = (
                                        <>
                                            <ArtboardPreviewOnce
                                                artboard={ artboard }
                                                width={ width }
                                                settings={ previewSettings }
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
                                                    setRendered( ( current ) =>
                                                        new Set( current ).add(
                                                            artboard.id
                                                        )
                                                    );
                                                } }
                                            />
                                            <Skeleton className="wfd-artboard__skeleton" />
                                        </>
                                    );
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
                                const hasFailed = artboard.status === 'failed';
                                if ( hasFailed ) {
                                    content = (
                                        <ArtboardError
                                            kind={ artboard.kind }
                                            onRetry={ () =>
                                                invalidateResolution(
                                                    'getEntityRecord',
                                                    [
                                                        'postType',
                                                        KINDS[ artboard.kind ]
                                                            .postType,
                                                        artboard.entityId,
                                                    ]
                                                )
                                            }
                                        />
                                    );
                                }
                                return (
                                    <ArtboardFrame
                                        key={ artboard.id }
                                        artboard={ artboard }
                                        width={ width }
                                        tier={ tier }
                                        isSelected={ selectedIds.includes(
                                            artboard.id
                                        ) }
                                        uses={ located?.perArtboard.get(
                                            artboard.id
                                        ) }
                                        isChanged={ review.changedArtboardIds?.has(
                                            artboard.id
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
                                        onAddress={ ( path ) =>
                                            updateArtboard( artboard.id, {
                                                path,
                                            } )
                                        }
                                        onReload={ () => reload( artboard.id ) }
                                    >
                                        { content }
                                    </ArtboardFrame>
                                );
                            } ) }
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
                        <ShortcutsButton
                            onClick={ () => setShortcutsOpen( true ) }
                        />
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
                            <ReviewDrawer { ...review.drawerProps } />
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
