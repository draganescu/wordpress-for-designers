/**
 * `review-list`: list the unsaved changes waiting in Review, and who made
 * each (spec/agent/tools.md).
 */
import { actions } from '../board';

export default function reviewList( input, { authorOf } ) {
    return {
        items: actions()
            .reviewItems()
            .map( ( item ) => ( {
                ...item,
                // An item nobody was seen changing was there before the
                // surface was.
                author: authorOf( item.key ) ?? 'you',
            } ) ),
    };
}
