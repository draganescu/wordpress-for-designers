/**
 * `token-set`: change a colour of the palette (spec/agent/tools.md).
 */
import { actions } from '../board';
import { STYLES_NOT_READY, notFound, notReady } from '../errors';
import { describeToken, tokenFrom } from '../tokens';

export default async function tokenSet( input ) {
    const { kind, slug } = tokenFrom( input.kind, input.slug );
    const done = await actions().setColor( slug, input.value );
    if ( done === 'unknown' ) {
        throw notFound( 'Token', slug );
    }
    if ( done === 'not-ready' ) {
        throw notReady( STYLES_NOT_READY );
    }
    // The name and the slug are kept.
    return describeToken( kind, slug );
}
