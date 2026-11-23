/**
 * Whether a browser's address is one of WordPress's own screens and not a
 * page of the site (spec/agent/tools.md, What a tool refuses; decision
 * D106).
 *
 * @param {string} address The address, starting with `/`.
 * @return {boolean} Whether it is.
 */
export function isAdminAddress( address ) {
    let path = address.split( /[?#]/ )[ 0 ];
    try {
        path = decodeURIComponent( path );
    } catch {
        return true;
    }
    return /(^|[/\\])(wp-admin([/\\]|$)|wp-login\.php|xmlrpc\.php)/i.test(
        path
    );
}
