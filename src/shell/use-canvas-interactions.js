/**
 * Pointer, wheel and keyboard handling for the canvas: pan, zoom, selecting
 * and moving artboards, and the keyboard map of spec/architecture.md.
 *
 * Pan, zoom and artboard drags change the DOM directly; the store hears about
 * them when they end (constraint C22). The selection rectangle (D43) is drawn
 * the same way; the store hears when the set of selected artboards changes.
 */
import { useEffect, useRef } from '@wordpress/element';
import { useRegistry } from '@wordpress/data';
import { store as boardStore } from '../board-store';
import { orderedArtboards } from './artboards-panel';
import { isShortcutsDialogEvent } from './shortcuts-dialog';
import { noteRect } from './notes';
import { MIN_BROWSER_HEIGHT } from './constants';

const DRAG_THRESHOLD = 3;
const ZOOM_STEP = 1.25;
const WHEEL_ZOOM_RATE = 0.01;

function isEditable( target ) {
    return (
        !! target?.closest &&
        !! target.closest(
            'input, textarea, select, [contenteditable="true"], [role="textbox"]'
        )
    );
}

/**
 * The rectangle of an artboard in board units.
 *
 * @param {Object}   artboard The artboard.
 * @param {Function} widthOf  Gives the render width of a device.
 * @return {Object} The rectangle.
 */
export function rectOf( artboard, widthOf ) {
    return {
        x: artboard.x,
        y: artboard.y,
        width:
            artboard.kind === 'media'
                ? artboard.width
                : widthOf( artboard.device ),
        height: artboard.height,
    };
}

/**
 * @param {Object}   options
 * @param {Object}   options.areaRef           Ref of the canvas area element.
 * @param {Object}   options.viewport          The viewport.
 * @param {Function} options.widthOf           Gives the render width of a device.
 * @param {Function} options.getNames          Gives artboards with their names.
 * @param {Function} options.onEdit            Enters edit on an artboard.
 * @param {Function} options.onLeaveEdit       Leaves edit.
 * @param {Function} options.onTogglePanels    Hides or shows both side panels.
 * @param {Function} options.onToggleShortcuts Opens or closes the keyboard
 *                                             shortcuts dialog.
 * @param {Function} options.onRemoveMany      Takes several artboards off the
 *                                             board.
 * @param {boolean}  options.isReady           Whether the board has loaded.
 * @return {Object} Functions for the header's zoom menu.
 */
export function useCanvasInteractions( {
    areaRef,
    viewport,
    widthOf,
    getNames,
    onEdit,
    onLeaveEdit,
    onTogglePanels,
    onToggleShortcuts,
    onRemoveMany,
    isReady,
} ) {
    const registry = useRegistry();
    const latest = useRef( {} );
    latest.current = {
        widthOf,
        getNames,
        onEdit,
        onLeaveEdit,
        onTogglePanels,
        onToggleShortcuts,
        onRemoveMany,
    };

    const api = useRef( null );
    if ( ! api.current ) {
        const board = () => registry.select( boardStore );
        const actions = () => registry.dispatch( boardStore );
        // Artboards and notes (D46), with or without a filter on their ids.
        const rects = ( ids ) => [
            ...board()
                .getArtboards()
                .filter( ( artboard ) => ! ids || ids.includes( artboard.id ) )
                .map( ( artboard ) =>
                    rectOf( artboard, latest.current.widthOf )
                ),
            ...board()
                .getNotes()
                .filter( ( note ) => ! ids || ids.includes( note.id ) )
                .map( noteRect ),
        ];
        api.current = {
            fitAll( options ) {
                viewport.fit( rects(), options );
            },
            fitSelection( options ) {
                const selected = rects( board().getSelectedIds() );
                if ( selected.length ) {
                    viewport.fit( selected, options );
                }
            },
            zoom( id ) {
                const { zoom } = viewport.get();
                const immediate = { immediate: true };
                switch ( id ) {
                    case 'in':
                        return viewport.zoomTo(
                            zoom * ZOOM_STEP,
                            null,
                            immediate
                        );
                    case 'out':
                        return viewport.zoomTo(
                            zoom / ZOOM_STEP,
                            null,
                            immediate
                        );
                    case '50':
                        return viewport.zoomTo( 0.5, null, immediate );
                    case '100':
                        return viewport.zoomTo( 1, null, immediate );
                    case 'fit-all':
                        return api.current.fitAll( immediate );
                    case 'fit-selection':
                        return api.current.fitSelection( immediate );
                }
            },
            /**
             * Brings an artboard or a note into view without changing the
             * zoom.
             *
             * @param {string} id The artboard or note.
             */
            reveal( id ) {
                const artboard = board().getArtboard( id );
                const note = board().getNote( id );
                if ( ! artboard && ! note ) {
                    return;
                }
                const rect = artboard
                    ? rectOf( artboard, latest.current.widthOf )
                    : noteRect( note );
                const view = viewport.get();
                const size = viewport.size();
                const left = rect.x * view.zoom + view.x;
                const top = rect.y * view.zoom + view.y;
                const right = left + rect.width * view.zoom;
                const bottom = top + rect.height * view.zoom;
                if (
                    left >= 0 &&
                    top >= 0 &&
                    right <= size.width &&
                    bottom <= size.height
                ) {
                    return;
                }
                viewport.set(
                    {
                        zoom: view.zoom,
                        x:
                            size.width / 2 -
                            ( rect.x + rect.width / 2 ) * view.zoom,
                        y:
                            rect.height * view.zoom > size.height
                                ? 48 - rect.y * view.zoom
                                : size.height / 2 -
                                  ( rect.y + rect.height / 2 ) * view.zoom,
                    },
                    { immediate: true }
                );
            },
            board,
            actions,
        };
    }

    useEffect( () => {
        const area = areaRef.current;
        if ( ! isReady || ! area ) {
            return;
        }
        const { board, actions } = api.current;
        const doc = area.ownerDocument;
        let isSpaceDown = false;
        let gesture = null;

        const point = ( event ) => {
            const box = area.getBoundingClientRect();
            return { x: event.clientX - box.left, y: event.clientY - box.top };
        };
        // An artboard or a note (D46).
        const frameOf = ( target ) =>
            target.closest?.( '[data-wfd-artboard], [data-wfd-note]' ) || null;
        const idOf = ( element ) =>
            element.dataset.wfdArtboard ?? element.dataset.wfdNote;
        const isBody = ( target ) =>
            !! target.closest( '.wfd-artboard__frame, [data-wfd-note]' );

        function wheel( event, at ) {
            event.preventDefault();
            if ( event.ctrlKey || event.metaKey ) {
                const { zoom } = viewport.get();
                viewport.zoomTo(
                    zoom * Math.exp( -event.deltaY * WHEEL_ZOOM_RATE ),
                    at
                );
            } else {
                viewport.panBy( -event.deltaX, -event.deltaY );
            }
        }
        function onWheel( event ) {
            wheel( event, point( event ) );
        }
        // Wheel events inside artboard iframes are forwarded here.
        api.current.forwardWheel = ( event, frame ) => {
            const box = area.getBoundingClientRect();
            const frameBox = frame.getBoundingClientRect();
            const scale = frameBox.width / frame.offsetWidth || 1;
            wheel( event, {
                x: frameBox.left + event.clientX * scale - box.left,
                y: frameBox.top + event.clientY * scale - box.top,
            } );
        };

        function onPointerDown( event ) {
            if ( event.button === 1 || ( event.button === 0 && isSpaceDown ) ) {
                event.preventDefault();
                gesture = { type: 'pan', x: event.clientX, y: event.clientY };
                area.setPointerCapture( event.pointerId );
                area.classList.add( 'is-panning' );
                return;
            }
            if ( event.button !== 0 ) {
                return;
            }
            const element = frameOf( event.target );
            if ( ! element ) {
                gesture = {
                    type: 'empty',
                    // Only a press on the board itself can become a selection
                    // rectangle, not one on a banner or a floating control.
                    canSelect: event.target === area,
                    add: event.metaKey || event.ctrlKey,
                    startX: event.clientX,
                    startY: event.clientY,
                };
                if ( gesture.canSelect ) {
                    area.setPointerCapture( event.pointerId );
                }
                return;
            }
            const id = idOf( element );
            if (
                event.target.closest( '[data-wfd-resize]' ) &&
                board().getLiveId() !== id
            ) {
                // The bottom edge of a browser's window (D56).
                if ( board().getLiveId() ) {
                    latest.current.onLeaveEdit();
                }
                actions().selectArtboard( id );
                area.focus( { preventScroll: true } );
                const frame = element.querySelector( '.wfd-artboard__frame' );
                gesture = {
                    type: 'resize',
                    id,
                    frame,
                    originHeight: board().getArtboard( id ).height,
                    height: null,
                    startY: event.clientY,
                };
                area.setPointerCapture( event.pointerId );
                return;
            }
            if ( board().getEditingNoteId() === id ) {
                // The text field of the note being edited.
                return;
            }
            const liveId = board().getLiveId();
            if ( liveId === id ) {
                // The Live artboard's own label and tools.
                return;
            }
            if ( liveId ) {
                // Selecting another artboard ends edit.
                latest.current.onLeaveEdit();
            }
            if ( ! isBody( event.target ) ) {
                return;
            }
            if ( ! liveId && ( event.metaKey || event.ctrlKey ) ) {
                // Cmd/Ctrl + click adds the artboard to the selection or
                // takes it out.
                actions().toggleArtboardSelection( id );
                area.focus( { preventScroll: true } );
                return;
            }
            // A press on one of several selected artboards keeps them all,
            // so that a drag moves them; without a drag it selects this one.
            const selectedIds = board().getSelectedIds();
            const isOneOfMany =
                selectedIds.length > 1 && selectedIds.includes( id );
            if ( ! isOneOfMany ) {
                actions().selectArtboard( id );
            }
            if ( event.target.closest( 'button' ) ) {
                // A control inside the artboard (Retry) takes its own click.
                return;
            }
            area.focus( { preventScroll: true } );
            const movedIds = isOneOfMany ? selectedIds : [ id ];
            const items = [];
            area.querySelectorAll(
                '[data-wfd-artboard], [data-wfd-note]'
            ).forEach( ( node ) => {
                const nodeId = idOf( node );
                const item = movedIds.includes( nodeId )
                    ? board().getArtboard( nodeId ) || board().getNote( nodeId )
                    : null;
                if ( item ) {
                    items.push( {
                        id: item.id,
                        element: node,
                        originX: item.x,
                        originY: item.y,
                        x: item.x,
                        y: item.y,
                    } );
                }
            } );
            gesture = {
                type: 'press',
                id,
                isOneOfMany,
                items,
                startX: event.clientX,
                startY: event.clientY,
            };
            area.setPointerCapture( event.pointerId );
        }

        const toBoard = ( { x, y } ) => {
            const view = viewport.get();
            return {
                x: ( x - view.x ) / view.zoom,
                y: ( y - view.y ) / view.zoom,
            };
        };

        // The selection rectangle (D43). It is kept in board units, so it
        // stays put on the board if the board is scrolled during the drag.
        function startMarquee() {
            const isEditing = !! board().getLiveId();
            const before = board().getSelectedIds();
            if ( isEditing ) {
                // Deselecting ends edit.
                latest.current.onLeaveEdit();
            }
            const box = area.getBoundingClientRect();
            gesture.type = 'marquee';
            gesture.element = area.querySelector( '[data-wfd-marquee]' );
            gesture.origin = toBoard( {
                x: gesture.startX - box.left,
                y: gesture.startY - box.top,
            } );
            gesture.before = before;
            gesture.kept =
                gesture.add && ! isEditing ? board().getSelectedIds() : [];
            area.focus( { preventScroll: true } );
        }

        function updateMarquee( event ) {
            const { origin, kept, element } = gesture;
            const end = toBoard( point( event ) );
            const left = Math.min( origin.x, end.x );
            const top = Math.min( origin.y, end.y );
            const right = Math.max( origin.x, end.x );
            const bottom = Math.max( origin.y, end.y );
            if ( element ) {
                element.style.left = left + 'px';
                element.style.top = top + 'px';
                element.style.width = right - left + 'px';
                element.style.height = bottom - top + 'px';
                element.hidden = false;
            }
            const touched = board()
                .getArtboards()
                .filter( ( artboard ) => {
                    if ( kept.includes( artboard.id ) ) {
                        return false;
                    }
                    const rect = rectOf( artboard, latest.current.widthOf );
                    return (
                        rect.x < right &&
                        rect.x + rect.width > left &&
                        rect.y < bottom &&
                        rect.y + rect.height > top
                    );
                } )
                .map( ( artboard ) => artboard.id );
            actions().selectArtboards( [ ...kept, ...touched ] );
        }

        function onPointerMove( event ) {
            if ( ! gesture ) {
                return;
            }
            if ( gesture.type === 'pan' ) {
                viewport.panBy(
                    event.clientX - gesture.x,
                    event.clientY - gesture.y
                );
                gesture.x = event.clientX;
                gesture.y = event.clientY;
                return;
            }
            if ( gesture.type === 'resize' ) {
                const { zoom } = viewport.get();
                gesture.height = Math.max(
                    MIN_BROWSER_HEIGHT,
                    Math.round(
                        gesture.originHeight +
                            ( event.clientY - gesture.startY ) / zoom
                    )
                );
                gesture.frame.style.height = gesture.height + 'px';
                return;
            }
            const dx = event.clientX - gesture.startX;
            const dy = event.clientY - gesture.startY;
            if ( gesture.type === 'empty' || gesture.type === 'marquee' ) {
                if (
                    gesture.type === 'empty' &&
                    ( ! gesture.canSelect ||
                        Math.hypot( dx, dy ) < DRAG_THRESHOLD )
                ) {
                    return;
                }
                if ( gesture.type === 'empty' ) {
                    startMarquee();
                }
                updateMarquee( event );
                return;
            }
            if ( gesture.type !== 'press' && gesture.type !== 'drag' ) {
                return;
            }
            if (
                gesture.type === 'press' &&
                Math.hypot( dx, dy ) < DRAG_THRESHOLD
            ) {
                return;
            }
            gesture.type = 'drag';
            const { zoom } = viewport.get();
            const moveX = Math.round( dx / zoom );
            const moveY = Math.round( dy / zoom );
            gesture.items.forEach( ( item ) => {
                item.x = item.originX + moveX;
                item.y = item.originY + moveY;
                item.element.style.left = item.x + 'px';
                item.element.style.top = item.y + 'px';
            } );
        }

        function onPointerUp( event ) {
            const ended = gesture;
            gesture = null;
            area.classList.remove( 'is-panning' );
            if ( area.hasPointerCapture?.( event.pointerId ) ) {
                area.releasePointerCapture( event.pointerId );
            }
            if ( ! ended ) {
                return;
            }
            if ( ended.type === 'marquee' ) {
                if ( ended.element ) {
                    ended.element.hidden = true;
                }
                return;
            }
            if ( ended.type === 'resize' ) {
                if ( ended.height !== null ) {
                    actions().resizeBrowser( ended.id, ended.height );
                }
                return;
            }
            if ( ended.type === 'drag' ) {
                actions().moveArtboards(
                    ended.items.map( ( { id, x, y } ) => ( { id, x, y } ) )
                );
            } else if ( ended.type === 'press' && ended.isOneOfMany ) {
                actions().selectArtboard( ended.id );
            } else if (
                ended.type === 'empty' &&
                ! frameOf( event.target ) &&
                ! event.target.closest(
                    '.wfd-canvas__banner, .wfd-canvas__empty'
                )
            ) {
                // Deselecting ends edit.
                if ( board().getLiveId() ) {
                    latest.current.onLeaveEdit();
                }
                actions().clearSelection();
                area.focus( { preventScroll: true } );
            }
        }

        function onDoubleClick( event ) {
            // Pointer capture retargets the event to the canvas area, so
            // look at what is under the pointer.
            const target =
                doc.elementFromPoint( event.clientX, event.clientY ) ||
                event.target;
            const element = frameOf( target );
            if ( element?.dataset.wfdNote ) {
                if ( board().getEditingNoteId() !== element.dataset.wfdNote ) {
                    actions().startNoteEdit( element.dataset.wfdNote );
                }
                return;
            }
            if (
                element &&
                isBody( target ) &&
                element.dataset.wfdArtboard !== board().getLiveId()
            ) {
                latest.current.onEdit( element.dataset.wfdArtboard );
            }
        }

        function stepSelection( direction ) {
            const ordered = orderedArtboards( latest.current.getNames() );
            if ( ! ordered.length ) {
                return false;
            }
            const index = ordered.findIndex(
                ( artboard ) => artboard.id === board().getSelectedId()
            );
            let next = index + direction;
            if ( index === -1 ) {
                next = direction > 0 ? 0 : ordered.length - 1;
            }
            if ( next < 0 || next >= ordered.length ) {
                return false;
            }
            actions().selectArtboard( ordered[ next ].id );
            api.current.reveal( ordered[ next ].id );
            return true;
        }

        function onKeyDown( event ) {
            if ( gesture?.type === 'marquee' && event.key === 'Escape' ) {
                // Esc cancels the selection rectangle: the selection goes
                // back to what it was and the rest of the drag does nothing.
                if ( gesture.element ) {
                    gesture.element.hidden = true;
                }
                actions().selectArtboards( gesture.before );
                gesture = { type: 'cancelled' };
                event.preventDefault();
                event.stopPropagation();
                return;
            }
            if ( event.target !== area ) {
                return;
            }
            if ( event.key === 'Escape' && board().isNoteToolArmed() ) {
                // Left to the document: it switches the note tool off.
                return;
            }
            if ( board().getLiveId() && event.code !== 'Space' ) {
                // The shell's editing keys take over (see use-editing.js).
                return;
            }
            const mod = event.metaKey || event.ctrlKey;
            const done = () => {
                event.preventDefault();
                event.stopPropagation();
            };
            if ( event.code === 'Space' ) {
                isSpaceDown = true;
                area.classList.add( 'is-pan-ready' );
                return done();
            }
            if ( mod && event.key.toLowerCase() === 'z' ) {
                if ( event.shiftKey ) {
                    actions().redoLayout();
                } else {
                    actions().undoLayout();
                }
                return done();
            }
            if ( mod || event.altKey ) {
                return;
            }
            switch ( event.key ) {
                case 'Tab':
                    if ( stepSelection( event.shiftKey ? -1 : 1 ) ) {
                        done();
                    }
                    return;
                case 'Escape':
                    actions().clearSelection();
                    return done();
            }
            if ( event.code === 'Digit2' && event.shiftKey ) {
                api.current.fitSelection( { immediate: true } );
                return done();
            }
            const selectedIds = board().getSelectedIds();
            if ( ! selectedIds.length ) {
                return;
            }
            const selectedId = board().getSelectedId();
            const step = event.shiftKey ? 10 : 1;
            const nudge = ( dx, dy ) => {
                actions().moveArtboards(
                    [ ...board().getArtboards(), ...board().getNotes() ]
                        .filter( ( item ) => selectedIds.includes( item.id ) )
                        .map( ( { id, x, y } ) => ( {
                            id,
                            x: x + dx,
                            y: y + dy,
                        } ) )
                );
                return done();
            };
            switch ( event.key ) {
                case 'Enter':
                    // Only one artboard can be in edit.
                    if ( selectedId ) {
                        latest.current.onEdit( selectedId );
                        done();
                    } else if ( board().getSelectedNoteId() ) {
                        actions().startNoteEdit( board().getSelectedNoteId() );
                        done();
                    }
                    return;
                case 'Delete':
                case 'Backspace':
                    if ( selectedId ) {
                        actions().setRemovingId( selectedId );
                    } else {
                        latest.current.onRemoveMany( selectedIds );
                    }
                    return done();
                case 'ArrowLeft':
                    return nudge( -step, 0 );
                case 'ArrowRight':
                    return nudge( step, 0 );
                case 'ArrowUp':
                    return nudge( 0, -step );
                case 'ArrowDown':
                    return nudge( 0, step );
            }
        }

        function onKeyUp( event ) {
            if ( event.code === 'Space' ) {
                isSpaceDown = false;
                area.classList.remove( 'is-pan-ready' );
            }
        }

        // The shortcuts marked "always" in the keyboard map.
        function onDocumentKeyDown( event ) {
            if ( event.key === 'Escape' && board().isNoteToolArmed() ) {
                // Esc switches the note tool off (D46).
                event.preventDefault();
                event.stopPropagation();
                actions().setNoteToolArmed( false );
                return;
            }
            const mod = event.metaKey || event.ctrlKey;
            const { zoom } = viewport.get();
            if ( mod && ( event.key === '+' || event.key === '=' ) ) {
                event.preventDefault();
                viewport.zoomTo( zoom * ZOOM_STEP, null, { immediate: true } );
            } else if ( mod && ( event.key === '-' || event.key === '_' ) ) {
                event.preventDefault();
                viewport.zoomTo( zoom / ZOOM_STEP, null, { immediate: true } );
            } else if ( mod && event.code === 'Backslash' ) {
                event.preventDefault();
                latest.current.onTogglePanels?.();
            } else if ( isShortcutsDialogEvent( event ) ) {
                event.preventDefault();
                latest.current.onToggleShortcuts?.();
            } else if (
                event.code === 'Digit1' &&
                event.shiftKey &&
                ! mod &&
                ! event.altKey &&
                ! isEditable( event.target )
            ) {
                event.preventDefault();
                api.current.fitAll( { immediate: true } );
            }
        }

        area.addEventListener( 'wheel', onWheel, { passive: false } );
        area.addEventListener( 'pointerdown', onPointerDown );
        area.addEventListener( 'pointermove', onPointerMove );
        area.addEventListener( 'pointerup', onPointerUp );
        area.addEventListener( 'pointercancel', onPointerUp );
        area.addEventListener( 'dblclick', onDoubleClick );
        area.addEventListener( 'keydown', onKeyDown );
        area.addEventListener( 'keyup', onKeyUp );
        doc.addEventListener( 'keydown', onDocumentKeyDown );
        return () => {
            area.removeEventListener( 'wheel', onWheel );
            area.removeEventListener( 'pointerdown', onPointerDown );
            area.removeEventListener( 'pointermove', onPointerMove );
            area.removeEventListener( 'pointerup', onPointerUp );
            area.removeEventListener( 'pointercancel', onPointerUp );
            area.removeEventListener( 'dblclick', onDoubleClick );
            area.removeEventListener( 'keydown', onKeyDown );
            area.removeEventListener( 'keyup', onKeyUp );
            doc.removeEventListener( 'keydown', onDocumentKeyDown );
        };
    }, [ areaRef, viewport, isReady ] );

    return api.current;
}
