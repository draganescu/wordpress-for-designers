/**
 * `artboard-remove`: take artboards off the board. Nothing on the site is
 * deleted (spec/agent/tools.md).
 */
import { actions, findArtboard } from '../board';
import { editor } from '../edit';

export default function artboardRemove( { artboards } ) {
    const ids = [
        ...new Set(
            artboards.map(
                ( value, index ) =>
                    findArtboard( value, `artboards[${ index }]` ).artboard.id
            )
        ),
    ];
    if ( ids.includes( actions().board().edit ) ) {
        editor().leave();
    }
    actions().remove( ids );
    return { removed: ids };
}
