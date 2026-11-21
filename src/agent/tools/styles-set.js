/**
 * `styles-set`: change any global style or setting, for the site or for one
 * block type (spec/agent/tools.md).
 */
import { getBlockType } from '@wordpress/blocks';
import { actions } from '../board';
import { invalidArgs } from '../errors';

export default async function stylesSet( { kind, path, value, block } ) {
    if ( block !== undefined && ! getBlockType( block ) ) {
        throw invalidArgs( 'block must be a registered block name.' );
    }
    await actions().setStyleValue( kind, path, value, block );
    return { changed: true };
}
