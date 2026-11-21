/**
 * Putting an artboard in edit for a tool, as `artboard-edit` does
 * (spec/agent/tools.md): the designer's own way in, without the lock dialog.
 */
import { editSeam } from '../shell/seams';
import { locked, notEditable, notFound } from './errors';

/**
 * @return {Object} The editor in edit seam.
 */
export const editor = () => editSeam.current;

/**
 * Puts an artboard in edit, unless it is in edit already.
 *
 * @param {Object} artboard The artboard with its name.
 * @return {Promise<void>} Resolves once the store names it as in edit.
 */
export async function putInEdit( artboard ) {
    const result = await editor().enter( artboard.id );
    if ( result === 'not-editable' ) {
        throw notEditable( artboard.name );
    }
    if ( result === 'missing' ) {
        throw notFound( 'Artboard', artboard.id );
    }
    if ( result?.lockedBy !== undefined ) {
        throw locked( artboard.name, result.lockedBy );
    }
}
