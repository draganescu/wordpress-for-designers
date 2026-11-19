/**
 * WordPress dependencies
 */
import { useEffect, useRef } from '@wordpress/element';

// How long the pointer rests on an edge before the panel there comes back.
const REVEAL_DELAY = 150;

/**
 * A strip along one edge of the canvas area. Resting the pointer on it
 * shows the panel that is not shown on that side (D32). It is for the
 * pointer only: the header toggles and the shortcut do the same from the
 * keyboard.
 *
 * @param {Object}   props
 * @param {string}   props.side     "left" or "right".
 * @param {Function} props.onReveal Shows the panel.
 */
function RevealEdge( { side, onReveal } ) {
    const timer = useRef( null );
    const latest = useRef( onReveal );
    latest.current = onReveal;
    useEffect( () => () => clearTimeout( timer.current ), [] );
    return (
        <div
            className={ `wfd-reveal-edge is-${ side }` }
            data-wfd-reveal={ side }
            aria-hidden="true"
            onPointerEnter={ ( event ) => {
                // Not in the middle of a drag that passes over the edge.
                if ( event.buttons ) {
                    return;
                }
                clearTimeout( timer.current );
                timer.current = setTimeout(
                    () => latest.current(),
                    REVEAL_DELAY
                );
            } }
            onPointerLeave={ () => clearTimeout( timer.current ) }
        />
    );
}

/**
 * The shell layout: header, left panel, canvas area, right panel.
 *
 * @param {Object}   props
 * @param {Element}  props.header        The header region.
 * @param {Element}  props.left          The left panel content, or null when closed.
 * @param {Element}  props.canvas        The canvas region.
 * @param {Element}  props.right         The right panel content, or null when hidden.
 * @param {Element}  props.corner        What floats at the bottom left of the canvas area.
 * @param {Element}  props.overlays      Drawers and dialogs.
 * @param {Function} props.onRevealLeft  Shows the left panel.
 * @param {Function} props.onRevealRight Shows the right panel.
 */
export function Shell( {
    header,
    left,
    canvas,
    right,
    corner,
    overlays,
    onRevealLeft,
    onRevealRight,
} ) {
    return (
        <div
            className={
                'wfd-shell' +
                ( left ? '' : ' has-no-left' ) +
                ( right ? '' : ' has-no-right' )
            }
        >
            { header }
            { /* One landmark for everything under the header. */ }
            <main className="wfd-body">
                { left && (
                    <section className="wfd-left" data-wfd-region="left">
                        { left }
                    </section>
                ) }
                <div className="wfd-main">
                    { canvas }
                    { corner }
                    { ! left && (
                        <RevealEdge side="left" onReveal={ onRevealLeft } />
                    ) }
                    { ! right && (
                        <RevealEdge side="right" onReveal={ onRevealRight } />
                    ) }
                </div>
                { right && (
                    <section className="wfd-right" data-wfd-region="right">
                        { right }
                    </section>
                ) }
            </main>
            { overlays }
        </div>
    );
}
