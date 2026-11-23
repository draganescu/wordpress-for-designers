/**
 * `styles-set`: change any global style or setting, for the site or for one
 * block type (spec/agent/tools.md).
 */
import { getBlockType } from '@wordpress/blocks';
import { actions } from '../board';
import { STYLES_NOT_READY, invalidArgs, notReady } from '../errors';

export default async function stylesSet( { kind, property, value, block } ) {
    if ( block !== undefined && ! getBlockType( block ) ) {
        throw invalidArgs( 'block must be a registered block name.' );
    }
    // Custom CSS is the designer's to write (D105).
    if ( kind === 'style' && property.split( '.' ).pop() === 'css' ) {
        throw invalidArgs( 'property must not be css.' );
    }
    const done = await actions().setStyleValue( kind, property, value, block );
    if ( done === 'not-ready' ) {
        throw notReady( STYLES_NOT_READY );
    }
    return { changed: true };
}
