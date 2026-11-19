/**
 * OQ-1 diagnostic. Throwaway. NOT limited to spec/api-allowlist.md.
 *
 * Outside the allowlist, used on purpose:
 * - `@wordpress/private-apis` `__dangerousOptInToUnstableAPIsOnlyForCoreModules`
 * - `privateApis` of `@wordpress/block-editor` (`ExperimentalBlockCanvas`)
 * - private actions/selectors of the block-editor store (`setZoomLevel`,
 *   `getZoomLevel`, `isZoomOut`) through `unlock`
 */
import { createRoot, useEffect } from '@wordpress/element';
import { registerCoreBlocks } from '@wordpress/block-library';
import { EntityProvider, useEntityBlockEditor } from '@wordpress/core-data';
import {
    BlockEditorProvider,
    BlockCanvas,
    BlockList,
    BlockToolbar,
    store as blockEditorStore,
    privateApis as blockEditorPrivateApis,
} from '@wordpress/block-editor';
import { SlotFillProvider, Slot, Fill, Popover } from '@wordpress/components';
import { ShortcutProvider } from '@wordpress/keyboard-shortcuts';
import { useRegistry } from '@wordpress/data';
import { getQueryArg } from '@wordpress/url';
import { __dangerousOptInToUnstableAPIsOnlyForCoreModules } from '@wordpress/private-apis';

const { settings, postId } = window.wfdSpike;
const href = window.location.href;
const zoom = Number( getQueryArg( href, 'zoom' ) || 100 ) / 100;
const mode = getQueryArg( href, 'mode' ) || 'naive';
const fix = getQueryArg( href, 'fix' ) === '1';
const optInName = getQueryArg( href, 'optin' ) || '@wordpress/block-editor';
const W = 1440;
const H = 900;

const CONSENT =
    'I acknowledge private features are not for use in themes or plugins and doing so will break in the next version of WordPress.';

let unlock = null;
window.wfdUnlock = { ok: false, error: null, optInName };
try {
    unlock = __dangerousOptInToUnstableAPIsOnlyForCoreModules(
        CONSENT,
        optInName
    ).unlock;
    window.wfdUnlock.ok = true;
    window.wfdUnlock.privateKeys = Object.keys(
        unlock( blockEditorPrivateApis )
    );
} catch ( e ) {
    window.wfdUnlock.error = e.message;
}

registerCoreBlocks();

function Expose() {
    const registry = useRegistry();
    useEffect( () => {
        const select = registry.select( blockEditorStore );
        const dispatch = registry.dispatch( blockEditorStore );
        window.wfdBE = {
            select,
            dispatch,
            privateSelect: unlock ? unlock( select ) : null,
            privateDispatch: unlock ? unlock( dispatch ) : null,
        };
        if ( mode === 'storezoom' && zoom !== 1 && unlock ) {
            unlock( dispatch ).setZoomLevel( zoom );
        }
    }, [ registry ] );
    return null;
}

function ArtboardEditor( { id, height } ) {
    const [ blocks, onInput, onChange ] = useEntityBlockEditor(
        'postType',
        'page',
        { id }
    );
    let canvas;
    if ( mode === 'expscale' ) {
        const { ExperimentalBlockCanvas } = unlock( blockEditorPrivateApis );
        canvas = (
            <ExperimentalBlockCanvas
                height={ height }
                styles={ settings.styles }
                iframeProps={
                    zoom !== 1 ? { scale: zoom, frameSize: 0 } : undefined
                }
            >
                <BlockList />
            </ExperimentalBlockCanvas>
        );
    } else {
        canvas = (
            <BlockCanvas height={ height } styles={ settings.styles }>
                { mode === 'inner' && (
                    <style>
                        { `html { transform: scale(${ zoom }) !important; transform-origin: 0 0 !important; }` }
                    </style>
                ) }
                <BlockList />
            </BlockCanvas>
        );
    }
    return (
        <BlockEditorProvider
            value={ blocks }
            onInput={ onInput }
            onChange={ onChange }
            settings={ { ...settings, hasFixedToolbar: true } }
        >
            <Expose />
            <Fill name="wfd-block-toolbar">
                <BlockToolbar hideDragHandle />
            </Fill>
            { canvas }
        </BlockEditorProvider>
    );
}

// Net-identity wrapper: undoes the board transform for the Live artboard.
function Live( { children, css } ) {
    return (
        <div
            id="wfd-live"
            style={ {
                width: W * zoom,
                height: H * zoom,
                transform: `scale(${ 1 / zoom })`,
                transformOrigin: '0 0',
            } }
        >
            { css && <style>{ css }</style> }
            { children }
        </div>
    );
}

function Arrangement() {
    if ( mode === 'counter' ) {
        return (
            <Live
                css={ `#wfd-live iframe { width: ${ W }px !important; transform: scale(${ zoom }); transform-origin: 0 0; }` }
            >
                <ArtboardEditor id={ postId } height={ `${ H }px` } />
            </Live>
        );
    }
    if ( mode === 'inner' ) {
        return (
            <Live
                css={ `#wfd-live iframe { width: ${ W }px !important; clip-path: inset(0 ${ W * ( 1 - zoom ) }px ${ H * ( 1 - zoom ) }px 0); }` }
            >
                <ArtboardEditor id={ postId } height={ `${ H }px` } />
            </Live>
        );
    }
    if ( mode === 'expscale' || mode === 'storezoom' ) {
        // Stock zoom-out scales <html> about its top centre, so the iframe
        // element keeps the device width and the content sits in its middle.
        const side = ( W * ( 1 - zoom ) ) / 2;
        return (
            <Live
                css={
                    zoom !== 1
                        ? `#wfd-live iframe { clip-path: inset(0 ${ side }px 0 ${ side }px); }`
                        : ''
                }
            >
                <div
                    id="wfd-stock"
                    style={ {
                        position: 'relative',
                        width: W,
                        height: H * zoom,
                        marginLeft: -side,
                    } }
                >
                    <ArtboardEditor
                        id={ postId }
                        height={ `${ H * zoom }px` }
                    />
                </div>
            </Live>
        );
    }
    // naive: tools and iframe scaled together by the board transform.
    return <ArtboardEditor id={ postId } height={ `${ H }px` } />;
}

// Plugin CSS that rescales the stock cover container (public JS API only,
// but it targets core class names and inline styles).
const fixCss = `
.block-editor-block-popover > .components-popover__content > div[style*="position: absolute"] {
    transform: scale(${ zoom });
    transform-origin: 0 0;
}
.block-editor-block-list__empty-block-inserter {
    transform: scale(${ 1 / zoom });
    transform-origin: 100% 50%;
}`;

function SpikeA() {
    return (
        <SlotFillProvider>
            <ShortcutProvider>
                { fix && zoom !== 1 && <style>{ fixCss }</style> }
                <div
                    id="wfd-header"
                    style={ { height: 48, borderBottom: '1px solid' } }
                >
                    <Slot name="wfd-block-toolbar" bubblesVirtually />
                </div>
                <div style={ { padding: 40, overflow: 'hidden' } }>
                    <div
                        id="wfd-scaled"
                        style={ {
                            width: W,
                            transform: `scale(${ zoom })`,
                            transformOrigin: '0 0',
                        } }
                    >
                        <EntityProvider
                            kind="postType"
                            type="page"
                            id={ postId }
                        >
                            <Arrangement />
                        </EntityProvider>
                    </div>
                </div>
                <Popover.Slot />
            </ShortcutProvider>
        </SlotFillProvider>
    );
}

createRoot( document.getElementById( 'wfd-spike-root' ) ).render( <SpikeA /> );
