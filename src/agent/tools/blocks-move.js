/**
 * `blocks-move`: move a block to another place in the artboard
 * (spec/agent/tools.md).
 */
import { findArtboard } from '../board';
import { clientIdAt, editorOf, pathFrom, pathOf, settled } from '../blocks';
import { invalidArgs, notAllowed } from '../errors';

export default async function blocksMove( input ) {
    const found = findArtboard( input.artboard );
    const { artboard } = found;
    const path = pathFrom( input.path, found.path );
    const parent = input.parent ?? [];
    if ( ! path.length ) {
        throw invalidArgs( 'path must name a block.' );
    }
    if ( path.every( ( index, depth ) => parent[ depth ] === index ) ) {
        throw invalidArgs( 'parent must not be the block or inside it.' );
    }
    const { select, dispatch } = await editorOf( artboard );
    const clientId = clientIdAt( select, path );
    const from = select.getBlockRootClientId( clientId ) ?? '';
    const to = clientIdAt( select, parent );
    // The index is counted after the block has left its old place.
    const room = select.getBlocks( to ).length - ( from === to ? 1 : 0 );
    if ( input.index > room ) {
        throw invalidArgs( `index must be ${ room } or less.` );
    }
    if (
        ! select.canMoveBlocks( [ clientId ] ) ||
        ( from !== to &&
            ! select.canInsertBlockType( select.getBlockName( clientId ), to ) )
    ) {
        throw notAllowed();
    }
    dispatch.moveBlockToPosition( clientId, from, to, input.index );
    await settled();
    return { path: pathOf( select, clientId ) };
}
