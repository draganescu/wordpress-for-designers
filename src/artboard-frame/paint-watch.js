/**
 * Tells when the content an artboard is changing to has been drawn, so that
 * what it showed before can stay over it until then: a tier change then
 * shows no empty frame.
 */
import { useContext, useEffect, useRef } from '@wordpress/element';
import { FrameElementContext } from './index';

const CHECK_EVERY = 50;
// How long to wait for content that never comes, from the moment its iframe
// is there.
const GIVE_UP = 3000;

/**
 * Whether an iframe's document has its blocks laid out and its style sheets
 * loaded.
 *
 * @param {HTMLIFrameElement} iframe The iframe.
 * @return {boolean} Whether it is drawn.
 */
function isDrawn( iframe ) {
    const doc = iframe.contentDocument;
    if ( ! doc || doc.readyState !== 'complete' ) {
        return false;
    }
    // The block list is there once its root is. An artboard with no blocks
    // has an empty root, which is all it will ever draw.
    const root = doc.querySelector( '.is-root-container' );
    if (
        ! root ||
        ( root.firstElementChild && ! root.getBoundingClientRect().height )
    ) {
        return false;
    }
    return [ ...doc.querySelectorAll( 'link[rel="stylesheet"]' ) ].every(
        ( link ) => link.sheet
    );
}

/**
 * Calls `onPainted` once every iframe matching `selector` in the artboard's
 * frame is drawn, and two animation frames have passed so that the drawing
 * is on screen.
 *
 * @param {Object}   props
 * @param {string}   props.selector  The iframes of the incoming content.
 * @param {Function} props.onPainted Called once.
 */
export function PaintWatch( { selector, onPainted } ) {
    const frame = useContext( FrameElementContext );
    const latest = useRef( onPainted );
    latest.current = onPainted;
    useEffect( () => {
        if ( ! frame ) {
            return;
        }
        let since = 0;
        let raf = 0;
        let isDone = false;
        const done = () => {
            isDone = true;
            window.clearInterval( timer );
            raf = window.requestAnimationFrame( () => {
                raf = window.requestAnimationFrame( () => latest.current() );
            } );
        };
        const check = () => {
            if ( isDone ) {
                return;
            }
            const iframes = [ ...frame.querySelectorAll( selector ) ];
            if ( ! iframes.length ) {
                return;
            }
            since = since || Date.now();
            if ( iframes.every( isDrawn ) || Date.now() - since > GIVE_UP ) {
                done();
            }
        };
        const timer = window.setInterval( check, CHECK_EVERY );
        check();
        return () => {
            window.clearInterval( timer );
            window.cancelAnimationFrame( raf );
        };
    }, [ frame, selector ] );
    return null;
}
