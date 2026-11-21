/**
 * `artboard-edit`: put an artboard in edit (spec/agent/tools.md).
 */
import { findArtboard } from '../board';
import { putInEdit } from '../edit';

export default async function artboardEdit( input ) {
    const { artboard } = findArtboard( input.artboard );
    await putInEdit( artboard );
    return { edit: artboard.id };
}
