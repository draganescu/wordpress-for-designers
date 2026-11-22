/**
 * `artboard-update`: change an artboard's device or position
 * (spec/agent/tools.md).
 */
import { actions, describeArtboard, findArtboard } from '../board';
import { invalidArgs } from '../errors';

export default function artboardUpdate( input, { changedOf } ) {
    const { device, x, y } = input;
    const { artboard } = findArtboard( input.artboard );
    if ( ( x === undefined ) !== ( y === undefined ) ) {
        throw invalidArgs( 'x and y must be given together.' );
    }
    if ( device === undefined && x === undefined ) {
        throw invalidArgs( 'One of device and x, y is required.' );
    }
    if ( device !== undefined && artboard.kind === 'media' ) {
        throw invalidArgs( 'device is not allowed for media.' );
    }
    if ( device !== undefined ) {
        actions().setDevice( artboard.id, device );
    }
    if ( x !== undefined ) {
        actions().move( artboard.id, x, y );
    }
    const board = actions().board();
    return describeArtboard(
        board.artboards.find( ( item ) => item.id === artboard.id ),
        board,
        changedOf
    );
}
