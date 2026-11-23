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
function PaintWatch( { selector, onPainted } ) {
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
            onPainted={ () => handedOver( tier ) }
        />,
    ];
}
