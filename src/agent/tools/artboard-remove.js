/**
 * `artboard-remove`: take artboards off the board. Nothing on the site is
 * deleted (spec/agent/tools.md).
 */
import { actions, findArtboard } from '../board';
import { editor } from '../edit';
import { notAgents } from '../errors';

export default function artboardRemove( { artboards }, { changedOf } ) {
    const named = artboards.map(
        ( value, index ) =>
            findArtboard( value, `artboards[${ index }]` ).artboard
    );
    // A new template or part that was never saved exists only on the
    // board: it leaves only when the agent alone changed it (D83).
    const kept = named.find(
        ( artboard ) => artboard.draft && changedOf( artboard ) !== 'agent'
    );
    if ( kept ) {
        throw notAgents( kept.name );
    }
    const ids = [ ...new Set( named.map( ( artboard ) => artboard.id ) ) ];
    if ( ids.includes( actions().board().edit ) ) {
        editor().leave();
    }
    actions().remove( ids );
    return { removed: ids };
}
