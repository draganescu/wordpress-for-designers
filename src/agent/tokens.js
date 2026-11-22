/**
 * Finding the token an input names: a slug with its kind, or a token
 * reference string in the slug's place (spec/agent/tools.md, Styles).
 */
import { actions } from './board';
import { invalidArgs, notFound } from './errors';
import { isRef, parseRef, tokenRef } from './refs';

const LISTS = {
    color: 'colors',
    'font-size': 'fontSizes',
    'font-family': 'fontFamilies',
};

/**
 * @param {string|undefined} kind The `kind` field.
 * @param {string}           slug The `slug` field.
 * @return {Object} `{ kind, slug }`.
 */
export function tokenFrom( kind, slug ) {
    if ( isRef( slug ) ) {
        const ref = parseRef( slug, 'slug' );
        if ( ref.type !== 'token' || ( kind && kind !== ref.kind ) ) {
            throw invalidArgs(
                kind
                    ? `slug does not name a ${ kind } token.`
                    : 'slug does not name a token.'
            );
        }
        return { kind: ref.kind, slug: ref.slug };
    }
    if ( ! kind ) {
        throw invalidArgs(
            'kind is required, unless slug is a token reference.'
        );
    }
    return { kind, slug };
}

/**
 * A token's row, in the form `styles-get` gives.
 *
 * @param {string} kind The token's kind.
 * @param {string} slug Its slug.
 * @return {Object} The row with its reference.
 */
export function describeToken( kind, slug ) {
    const row = actions()
        .styles()
        [ LISTS[ kind ] ].find( ( item ) => item.slug === slug );
    if ( ! row ) {
        throw notFound( 'Token', slug );
    }
    return { ...row, ref: tokenRef( kind, slug ) };
}
