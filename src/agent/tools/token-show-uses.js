/**
 * `token-show-uses`: show on the board where a token is used, or stop showing
 * it (spec/agent/tools.md).
 */
import { actions } from '../board';
import { invalidArgs } from '../errors';
import { describeToken, tokenFrom } from '../tokens';

export default function tokenShowUses( input ) {
    if ( input.slug === undefined ) {
        if ( input.kind !== undefined ) {
            throw invalidArgs( 'kind is given with slug or not at all.' );
        }
        // The selected token is cleared.
        return actions().showUses();
    }
    const { kind, slug } = tokenFrom( input.kind, input.slug );
    // Fails when there is no such token.
    describeToken( kind, slug );
    return actions().showUses( kind, slug );
}
