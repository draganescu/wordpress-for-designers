/**
 * Rulers along the top and left edges of the canvas area (D108): what they
 * measure, and the two canvases they are painted on.
 */
import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { store as boardStore } from '../board-store';
import { ATTR } from './constants';
import { rectOf } from './use-canvas-interactions';

/**
 * Two numbers are at least this far apart, in CSS px.
 */
const NUMBER_GAP = 50;

/**
 * The parts a step between two numbers is cut into by its smaller ticks.
 */
const PARTS = 5;

/**
 * Room between a line and its number, and between two numbers, in CSS px.
 */
const ROOM = 3;

/**
 * The step between two numbers: the smallest of 1, 2 or 5 times a power of
 * ten that is long enough at this zoom.
 *
 * @param {number} zoom The zoom.
 * @return {number} The step in board units.
 */
function stepAt( zoom ) {
    const least = NUMBER_GAP / zoom - 1e-6;
    const power = 10 ** Math.floor( Math.log10( least ) );
    return [ 1, 2, 5, 10 ]
        .map( ( times ) => times * power )
        .find( ( step ) => step >= least );
}

/**
 * The colours and fonts the rulers are painted with, read from the page.
 *
 * @param {Element} ruler A ruler's canvas.
 * @param {Element} probe The element that holds the brand and guide colours.
 * @return {Object} The values.
 */
function readInk( ruler, probe ) {
    const view = ruler.ownerDocument.defaultView;
    const neutral = view.getComputedStyle( ruler );
    const brand = view.getComputedStyle( probe );
    const font = ( weight ) =>
        `${ weight } ${ neutral.fontSize } ${ neutral.fontFamily }`;
    return {
        ratio: view.devicePixelRatio || 1,
        tick: neutral.borderBottomColor,
        number: neutral.color,
        font: font( neutral.fontWeight ),
        span: brand.backgroundColor,
        brand: brand.borderBottomColor,
        brandNumber: brand.color,
        brandFont: font( brand.fontWeight ),
        guide: brand.outlineColor,
    };
}

/**
 * Paints one ruler and writes the attributes the tests read.
 *
 * @param {Element} canvas         The ruler's canvas.
 * @param {string}  axis           'x' for the top ruler, 'y' for the left one.
 * @param {Object}  view           The pan and zoom.
 * @param {Object}  context        What is measured.
 * @param {?Object} context.owner  The artboard whose corner is zero.
 * @param {?Object} context.span   The span, when it is not the owner's extent.
 * @param {?Object} context.active The guide selected or being dragged.
 * @param {Array}   guides         The guides that are shown.
 * @param {Object}  ink            Colours and fonts.
 */
function paintRuler(
    canvas,
    axis,
    view,
    { owner, span, active },
    guides,
    ink
) {
    const isTop = axis === 'x';
    const origin = owner ? owner[ axis ] : 0;
    const zero = view[ axis ] + origin * view.zoom;
    const step = stepAt( view.zoom );
    let ends = null;
    if ( span ) {
        ends = span[ axis ];
    } else if ( owner ) {
        ends = [ 0, isTop ? owner.width : owner.height ];
    }
    // A board guide counts from the board's origin, an artboard's guide
    // from zero already.
    const marks = guides
        .filter(
            ( guide ) =>
                guide.axis === axis &&
                guide.id !== active?.id &&
                ( ! guide.artboard || guide.artboard === owner?.id )
        )
        .map( ( guide ) => ( guide.artboard ? guide.at : guide.at - origin ) );
    let current = null;
    if ( active?.axis === axis ) {
        const known = guides.find( ( guide ) => guide.id === active.id );
        current = known && ! known.artboard ? active.at - origin : active.at;
    }

    canvas.setAttribute( ATTR.zero, Math.round( zero ) );
    canvas.setAttribute( ATTR.step, step );
    if ( ends ) {
        canvas.setAttribute( ATTR.span, ends.join( ' ' ) );
    } else {
        canvas.removeAttribute( ATTR.span );
    }
    canvas.setAttribute(
        ATTR.marks,
        ( current === null ? marks : [ ...marks, current ] )
            .sort( ( a, b ) => a - b )
            .join( ' ' )
    );

    // Everything below is drawn as for the top ruler: along the ruler, then
    // across it towards the board. The left ruler is turned a quarter, so
    // its numbers read upwards and its values grow against the drawing.
    const { ratio } = ink;
    const length = ( isTop ? canvas.width : canvas.height ) / ratio;
    const depth = ( isTop ? canvas.height : canvas.width ) / ratio;
    const pen = canvas.getContext( '2d' );
    pen.setTransform( 1, 0, 0, 1, 0, 0 );
    pen.clearRect( 0, 0, canvas.width, canvas.height );
    if ( isTop ) {
        pen.setTransform( ratio, 0, 0, ratio, 0, 0 );
    } else {
        pen.setTransform( 0, -ratio, ratio, 0, 0, 0 );
    }
    pen.textBaseline = 'middle';
    pen.textAlign = isTop ? 'left' : 'right';
    // Where a value is along the ruler, in whole CSS px.
    const at = ( value ) => Math.round( zero + value * view.zoom );
    const fill = ( from, to, top, color ) => {
        pen.fillStyle = color;
        pen.fillRect( isTop ? from : -to, top, to - from, depth - top );
    };
    const line = ( value, top, color ) =>
        fill( at( value ), at( value ) + 1, top, color );
    // A number beside the line of its value: after it, or before it for
    // the far end of the span.
    const numberOf = ( value, font, isBefore ) => {
        const text = String( value ).replace( '-', '−' );
        pen.font = font;
        const { width } = pen.measureText( text );
        const start = isBefore
            ? at( value ) - ROOM - width
            : at( value ) + 1 + ROOM;
        return { text, font, start, end: start + width };
    };
    const write = ( { text, font, start }, color ) => {
        pen.font = font;
        pen.fillStyle = color;
        pen.fillText( text, isTop ? start : -start, depth / 2 );
    };

    const brandNumbers = [];
    if ( ends ) {
        fill( at( ends[ 0 ] ), at( ends[ 1 ] ) + 1, 0, ink.span );
        brandNumbers.push(
            numberOf( ends[ 0 ], ink.brandFont ),
            numberOf( ends[ 1 ], ink.brandFont, true )
        );
    }
    if ( current !== null ) {
        brandNumbers.push( numberOf( current, ink.brandFont ) );
    }

    const part = step / PARTS;
    let index = Math.floor( -zero / view.zoom / part ) - PARTS;
    for ( ; at( index * part ) < length; index++ ) {
        const value = index * part;
        if ( index % PARTS ) {
            line( value, depth * 0.75, ink.tick );
            continue;
        }
        line( value, 0, ink.tick );
        const number = numberOf( value, ink.font );
        // A number that would touch one in the brand colour is left out.
        if (
            ! brandNumbers.some(
                ( other ) =>
                    number.start < other.end + ROOM &&
                    other.start < number.end + ROOM
            )
        ) {
            write( number, ink.number );
        }
    }

    marks.forEach( ( value ) => line( value, 0, ink.guide ) );
    ( ends ?? [] ).forEach( ( value ) => line( value, 0, ink.brand ) );
    if ( current !== null ) {
        line( current, 0, ink.brand );
    }
    brandNumbers.forEach( ( number ) => write( number, ink.brandNumber ) );
}

/**
 * The rulers (R1 to R5). They are painted from the viewport's frames with
 * no render (C34).
 *
 * The ref's `measure( context )` puts another context in place of the
 * `context` prop and paints at once, with no render, until it is called
 * with null: a guide being dragged does that on each move (C35).
 *
 * @param {Object}   props
 * @param {Object}   props.viewport The viewport.
 * @param {Object}   props.context  What is measured: `owner`, the artboard
 *                                  whose corner is zero, as its id and
 *                                  rectangle, or null for the board's
 *                                  origin; `span`, as `{ x, y }` pairs of
 *                                  values, when it is not the owner's
 *                                  extent; `active`, the guide selected or
 *                                  being dragged, as `{ id, axis, at }`.
 * @param {Array}    props.guides   The guides that are shown.
 * @param {Function} props.onPull   Called with the axis of the guide a press
 *                                  on a ruler pulls out, and the event.
 */
export const Rulers = forwardRef( function RulersRegion(
    { viewport, context, guides, onPull },
    ref
) {
    const element = useRef();
    const ink = useRef( null );
    const measured = useRef( null );
    const latest = useRef();
    latest.current = { context, guides, onPull };

    const paint = useCallback(
        ( view = viewport.get() ) => {
            if ( ! ink.current ) {
                return;
            }
            const [ top, left ] = element.current.children;
            const what = measured.current ?? latest.current.context;
            paintRuler(
                top,
                'x',
                view,
                what,
                latest.current.guides,
                ink.current
            );
            paintRuler(
                left,
                'y',
                view,
                what,
                latest.current.guides,
                ink.current
            );
        },
        [ viewport ]
    );

    useImperativeHandle(
        ref,
        () => ( {
            measure( next ) {
                measured.current = next;
                paint();
            },
        } ),
        [ paint ]
    );

    // The props changed.
    useLayoutEffect( () => paint() );

    useEffect( () => {
        const root = element.current;
        const [ top, left, , probe ] = root.children;
        // The canvases keep the size of the canvas area's edges.
        const sizes = new root.ownerDocument.defaultView.ResizeObserver( () => {
            ink.current = readInk( top, probe );
            [ top, left ].forEach( ( canvas ) => {
                canvas.width = canvas.clientWidth * ink.current.ratio;
                canvas.height = canvas.clientHeight * ink.current.ratio;
            } );
            paint();
        } );
        sizes.observe( top );
        sizes.observe( left );
        // A press on a ruler pulls a guide out of it (D110): a horizontal
        // one from the top ruler, a vertical one from the left ruler. The
        // board does not hear of the press, or it would take it for one on
        // empty board; a press that pans is the board's.
        function onPointerDown( event ) {
            if ( event.button !== 0 || root.closest( '.is-pan-ready' ) ) {
                return;
            }
            event.stopPropagation();
            if ( event.target === top ) {
                latest.current.onPull( 'y', event );
            } else if ( event.target === left ) {
                latest.current.onPull( 'x', event );
            }
        }
        root.addEventListener( 'pointerdown', onPointerDown );
        const stop = viewport.onFrame( paint );
        return () => {
            sizes.disconnect();
            root.removeEventListener( 'pointerdown', onPointerDown );
            stop();
        };
    }, [ viewport, paint ] );

    return (
        <div className="wfd-rulers" ref={ element } aria-hidden="true">
            <canvas
                className="wfd-ruler is-top"
                { ...{ [ ATTR.ruler ]: 'top' } }
            />
            <canvas
                className="wfd-ruler is-left"
                { ...{ [ ATTR.ruler ]: 'left' } }
            />
            <div className="wfd-ruler__corner" />
            <span className="wfd-ruler__ink" />
        </div>
    );
} );

/**
 * What the rulers measure, from the board's state (spec/screens/README.md,
 * Rulers): the artboard in edit, or the artboard of the selected guide, or
 * the one artboard selected, or the board.
 *
 * @param {Object}   options
 * @param {boolean}  options.isShown         Whether the rulers are shown.
 * @param {Function} options.widthOf         Gives the render width of a device.
 * @param {?string}  options.selectedBlockId The block selected in the Live
 *                                           editor, when it is one block.
 * @return {Object} The `context` of `Rulers`.
 */
export function useRulerContext( { isShown, widthOf, selectedBlockId } ) {
    const { artboard, guide, liveId } = useSelect( ( select ) => {
        const board = select( boardStore );
        const guideId = board.getSelectedGuideId();
        const selected =
            ( guideId &&
                board.getGuides().find( ( item ) => item.id === guideId ) ) ||
            null;
        const id =
            board.getEditId() ??
            ( selected ? selected.artboard : board.getSelectedId() );
        return {
            artboard: id ? board.getArtboard( id ) : null,
            guide: selected,
            liveId: board.getLiveId(),
        };
    }, [] );

    // The edges of the selected blocks in the page's pixels, read from the
    // Live editor's document: its iframe starts at the artboard's corner
    // and one of its pixels is one board unit.
    const [ blocks, setBlocks ] = useState( null );
    useEffect( () => {
        const doc =
            isShown &&
            liveId &&
            document.querySelector(
                `[data-wfd-artboard="${ liveId }"] iframe[name="editor-canvas"]`
            )?.contentDocument;
        if ( ! doc?.body ) {
            return;
        }
        const view = doc.defaultView;
        let elements = [];
        let frame = 0;
        function read() {
            const boxes = elements.map( ( block ) =>
                block.getBoundingClientRect()
            );
            const edges = ( low, high, scroll ) => [
                Math.round(
                    Math.min( ...boxes.map( ( box ) => box[ low ] ) ) + scroll
                ),
                Math.round(
                    Math.max( ...boxes.map( ( box ) => box[ high ] ) ) + scroll
                ),
            ];
            const next = boxes.length
                ? {
                      x: edges( 'left', 'right', view.scrollX ),
                      y: edges( 'top', 'bottom', view.scrollY ),
                  }
                : null;
            setBlocks( ( was ) =>
                was &&
                next &&
                String( [ was.x, was.y ] ) === String( [ next.x, next.y ] )
                    ? was
                    : next
            );
        }
        // Read again when a selected block changes size.
        const sizes = new view.ResizeObserver( read );
        function find() {
            frame = 0;
            elements = [
                ...doc.querySelectorAll(
                    selectedBlockId
                        ? `[data-block="${ selectedBlockId }"]`
                        : '[data-block].is-multi-selected'
                ),
            ];
            sizes.disconnect();
            elements.forEach( ( block ) => sizes.observe( block ) );
            read();
        }
        // The editor marks the blocks of a selection of several with a
        // class, and draws a block's element again when it likes.
        const marks = new view.MutationObserver( () => {
            frame = frame || view.requestAnimationFrame( find );
        } );
        marks.observe( doc.body, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: [ 'class' ],
        } );
        find();
        return () => {
            view.cancelAnimationFrame( frame );
            sizes.disconnect();
            marks.disconnect();
            setBlocks( null );
        };
    }, [ isShown, liveId, selectedBlockId ] );

    return useMemo(
        () => ( {
            owner: artboard
                ? { id: artboard.id, ...rectOf( artboard, widthOf ) }
                : null,
            span: ( artboard?.id === liveId && blocks ) || undefined,
            active: guide
                ? { id: guide.id, axis: guide.axis, at: guide.at }
                : null,
        } ),
        [ artboard, guide, liveId, blocks, widthOf ]
    );
}
