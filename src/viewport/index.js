/**
 * Pan and zoom state kept outside React (constraint C22).
 *
 * The viewport writes one CSS transform on the canvas surface per animation
 * frame, together with the custom property the labels and outlines read to
 * stay at screen size. React is told only when a gesture settles.
 */
import { boundsOf, clampZoom, fitBounds, zoomAround } from './math';

const SETTLE_DELAY = 140;

export function createViewport() {
    let state = { x: 0, y: 0, zoom: 1 };
    let surface = null;
    let area = null;
    let frame = 0;
    let settleTimer = 0;
    let isGesturing = false;
    const settleListeners = new Set();
    const gestureListeners = new Set();
    const frameListeners = new Set();
    const counters = { updates: 0 };

    function write() {
        frame = 0;
        if ( ! surface ) {
            return;
        }
        counters.updates++;
        surface.style.transform = `translate(${ state.x }px, ${ state.y }px) scale(${ state.zoom })`;
        surface.style.setProperty( '--wfd-zoom', String( state.zoom ) );
        // Block tools that WordPress draws outside the canvas read it too.
        surface.ownerDocument.documentElement.style.setProperty(
            '--wfd-zoom',
            String( state.zoom )
        );
        frameListeners.forEach( ( listener ) => listener( state ) );
    }

    function schedule() {
        if ( ! frame ) {
            frame = window.requestAnimationFrame( write );
        }
    }

    function settle() {
        settleTimer = 0;
        if ( isGesturing ) {
            isGesturing = false;
            gestureListeners.forEach( ( listener ) => listener( false ) );
        }
        settleListeners.forEach( ( listener ) => listener( state ) );
    }

    function set( next, { immediate = false } = {} ) {
        state = { ...next, zoom: clampZoom( next.zoom ) };
        if ( immediate ) {
            if ( frame ) {
                window.cancelAnimationFrame( frame );
            }
            write();
            window.clearTimeout( settleTimer );
            settle();
            return;
        }
        if ( ! isGesturing ) {
            isGesturing = true;
            gestureListeners.forEach( ( listener ) => listener( true ) );
        }
        schedule();
        window.clearTimeout( settleTimer );
        settleTimer = window.setTimeout( settle, SETTLE_DELAY );
    }

    function size() {
        return area
            ? { width: area.clientWidth, height: area.clientHeight }
            : { width: 0, height: 0 };
    }

    return {
        counters,
        get: () => state,
        size,
        isGesturing: () => isGesturing,
        attach( surfaceElement, areaElement ) {
            surface = surfaceElement;
            area = areaElement;
            write();
        },
        detach() {
            surface = null;
            area = null;
        },
        set,
        panBy( dx, dy ) {
            set( { ...state, x: state.x + dx, y: state.y + dy } );
        },
        zoomTo( zoom, point, options ) {
            const centre = point || {
                x: size().width / 2,
                y: size().height / 2,
            };
            set( zoomAround( state, zoom, centre ), options );
        },
        fit( rects, options = { immediate: true } ) {
            const bounds = boundsOf( rects );
            if ( bounds ) {
                set( fitBounds( bounds, size() ), options );
            }
        },
        /**
         * Converts a point of the canvas area to board units.
         *
         * @param {Object} point The point in canvas area pixels.
         * @return {Object} The point in board units.
         */
        toBoard( point ) {
            return {
                x: ( point.x - state.x ) / state.zoom,
                y: ( point.y - state.y ) / state.zoom,
            };
        },
        onSettle( listener ) {
            settleListeners.add( listener );
            return () => settleListeners.delete( listener );
        },
        onGesture( listener ) {
            gestureListeners.add( listener );
            return () => gestureListeners.delete( listener );
        },
        /**
         * Adds a listener called once for each frame the viewport writes,
         * with the pan and zoom of that frame (C34).
         *
         * @param {Function} listener The listener.
         * @return {Function} Removes it.
         */
        onFrame( listener ) {
            frameListeners.add( listener );
            return () => frameListeners.delete( listener );
        },
    };
}
