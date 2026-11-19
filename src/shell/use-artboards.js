/**
 * Artboards joined with what is known about their entities.
 */
import { useSelect } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import { store as boardStore } from '../board-store';
import { KINDS } from './constants';

/**
 * The display name of an entity record.
 *
 * @param {Object} record An entity record.
 * @return {string} The name.
 */
export function recordName( record ) {
    const title = record?.title;
    if ( typeof title === 'string' ) {
        return title;
    }
    return title?.raw || title?.rendered || record?.slug || '';
}

/**
 * The board's artboards, each with `name`, `record` and `isMissing`.
 *
 * @return {Array} Artboards.
 */
export function useArtboards() {
    return useSelect( ( select ) => {
        const core = select( coreStore );
        return select( boardStore )
            .getArtboards()
            .map( ( artboard ) => {
                if ( ! KINDS[ artboard.kind ].postType ) {
                    // With no entity, a browser: its name is its address.
                    return {
                        ...artboard,
                        record: null,
                        name: artboard.path,
                        status: 'ready',
                    };
                }
                const args = [
                    'postType',
                    KINDS[ artboard.kind ].postType,
                    artboard.entityId,
                ];
                if ( artboard.draft ) {
                    // A new template or part: it has edits and no saved record.
                    return {
                        ...artboard,
                        record: core.getEditedEntityRecord( ...args ) || null,
                        name: artboard.draft.title,
                        status: 'ready',
                    };
                }
                const saved = core.getEntityRecord( ...args );
                const record = saved
                    ? core.getEditedEntityRecord( ...args )
                    : null;
                let status = 'loading';
                if ( record ) {
                    status = record.status === 'trash' ? 'missing' : 'ready';
                } else if (
                    core.hasFinishedResolution( 'getEntityRecord', args )
                ) {
                    const error = core.getResolutionError(
                        'getEntityRecord',
                        args
                    );
                    // The error is the response itself, or its parsed body.
                    const code = error?.data?.status ?? error?.status;
                    // 404: the entity no longer exists. Anything else failed
                    // to load and can be tried again.
                    status = ! error || code === 404 ? 'missing' : 'failed';
                }
                return {
                    ...artboard,
                    record: record || null,
                    name: recordName( record ),
                    status,
                };
            } );
    }, [] );
}
