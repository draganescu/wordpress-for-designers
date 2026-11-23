/**
 * `block-update`: change the attributes of one block, its text included
 * (spec/agent/tools.md).
 */
import { getBlockType } from '@wordpress/blocks';
import { findArtboard } from '../board';
import {
    clientIdAt,
    describeBlock,
    editorOf,
    pathFrom,
    settled,
} from '../blocks';
import { invalidArgs, notAllowed } from '../errors';
import { isCustomHtml, runsScript } from '../unsafe';

export default async function blockUpdate( input ) {
    const found = findArtboard( input.artboard );
    const { artboard } = found;
    const path = pathFrom( input.block, found.path );
    if ( ! path.length ) {
        throw invalidArgs( 'block must name a block.' );
    }
    if ( ! Object.keys( input.attributes ).length ) {
        throw invalidArgs( 'attributes must have at least one key.' );
    }
    if ( runsScript( input.attributes ) ) {
        throw invalidArgs(
            'attributes must not hold a script or an event handler.'
        );
    }
    const { select, dispatch } = await editorOf( artboard );
    const clientId = clientIdAt( select, path );
    if ( isCustomHtml( select.getBlockName( clientId ) ) ) {
        throw invalidArgs( 'block must not name a Custom HTML block.' );
    }
    const mode = select.getBlockEditingMode( clientId );
    if ( mode === 'disabled' ) {
        throw notAllowed();
    }
    // Where the editor lets only the content of a block be changed, the
    // tool changes nothing else either.
    if ( mode === 'contentOnly' ) {
        const declared =
            getBlockType( select.getBlockName( clientId ) )?.attributes ?? {};
        const isContent = ( name ) => declared[ name ]?.role === 'content';
        if ( ! Object.keys( input.attributes ).every( isContent ) ) {
            throw notAllowed();
        }
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
