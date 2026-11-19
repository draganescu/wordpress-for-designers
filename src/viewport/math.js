/**
 * Pure viewport maths. One board unit is one CSS pixel at 100% zoom.
 */

export const MIN_ZOOM = 0.02;
export const MAX_ZOOM = 4;
const FIT_MARGIN = 48;

export function clampZoom( zoom ) {
    return Math.min( MAX_ZOOM, Math.max( MIN_ZOOM, zoom ) );
}

/**
 * The bounding box of a list of rectangles.
 *
 * @param {Array} rects Rectangles as { x, y, width, height }.
 * @return {Object|null} The bounds, or null for an empty list.
 */
export function boundsOf( rects ) {
    if ( ! rects.length ) {
        return null;
    }
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for ( const rect of rects ) {
        left = Math.min( left, rect.x );
        top = Math.min( top, rect.y );
        right = Math.max( right, rect.x + rect.width );
        bottom = Math.max( bottom, rect.y + rect.height );
    }
    return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * The viewport that shows a rectangle whole, centred, at no more than 100%.
 *
 * @param {Object} bounds The rectangle in board units.
 * @param {Object} size   The canvas area size in CSS pixels.
 * @return {Object} The viewport as { x, y, zoom }.
 */
export function fitBounds( bounds, size ) {
    if ( ! bounds || ! size.width || ! size.height ) {
        return { x: 0, y: 0, zoom: 1 };
    }
    const zoom = clampZoom(
        Math.min(
            1,
            ( size.width - FIT_MARGIN * 2 ) / bounds.width,
            ( size.height - FIT_MARGIN * 2 ) / bounds.height
        )
    );
    return {
        zoom,
        x: ( size.width - bounds.width * zoom ) / 2 - bounds.x * zoom,
        y: ( size.height - bounds.height * zoom ) / 2 - bounds.y * zoom,
    };
}

/**
 * Zooms around a point of the canvas area, keeping it still.
 *
 * @param {Object} viewport The current viewport.
 * @param {number} zoom     The new zoom.
 * @param {Object} point    The fixed point in canvas area pixels.
 * @return {Object} The new viewport.
 */
export function zoomAround( viewport, zoom, point ) {
    const next = clampZoom( zoom );
    const ratio = next / viewport.zoom;
    return {
        zoom: next,
        x: point.x - ( point.x - viewport.x ) * ratio,
        y: point.y - ( point.y - viewport.y ) * ratio,
    };
}

/**
 * The part of the board that is visible, in board units.
 *
 * @param {Object} viewport The viewport.
 * @param {Object} size     The canvas area size.
 * @return {Object} A rectangle.
 */
export function visibleRect( viewport, size ) {
    return {
        x: -viewport.x / viewport.zoom,
        y: -viewport.y / viewport.zoom,
        width: size.width / viewport.zoom,
        height: size.height / viewport.zoom,
    };
}
