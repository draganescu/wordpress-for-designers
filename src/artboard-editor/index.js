/**
 * The Live editor: a block editor on the artboard's entity, built from
 * WordPress's public parts. Fills the chrome slots while it is active.
 */
import {
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from '@wordpress/element';
import { useRegistry, useSelect } from '@wordpress/data';
import { useEntityBlockEditor } from '@wordpress/core-data';
import {
    BlockCanvas,
    BlockContextProvider,
    BlockEditorKeyboardShortcuts,
    BlockEditorProvider,
    BlockInspector,
    BlockList,
    store as blockEditorStore,
    useBlockEditingMode,
} from '@wordpress/block-editor';
import { getBlockType, getBlockTypes } from '@wordpress/blocks';
import { ListView } from '../adapter/experimental';
import { CollapsibleBlockToolbar } from './collapsible-block-toolbar';
import { BlockToolbarFill, InspectorFill, ListViewFill } from '../chrome-slots';
import { usePageTemplateId } from '../artboard-preview/use-page-template';
import { FrameElementContext } from '../artboard-frame';
import {
    pinStyles,
    useViewportOverrides,
} from '../artboard-frame/viewport-units';
import { KINDS } from '../shell/constants';
import { coalesceTyping } from './coalesce';
import { DragAnywhere, DRAG_ANYWHERE_STYLES } from './drag-anywhere';
import { GuardedRegistry } from '../shell/guarded-registry';

const NO_CONTEXT = {};
const CONTENT_BLOCKS = [
    'core/post-content',
    'core/post-title',
    'core/post-featured-image',
];
// `display: flow-root` keeps the margins of the first and last blocks inside
// the body's box. Without it they collapse through the body, and the height
// measured by `useCanvasProbe` leaves them out, so the iframe is too short.
const CANVAS_STYLES = [
    { css: 'body{display:flow-root;height:auto;overflow:hidden;}' },
];

/**
 * Watches the canvas document from outside: measures the content and passes
 * wheel and key events on. Nothing of the plugin's is put inside the canvas
 * (constraint C6).
 *
 * @param {Object}   options
 * @param {Function} options.onHeight         Reports the content height.
 * @param {Function} options.onWheel          Receives wheel events with the iframe.
 * @param {Function} options.onDocument       Receives the canvas document with the iframe,
 *                                            and returns what lets go of it.
 * @param {Function} options.onKeyDownCapture Called before the editor handles a key.
 */
function useCanvasProbe( { onHeight, onWheel, onDocument, onKeyDownCapture } ) {
    const frame = useContext( FrameElementContext );
    const latest = useRef( {} );
    latest.current = { onHeight, onWheel, onDocument, onKeyDownCapture };
    useEffect( () => {
        if ( ! frame ) {
            return;
        }
        let watched = null;
        let detach = () => {};
        const attach = () => {
            const iframe = frame.querySelector(
                'iframe[name="editor-canvas"]'
            );
            const doc = iframe?.contentDocument;
            const body = doc?.body;
            if (
                ! body?.querySelector( '.is-root-container' ) ||
                doc === watched
            ) {
                return;
            }
            detach();
            watched = doc;
            const view = doc.defaultView;
            const measure = () => {
                const height = Math.ceil( body.getBoundingClientRect().height );
                if ( height ) {
                    latest.current.onHeight( height );
                }
            };
            const observer = new view.ResizeObserver( measure );
            observer.observe( body );
            measure();
            const wheel = ( event ) =>
                latest.current.onWheel?.( event, iframe );
            const keyDown = () => latest.current.onKeyDownCapture?.();
            doc.addEventListener( 'wheel', wheel, { passive: false } );
            doc.addEventListener( 'keydown', keyDown, true );
            // The shell counts the fingers in the canvas document with the
            // ones on the board (D64). The editor still gets them all.
            const letGo = latest.current.onDocument?.( doc, iframe );
            detach = () => {
                observer.disconnect();
                doc.removeEventListener( 'wheel', wheel );
                doc.removeEventListener( 'keydown', keyDown, true );
                letGo?.();
            };
        };
        // The canvas document is filled in after the iframe loads.
        const timer = window.setInterval( attach, 100 );
        attach();
        return () => {
            window.clearInterval( timer );
            detach();
        };
    }, [ frame ] );
}

/**
 * Locks the template around a page: everything is disabled except the page's
 * own content blocks.
 */
function LockTemplate() {
    useBlockEditingMode( 'disabled' );
    const registry = useRegistry();
    const { contentIds, childIds, partChildIds } = useSelect( ( select ) => {
        const { getBlockOrder, getBlockName, getClientIdsWithDescendants } =
            select( blockEditorStore );
        const all = getClientIdsWithDescendants();
        const content = all.filter( ( id ) =>
            CONTENT_BLOCKS.includes( getBlockName( id ) )
        );
        return {
            contentIds: content.join( ',' ),
            childIds: content
                .filter( ( id ) => getBlockName( id ) === 'core/post-content' )
                .flatMap( ( id ) => getBlockOrder( id ) )
                .join( ',' ),
            // The blocks of a template part do not take the root's mode.
            partChildIds: all
                .filter( ( id ) => getBlockName( id ) === 'core/template-part' )
                .flatMap( ( id ) => getBlockOrder( id ) )
                .join( ',' ),
        };
    }, [] );
    useEffect( () => {
        const { setBlockEditingMode, unsetBlockEditingMode } =
            registry.dispatch( blockEditorStore );
        const split = ( ids ) => ( ids ? ids.split( ',' ) : [] );
        const content = split( contentIds );
        const children = split( childIds );
        const partChildren = split( partChildIds );
        registry.batch( () => {
            content.forEach( ( id ) =>
                setBlockEditingMode( id, 'contentOnly' )
            );
            children.forEach( ( id ) => setBlockEditingMode( id, 'default' ) );
            partChildren.forEach( ( id ) =>
                setBlockEditingMode( id, 'disabled' )
            );
        } );
        return () => {
            registry.batch( () => {
                [ ...content, ...children, ...partChildren ].forEach( ( id ) =>
                    unsetBlockEditingMode( id )
                );
            } );
        };
    }, [ registry, contentIds, childIds, partChildIds ] );
    return null;
}

/**
 * Tells the shell about the editor's selection and gives it the few actions
 * it needs on this editor's own block-editor registry.
 *
 * @param {Object}   props
 * @param {Object}   props.bridgeRef       Ref that receives the bridge.
 * @param {Function} props.onSelection     Called when the selected block changes.
 * @param {Function} props.onAllowedBlocks Called with the block names allowed at the insertion point.
 */
function Bridge( { bridgeRef, onSelection, onAllowedBlocks } ) {
    const registry = useRegistry();
    const allowed = useSelect( ( select ) => {
        const { getBlockInsertionPoint, canInsertBlockType } =
            select( blockEditorStore );
        const { rootClientId } = getBlockInsertionPoint();
        return getBlockTypes()
            .filter( ( type ) => canInsertBlockType( type.name, rootClientId ) )
            .map( ( type ) => type.name )
            .join( ',' );
    }, [] );
    useEffect( () => {
        onAllowedBlocks?.( allowed );
        return () => onAllowedBlocks?.( null );
    }, [ allowed, onAllowedBlocks ] );
    const selected = useSelect( ( select ) => {
        const { getSelectedBlockClientId, getBlockName } =
            select( blockEditorStore );
        const clientId = getSelectedBlockClientId();
        return clientId ? `${ clientId }|${ getBlockName( clientId ) }` : '';
    }, [] );
    useEffect( () => {
        const [ clientId, name ] = selected ? selected.split( '|' ) : [];
        onSelection(
            clientId
                ? {
                      clientId,
                      name,
                      title: getBlockType( name )?.title ?? name,
                  }
                : null
        );
    }, [ selected, onSelection ] );
    useEffect( () => {
        const select = () => registry.select( blockEditorStore );
        const dispatch = () => registry.dispatch( blockEditorStore );
        bridgeRef.current = {
            registry,
            // Whether this editor has been given its settings, which
            // happens just after it mounts: until then it answers what may
            // be inserted and changed from WordPress's defaults.
            isReady: () => select().getSettings().hasFixedToolbar === true,
            hasSelection: () =>
                !! select().getSelectedBlockClientId() ||
                select().hasMultiSelection(),
            clearSelection: () => dispatch().clearSelectedBlock(),
            getInsertionPoint: () => select().getBlockInsertionPoint(),
            canInsert: ( name, rootClientId ) =>
                select().canInsertBlockType( name, rootClientId ),
            insertBlocks: ( blocks ) => {
                const { rootClientId, index } =
                    select().getBlockInsertionPoint();
                dispatch().insertBlocks( blocks, index, rootClientId, true );
            },
        };
        return () => {
            bridgeRef.current = null;
        };
    }, [ registry, bridgeRef ] );
    return null;
}

function Editor( {
    postType,
    id,
    settings,
    context = NO_CONTEXT,
    isActive,
    isPage,
    onHeight,
    onWheel,
    onDocument,
    onKeyDownCapture,
    bridgeRef,
    onSelection,
    onAllowedBlocks,
} ) {
    const [ blocks, onInput, onChange ] = useEntityBlockEditor(
        'postType',
        postType,
        { id }
    );
    const handlers = useRef( { onInput, onChange } );
    handlers.current = { onInput, onChange };
    const coalesced = useMemo(
        () =>
            coalesceTyping(
                ( ...args ) => handlers.current.onInput( ...args ),
                ( ...args ) => handlers.current.onChange( ...args )
            ),
        []
    );
    coalesced.sync( blocks );
    useCanvasProbe( {
        onHeight: ( value ) => {
            setHeight( value );
            onHeight( value );
        },
        onWheel,
        onDocument,
        onKeyDownCapture,
    } );
    const [ height, setHeight ] = useState( 0 );
    const editorSettings = useMemo(
        () => ( { ...settings, hasFixedToolbar: true } ),
        [ settings ]
    );
    // Viewport-height lengths are pinned, or content sized with them would
    // grow with every measurement (artboard-frame/viewport-units.js).
    const overrides = useViewportOverrides( useContext( FrameElementContext ) );
    const canvasStyles = useMemo(
        () => [
            ...( pinStyles( settings.styles ) ?? [] ),
            ...CANVAS_STYLES,
            ...DRAG_ANYWHERE_STYLES,
            { css: overrides },
        ],
        [ settings.styles, overrides ]
    );
    return (
        <BlockEditorProvider
            value={ blocks }
            onInput={ coalesced.onInput }
            onChange={ coalesced.onChange }
            settings={ editorSettings }
        >
            <BlockContextProvider value={ context }>
                { isPage && <LockTemplate /> }
                { isActive && (
                    <>
                        <Bridge
                            bridgeRef={ bridgeRef }
                            onSelection={ onSelection }
                            onAllowedBlocks={ onAllowedBlocks }
                        />
                        <BlockEditorKeyboardShortcuts.Register />
                        <DragAnywhere />
                        <BlockToolbarFill>
                            <CollapsibleBlockToolbar />
                        </BlockToolbarFill>
                        <InspectorFill>
                            <BlockInspector />
                        </InspectorFill>
                        <ListViewFill>
                            <ListView />
                        </ListViewFill>
                    </>
                ) }
                { /*
                 * No wrapper of the plugin's goes around the canvas. The
                 * element BlockCanvas renders is styled from outside so that
                 * WordPress's block tools stay at screen size while the
                 * iframe carries the board's zoom (shell/style.scss).
                 */ }
                <BlockCanvas
                    height={ height ? `${ height }px` : '100%' }
                    styles={ canvasStyles }
                >
                    <BlockList />
                </BlockCanvas>
            </BlockContextProvider>
        </BlockEditorProvider>
    );
}

function PageEditor( { artboard, ...props } ) {
    const templateId = usePageTemplateId( artboard.record );
    const context = useMemo(
        () => ( { postId: artboard.entityId, postType: 'page' } ),
        [ artboard.entityId ]
    );
    if ( templateId === undefined ) {
        return null;
    }
    if ( templateId === null ) {
        return <Editor postType="page" id={ artboard.entityId } { ...props } />;
    }
    return (
        <Editor
            postType="wp_template"
            id={ templateId }
            context={ context }
            isPage
            { ...props }
        />
    );
}

/**
 * @param {Object}   props
 * @param {Object}   props.artboard         The artboard with its record.
 * @param {Object}   props.settings         Block editor settings.
 * @param {boolean}  props.isActive         True for the Live editor, false for a warm one.
 * @param {Function} props.onHeight         Reports the measured content height.
 * @param {Function} props.onWheel          Receives wheel events from the canvas document.
 * @param {Function} props.onDocument       Receives the canvas document and returns what lets go of it.
 * @param {Function} props.onKeyDownCapture Called before the editor handles a key.
 * @param {Object}   props.bridgeRef        Receives the bridge to this editor.
 * @param {Function} props.onSelection      Called when the selected block changes.
 */
export function ArtboardEditor( { artboard, ...props } ) {
    return (
        <GuardedRegistry isReadOnly={ ! props.isActive }>
            { artboard.kind === 'page' ? (
                <PageEditor artboard={ artboard } { ...props } />
            ) : (
                <Editor
                    postType={ KINDS[ artboard.kind ].postType }
                    id={ artboard.entityId }
                    { ...props }
                />
            ) }
        </GuardedRegistry>
    );
}
