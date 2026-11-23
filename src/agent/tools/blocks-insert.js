/**
 * `blocks-insert`: insert blocks, given as block markup, or insert a pattern
 * (spec/agent/tools.md).
 */
import { parse } from '@wordpress/blocks';
import { actions, findArtboard } from '../board';
import { clientIdAt, editorOf, settled } from '../blocks';
import { invalidArgs, notAllowed, notFound } from '../errors';
import { withinLimit } from '../limit';

export default async function blocksInsert( input ) {
    const { markup, pattern } = input;
    if ( ( markup === undefined ) === ( pattern === undefined ) ) {
        throw invalidArgs( 'Exactly one of markup and pattern is required.' );
    }
    const { artboard } = findArtboard( input.artboard );
    const parent = input.parent ?? [];
    const { select, dispatch } = await editorOf( artboard );
    const rootClientId = clientIdAt( select, parent );

    let blocks;
    if ( pattern !== undefined ) {
        // As the pattern's inserter row inserts it in edit (D39).
        blocks = await withinLimit( actions().patternBlocks( pattern ) );
        if ( ! blocks ) {
            throw notFound( 'Pattern', pattern );
        }
    } else {
        blocks = parse( markup ).filter(
            // White space between blocks parses as an empty block.
            ( block ) =>
                block.name !== 'core/freeform' ||
                String( block.attributes?.content ?? '' ).trim()
        );
    }
    if ( ! blocks.length ) {
        throw invalidArgs(
            pattern !== undefined
                ? 'pattern yields no block.'
                : 'markup yields no block.'
        );
    }

    const count = select.getBlocks( rootClientId ).length;
    const index = input.index ?? count;
    if ( index > count ) {
        throw invalidArgs( `index must be ${ count } or less.` );
    }
    if (
        blocks.some(
            ( block ) => ! select.canInsertBlockType( block.name, rootClientId )
        )
    ) {
        throw notAllowed();
    }
    dispatch.insertBlocks( blocks, index, rootClientId, true );
    await settled();
    return {
        inserted: blocks.map( ( block, offset ) => [
            ...parent,
            index + offset,
        ] ),
    };
}
