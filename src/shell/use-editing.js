/**
 * Entering and leaving edit: the zoom rules of constraint C18, the post lock,
 * and the keys that belong to the shell while an artboard is Live.
 */
import { useCallback, useEffect, useRef, useState } from '@wordpress/element';
import { useDispatch, useRegistry, useSelect } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import { store as boardStore } from '../board-store';
import { holdLock, isLockable, takeLock } from '../lock';
import { expose } from './test-hooks';

/**
 * Where the artboard's top-left corner sits in the canvas area when edit
 * starts: at the top-left, leaving room for its label.
 */
export const EDIT_INSET = { x: 24, y: 44 };

/**
 * Editing works from this zoom up (constraint C18).
 */
export const MIN_EDIT_ZOOM = 0.3;

const OPEN_OVERLAY =
    '.components-popover:not(.block-editor-block-popover), [role="menu"], [role="dialog"], [role="alertdialog"], [role="listbox"]';

/**
 * @param {Object}   options
 * @param {Object}   options.viewport     The viewport.
 * @param {Object}   options.areaRef      Ref of the canvas area element.
 * @param {Function} options.getArtboards Gives artboards with their records.
 * @param {Function} options.widthOf      Gives the render width of a device.
 * @return {Object} State and actions for editing.
 */
export function useEditing( { viewport, areaRef, getArtboards, widthOf } ) {
    const registry = useRegistry();
    const liveId = useSelect(
        ( select ) => select( boardStore ).getLiveId(),
        []
    );
    const { setLiveId } = useDispatch( boardStore );
    const [ lockDialog, setLockDialog ] = useState( null );
    const [ selectedBlock, setSelectedBlock ] = useState( null );
    const [ allowedBlocks, setAllowedBlocks ] = useState( null );
    const bridgeRef = useRef( null );
    expose( 'editorBridge', bridgeRef );
    const lock = useRef( null );
    const overlayAtKeyDown = useRef( false );
    const getLatest = useRef( getArtboards );
    getLatest.current = getArtboards;
    const latestWidthOf = useRef( widthOf );
    latestWidthOf.current = widthOf;

    const releaseLock = useCallback( () => {
        lock.current?.();
        lock.current = null;
    }, [] );

    const leaveEdit = useCallback( () => {
        if ( ! registry.select( boardStore ).getLiveId() ) {
            return;
        }
        releaseLock();
        setSelectedBlock( null );
        setLiveId( null );
        areaRef.current?.focus( { preventScroll: true } );
    }, [ registry, releaseLock, setLiveId, areaRef ] );

    const enterEdit = useCallback(
        async ( id, { takeover = false } = {} ) => {
            const artboard =
                getLatest.current().find( ( item ) => item.id === id ) ||
                registry.select( boardStore ).getArtboard( id );
            if (
                ! artboard ||
                // A media object is not editable.
                artboard.kind === 'media' ||
                registry.select( boardStore ).getLiveId() === id
            ) {
                return;
            }
            let release = null;
            if ( isLockable( artboard ) ) {
                try {
                    const result = await takeLock(
                        artboard.entityId,
                        takeover
                    );
                    if ( ! result.held ) {
                        registry.dispatch( boardStore ).selectArtboard( id );
                        setLockDialog( {
                            state: 'locked',
                            id,
                            userName: result.user?.name ?? '',
                        } );
                        return;
                    }
                    release = holdLock( artboard.entityId, ( user ) => {
                        lock.current = null;
                        setSelectedBlock( null );
                        setLiveId( null );
                        setLockDialog( {
                            state: 'taken',
                            id,
                            userName: user?.name ?? '',
                        } );
                    } );
                } catch {
                    // The lock could not be checked. It is advisory, so
                    // editing goes ahead without it.
                }
            }
            releaseLock();
            lock.current = release;
            expose( 'refreshLock', release?.refresh );
            // Editing happens at 30% zoom or more (constraint C18). From
            // below that, the zoom is set so the artboard's width fits the
            // canvas area, between 30% and 100%.
            if ( viewport.get().zoom < MIN_EDIT_ZOOM ) {
                const width = latestWidthOf.current( artboard.device );
                const room = viewport.size().width - 2 * EDIT_INSET.x;
                const zoom = Math.min(
                    1,
                    Math.max( MIN_EDIT_ZOOM, room / width )
                );
                viewport.set(
                    {
                        zoom,
                        x: EDIT_INSET.x - artboard.x * zoom,
                        y: EDIT_INSET.y - artboard.y * zoom,
                    },
                    { immediate: true }
                );
            }
            setSelectedBlock( null );
            setLiveId( id );
            // Keyboard focus follows into the artboard's document once it
            // is there, so typing and Tab reach the blocks.
            const started = Date.now();
            const focusCanvas = () => {
                if ( registry.select( boardStore ).getLiveId() !== id ) {
                    return;
                }
                const iframe = areaRef.current?.querySelector(
                    artboard.kind === 'browser'
                        ? `[data-wfd-artboard="${ id }"] iframe:not([inert])`
                        : `[data-wfd-artboard="${ id }"] iframe[name="editor-canvas"]`
                );
                if (
                    // A browser's page takes the keys while browsing (D55).
                    ( artboard.kind === 'browser' && iframe ) ||
                    iframe?.contentDocument?.querySelector(
                        '.is-root-container'
                    )
                ) {
                    iframe.focus( { preventScroll: true } );
                } else if ( Date.now() - started < 5000 ) {
                    window.setTimeout( focusCanvas, 50 );
                }
            };
            focusCanvas();
        },
        [ registry, viewport, releaseLock, setLiveId, areaRef ]
    );

    // Zooming out below 30% while an artboard is Live leaves edit.
    useEffect(
        () =>
            viewport.onSettle( ( state ) => {
                if ( state.zoom < MIN_EDIT_ZOOM ) {
                    leaveEdit();
                } else if ( registry.select( boardStore ).getLiveId() ) {
                    // Open popovers of the block tools are placed again
                    // when the window is resized; a zoom moves their
                    // blocks in the same way.
                    const view = areaRef.current?.ownerDocument.defaultView;
                    view?.dispatchEvent( new view.Event( 'resize' ) );
                }
            } ),
        [ viewport, leaveEdit, registry, areaRef ]
    );

    useEffect( () => releaseLock, [ releaseLock ] );

    // Keys handled by the shell while editing. Key events from the canvas
    // document bubble to this one.
    useEffect( () => {
        if ( ! liveId ) {
            return;
        }
        const doc = areaRef.current?.ownerDocument ?? document;
        // Whether a popover or menu was open when the key went down, before
        // anything handled it. Key events from the canvas document arrive
        // here as copies on the iframe element, after the editor has handled
        // them, so the canvas document records this itself (noteKeyDown).
        function onKeyDownCapture( event ) {
            if ( event.target?.tagName !== 'IFRAME' ) {
                overlayAtKeyDown.current = !! doc.querySelector( OPEN_OVERLAY );
            }
        }
        function onKeyDown( event ) {
            const mod = event.metaKey || event.ctrlKey;
            if ( mod && ! event.altKey && event.key.toLowerCase() === 'z' ) {
                event.preventDefault();
                const board = registry.select( boardStore );
                if (
                    board.getArtboard( board.getLiveId() )?.kind === 'browser'
                ) {
                    // A browser has no content history (D55).
                    if ( event.shiftKey ) {
                        registry.dispatch( boardStore ).redoLayout();
                    } else {
                        registry.dispatch( boardStore ).undoLayout();
                    }
                    return;
                }
                if ( event.shiftKey ) {
                    registry.dispatch( coreStore ).redo();
                } else {
                    registry.dispatch( coreStore ).undo();
                }
                return;
            }
            if ( event.key !== 'Escape' ) {
                return;
            }
            // The editor dismisses what it has first: an open popover or
            // menu, then the block selection. With nothing left, Esc leaves
            // edit.
            if (
                overlayAtKeyDown.current ||
                doc.querySelector( OPEN_OVERLAY )
            ) {
                return;
            }
            if ( bridgeRef.current?.hasSelection() ) {
                bridgeRef.current.clearSelection();
                // Focus leaves the canvas document with the selection.
                areaRef.current?.focus( { preventScroll: true } );
                return;
            }
            leaveEdit();
        }
        doc.addEventListener( 'keydown', onKeyDownCapture, true );
        doc.addEventListener( 'keydown', onKeyDown );
        return () => {
            doc.removeEventListener( 'keydown', onKeyDownCapture, true );
            doc.removeEventListener( 'keydown', onKeyDown );
        };
    }, [ liveId, registry, leaveEdit, areaRef ] );

    const noteKeyDown = useCallback( () => {
        const doc = areaRef.current?.ownerDocument ?? document;
        overlayAtKeyDown.current = !! doc.querySelector( OPEN_OVERLAY );
    }, [ areaRef ] );

    return {
        liveId,
        noteKeyDown,
        enterEdit,
        leaveEdit,
        bridgeRef,
        selectedBlock,
        setSelectedBlock,
        allowedBlocks,
        setAllowedBlocks,
        lockDialog,
        closeLockDialog: () => setLockDialog( null ),
        takeOver: () => {
            const id = lockDialog?.id;
            setLockDialog( null );
            if ( id ) {
                enterEdit( id, { takeover: true } );
            }
        },
    };
}
