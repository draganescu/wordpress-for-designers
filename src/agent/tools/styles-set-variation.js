/**
 * `styles-set-variation`: switch the site to one of the theme's style
 * variations, or back to the theme's own styles (spec/agent/tools.md).
 */
import { actions } from '../board';
import { STYLES_NOT_READY, notFound, notReady } from '../errors';

export default async function stylesSetVariation( { name } ) {
    const done = await actions().pickVariation( name );
    if ( done === 'unknown' ) {
        throw notFound( 'Variation', name );
    }
    if ( done === 'not-ready' ) {
        throw notReady( STYLES_NOT_READY );
    }
    return { variation: name };
}
