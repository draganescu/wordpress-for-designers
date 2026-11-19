/**
 * The Preview tier: read-only blocks through BlockPreview in an iframe at the
 * device width.
 */
import {
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
