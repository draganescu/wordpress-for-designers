/**
 * `token-set`: change a colour of the palette (spec/agent/tools.md).
 */
import { actions } from '../board';
import { notFound } from '../errors';
import { describeToken, tokenFrom } from '../tokens';

export default async function tokenSet( input ) {
    const { kind, slug } = tokenFrom( input.kind, input.slug );
    if ( ! ( await actions().setColor( slug, input.value ) ) ) {
        throw notFound( 'Token', slug );
    }
    // The name and the slug are kept.
    return describeToken( kind, slug );
}
