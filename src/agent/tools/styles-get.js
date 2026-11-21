/**
 * `styles-get`: read the site's style tokens, their use counts and the style
 * variations (spec/agent/tools.md).
 */
import { actions } from '../board';
import { tokenRef } from '../refs';

export default function stylesGet( input, { authorOf } ) {
    const styles = actions().styles();
    const withRefs = ( kind, rows ) =>
        rows.map( ( row ) => ( { ...row, ref: tokenRef( kind, row.slug ) } ) );
    const out = {
        variation: styles.variation,
        variations: styles.variations,
        colors: withRefs( 'color', styles.colors ),
        fontSizes: withRefs( 'font-size', styles.fontSizes ),
        fontFamilies: withRefs( 'font-family', styles.fontFamilies ),
        spacing: styles.spacing,
    };
    const author = authorOf( actions().stylesKey() );
    if ( author ) {
        out.changed = author;
    }
    return out;
}
