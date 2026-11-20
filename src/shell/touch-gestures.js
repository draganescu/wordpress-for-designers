/**
 * Fingers on the board (decision D64).
 *
 * Two fingers or more on the canvas area pan the board by the movement of
 * their middle and zoom it about that middle by the change of their spread,
 * through the viewport the wheel uses. One finger is the pointer: what it
 * pressed is told to the board when it has moved or lifted, not when it
 * lands, because it may be the first of two.
 *
 * This file is the board's pointer input. A mouse or a pen goes straight
 * through to the handlers it is given; only fingers are held back, counted
 * and turned into presses, drags, taps and double taps. It knows nothing of
 * artboards, of the store or of React.
 *
 * To remove it once WordPress or the browser gives the board these gestures:
 * delete this file; in `./use-canvas-interactions.js` replace the
 * `createTouchGestures` call with `pointerdown`, `pointermove`, `pointerup`,
 * `pointercancel` and `dblclick` listeners on the canvas area for the five
 * handlers it is given, and drop `watchDocument`; drop the `onDocument` call
 * and prop in `../artboard-editor/index.js` and `./app.js`; drop the
 * `touch-action` line of `.wfd-canvas` in `./style.scss`; and delete the
 * AC-CANVAS-08 to AC-CANVAS-11 and AC-PERF-04 tests with the `fingers` helper
 * of `tests/e2e/utils.ts`.
 */

const POINTER_EVENTS = [
    'pointerdown',
    'pointermove',
    'pointerup',
    'pointercancel',
];
// A finger is less steady than a mouse: how far it moves (px) before what it
// pressed is dragged.
const DRAG_THRESHOLD = 10;
// Two taps this close in time (ms) and place (px) are a double tap.
const DOUBLE_TAP_DELAY = 400;
const DOUBLE_TAP_DISTANCE = 30;
// Fingers closer to their middle than this (px) give no zoom.
const MIN_SPREAD = 1;

/**
 * @param {Object}                                                  options
 * @param {Element}                                                 options.area      The canvas area.
 * @param {Object}                                                  options.viewport  The viewport.
 * @param {(event: Event, iframe?: Element) => {x:number,y:number}} options.pointOf   Gives where an event is in canvas area pixels; `iframe`
 *                                                                                    is the iframe of the event's document, when it is not
 *                                                                                    the board's.
 * @param {(event: PointerEvent) => void}                           options.onPress   Receives the `pointerdown` of a pointer that pressed.
 * @param {(event: PointerEvent) => void}                           options.onMove    Receives its `pointermove`s.
 * @param {(event: PointerEvent) => void}                           options.onRelease Receives its `pointerup` or `pointercancel`.
 * @param {() => void}                                              options.onCancel  Undoes the press in progress as if it had not started.
 * @param {(event: Event) => void}                                  options.onOpen    Receives the event of a double-click or a double tap.
 * @return {Object} `watchDocument`, to count the fingers of an artboard's
 *                  document as well, and `destroy`.
 */
export function createTouchGestures( {
    area,
    viewport,
    pointOf,
    onPress,
    onMove,
    onRelease,
    onCancel,
    onOpen,
} ) {
    // The fingers that are down, on the canvas area and in the watched
    // documents: document, then pointer id, then where the finger is in
    // canvas area pixels.
    const fingers = new Map();
    const watches = new Set();
    // Where the fingers were at the last update of a gesture of two or
    // more. It stays set until the last finger lifts, so that the fingers
    // of that gesture never act as a pointer.
    let pinch = null;
    // The finger that is the pointer: its `pointerdown`, and whether the
    // board has been told of it.
    let lone = null;
    let lastTap = null;
    let lastPointerType = '';

    // WordPress dispatches copies of the pointer events of a canvas document
    // on its iframe; those are not fingers on the canvas area.
    const isFinger = ( event ) =>
        event.pointerType === 'touch' && event.isTrusted;

    const fingersOf = ( doc ) => {
        if ( ! fingers.has( doc ) ) {
            fingers.set( doc, new Map() );
        }
        return fingers.get( doc );
    };

    const count = () => {
        let total = 0;
        fingers.forEach( ( inDocument ) => {
            total += inDocument.size;
        } );
        return total;
    };

    // The middle of the fingers and their mean distance from it.
    function measure() {
        const total = count();
        let x = 0;
        let y = 0;
        fingers.forEach( ( inDocument ) =>
            inDocument.forEach( ( at ) => {
                x += at.x / total;
                y += at.y / total;
            } )
        );
        let spread = 0;
        fingers.forEach( ( inDocument ) =>
            inDocument.forEach( ( at ) => {
                spread += Math.hypot( at.x - x, at.y - y ) / total;
            } )
        );
        return { x, y, spread };
    }

    // A finger that has already lifted cannot be captured.
    function hold( pointerId ) {
        try {
            area.setPointerCapture( pointerId );
        } catch {
            // Nothing to capture.
        }
    }

    function lift( doc, pointerId ) {
        fingersOf( doc ).delete( pointerId );
        const total = count();
        if ( ! total ) {
            pinch = null;
        } else if ( pinch && total > 1 ) {
            pinch = measure();
        }
    }

    /**
     * Follows one finger.
     *
     * @param {Document} doc    The finger's document.
     * @param {Event}    event  Its pointer event.
     * @param {Element}  iframe The iframe of that document, when it is not
     *                          the board's.
     * @return {boolean} Whether the finger is part of a gesture of two or
     *                   more.
     */
    function track( doc, event, iframe ) {
        const wasPinching = !! pinch;
        const inDocument = fingersOf( doc );
        if ( event.type === 'pointerdown' ) {
            if ( event.isPrimary ) {
                // Any other finger of that document lifted unheard.
                inDocument.clear();
                if ( ! count() ) {
                    pinch = null;
                }
            }
            inDocument.set( event.pointerId, pointOf( event, iframe ) );
            if ( count() > 1 ) {
                // A second finger ends what the first one was doing as if
                // it had not started: nothing is selected, moved or left
                // by it.
                lastTap = null;
                const wasPressed = lone?.isPressed;
                lone = null;
                if ( wasPressed ) {
                    onCancel();
                }
                pinch = measure();
                // What is under a finger can go while the board moves (an
                // artboard changes tier); the fingers stay with the board.
                fingersOf( area.ownerDocument ).forEach( ( at, pointerId ) =>
                    hold( pointerId )
                );
            }
        } else if ( event.type === 'pointermove' ) {
            if ( ! inDocument.has( event.pointerId ) ) {
                return wasPinching;
            }
            inDocument.set( event.pointerId, pointOf( event, iframe ) );
            if ( pinch && count() > 1 ) {
                const next = measure();
                viewport.panBy( next.x - pinch.x, next.y - pinch.y );
                if ( pinch.spread > MIN_SPREAD && next.spread > MIN_SPREAD ) {
                    viewport.zoomTo(
                        ( viewport.get().zoom * next.spread ) / pinch.spread,
                        next
                    );
                }
                pinch = next;
            }
        } else {
            lift( doc, event.pointerId );
        }
        return wasPinching || !! pinch;
    }

    // Before anything under the finger hears of it: the fingers of a gesture
    // of two or more are the board's alone.
    function onFinger( event ) {
        if ( event.type === 'pointerdown' ) {
            lastPointerType = event.pointerType;
        }
        if ( isFinger( event ) && track( area.ownerDocument, event ) ) {
            event.stopPropagation();
        }
    }

    // The browser must not take two fingers for itself, here or in an
    // artboard's document.
    function onTouchMove( event ) {
        if ( pinch && event.cancelable ) {
            event.preventDefault();
        }
    }

    function onPointerDown( event ) {
        if ( ! isFinger( event ) ) {
            onPress( event );
        } else if ( ! pinch ) {
            // A finger may be the first of two, so what it pressed is acted
            // on only once it moves or lifts.
            lone = { down: event, isPressed: false };
        }
    }

    function onPointerMove( event ) {
        if ( pinch && event.pointerType === 'touch' ) {
            return;
        }
        if ( lone && ! lone.isPressed ) {
            const { down } = lone;
            if (
                event.pointerId !== down.pointerId ||
                Math.hypot(
                    event.clientX - down.clientX,
                    event.clientY - down.clientY
                ) < DRAG_THRESHOLD
            ) {
                return;
            }
            // The finger drags: it pressed where it landed.
            lone.isPressed = true;
            onPress( down );
        }
        onMove( event );
    }

    function onPointerUp( event ) {
        let isTap = false;
        if ( lone && ! lone.isPressed ) {
            const { down } = lone;
            if ( event.pointerId !== down.pointerId ) {
                return;
            }
            lone = null;
            if ( event.type === 'pointercancel' ) {
                return;
            }
            // The finger lifted where it landed: a tap is a click.
            onPress( down );
            isTap = true;
        } else if ( lone && event.pointerId === lone.down.pointerId ) {
            lone = null;
            if ( event.type === 'pointercancel' ) {
                // The browser took the finger away: its drag is undone, as
                // it is when a second finger lands.
                onCancel();
            }
        }
        onRelease( event );
        if ( isTap ) {
            // Two taps in the same place are a double-click. Browsers do
            // not agree on sending one for fingers.
            const isDouble =
                lastTap &&
                event.timeStamp - lastTap.time < DOUBLE_TAP_DELAY &&
                Math.hypot(
                    event.clientX - lastTap.x,
                    event.clientY - lastTap.y
                ) < DOUBLE_TAP_DISTANCE;
            lastTap = isDouble
                ? null
                : {
                      time: event.timeStamp,
                      x: event.clientX,
                      y: event.clientY,
                  };
            if ( isDouble ) {
                onOpen( event );
            }
        }
    }

    function onDoubleClick( event ) {
        // A double tap is found from its taps, above.
        if ( lastPointerType !== 'touch' ) {
            onOpen( event );
        }
    }

    /**
     * Counts the fingers in an artboard's document with the ones on the
     * canvas area. The document still gets every one of their events.
     *
     * @param {Document} doc    The document.
     * @param {Element}  iframe Its iframe.
     * @return {() => void} Stops watching the document.
     */
    function watchDocument( doc, iframe ) {
        const onDocumentFinger = ( event ) => {
            if ( event.pointerType === 'touch' ) {
                track( doc, event, iframe );
            }
        };
        POINTER_EVENTS.forEach( ( type ) =>
            doc.addEventListener( type, onDocumentFinger, true )
        );
        doc.addEventListener( 'touchmove', onTouchMove, {
            passive: false,
            capture: true,
        } );
        const stop = () => {
            watches.delete( stop );
            POINTER_EVENTS.forEach( ( type ) =>
                doc.removeEventListener( type, onDocumentFinger, true )
            );
            doc.removeEventListener( 'touchmove', onTouchMove, true );
            // A finger still down there is not heard of again.
            [ ...fingersOf( doc ).keys() ].forEach( ( pointerId ) =>
                lift( doc, pointerId )
            );
            fingers.delete( doc );
        };
        watches.add( stop );
        return stop;
    }

    POINTER_EVENTS.forEach( ( type ) =>
        area.addEventListener( type, onFinger, true )
    );
    area.addEventListener( 'touchmove', onTouchMove, { passive: false } );
    area.addEventListener( 'pointerdown', onPointerDown );
    area.addEventListener( 'pointermove', onPointerMove );
    area.addEventListener( 'pointerup', onPointerUp );
    area.addEventListener( 'pointercancel', onPointerUp );
    area.addEventListener( 'dblclick', onDoubleClick );

    return {
        watchDocument,
        destroy() {
            [ ...watches ].forEach( ( stop ) => stop() );
            POINTER_EVENTS.forEach( ( type ) =>
                area.removeEventListener( type, onFinger, true )
            );
            area.removeEventListener( 'touchmove', onTouchMove );
            area.removeEventListener( 'pointerdown', onPointerDown );
            area.removeEventListener( 'pointermove', onPointerMove );
            area.removeEventListener( 'pointerup', onPointerUp );
            area.removeEventListener( 'pointercancel', onPointerUp );
            area.removeEventListener( 'dblclick', onDoubleClick );
        },
    };
}
