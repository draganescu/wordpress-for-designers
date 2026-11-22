/**
 * Block paths (spec/agent/surface.md, Block paths; decision D79). In the
 * artboard in edit the tree is the block editor's own, read block by block.
 * In an artboard that is not in edit it is read from what is drawn.
 */
import { store as blockEditorStore } from '@wordpress/block-editor';
import { getBlockType, serialize } from '@wordpress/blocks';
import { editor, putInEdit } from './edit';
import { invalidArgs, notEditable, notFound } from './errors';
import { blockRef } from './refs';

// What WordPress's block preview puts on the element it draws a copy into.
const PREVIEW_COPY = '.block-editor-block-preview__live-content';
const TEXT_LENGTH = 200;

/**
 * Whether an element of an artboard's document is a block: it has a block
 * type and is not a preview copy, nor the editor's block appender.
 *
 * @param {Element} element An element with `data-block`.
 * @return {boolean} True for a block.
 */
const isBlockElement = ( element ) =>
    element.hasAttribute( 'data-type' ) &&
    ! element.parentElement?.closest( PREVIEW_COPY );

/**
 * The blocks drawn in an artboard's document, in document order.
 *
 * @param {Document} doc The document of a Preview, a Snapshot or an editor.
 * @return {Array} `{ path, name, element }` for each block.
 */
export function documentBlocks( doc ) {
    const paths = new Map();
    const counts = new Map();
    const blocks = [];
    for ( const element of doc.querySelectorAll( '[data-block]' ) ) {
        if ( ! isBlockElement( element ) ) {
            continue;
        }
        // The nearest block around it; a preview copy is never one.
        const parent = element.parentElement?.closest( '[data-block]' ) ?? null;
        const index = counts.get( parent ) ?? 0;
        counts.set( parent, index + 1 );
        const path = parent ? [ ...paths.get( parent ), index ] : [ index ];
        paths.set( element, path );
        blocks.push( {
            path,
            name: element.getAttribute( 'data-type' ),
            element,
        } );
    }
    return blocks;
}

/**
 * Text without markup: tags and block comments removed, white space
 * collapsed, cut to the length the tools give.
 *
 * @param {string} markup Markup or text.
 * @return {string} The text.
 */
export function plainText( markup ) {
    return String( markup ?? '' )
        .replace( /<!--[\s\S]*?-->/g, ' ' )
        .replace( /<[^>]*>/g, ' ' )
        .replace( /\s+/g, ' ' )
        .trim()
        .slice( 0, TEXT_LENGTH );
}

/**
 * The block editor store of the artboard in edit.
 *
 * @return {Object} `select` and `dispatch` of its `core/block-editor`, and
 *                  the editor's registry.
 */
function liveEditor() {
    const { registry } = editor().bridgeRef.current;
    return {
        registry,
        select: registry.select( blockEditorStore ),
        dispatch: registry.dispatch( blockEditorStore ),
    };
}

/**
 * Puts an artboard in edit as `artboard-edit` does, unless it is in edit
 * already, and gives its block editor (spec/agent/tools.md, Blocks).
 *
 * @param {Object} artboard The artboard with its name.
 * @return {Promise<Object>} `select`, `dispatch` and `registry`.
 */
export async function editorOf( artboard ) {
    if ( artboard.kind === 'media' || artboard.kind === 'browser' ) {
        throw notEditable( artboard.name );
    }
    await putInEdit( artboard );
    return liveEditor();
}

/**
 * Lets the change a tool made reach the entity's record, so the tool
 * returns with its effect in the stores.
 */
export const settled = () =>
    new Promise( ( resolve ) => window.setTimeout( resolve, 0 ) );

/**
 * The client id of the block at a path.
 *
 * @param {Object} select The editor's block editor selectors.
 * @param {Array}  path   The path; `[]` is the top level.
 * @return {string} The client id; '' for the top level.
 */
export function clientIdAt( select, path ) {
    let clientId = '';
    for ( const index of path ) {
        const block = select.getBlocks( clientId )[ index ];
        if ( ! block ) {
            throw notFound( 'Block', JSON.stringify( path ) );
        }
        clientId = block.clientId;
    }
    return clientId;
}

/**
 * The path of a block in the editor's tree.
 *
 * @param {Object} select   The editor's block editor selectors.
 * @param {string} clientId The block.
 * @return {Array} Its path.
 */
export function pathOf( select, clientId ) {
    const path = [];
    for ( let id = clientId; id; id = select.getBlockRootClientId( id ) ) {
        path.unshift( select.getBlockIndex( id ) );
    }
    return path;
}

/**
 * The path an input names: its `block` field, or the path of a block
 * reference given as the artboard.
 *
 * @param {Array|undefined} path    The `block` field.
 * @param {Array|undefined} refPath The path of the block reference.
 * @param {string}          field   The field's name, for the message.
 * @return {Array} The path.
 */
export function pathFrom( path, refPath, field = 'block' ) {
    const found = path ?? refPath;
    if ( ! found ) {
        throw invalidArgs(
            `${ field } is required, unless artboard is a block reference.`
        );
    }
    return found;
}

/**
 * The text of a block and of the blocks inside it, without markup.
 *
 * @param {Object} select The editor's block editor selectors.
 * @param {Object} block  The block.
 * @return {string} The markup of the block's own content and its inner
 *                  blocks', one after the other.
 */
function markupOf( select, block ) {
    let own = '';
    try {
        own = serialize( [ { ...block, innerBlocks: [] } ] );
    } catch {
        // A block that cannot be serialized has no text of its own.
    }
    return [
        own,
        ...select
            .getBlocks( block.clientId )
            .map( ( inner ) => markupOf( select, inner ) ),
    ].join( ' ' );
}

/**
 * A block in the form `blocks-get` gives.
 *
 * @param {Object} select     The editor's block editor selectors.
 * @param {string} artboardId The artboard.
 * @param {Object} block      The block.
 * @param {Array}  path       Its path.
 * @param {number} depth      How many levels of inner blocks to list.
 * @return {Object} The block.
 */
export function describeBlock( select, artboardId, block, path, depth ) {
    const inner = select.getBlocks( block.clientId );
    const out = {
        path,
        ref: blockRef( artboardId, path ),
        name: block.name,
        title: getBlockType( block.name )?.title ?? block.name,
        text: plainText( markupOf( select, block ) ),
        attributes: select.getBlockAttributes( block.clientId ) ?? {},
        editable: select.getBlockEditingMode( block.clientId ) !== 'disabled',
        innerCount: inner.length,
    };
    if ( depth > 0 ) {
        out.inner = inner.map( ( child, index ) =>
            describeBlock(
                select,
                artboardId,
                child,
                [ ...path, index ],
                depth - 1
            )
        );
    }
    return out;
}
