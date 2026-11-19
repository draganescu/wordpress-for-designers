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
    Modal,
    Button,
} from '@wordpress/components';
import { ShortcutProvider } from '@wordpress/keyboard-shortcuts';
import { useSelect, useDispatch } from '@wordpress/data';
import { getQueryArg } from '@wordpress/url';
import {
    EntitiesSavedStates,
    PostLockedModal,
    UnsavedChangesWarning,
    EditorSnackbars,
} from '@wordpress/editor';
import apiFetch from '@wordpress/api-fetch';

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
                            mode === 'zoom'
                                ? { width: 1440, zoom }
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
    const [ modal, setModal ] = useState(
        getQueryArg( window.location.href, 'modal' ) !== '0'
    );
    const extras = getQueryArg( window.location.href, 'extras' ) === '1';
    const { editEntityRecord } = useDispatch( coreStore );
    const page = useSelect(
        ( select ) =>
            select( coreStore ).getEntityRecord( 'postType', 'page', postId ),
        []
    );
    useEffect( () => {
        window.wfdSetModal = setModal;
    }, [] );
    return (
        <SlotFillProvider>
            <div id="wfd-b">
                <p id="wfd-b-loaded">{ page ? 'loaded' : 'loading' }</p>
                <button
                    id="wfd-b-dirty"
                    onClick={ () => {
                        window.wfdClicked = ( window.wfdClicked || 0 ) + 1;
                        editEntityRecord( 'postType', 'page', postId, {
                            title: 'Diag2 title edited',
                        } );
                    } }
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
                { modal && <PostLockedModal /> }
                { extras && <UnsavedChangesWarning /> }
                { extras && <EditorSnackbars /> }
            </div>
            <Popover.Slot />
        </SlotFillProvider>
    );
}

/**
 * Spike D: lock lifecycle WITHOUT PostLockedModal and without the core/editor store.
 * Client imports are allowlisted (api-fetch, element, components Modal/Button).
 * Server side is the plugin REST route in wfd-diag2.php.
 * Every string below is a PLACEHOLDER: the spec would have to define each one.
 */
const REFRESH_MS = Number(
    getQueryArg( window.location.href, 'refresh' ) || 60000
);
const lockPath = ( id ) => `/wfd-diag2/v1/lock/${ id }`;

function useArtboardLock( id, live ) {
    const [ state, setState ] = useState( { status: 'idle' } );
    const activeRef = useRef( null );
    const log = ( e ) => {
        window.wfdLockLog = window.wfdLockLog || [];
        window.wfdLockLog.push( { t: Date.now(), ...e } );
    };
    const take = ( takeover ) =>
        apiFetch( {
            path: lockPath( id ),
            method: 'POST',
            data: { takeover },
        } ).then( ( r ) => {
            log( { op: takeover ? 'takeover' : 'take', r } );
            if ( r.held ) {
                const lost = false;
                activeRef.current = r.active;
                setState( { status: 'held', lost } );
            } else {
                setState( ( prev ) => ( {
                    status: 'blocked',
                    user: r.user,
                    lost: prev.status === 'held',
                } ) );
                activeRef.current = null;
            }
            return r;
        } );
    useEffect( () => {
        if ( ! live ) {
            return;
        }
        setState( { status: 'checking' } );
        take( false );
        const timer = setInterval( () => {
            if ( activeRef.current ) {
                take( false );
            }
        }, REFRESH_MS );
        const release = () => {
            if ( ! activeRef.current ) {
                return;
            }
            activeRef.current = null;
            // keepalive so it also completes during page unload.
            apiFetch( {
                path: lockPath( id ),
                method: 'DELETE',
                keepalive: true,
            } ).then( ( r ) => log( { op: 'release', r } ) );
        };
        window.addEventListener( 'pagehide', release );
        return () => {
            clearInterval( timer );
            window.removeEventListener( 'pagehide', release );
            release();
            setState( { status: 'idle' } );
        };
    }, [ id, live ] );
    return { ...state, takeOver: () => take( true ) };
}

function SpikeD() {
    const [ live, setLive ] = useState( false );
    const [ dismissed, setDismissed ] = useState( false );
    const lock = useArtboardLock( postId, live );
    useEffect( () => {
        window.wfdLockState = { live, status: lock.status, user: lock.user, lost: lock.lost };
    } );
    const readOnly = live && lock.status !== 'held';
    return (
        <div id="wfd-d">
            <button id="wfd-d-enter" onClick={ () => { setDismissed( false ); setLive( true ); } }>
                Enter edit
            </button>
            <button id="wfd-d-leave" onClick={ () => setLive( false ) }>
                Leave edit
            </button>
            <p id="wfd-d-status">
                { live ? lock.status : 'not live' }
                { readOnly ? ' (read-only)' : '' }
            </p>
            { live && lock.status === 'blocked' && ! dismissed && (
                <Modal
                    className="wfd-d-modal"
                    title={
                        lock.lost
                            ? 'PLACEHOLDER title: someone took over'
                            : 'PLACEHOLDER title: already being edited'
                    }
                    onRequestClose={ () => setDismissed( true ) }
                >
                    <p>
                        { lock.lost
                            ? `PLACEHOLDER body (taken over) naming ${ lock.user?.name }`
                            : `PLACEHOLDER body (locked) naming ${ lock.user?.name }` }
                    </p>
                    <Button
                        id="wfd-d-takeover"
                        variant="tertiary"
                        onClick={ () => lock.takeOver() }
                    >
                        PLACEHOLDER Take over
                    </Button>
                    <Button
                        id="wfd-d-stay"
                        variant="primary"
                        onClick={ () => setDismissed( true ) }
                    >
                        PLACEHOLDER Keep read-only
                    </Button>
                </Modal>
            ) }
        </div>
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

const spikes = { a: SpikeA, b: SpikeB, c: SpikeC, d: SpikeD };
const Spike = spikes[ spike ];
if ( Spike ) {
    createRoot( document.getElementById( 'wfd-spike-root' ) ).render(
        <Spike />
    );
}
