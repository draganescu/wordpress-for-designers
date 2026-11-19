/**
 * Milestone 0 spikes. Throwaway. Imports are limited to spec/api-allowlist.md.
 */
import { createRoot, useState, useEffect, useRef } from '@wordpress/element';
import { registerCoreBlocks } from '@wordpress/block-library';
import {
    EntityProvider,
    useEntityBlockEditor,
    store as coreStore,
} from '@wordpress/core-data';
import {
    BlockEditorProvider,
    BlockCanvas,
    BlockList,
    BlockToolbar,
    BlockPreview,
} from '@wordpress/block-editor';
import {
    SlotFillProvider,
    Slot,
    Fill,
    Popover,
} from '@wordpress/components';
import { ShortcutProvider } from '@wordpress/keyboard-shortcuts';
import { useSelect, useDispatch } from '@wordpress/data';
import { getQueryArg } from '@wordpress/url';
import { EntitiesSavedStates, PostLockedModal } from '@wordpress/editor';

const { settings, postId } = window.wfdSpike;
const spike = getQueryArg( window.location.href, 'spike' );
const zoom = Number( getQueryArg( window.location.href, 'zoom' ) || 100 ) / 100;
const mode = getQueryArg( window.location.href, 'mode' ) || 'naive';

registerCoreBlocks();

function ArtboardEditor( { id } ) {
    const [ blocks, onInput, onChange ] = useEntityBlockEditor(
        'postType',
        'page',
        { id }
    );
    return (
        <BlockEditorProvider
            value={ blocks }
            onInput={ onInput }
            onChange={ onChange }
            settings={ { ...settings, hasFixedToolbar: true } }
        >
            <Fill name="wfd-block-toolbar">
                <BlockToolbar hideDragHandle />
            </Fill>
            <BlockCanvas height="900px" styles={ settings.styles }>
                { mode === 'inner' && (
                    <style>
                        { `html { transform: scale(${ zoom }) !important; transform-origin: 0 0 !important; }` }
                    </style>
                ) }
                <BlockList />
            </BlockCanvas>
        </BlockEditorProvider>
    );
}

function SpikeA() {
    return (
        <SlotFillProvider>
            <ShortcutProvider>
                <div
                    id="wfd-header"
                    style={ { height: 48, borderBottom: '1px solid' } }
                >
                    <Slot name="wfd-block-toolbar" bubblesVirtually />
                </div>
                <div style={ { padding: 40, overflow: 'hidden' } }>
                    <div
                        id="wfd-scaled"
                        style={
                            // eslint-disable-next-line no-nested-ternary
                            mode === 'zoom'
                                ? { width: 1440, zoom }
                                : mode === 'pan'
                                ? {
                                        width: 1440,
                                        transform: `translate(63.5px, 53.25px) scale(${ zoom })`,
                                        transformOrigin: '0 0',
                                  }
                                : {
                                        width: 1440,
                                        transform: `scale(${ zoom })`,
                                        transformOrigin: '0 0',
                                  }
                        }
                    >
                        <EntityProvider
                            kind="postType"
                            type="page"
                            id={ postId }
                        >
                            { mode === 'inner' && (
                                <div
                                    id="wfd-live"
                                    style={ {
                                        width: 1440 * zoom,
                                        height: 900 * zoom,
                                        transform: `scale(${ 1 / zoom })`,
                                        transformOrigin: '0 0',
                                    } }
                                >
                                    <style>
                                        { `#wfd-live iframe { width: 1440px !important; clip-path: inset(0 ${ 1440 * ( 1 - zoom ) }px ${ 900 * ( 1 - zoom ) }px 0); }` }
                                    </style>
                                    <ArtboardEditor id={ postId } />
                                </div>
                            ) }
                            { mode === 'inner' ? null : mode === 'counter' ? (
                                <div
                                    id="wfd-live"
                                    style={ {
                                        width: 1440 * zoom,
                                        height: 900 * zoom,
                                        transform: `scale(${ 1 / zoom })`,
                                        transformOrigin: '0 0',
                                    } }
                                >
                                    <style>
                                        { `#wfd-live iframe { width: 1440px !important; transform: scale(${ zoom }); transform-origin: 0 0; }` }
                                    </style>
                                    <ArtboardEditor id={ postId } />
                                </div>
                            ) : (
                                <ArtboardEditor id={ postId } />
                            ) }
                        </EntityProvider>
                    </div>
                </div>
                <Popover.Slot />
            </ShortcutProvider>
        </SlotFillProvider>
    );
}

function SpikeB() {
    const [ open, setOpen ] = useState( false );
    const { editEntityRecord } = useDispatch( coreStore );
    const page = useSelect(
        ( select ) =>
            select( coreStore ).getEntityRecord( 'postType', 'page', postId ),
        []
    );
    return (
        <SlotFillProvider>
            <div id="wfd-b">
                <p id="wfd-b-loaded">{ page ? 'loaded' : 'loading' }</p>
                <button
                    id="wfd-b-dirty"
                    onClick={ () =>
                        editEntityRecord( 'postType', 'page', postId, {
                            title: 'Spike title edited',
                        } )
                    }
                >
                    Make dirty
                </button>
                <button id="wfd-b-open" onClick={ () => setOpen( true ) }>
                    Open saved states
                </button>
                { open && (
                    <div id="wfd-b-panel">
                        <EntitiesSavedStates
                            close={ () => setOpen( false ) }
                        />
                    </div>
                ) }
                <PostLockedModal />
            </div>
            <Popover.Slot />
        </SlotFillProvider>
    );
}

/**
 * Freezes a rendered preview: clones its DOM with plain DOM calls and replaces
 * the iframe with a static one holding the serialised document and its CSS.
 */
function freeze( previewEl, host ) {
    const clone = previewEl.cloneNode( true );
    clone.removeAttribute( 'id' );
    const srcFrames = previewEl.querySelectorAll( 'iframe' );
    const dstFrames = clone.querySelectorAll( 'iframe' );
    srcFrames.forEach( ( src, i ) => {
        const doc = src.contentDocument;
        let css = '';
        Array.from( doc.styleSheets ).forEach( ( sheet ) => {
            try {
                css += Array.from( sheet.cssRules )
                    .map( ( r ) => r.cssText )
                    .join( '\n' );
            } catch ( e ) {
                if ( sheet.href ) {
                    css += `@import url("${ sheet.href }");`;
                }
            }
        } );
        const html = doc.documentElement.cloneNode( true );
        html.querySelectorAll( 'script, style, link[rel="stylesheet"]' ).forEach(
            ( n ) => n.remove()
        );
        const style = doc.createElement( 'style' );
        style.textContent = css;
        html.querySelector( 'head' ).appendChild( style );
        const dst = dstFrames[ i ];
        dst.removeAttribute( 'src' );
        dst.setAttribute( 'sandbox', 'allow-same-origin' );
        dst.srcdoc = '<!DOCTYPE html>' + html.outerHTML;
    } );
    host.appendChild( clone );
}

function PreviewOf( { id } ) {
    const [ blocks ] = useEntityBlockEditor( 'postType', 'page', { id } );
    return (
        <BlockEditorProvider value={ blocks } settings={ settings }>
            <BlockPreview blocks={ blocks } viewportWidth={ 1440 } />
        </BlockEditorProvider>
    );
}

function SpikeC() {
    const previewRef = useRef();
    const hostRef = useRef();
    const { editEntityRecord } = useDispatch( coreStore );
    useEffect( () => {
        window.wfdFreeze = () =>
            freeze( previewRef.current, hostRef.current );
        window.wfdEdit = () =>
            editEntityRecord( 'postType', 'page', postId, {
                blocks: undefined,
                content:
                    '<!-- wp:paragraph --><p>Changed after freeze</p><!-- /wp:paragraph -->',
            } );
    }, [ editEntityRecord ] );
    return (
        <div style={ { display: 'flex', gap: 20 } }>
            <div
                id="wfd-preview"
                ref={ previewRef }
                style={ { width: 720, flex: 'none' } }
            >
                <EntityProvider kind="postType" type="page" id={ postId }>
                    <PreviewOf id={ postId } />
                </EntityProvider>
            </div>
            <div
                id="wfd-snapshot"
                ref={ hostRef }
                style={ { width: 720, flex: 'none' } }
            />
        </div>
    );
}

const spikes = { a: SpikeA, b: SpikeB, c: SpikeC };
const Spike = spikes[ spike ];
if ( Spike ) {
    createRoot( document.getElementById( 'wfd-spike-root' ) ).render(
        <Spike />
    );
}
