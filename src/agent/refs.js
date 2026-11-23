/**
 * References: strings that name one thing on a board (spec/agent/surface.md,
 * References). A reference holds no board id: it is read against the open
 * board.
 */
import { invalidArgs } from './errors';

const PREFIX = 'wfd-ref-';
const TOKEN_KINDS = [ 'color', 'font-size', 'font-family' ];

export const artboardRef = ( id ) => `${ PREFIX }a_${ id }`;
export const blockRef = ( id, path ) =>
    `${ PREFIX }a_${ id }_b_${ path.join( '_' ) }`;
export const noteRef = ( id ) => `${ PREFIX }n_${ id }`;
export const tokenRef = ( kind, slug ) => `${ PREFIX }t_${ kind }_${ slug }`;

/**
 * Whether a string is given as a reference.
 *
 * @param {*} value The value.
 * @return {boolean} True for a string that starts as a reference does.
 */
export function isRef( value ) {
    return (
        typeof value === 'string' &&
        value.replace( /^#/, '' ).startsWith( PREFIX )
    );
}

/**
 * Reads a reference string. A leading `#` is ignored.
 *
 * @param {string} value The string.
 * @param {string} field The input field it was given in, for the message.
 * @return {Object} `{ type: 'artboard', id }`, `{ type: 'block', id, path }`,
 *                  `{ type: 'note', id }` or `{ type: 'token', kind, slug }`.
 */
export function parseRef( value, field ) {
    const wrong = () =>
        invalidArgs( `${ field } is not a reference: ${ value }.` );
    const text = String( value ).replace( /^#/, '' );
    if ( ! text.startsWith( PREFIX ) || /[^A-Za-z0-9_-]/.test( text ) ) {
        throw wrong();
    }
    const rest = text.slice( PREFIX.length );
    if ( rest.startsWith( 'a_' ) ) {
        const [ id, path, ...more ] = rest.slice( 2 ).split( '_b_' );
        if ( ! id || id.includes( '_' ) || more.length ) {
            throw wrong();
        }
        if ( path === undefined ) {
            return { type: 'artboard', id };
        }
        if ( ! /^\d+(_\d+)*$/.test( path ) ) {
            throw wrong();
        }
        return { type: 'block', id, path: path.split( '_' ).map( Number ) };
    }
    if ( rest.startsWith( 'n_' ) && rest.length > 2 ) {
        return { type: 'note', id: rest.slice( 2 ) };
    }
    if ( rest.startsWith( 't_' ) ) {
        const kind = TOKEN_KINDS.find( ( item ) =>
            rest.startsWith( `t_${ item }_` )
        );
        const slug = kind ? rest.slice( kind.length + 3 ) : '';
        if ( slug ) {
            return { type: 'token', kind, slug };
        }
    }
    throw wrong();
}
