/**
 * Removing an artboard, and optionally acting on its entity
 * (spec/data-model.md, Removing).
 */
import { useCallback } from '@wordpress/element';
import { useDispatch, useRegistry } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import { store as boardStore } from '../board-store';
import { KINDS } from './constants';

/**
 * What the remove dialog needs to know about an artboard's entity.
 *
 * @param {Object} artboard The artboard with its record.
 * @return {Object} `isThemeItem` and `hasUserChanges`.
 */
export function removalInfo( artboard ) {
    const isTemplateKind =
        artboard.kind === 'template' || artboard.kind === 'template-part';
    const isThemeItem =
        isTemplateKind &&
        ! artboard.draft &&
        !! artboard.record?.has_theme_file;
    return {
        // A media object is only ever taken off the board.
        // So is a browser (D55).
        isBoardOnly: artboard.kind === 'media' || artboard.kind === 'browser',
        isDraft: !! artboard.draft,
        isThemeItem,
        hasUserChanges: isThemeItem && artboard.record?.source === 'custom',
    };
}

export function useRemoval() {
    const registry = useRegistry();
    const { saveEntityRecord, deleteEntityRecord, editEntityRecord } =
        useDispatch( coreStore );
    const { removeArtboard, removeArtboards } = useDispatch( boardStore );

    return useCallback(
        async ( artboard, alsoActOnEntity ) => {
            const postType = KINDS[ artboard.kind ].postType;
            if ( artboard.draft ) {
                // Never saved: drop the session's edits with the artboard.
                const edits =
                    registry
                        .select( coreStore )
                        .getEntityRecordEdits(
                            'postType',
                            postType,
                            artboard.entityId
                        ) ?? {};
                editEntityRecord(
                    'postType',
                    postType,
                    artboard.entityId,
                    Object.fromEntries(
                        Object.keys( edits ).map( ( key ) => [
                            key,
                            undefined,
                        ] )
                    ),
                    { undoIgnore: true }
                );
                removeArtboard( artboard.id, { undoable: false } );
                return;
            }
            if ( ! alsoActOnEntity ) {
                removeArtboard( artboard.id );
                return;
            }
            const { isThemeItem } = removalInfo( artboard );
            if ( isThemeItem ) {
                // Reset to the theme's version.
                await saveEntityRecord(
                    'postType',
                    postType,
                    { id: artboard.entityId, source: 'theme' },
                    { throwOnError: true }
                );
                removeArtboard( artboard.id, { undoable: false } );
                return;
            }
            // Pages and patterns go to the trash; user templates and parts
            // are deleted.
            const isTemplateKind =
                artboard.kind === 'template' ||
                artboard.kind === 'template-part';
            await deleteEntityRecord(
                'postType',
                postType,
                artboard.entityId,
                isTemplateKind ? { force: true } : {},
                { throwOnError: true }
            );
            // Every artboard on this board that showed it goes with it.
            removeArtboards(
                registry
                    .select( boardStore )
                    .getArtboards()
                    .filter(
                        ( item ) =>
                            item.kind === artboard.kind &&
                            item.entityId === artboard.entityId
                    )
                    .map( ( item ) => item.id )
            );
        },
        [
            registry,
            saveEntityRecord,
            deleteEntityRecord,
            editEntityRecord,
            removeArtboard,
            removeArtboards,
        ]
    );
}
