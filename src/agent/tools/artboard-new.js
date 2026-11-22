/**
 * `artboard-new`: create a new page, pattern, template part or template and
 * place its artboard (spec/agent/tools.md).
 */
import { actions, describeArtboard } from '../board';
import { editor, putInEdit } from '../edit';
import { invalidArgs } from '../errors';
import { withinLimit } from '../limit';

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
    const id = await withinLimit(
        actions().createNew(
            kind,
            purpose,
            x === undefined ? undefined : { x, y }
        )
    );
    if ( ! id ) {
        // A purpose whose template exists is not offered as new.
        throw invalidArgs(
            kind === 'template'
                ? `purpose ${ purpose } already has a template on the site.`
                : `kind ${ kind } cannot be made new right now.`
        );
    }
    const board = actions().board();
    // It is left as the New row leaves it; where that is in edit, its
    // editor has settled before the tool answers.
    if ( board.edit === id ) {
        await putInEdit( board.artboards.find( ( item ) => item.id === id ) );
    }
    return describeArtboard(
        board.artboards.find( ( artboard ) => artboard.id === id ),
        board,
        changedOf
    );
}
