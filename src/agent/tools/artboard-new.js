/**
 * `artboard-new`: create a new page, pattern, template part or template and
 * place its artboard (spec/agent/tools.md).
 */
import { actions, describeArtboard } from '../board';
import { editor } from '../edit';
import { invalidArgs } from '../errors';

export default async function artboardNew(
    { kind, purpose, x, y },
    { changedOf }
) {
    if ( kind === 'template' && purpose === undefined ) {
        throw invalidArgs( 'purpose is required for a template.' );
    }
    if ( kind !== 'template' && purpose !== undefined ) {
        throw invalidArgs( 'purpose is allowed for a template only.' );
    }
    if ( ( x === undefined ) !== ( y === undefined ) ) {
        throw invalidArgs( 'x and y must be given together.' );
    }
    // The New rows are offered with no artboard in edit (D63).
    editor().leave();
    const id = await actions().createNew(
        kind,
        purpose,
        x === undefined ? undefined : { x, y }
    );
    if ( ! id ) {
        // A purpose whose template exists is not offered as new.
        throw invalidArgs(
            `purpose ${ purpose } already has a template on the site.`
        );
    }
    const board = actions().board();
    return describeArtboard(
        board.artboards.find( ( artboard ) => artboard.id === id ),
        board,
        changedOf
    );
}
