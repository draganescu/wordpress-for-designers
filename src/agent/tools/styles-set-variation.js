/**
 * `styles-set-variation`: switch the site to one of the theme's style
 * variations, or back to the theme's own styles (spec/agent/tools.md).
 */
import { actions } from '../board';
import { notFound } from '../errors';

export default async function stylesSetVariation( { name } ) {
    if ( ! ( await actions().pickVariation( name ) ) ) {
        throw notFound( 'Variation', name );
    }
    return { variation: name };
}
