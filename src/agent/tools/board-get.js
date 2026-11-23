/**
 * `board-get`: read the open board (spec/agent/tools.md).
 */
import { actions, describeArtboard, describeNote } from '../board';

export default function boardGet( input, { changedOf } ) {
    const board = actions().board();
    return {
        board: { id: board.id, title: board.title },
        artboards: board.artboards.map( ( artboard ) =>
            describeArtboard( artboard, board, changedOf )
        ),
        notes: board.notes.map( describeNote ),
        selection: board.selection,
        edit: board.edit,
        zoom: board.zoom,
    };
}
