/**
 * A tier change that shows no empty frame (D100): what an artboard showed
 * before stays over what it now shows until that has been drawn.
 */
import {
    useCallback,
    useContext,
    useEffect,
    useReducer,
    useRef,
} from '@wordpress/element';
import { FrameElementContext } from './index';

const CHECK_EVERY = 50;
// How long to wait for content that never comes, from the moment its iframe
// is there.
const GIVE_UP = 3000;
// How long incoming content has to keep its height. Styles that reach a
// Preview after its blocks (artboard-frame/viewport-units.js) move it once
// more.
const QUIET = 200;

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
 * Whether a drawn iframe's document has its fonts and its images. A document
 * that is complete can still be loading both: a Preview's blocks are put in
 * after its iframe has loaded. An image the browser loads only when it comes
 * into view is not waited for.
 *
 * @param {HTMLIFrameElement} iframe The iframe.
 * @return {boolean} Whether it has them.
 */
function hasLoaded( iframe ) {
    const doc = iframe.contentDocument;
    return (
        doc.fonts?.status !== 'loading' &&
        [ ...doc.images ].every(
            ( image ) => image.complete || image.loading === 'lazy'
        )
    );
}

/**
 * Whether a drawn Preview's iframe has the height of its content; true of
 * anything else. The iframe starts short and is fitted to its content after
 * that is laid out, and a Preview shown before then is cut off.
 *
 * @param {HTMLIFrameElement} iframe The iframe.
 * @return {boolean} Whether it fits.
 */
function isFitted( iframe ) {
    // A frozen copy keeps the Preview's class, and the size it was copied at.
    return (
        ! iframe.closest( '.wfd-preview:not(.wfd-snapshot__copy)' ) ||
        iframe.contentDocument.documentElement.scrollHeight <=
            iframe.clientHeight + 1
    );
}

/**
 * Calls `onPainted` once every iframe matching `selector` in the artboard's
 * frame is drawn, and two animation frames have passed so that the drawing
 * is on screen. With `isSettling` the iframes also have to hold their fonts
 * and images, fit their content, and have kept their height for `QUIET`.
 *
 * @param {Object}   props
 * @param {string}   props.selector   The iframes of the incoming content.
 * @param {boolean}  props.isSettling Whether the content has to settle.
 * @param {Function} props.onPainted  Called once.
 */
function PaintWatch( { selector, isSettling, onPainted } ) {
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
        let heights = '';
        let quietSince = 0;
        const isSettled = ( iframes ) => {
            if ( ! iframes.every( isDrawn ) ) {
                return false;
            }
            if ( ! isSettling ) {
                return true;
            }
            const now = iframes
                .map( ( iframe ) => iframe.contentDocument.body.offsetHeight )
                .join();
            if ( now !== heights ) {
                heights = now;
                quietSince = Date.now();
            }
            return (
                Date.now() - quietSince >= QUIET &&
                iframes.every(
                    ( iframe ) => hasLoaded( iframe ) && isFitted( iframe )
                )
            );
        };
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
            if ( isSettled( iframes ) || Date.now() - since > GIVE_UP ) {
                done();
            }
        };
        const timer = window.setInterval( check, CHECK_EVERY );
        check();
        return () => {
            window.clearInterval( timer );
            window.cancelAnimationFrame( raf );
        };
    }, [ frame, selector, isSettling ] );
    return null;
}

// The tier changes that hand over from one content to the next, and the
// iframes of the content each tier changes to.
const HANDOVERS = {
    snapshot: [ 'preview' ],
    preview: [ 'live', 'warm', 'snapshot' ],
};
const PAINTED = {
    preview: '.wfd-preview:not(.is-over) iframe',
    live: 'iframe[name="editor-canvas"]',
    warm: 'iframe[name="editor-canvas"]',
    snapshot:
        '.wfd-snapshot:not(.is-over) .wfd-snapshot__copy:not(.is-loading) iframe',
};

/**
 * An artboard's tier content. It keeps the tier whose content was last drawn
 * itself, so that the end of a handover renders this artboard's content and
 * nothing else of the board.
 *
 * @param {Object}   props
 * @param {string}   props.tier        The artboard's tier.
 * @param {boolean}  props.canHandOver Whether its content can be left over the next.
 * @param {Function} props.contentFor  Receives the tier being left, if any, and
 *                                     returns `content` and `incoming`: whether
 *                                     the content of the new tier is there to
 *                                     be drawn.
 */
export function TierContent( { tier, canHandOver, contentFor } ) {
    const drawn = useRef( tier );
    const [ , redraw ] = useReducer( ( count ) => count + 1, 0 );
    let outgoing = null;
    if ( drawn.current !== tier ) {
        if ( canHandOver && HANDOVERS[ drawn.current ]?.includes( tier ) ) {
            outgoing = drawn.current;
        } else {
            drawn.current = tier;
        }
    }
    const handedOver = useCallback( ( painted ) => {
        drawn.current = painted;
        redraw();
    }, [] );
    const { content, incoming } = contentFor( outgoing );
    if ( ! outgoing || ! incoming ) {
        return content;
    }
    return [
        ...content,
        <PaintWatch
            key={ 'watch-' + tier }
            selector={ PAINTED[ tier ] }
            isSettling={ tier === 'preview' || tier === 'snapshot' }
            onPainted={ () => handedOver( tier ) }
        />,
    ];
}
