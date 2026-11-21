/**
 * `block-update`: change the attributes of one block, its text included
 * (spec/agent/tools.md).
 */
import { findArtboard } from '../board';
import {
    clientIdAt,
    describeBlock,
    editorOf,
    pathFrom,
    settled,
} from '../blocks';
import { invalidArgs, notAllowed } from '../errors';

export default async function blockUpdate( input ) {
    const found = findArtboard( input.artboard );
    const { artboard } = found;
    const path = pathFrom( input.path, found.path );
    if ( ! path.length ) {
        throw invalidArgs( 'path must name a block.' );
    }
    if ( ! Object.keys( input.attributes ).length ) {
        throw invalidArgs( 'attributes must have at least one key.' );
    }
    const { select, dispatch } = await editorOf( artboard );
    const clientId = clientIdAt( select, path );
    if ( select.getBlockEditingMode( clientId ) === 'disabled' ) {
        throw notAllowed();
    }
    dispatch.updateBlockAttributes( clientId, input.attributes );
    await settled();
    return describeBlock(
        select,
        artboard.id,
        select.getBlock( clientId ),
        path,
        0
    );
}
