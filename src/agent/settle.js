/**
 * Whether the editor of the artboard in edit has every block it is going to
 * have (spec/agent/tools.md, Settling; decision D82). A block that takes its
 * inner blocks from a record of the site (a template part, a synced pattern,
 * a navigation menu, the Content of a page) gets them a moment after that
 * record has resolved, when the editor has drawn it. The stores say when
 * that has happened: the block then holds as many blocks as its record.
 */
import { select } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { parse } from '@wordpress/blocks';

/**
 * The number of blocks at the top of a record's content, as its editor
 * will hold them.
 *
 * @param {string}        postType The record's post type.
 * @param {string|number} id       Its id.
 * @return {number|null} The number; null when the record cannot be read.
 */
function blocksOf( postType, id ) {
    const core = select( coreStore );
    if ( ! core.getEntityRecord( 'postType', postType, id ) ) {
        return null;
    }
    const record = core.getEditedEntityRecord( 'postType', postType, id );
    if ( Array.isArray( record?.blocks ) ) {
        return record.blocks.length;
    }
    const content = record?.content;
    if ( typeof content === 'function' ) {
        return parse( content( record ) ).length;
    }
    return parse(
        typeof content === 'string' ? content : ( content?.raw ?? '' )
    ).length;
}

/**
 * How many inner blocks a block that takes them from a record will hold.
 *
 * @param {Object}  block     The block.
 * @param {Object}  artboard  The artboard in edit.
 * @param {boolean} isInQuery Whether the block is inside a Query Loop.
 * @return {number|null} The number; null for a block that holds its own
 *                       inner blocks, or whose record cannot be read.
 */
function expectedInner( block, artboard, isInQuery ) {
    const { attributes } = block;
    switch ( block.name ) {
        case 'core/template-part':
            return attributes.slug
                ? blocksOf(
                      'wp_template_part',
                      `${
                          attributes.theme ??
                          select( coreStore ).getCurrentTheme()?.stylesheet
                      }//${ attributes.slug }`
                  )
                : null;
        case 'core/block':
            return attributes.ref
                ? blocksOf( 'wp_block', attributes.ref )
                : null;
        case 'core/navigation':
            return attributes.ref
                ? blocksOf( 'wp_navigation', attributes.ref )
                : null;
        case 'core/post-content':
            // WordPress makes a Content block editable, and so the holder
            // of its post's blocks, only where it has a post to show and
            // is not inside a Query Loop; everywhere else it draws the
            // content read-only and holds nothing. The Content of a page
            // artboard is the first case. A Query Loop gives itself its id
            // just after it mounts, and until that has reached the Content
            // blocks inside it they take themselves for editable and hold
            // their post's blocks; then they let them go.
            return artboard.kind === 'page' && ! isInQuery
                ? blocksOf( 'page', artboard.entityId )
                : 0;
    }
    return null;
}

/**
 * @param {Object} registry The registry of the editor in edit.
 * @param {Object} artboard The artboard in edit.
 * @return {boolean} False while a block is still without its record's
 *                   blocks, or still holds blocks it will let go.
 */
export function hasEveryBlock( registry, artboard ) {
    const editor = registry.select( blockEditorStore );
    const isFull = ( clientId, isInQuery ) =>
        editor.getBlocks( clientId ).every( ( block ) => {
            const expected = expectedInner( block, artboard, isInQuery );
            return (
                ( expected === null ||
                    editor.getBlocks( block.clientId ).length === expected ) &&
                isFull(
                    block.clientId,
                    isInQuery || block.name === 'core/query'
                )
            );
        } );
    return isFull( '', false );
}

/**
 * Whether the editor has drawn every block it holds. A block that is drawn
 * has told the editor what it takes inside it; until then the editor
 * answers that nothing may be inserted there.
 *
 * @param {Object}        registry The registry of the editor in edit.
 * @param {Document|null} canvas   The editor's canvas document.
 * @return {boolean} False while a block of the tree has no element.
 */
export function isDrawn( registry, canvas ) {
    if ( ! canvas ) {
        return false;
    }
    const editor = registry.select( blockEditorStore );
    const hasElement = ( clientId ) =>
        editor
            .getBlocks( clientId )
            .every(
                ( block ) =>
                    !! canvas.getElementById( `block-${ block.clientId }` ) &&
                    hasElement( block.clientId )
            );
    return hasElement( '' );
}
