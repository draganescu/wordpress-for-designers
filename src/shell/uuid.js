/**
 * The ids the client makes (spec/data-model.md): version 4 UUIDs.
 *
 * `crypto.randomUUID` exists only in a secure context, and a site served
 * over plain http from a name other than localhost is not one. There the id
 * is built from `crypto.getRandomValues`, which every context has.
 *
 * @return {string} A version 4 UUID.
 */
export function uuid() {
    const { crypto } = window;
    if ( typeof crypto.randomUUID === 'function' ) {
        return crypto.randomUUID();
    }
    const bytes = crypto.getRandomValues( new Uint8Array( 16 ) );
    // The version and the variant, as RFC 4122 places them.
    bytes[ 6 ] = ( bytes[ 6 ] % 16 ) + 64;
    bytes[ 8 ] = ( bytes[ 8 ] % 64 ) + 128;
    const hex = Array.from( bytes, ( byte ) =>
        byte.toString( 16 ).padStart( 2, '0' )
    ).join( '' );
    return [
        hex.slice( 0, 8 ),
        hex.slice( 8, 12 ),
        hex.slice( 12, 16 ),
        hex.slice( 16, 20 ),
        hex.slice( 20 ),
    ].join( '-' );
}
