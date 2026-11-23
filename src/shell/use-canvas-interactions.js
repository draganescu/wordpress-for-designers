/**
 * Pointer, wheel and keyboard handling for the canvas: pan, zoom, selecting
 * and moving artboards, and the keyboard map of spec/architecture.md.
 *
 * Pan, zoom and artboard drags change the DOM directly; the store hears about
 * them when they end (constraint C22). The selection rectangle (D43) is drawn
 * the same way; the store hears when the set of selected artboards changes.
 * So is a guide being dragged (C35): the store hears of it on release.
 *
 * Pointer events reach this file through ./touch-gestures.js, which turns
 * fingers into presses, drags and double-clicks and pans and pinches the
 * board with two of them (D64).
 */
import { useEffect, useRef } from '@wordpress/element';
import { useRegistry } from '@wordpress/data';
import { store as boardStore } from '../board-store';
import { orderedArtboards } from './artboards-panel';
import { isShortcutsDialogEvent } from './shortcuts-dialog';
import { noteRect } from './notes';
import { guideRange } from './guides';
import { KINDS, MIN_BROWSER_HEIGHT, hasDevice } from './constants';
import { createTouchGestures } from './touch-gestures';

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
 * A guide's position kept within what `guideRange` gives for it.
 *
 * @param {number}   at    The position.
 * @param {number[]} range The lowest and the highest; none for a board guide.
 * @return {number} The position.
 */
const within = ( at, range ) =>
    range ? Math.min( range[ 1 ], Math.max( range[ 0 ], at ) ) : at;

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
        width: hasDevice( artboard )
            ? widthOf( artboard.device )
            : artboard.width,
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
 * @param {Function} options.onRename          Starts naming an artboard's
 *                                             page or pattern on its label.
 * @param {Function} options.onTogglePanels    Hides or shows both side panels.
 * @param {Function} options.onToggleShortcuts Opens or closes the keyboard
 *                                             shortcuts dialog.
 * @param {Function} options.onRemoveMany      Takes several artboards off the
 *                                             board.
 * @param {Object}   options.rulersRef         Ref of the rulers, which measure
 *                                             a guide while it is dragged.
 * @param {Function} options.onToggleRulers    Shows or hides the rulers.
 * @param {Function} options.onToggleGuides    Shows or hides guides.
 * @param {Function} options.onShowGuides      Shows guides: one is pulled out
 *                                             of a ruler (D109).
 * @param {boolean}  options.isReady           Whether the board has loaded.
 * @return {Object} Functions for the header's zoom menu, and `pullGuide` for
 *                  the rulers.
 */
export function useCanvasInteractions( {
    areaRef,
    viewport,
    widthOf,
    getNames,
    onEdit,
    onLeaveEdit,
    onRename,
    onTogglePanels,
    onToggleShortcuts,
    onRemoveMany,
    rulersRef,
    onToggleRulers,
    onToggleGuides,
    onShowGuides,
    isReady,
} ) {
    const registry = useRegistry();
    const latest = useRef( {} );
    latest.current = {
        widthOf,
        getNames,
        onEdit,
        onLeaveEdit,
        onRename,
        onTogglePanels,
        onToggleShortcuts,
        onRemoveMany,
        rulersRef,
        onToggleRulers,
        onToggleGuides,
        onShowGuides,
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

        // Where an event is, in canvas area pixels. An event of an artboard
        // iframe's document comes with that iframe.
        const point = ( event, frame ) => {
            const box = area.getBoundingClientRect();
            if ( ! frame ) {
                return {
                    x: event.clientX - box.left,
                    y: event.clientY - box.top,
                };
            }
            const frameBox = frame.getBoundingClientRect();
            const scale = frameBox.width / frame.offsetWidth || 1;
            return {
                x: frameBox.left + event.clientX * scale - box.left,
                y: frameBox.top + event.clientY * scale - box.top,
            };
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
            wheel( event, point( event, frame ) );
        };

        // A finger's tap presses after it has lifted (./touch-gestures.js),
        // and a pointer that has lifted cannot be captured.
        function capture( pointerId ) {
            try {
                area.setPointerCapture( pointerId );
            } catch {
                // Nothing to capture.
            }
        }

        function onPointerDown( event ) {
            if ( event.button === 1 || ( event.button === 0 && isSpaceDown ) ) {
                event.preventDefault();
                gesture = { type: 'pan', x: event.clientX, y: event.clientY };
                capture( event.pointerId );
                area.classList.add( 'is-panning' );
                return;
            }
            if ( event.button !== 0 ) {
                return;
            }
            const line = event.target.closest?.( '[data-wfd-guide]' );
            if ( line ) {
                const guide = board().getGuide( line.dataset.wfdGuide );
                // With an artboard in edit a guide takes no input (D114).
                if ( ! guide || board().getEditId() ) {
                    return;
                }
                gesture = {
                    type: 'guide',
                    guide,
                    element: line,
                    artboard: board().getArtboard( guide.artboard ),
                    at: guide.at,
                    startX: event.clientX,
                    startY: event.clientY,
                    selectionBefore: board().getSelectedIds(),
                };
                actions().selectGuide( guide.id );
                area.focus( { preventScroll: true } );
                capture( event.pointerId );
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
                    capture( event.pointerId );
                }
                return;
            }
            const id = idOf( element );
            if (
                event.target.closest( '[data-wfd-resize]' ) &&
                board().getEditId() !== id
            ) {
                // The bottom edge of a browser's window (D56).
                if ( board().getEditId() ) {
                    latest.current.onLeaveEdit();
                }
                // What the gesture puts back if it is cancelled.
                const selectionBefore = board().getSelectedIds();
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
                    selectionBefore,
                };
                capture( event.pointerId );
                return;
            }
            if ( board().getEditingNoteId() === id ) {
                // The text field of the note being edited.
                return;
            }
            const editId = board().getEditId();
            if ( editId === id ) {
                // The Live artboard's own label and tools.
                return;
            }
            if ( editId ) {
                // Selecting another artboard ends edit.
                latest.current.onLeaveEdit();
            }
            if ( ! isBody( event.target ) ) {
                return;
            }
            if ( ! editId && ( event.metaKey || event.ctrlKey ) ) {
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
                // What the gesture puts back if it is cancelled.
                selectionBefore: selectedIds,
            };
            capture( event.pointerId );
        }

        // A press, which also keeps the guide that was selected (D112) for
        // the gesture to put back if it is cancelled.
        function onPress( event ) {
            const guideBefore = board().getSelectedGuideId();
            onPointerDown( event );
            if ( gesture ) {
                gesture.guideBefore = guideBefore;
            }
        }

        const toBoard = ( { x, y } ) => {
            const view = viewport.get();
            return {
                x: ( x - view.x ) / view.zoom,
                y: ( y - view.y ) / view.zoom,
            };
        };

        // Ends the gesture in progress as if it had not started: what it
        // moved goes back and the selection is what it was. Esc does this to
        // the selection rectangle, and a second finger or the browser to
        // what one finger was doing (./touch-gestures.js).
        function cancelGesture() {
            const cancelled = gesture;
            gesture = null;
            area.classList.remove( 'is-panning' );
            if ( cancelled?.type === 'drag' ) {
                cancelled.items.forEach( ( item ) => {
                    item.element.style.left = item.originX + 'px';
                    item.element.style.top = item.originY + 'px';
                } );
            } else if ( cancelled?.type === 'marquee' ) {
                if ( cancelled.element ) {
                    cancelled.element.hidden = true;
                }
            } else if ( cancelled?.type === 'resize' ) {
                cancelled.frame.style.height = cancelled.originHeight + 'px';
            } else if ( cancelled?.type === 'guide' ) {
                endGuideDrag( cancelled );
                if ( ! cancelled.guide.id ) {
                    // A guide being pulled out selected nothing.
                    return;
                }
                placeGuide( cancelled, cancelled.guide.at );
            } else {
                return;
            }
            actions().selectArtboards( cancelled.selectionBefore );
            actions().selectGuide( cancelled.guideBefore );
        }

        // Guides (D110 to D114). The line of a guide pulled out of a ruler
        // and the position chip are drawn once (./guides.js) and driven
        // from here.
        const guideDrag = () => ( {
            draft: area.querySelector( '.wfd-guide.is-draft' ),
            chip: area.querySelector( '[data-wfd-guide-chip]' ),
        } );

        // Puts the line of a guide of the board at a position, and the
        // "Position" field of its card (GD4) with it.
        function placeGuide( { guide, element }, at ) {
            element.style[ guide.axis === 'x' ? 'left' : 'top' ] = at + 'px';
            const field = doc.querySelector( '[data-wfd-panel="guide"] input' );
            if ( field ) {
                field.value = at;
            }
        }

        // Whether a pointer is where a guide pulled out of a ruler is not
        // added: over a ruler or the corner between them, or outside the
        // canvas area (D110).
        function isOffBoard( event ) {
            const { x, y } = point( event );
            const size = viewport.size();
            return (
                x < 0 ||
                y < 0 ||
                x > size.width ||
                y > size.height ||
                [ ...area.querySelectorAll( '[data-wfd-ruler]' ) ].some(
                    ( ruler ) => {
                        const box = ruler.getBoundingClientRect();
                        return ruler.dataset.wfdRuler === 'top'
                            ? event.clientY < box.bottom
                            : event.clientX < box.right;
                    }
                )
            );
        }

        // The artboard under a pointer that a guide can belong to: a page,
        // template, template part or pattern. Guides themselves are looked
        // through.
        function guideOwnerAt( event ) {
            const under = doc
                .elementsFromPoint( event.clientX, event.clientY )
                .find( ( element ) => ! element.closest( '[data-wfd-guide]' ) );
            const artboard =
                under && isBody( under )
                    ? board().getArtboard(
                          frameOf( under ).dataset.wfdArtboard
                      )
                    : null;
            return artboard && KINDS[ artboard.kind ].edit === 'editor'
                ? artboard
                : null;
        }

        function dragGuide( event ) {
            const { guide } = gesture;
            const { axis } = guide;
            const isNew = ! guide.id;
            const { draft, chip } = guideDrag();
            if ( isNew ) {
                gesture.at = null;
                if ( isOffBoard( event ) ) {
                    endGuideDrag( gesture );
                    return;
                }
                gesture.artboard = guideOwnerAt( event );
            } else if (
                ! gesture.isMoving &&
                Math.hypot(
                    event.clientX - gesture.startX,
                    event.clientY - gesture.startY
                ) < DRAG_THRESHOLD
            ) {
                return;
            }
            gesture.isMoving = true;
            area.classList.add( `is-guiding-${ axis }` );
            const { artboard } = gesture;
            const rect = artboard && rectOf( artboard, latest.current.widthOf );
            const pointer = toBoard( point( event ) );
            // Nothing snaps: the guide is where the pointer is, as a whole
            // number, counted from its artboard's corner when it has one.
            const at = within(
                Math.round( pointer[ axis ] - ( rect ? rect[ axis ] : 0 ) ),
                guideRange( axis, artboard, latest.current.widthOf )
            );
            gesture.at = at;
            if ( ! isNew ) {
                placeGuide( gesture, at );
            } else if ( draft ) {
                // Across its artboard only, or from edge to edge.
                const start = { x: rect?.x ?? 0, y: rect?.y ?? 0 };
                start[ axis ] += at;
                draft.classList.toggle( 'is-x', axis === 'x' );
                draft.classList.toggle( 'is-y', axis === 'y' );
                draft.classList.toggle( 'is-board', ! rect );
                draft.style.left = start.x + 'px';
                draft.style.top = start.y + 'px';
                draft.style.width =
                    rect && axis === 'y' ? rect.width + 'px' : '';
                draft.style.height =
                    rect && axis === 'x' ? rect.height + 'px' : '';
                draft.hidden = false;
            }
            // The artboard the new guide would belong to.
            const target =
                isNew && artboard
                    ? area.querySelector(
                          `[data-wfd-artboard="${ artboard.id }"]`
                      )
                    : null;
            if ( target !== gesture.target ) {
                gesture.target?.classList.remove( 'is-guide-target' );
                gesture.target = target;
            }
            target?.classList.add( 'is-guide-target' );
            if ( chip ) {
                chip.textContent = String( at );
                chip.style.left = pointer.x + 'px';
                chip.style.top = pointer.y + 'px';
                chip.hidden = false;
            }
            latest.current.rulersRef?.current?.measure( {
                owner: rect ? { id: artboard.id, ...rect } : null,
                active: { id: guide.id, axis, at },
            } );
        }

        // Takes away what the drag of a guide drew besides its line.
        function endGuideDrag( ended ) {
            const { draft, chip } = guideDrag();
            area.classList.remove( 'is-guiding-x', 'is-guiding-y' );
            ended.target?.classList.remove( 'is-guide-target' );
            ended.target = null;
            if ( draft ) {
                draft.hidden = true;
            }
            if ( chip ) {
                chip.hidden = true;
            }
            latest.current.rulersRef?.current?.measure( null );
        }

        // Starts the drag of a new guide from a press on a ruler (D110):
        // the top ruler pulls out a horizontal guide ('y'), the left ruler
        // a vertical one ('x').
        api.current.pullGuide = ( axis, event ) => {
            if ( event.button !== 0 || gesture ) {
                return;
            }
            latest.current.onShowGuides?.();
            gesture = { type: 'guide', guide: { axis }, at: null };
            capture( event.pointerId );
        };

        // The selection rectangle (D43). It is kept in board units, so it
        // stays put on the board if the board is scrolled during the drag.
        function startMarquee() {
            const isEditing = !! board().getEditId();
            const selectionBefore = board().getSelectedIds();
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
            gesture.selectionBefore = selectionBefore;
            // A guide is selected alone (D112).
            actions().selectGuide( null );
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
            if ( gesture.type === 'guide' ) {
                dragGuide( event );
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
            if ( ended.type === 'guide' ) {
                const { guide, artboard, at } = ended;
                endGuideDrag( ended );
                if ( guide.id ) {
                    if ( ended.isMoving && at !== guide.at ) {
                        actions().moveGuide( guide.id, at );
                    }
                } else if ( at !== null ) {
                    // With an artboard in edit the new guide is not
                    // selected and edit is kept (D114).
                    const isEditing = !! board().getEditId();
                    actions().addGuide(
                        {
                            id: window.crypto.randomUUID(),
                            axis: guide.axis,
                            at,
                            ...( artboard && {
                                artboard: artboard.id,
                                device: artboard.device,
                            } ),
                        },
                        { select: ! isEditing }
                    );
                    if ( ! isEditing ) {
                        area.focus( { preventScroll: true } );
                    }
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
                if ( board().getEditId() ) {
                    latest.current.onLeaveEdit();
                }
                actions().clearSelection();
                area.focus( { preventScroll: true } );
            }
        }

        // Edits what was double-clicked or double-tapped.
        function open( event ) {
            // Pointer capture retargets the event to the canvas area, so
            // look at what is under the pointer.
            const target =
                doc.elementFromPoint( event.clientX, event.clientY ) ||
                event.target;
            if ( target.closest?.( 'input, textarea' ) ) {
                // A text field on the board selects its own words.
                return;
            }
            const element = frameOf( target );
            if ( element?.dataset.wfdNote ) {
                if ( board().getEditingNoteId() !== element.dataset.wfdNote ) {
                    actions().startNoteEdit( element.dataset.wfdNote );
                }
                return;
            }
            if (
                element &&
                target.closest( '.wfd-artboard__label' ) &&
                ! target.closest( 'button' )
            ) {
                // The label of a page or pattern names it (D62).
                latest.current.onRename( element.dataset.wfdArtboard );
                return;
            }
            if (
                element &&
                isBody( target ) &&
                element.dataset.wfdArtboard !== board().getEditId()
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
            if (
                [ 'marquee', 'guide' ].includes( gesture?.type ) &&
                event.key === 'Escape'
            ) {
                // Esc cancels the selection rectangle and the drag of a
                // guide: the selection goes back to what it was, the guide
                // to where it was, and the rest of the drag does nothing.
                cancelGesture();
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
            if ( board().getBrowsingId() ) {
                // While a browser is browsed the board has those keys only;
                // Esc is the shell's (see use-editing.js).
                return;
            }
            if (
                mod &&
                event.code === 'Semicolon' &&
                ! event.shiftKey &&
                ! event.altKey
            ) {
                latest.current.onToggleGuides?.();
                return done();
            }
            if ( mod || event.altKey ) {
                return;
            }
            if ( event.code === 'KeyR' && event.shiftKey ) {
                latest.current.onToggleRulers?.();
                return done();
            }
            const guide = board().getGuide( board().getSelectedGuideId() );
            if ( guide && event.key !== 'Escape' ) {
                // A selected guide takes these keys and no others (D112).
                const nudgeGuide = ( by ) => {
                    const at = within(
                        guide.at + by,
                        guideRange(
                            guide.axis,
                            board().getArtboard( guide.artboard ),
                            latest.current.widthOf
                        )
                    );
                    if ( at !== guide.at ) {
                        actions().moveGuide( guide.id, at );
                    }
                    return done();
                };
                const by = event.shiftKey ? 10 : 1;
                switch ( event.key ) {
                    case 'Delete':
                    case 'Backspace':
                        actions().removeGuide( guide.id );
                        return done();
                    case guide.axis === 'x' ? 'ArrowLeft' : 'ArrowUp':
                        return nudgeGuide( -by );
                    case guide.axis === 'x' ? 'ArrowRight' : 'ArrowDown':
                        return nudgeGuide( by );
                }
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
                case 'F2':
                    if ( selectedId ) {
                        latest.current.onRename( selectedId );
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

        // Pointer events come through the fingers' own handling (D64).
        const touch = createTouchGestures( {
            area,
            viewport,
            pointOf: point,
            onPress,
            onMove: onPointerMove,
            onRelease: onPointerUp,
            onCancel: cancelGesture,
            onOpen: open,
        } );
        // The Live editor has its canvas document watched for fingers.
        api.current.watchDocument = touch.watchDocument;
        area.addEventListener( 'wheel', onWheel, { passive: false } );
        area.addEventListener( 'keydown', onKeyDown );
        area.addEventListener( 'keyup', onKeyUp );
        doc.addEventListener( 'keydown', onDocumentKeyDown );
        return () => {
            touch.destroy();
            area.removeEventListener( 'wheel', onWheel );
            area.removeEventListener( 'keydown', onKeyDown );
            area.removeEventListener( 'keyup', onKeyUp );
            doc.removeEventListener( 'keydown', onDocumentKeyDown );
        };
    }, [ areaRef, viewport, isReady ] );

    return api.current;
}
