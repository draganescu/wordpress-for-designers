/**
 * What an agent may not put on the site through a tool: a Custom HTML block,
 * and markup that runs script (spec/agent/tools.md, What a tool refuses;
 * decision D105). Review names a changed block and does not show its markup,
 * so the designer could not see it before saving.
 */

const RUNS_SCRIPT =
    /<\s*(script|iframe|object|embed)\b|<[^>]*\son[a-z]+\s*=|javascript\s*:|data\s*:\s*text\/html/i;

/**
 * Whether a value, or anything inside it, holds markup that runs script.
 *
 * @param {*} value An attribute value, a list or an object of them.
 * @return {boolean} Whether it does.
 */
export function runsScript( value ) {
    if ( typeof value === 'string' ) {
        return RUNS_SCRIPT.test( value );
    }
    if ( ! value || typeof value !== 'object' ) {
        return false;
    }
    // Rich text is held as an object that gives its markup.
    if ( typeof value.toHTMLString === 'function' ) {
        return RUNS_SCRIPT.test( value.toHTMLString() );
    }
    return Object.values( value ).some( runsScript );
}

/**
 * Whether a block name is the Custom HTML block's.
 *
 * @param {string} name A block name.
 * @return {boolean} Whether it is.
 */
export const isCustomHtml = ( name ) => name === 'core/html';

/**
 * Whether a parsed block, or one inside it, is refused.
 *
 * @param {Object} block A block.
 * @return {boolean} Whether it is.
 */
export const isRefused = ( block ) =>
    isCustomHtml( block.name ) ||
    runsScript( block.attributes ) ||
    ( block.innerBlocks ?? [] ).some( isRefused );

/**
 * Whether a browser's address is one of WordPress's own screens and not a
 * page of the site (D106).
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
