/**
 * `board-select`: select artboards and bring them into view
 * (spec/agent/tools.md).
 */
import { actions, findArtboard } from '../board';
import { editor } from '../edit';

export default function boardSelect( { artboards } ) {
    const ids = [
        ...new Set(
            artboards.map(
                ( value, index ) =>
                    findArtboard( value, `artboards[${ index }]` ).artboard.id
            )
        ),
    ];
    // Edit ends first, as a click on another artboard ends it (D38).
    editor().leave();
    actions().selectRows( ids );
    return { selection: actions().board().selection };
}
