/**
 * Every unsaved change, as Review lists it. The preview of unsaved changes
 * sends the same list (D57).
 */
import { store as coreStore } from '@wordpress/core-data';
import { getDirtyEntityRecords } from '../adapter/experimental';
import { store as boardStore } from '../board-store';
import { KINDS } from '../shell/constants';

const TYPES = {
    'root/globalStyles': 'styles',
    'root/site': 'site',
    'postType/page': 'page',
    'postType/wp_block': 'pattern',
    'postType/wp_template': 'template',
    'postType/wp_template_part': 'template-part',
    'postType/wp_navigation': 'navigation',
};

const keyOf = ( kind, name, id ) => `${ kind }/${ name }/${ id }`;

/**
 * The saved or unsaved content of a record, when it is text.
 *
 * @param {Object} record The record.
 * @return {string} The content.
 */
export function rawContent( record ) {
    const content = record?.content;
    return typeof content === 'string' ? content : ( content?.raw ?? '' );
}

/**
 * The saved or unsaved title of a record, as it is stored.
 *
 * @param {Object} record The record.
 * @return {string} The title.
 */
export function rawTitle( record ) {
    const title = record?.title;
    return typeof title === 'string' ? title : ( title?.raw ?? '' );
}

/**
 * @param {(store: Object) => Object} select The registry's select.
 * @return {Array} One entry per changed item, with its saved and edited
 *                 records.
 */
export function changedEntries( select ) {
    const core = select( coreStore );
    const artboards = select( boardStore ).getArtboards();
    const list = [];
    for ( const dirty of getDirtyEntityRecords( select ) ?? [] ) {
        const type = TYPES[ `${ dirty.kind }/${ dirty.name }` ];
        if ( ! type ) {
            continue;
        }
        list.push( {
            key: keyOf( dirty.kind, dirty.name, dirty.key ),
            kind: dirty.kind,
            name: dirty.name,
            id: dirty.key,
            type,
            title: dirty.title,
            saved: core.getEntityRecord( dirty.kind, dirty.name, dirty.key ),
            edited: core.getEditedEntityRecord(
                dirty.kind,
                dirty.name,
                dirty.key
            ),
        } );
    }
    // New templates and parts have edits but no saved record.
    for ( const artboard of artboards ) {
        if ( ! artboard.draft ) {
            continue;
        }
        const postType = KINDS[ artboard.kind ].postType;
        list.push( {
            key: keyOf( 'postType', postType, artboard.entityId ),
            kind: 'postType',
            name: postType,
            id: artboard.entityId,
            type: artboard.kind,
            title: artboard.draft.title,
            isNew: true,
            artboardId: artboard.id,
            saved: null,
            edited: core.getEditedEntityRecord(
                'postType',
                postType,
                artboard.entityId
            ),
        } );
    }
    return list;
}
