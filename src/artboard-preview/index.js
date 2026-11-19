/**
 * The Preview tier: read-only blocks through BlockPreview in an iframe at the
 * device width.
 */
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
} from '@wordpress/element';
import { useEntityBlockEditor } from '@wordpress/core-data';
import {
    BlockContextProvider,
    BlockEditorProvider,
    BlockPreview,
} from '@wordpress/block-editor';
import { useResizeObserver } from '@wordpress/compose';
import { KINDS } from '../shell/constants';
import { GuardedRegistry } from '../shell/guarded-registry';
import { usePageTemplateId } from './use-page-template';

const NO_CONTEXT = {};

function Measured( { onHeight, onFreeze, children } ) {
    const [ listener, { height } ] = useResizeObserver();
    const element = useRef();
    const report = useRef( onHeight );
    report.current = onHeight;
    const freeze = useRef( onFreeze );
    freeze.current = onFreeze;
    useEffect( () => {
        if ( height ) {
            report.current( Math.round( height ) );
        }
    }, [ height ] );
    // Layout effects are cleaned up before React removes the elements, so
    // the rendered Preview can still be copied here.
    useLayoutEffect( () => {
        const node = element.current;
        return () => freeze.current?.( node );
    }, [] );
    return (
        <div className="wfd-preview" ref={ element }>
            { listener }
            { children }
        </div>
    );
}

function Preview( {
    blocks,
    width,
    settings,
    context = NO_CONTEXT,
    onHeight,
    onFreeze,
} ) {
    return (
        <BlockEditorProvider value={ blocks } settings={ settings }>
            <BlockContextProvider value={ context }>
                <Measured onHeight={ onHeight } onFreeze={ onFreeze }>
                    <BlockPreview blocks={ blocks } viewportWidth={ width } />
                </Measured>
            </BlockContextProvider>
        </BlockEditorProvider>
    );
}

function EntityPreview( { postType, id, ...props } ) {
    const [ blocks ] = useEntityBlockEditor( 'postType', postType, { id } );
    return <Preview blocks={ blocks } { ...props } />;
}

/**
 * A page is shown inside its template.
 *
 * @param {Object} props
 * @param {Object} props.artboard The artboard with its record.
 */
function PagePreview( { artboard, ...props } ) {
    const templateId = usePageTemplateId( artboard.record );
    const context = useMemo(
        () => ( { postId: artboard.entityId, postType: 'page' } ),
        [ artboard.entityId ]
    );
    if ( templateId === undefined ) {
        return null;
    }
    if ( templateId === null ) {
        return (
            <EntityPreview
                postType="page"
                id={ artboard.entityId }
                { ...props }
            />
        );
    }
    return (
        <EntityPreview
            postType="wp_template"
            id={ templateId }
            context={ context }
            { ...props }
        />
    );
}

const QUIET = 500;
const GIVE_UP = 8000;

/**
 * A Preview rendered once, out of the Preview tier, for an artboard that
 * needs a frozen copy and was never rendered. It reports once, when its
 * height has stopped changing or when nothing was rendered at all, and never
 * while the board is busy.
 *
 * @param {Object}   props
 * @param {Function} props.isBusy    Whether reporting has to wait.
 * @param {Function} props.onSettled Receives the rendered Preview and its height, or null when there is none.
 */
export function ArtboardPreviewOnce( { isBusy, onSettled, ...props } ) {
    const element = useRef();
    const timer = useRef();
    const latest = useRef( { isBusy, onSettled } );
    latest.current = { isBusy, onSettled };
    const wait = useCallback( ( delay, height ) => {
        clearTimeout( timer.current );
        timer.current = setTimeout( () => {
            if ( latest.current.isBusy?.() ) {
                wait( QUIET, height );
                return;
            }
            latest.current.onSettled(
                ( height &&
                    element.current?.querySelector( '.wfd-preview' ) ) ||
                    null,
                height
            );
        }, delay );
    }, [] );
    useEffect( () => {
        wait( GIVE_UP, 0 );
        return () => clearTimeout( timer.current );
    }, [ wait ] );
    const handleHeight = useCallback(
        ( height ) => wait( QUIET, height ),
        [ wait ]
    );
    return (
        <div ref={ element }>
            <ArtboardPreview { ...props } onHeight={ handleHeight } />
        </div>
    );
}

/**
 * @param {Object}   props
 * @param {Object}   props.artboard The artboard with its record.
 * @param {number}   props.width    Render width of its device.
 * @param {Object}   props.settings Block editor settings.
 * @param {Function} props.onHeight Reports the measured content height.
 * @param {Function} props.onFreeze Receives the rendered Preview just before it is removed.
 */
export function ArtboardPreview( { artboard, ...props } ) {
    return (
        <GuardedRegistry isReadOnly>
            { artboard.kind === 'page' ? (
                <PagePreview artboard={ artboard } { ...props } />
            ) : (
                <EntityPreview
                    postType={ KINDS[ artboard.kind ].postType }
                    id={ artboard.entityId }
                    { ...props }
                />
            ) }
        </GuardedRegistry>
    );
}
