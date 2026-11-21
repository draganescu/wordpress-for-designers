/**
 * `blocks-remove`: remove blocks (spec/agent/tools.md).
 */
import { findArtboard } from '../board';
import { clientIdAt, editorOf, pathFrom, settled } from '../blocks';
import { invalidArgs, notAllowed } from '../errors';

export default async function blocksRemove( input ) {
    const found = findArtboard( input.artboard );
    const { artboard } = found;
    const paths = input.paths ?? [ pathFrom( undefined, found.path, 'paths' ) ];
    if ( paths.some( ( path ) => ! path.length ) ) {
        throw invalidArgs( 'paths must name blocks.' );
    }
    const { select, dispatch } = await editorOf( artboard );
    // The blocks, as their paths are before the call.
    const clientIds = [
        ...new Set( paths.map( ( path ) => clientIdAt( select, path ) ) ),
    ];
    // If one of them cannot be removed, none is.
    if ( ! select.canRemoveBlocks( clientIds ) ) {
        throw notAllowed();
    }
    dispatch.removeBlocks( clientIds, false );
    await settled();
    return { removed: clientIds.length };
}
