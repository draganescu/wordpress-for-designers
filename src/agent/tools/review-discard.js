/**
 * `review-discard`: discard one unsaved item that only the agent changed
 * (spec/agent/tools.md).
 */
import { actions } from '../board';
import { notAgents, notFound } from '../errors';

export default function reviewDiscard( { key }, { authorOf } ) {
    const item = actions()
        .reviewItems()
        .find( ( one ) => one.key === key );
    if ( ! item ) {
        throw notFound( 'Review item', key );
    }
    if ( authorOf( key ) !== 'agent' ) {
        throw notAgents( item.name );
    }
    // What the card's Discard does after its confirmation (D48).
    actions().discardItem( key );
    return { discarded: key };
}
