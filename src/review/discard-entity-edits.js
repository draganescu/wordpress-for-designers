/**
 * Drops every unsaved edit of one entity record: the one place the plugin
 * does so.
 */
import { store as coreStore } from '@wordpress/core-data';

// core-data merges an edit of these keys into the edit it already holds, so
// `undefined` leaves them as they are. The saved value clears them.
const MERGED_KEYS = [ 'meta' ];

/**
 * @param {Object}        registry            The data registry.
 * @param {string}        kind                The entity's kind.
 * @param {string}        name                The entity's name.
 * @param {number|string} [id]                The record's id; none for the site.
 * @param {Object}        [options]
 * @param {boolean}       [options.undoable]  Whether the discard is a step of the content history (D48).
 * @param {boolean}       [options.continued] Whether it belongs to the step that the discard before it started.
 * @return {boolean} Whether the content history has the discard.
 */
export function discardEntityEdits(
    registry,
    kind,
    name,
    id,
    { undoable = false, continued = false } = {}
) {
    const { clearEntityRecordEdits, editEntityRecord } =
        registry.dispatch( coreStore );
    if ( ! undoable ) {
        clearEntityRecordEdits( kind, name, id );
        return false;
    }
    // core-data's own action adds no undo level, so an undoable discard is
    // an ordinary edit back to what is saved.
    const core = registry.select( coreStore );
    const keys = Object.keys(
        core.getEntityRecordEdits( kind, name, id ) ?? {}
    );
    if ( ! keys.length ) {
        return false;
    }
    const saved = core.getEntityRecord( kind, name, id );
    editEntityRecord(
        kind,
        name,
        id,
        Object.fromEntries(
            keys.map( ( key ) => [
                key,
                MERGED_KEYS.includes( key ) ? saved?.[ key ] : undefined,
            ] )
        ),
        // A cached edit joins the undo level before it, as typing does.
        { isCached: continued }
    );
    return true;
}
