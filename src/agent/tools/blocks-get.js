/**
 * `blocks-get`: read the blocks of an artboard (spec/agent/tools.md).
 */
import { findArtboard } from '../board';
import { clientIdAt, describeBlock, editorOf } from '../blocks';

export default async function blocksGet( input ) {
    const found = findArtboard( input.artboard );
    const { artboard } = found;
    const path = input.path ?? found.path;
    const depth = input.depth ?? 2;
    const { select } = await editorOf( artboard );
    if ( path && path.length ) {
        const clientId = clientIdAt( select, path );
        return {
            artboard: artboard.id,
            blocks: [
                describeBlock(
                    select,
                    artboard.id,
                    select.getBlock( clientId ),
                    path,
                    depth
                ),
            ],
        };
    }
    return {
        artboard: artboard.id,
        blocks: select
            .getBlocks()
            .map( ( block, index ) =>
                describeBlock( select, artboard.id, block, [ index ], depth )
            ),
    };
}
