/**
 * The Review list: every changed item, saving the checked ones with one REST
 * request each, and discarding (spec/screens/Review.md, data-model.md Saving).
 */
import { __, sprintf } from '@wordpress/i18n';
import { useCallback, useEffect, useMemo, useState } from '@wordpress/element';
import { useDispatch, useRegistry, useSelect } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import { parse, serialize } from '@wordpress/blocks';
import { getGlobalStylesChanges } from '@wordpress/global-styles-engine';
import { getDirtyEntityRecords } from '../adapter/experimental';
import { store as boardStore } from '../board-store';
import { KINDS } from '../shell/constants';
import { recordName } from '../shell/use-artboards';
import { countTemplatesUsing } from '../shell/use-entity-info';
import { changeLines } from './diff';

const TYPES = {
    'root/globalStyles': 'styles',
    'root/site': 'site',
    'postType/page': 'page',
    'postType/wp_block': 'pattern',
    'postType/wp_template': 'template',
    'postType/wp_template_part': 'template-part',
    'postType/wp_navigation': 'navigation',
};
const KIND_OF_TYPE = {
    page: 'page',
    pattern: 'pattern',
    template: 'template',
    'template-part': 'template-part',
};
// The status of a page or pattern, in lower case as the Review image shows.
const STATUS = {
    publish: __( 'published', 'wordpress-for-designers' ),
    draft: __( 'draft', 'wordpress-for-designers' ),
    pending: __( 'pending', 'wordpress-for-designers' ),
    private: __( 'private', 'wordpress-for-designers' ),
    future: __( 'scheduled', 'wordpress-for-designers' ),
};
const ALL = { per_page: -1 };

function rawContent( record ) {
    const content = record?.content;
    return typeof content === 'string' ? content : ( content?.raw ?? '' );
}

function editedBlocks( record ) {
    if ( Array.isArray( record?.blocks ) ) {
        return record.blocks;
    }
    const content = record?.content;
    return parse(
        typeof content === 'function' ? content( record ) : rawContent( record )
    );
}

const keyOf = ( kind, name, id ) => `${ kind }/${ name }/${ id }`;

export function useReview() {
    const registry = useRegistry();
    const [ unchecked, setUnchecked ] = useState( () => new Set() );
    const [ failed, setFailed ] = useState( () => new Set() );
    const [ isSaving, setIsSaving ] = useState( false );
    const [ isOpen, setIsOpen ] = useState( false );

    const entries = useSelect( ( select ) => {
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
                saved: core.getEntityRecord(
                    dirty.kind,
                    dirty.name,
                    dirty.key
                ),
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
    }, [] );

    const { templates, artboards } = useSelect(
        ( select ) => ( {
            templates:
                select( coreStore ).getEntityRecords(
                    'postType',
                    'wp_template',
                    ALL
                ) ?? [],
            artboards: select( boardStore ).getArtboards(),
        } ),
        []
    );

    const items = useMemo(
        () =>
            entries.map( ( entry ) => {
                const item = {
                    key: entry.key,
                    name:
                        entry.type === 'styles'
                            ? __( 'Styles', 'wordpress-for-designers' )
                            : entry.title ||
                              recordName( entry.edited ) ||
                              recordName( entry.saved ),
                    type: entry.type,
                    isNew: !! entry.isNew,
                    isChecked: ! unchecked.has( entry.key ),
                    hasError: failed.has( entry.key ),
                    lines: [],
                };
                if ( entry.type === 'styles' ) {
                    item.lines = getGlobalStylesChanges(
                        entry.edited ?? {},
                        entry.saved ?? {}
                    );
                    item.changeCount = item.lines.length;
                    item.artboardCount = artboards.length;
                    return item;
                }
                if ( entry.type === 'site' ) {
                    return item;
                }
                const { lines, moreCount } = changeLines(
                    entry.saved ? parse( rawContent( entry.saved ) ) : [],
                    editedBlocks( entry.edited )
                );
                item.lines = lines;
                item.moreCount = moreCount;
                if (
                    entry.type === 'page' &&
                    entry.saved &&
                    ( entry.saved.template ?? '' ) !==
                        ( entry.edited?.template ?? '' )
                ) {
                    // The page was given another template.
                    item.lines = [
                        sprintf(
                            /* translators: 1: what was changed, for example "Template". 2: what happened to it, for example "changed". */
                            __( '%1$s: %2$s', 'wordpress-for-designers' ),
                            __( 'Template', 'wordpress-for-designers' ),
                            __( 'changed', 'wordpress-for-designers' )
                        ),
                        ...item.lines,
                    ];
                }
                if ( entry.type === 'page' || entry.type === 'pattern' ) {
                    const status = entry.edited?.status;
                    item.status = STATUS[ status ] ?? status ?? '';
                }
                if ( entry.type === 'template-part' ) {
                    item.usedByCount = countTemplatesUsing( templates, {
                        kind: 'template-part',
                        entityId: entry.id,
                        record: entry.edited,
                    } );
                }
                return item;
            } ),
        [ entries, unchecked, failed, templates, artboards ]
    );

    // Artboards whose entity has changes, for the "Changed" mark.
    const changedArtboardIds = useMemo( () => {
        const changed = new Set();
        for ( const entry of entries ) {
            const kind = KIND_OF_TYPE[ entry.type ];
            if ( ! kind ) {
                continue;
            }
            for ( const artboard of artboards ) {
                if (
                    artboard.kind === kind &&
                    String( artboard.entityId ) === String( entry.id )
                ) {
                    changed.add( artboard.id );
                }
            }
        }
        return changed;
    }, [ entries, artboards ] );

    const core = useDispatch( coreStore );
    const board = useDispatch( boardStore );

    const clearEdits = useCallback(
        ( entry ) => {
            const edits =
                registry
                    .select( coreStore )
                    .getEntityRecordEdits( entry.kind, entry.name, entry.id ) ??
                {};
            const keys = Object.keys( edits );
            if ( keys.length ) {
                core.editEntityRecord(
                    entry.kind,
                    entry.name,
                    entry.id,
                    Object.fromEntries(
                        keys.map( ( key ) => [ key, undefined ] )
                    ),
                    { undoIgnore: true }
                );
            }
        },
        [ registry, core ]
    );

    const saveOne = useCallback(
        async ( entry ) => {
            if ( ! entry.isNew ) {
                await core.saveEditedEntityRecord(
                    entry.kind,
                    entry.name,
                    entry.id,
                    { throwOnError: true }
                );
                return;
            }
            // First save of a new template or part: this creates it.
            const edited = entry.edited ?? {};
            const data = {
                slug: edited.slug,
                title: edited.title,
                status: 'publish',
                content: serialize( editedBlocks( edited ) ),
            };
            if ( entry.name === 'wp_template_part' ) {
                data.area = edited.area ?? 'uncategorized';
            }
            const created = await core.saveEntityRecord(
                entry.kind,
                entry.name,
                data,
                { throwOnError: true }
            );
            clearEdits( entry );
            // From now on the artboard is part of the board's layout.
            board.updateArtboard( entry.artboardId, {
                entityId: created.id,
                draft: undefined,
            } );
            const args = [ entry.kind, entry.name, created.id ];
            core.invalidateResolution( 'getEntityRecord', args );
            core.invalidateResolution( 'getEditedEntityRecord', args );
        },
        [ core, board, clearEdits ]
    );

    const save = useCallback( async () => {
        setIsSaving( true );
        const nextFailed = new Set();
        for ( const entry of entries ) {
            if ( unchecked.has( entry.key ) ) {
                continue;
            }
            try {
                // One request per item.
                await saveOne( entry );
            } catch {
                nextFailed.add( entry.key );
            }
        }
        setFailed( nextFailed );
        setIsSaving( false );
    }, [ entries, unchecked, saveOne ] );

    const discardAll = useCallback( () => {
        for ( const entry of entries ) {
            clearEdits( entry );
        }
        // Unsaved new templates and parts leave the board.
        const drafts = entries
            .filter( ( entry ) => entry.isNew )
            .map( ( entry ) => entry.artboardId );
        if ( drafts.length ) {
            board.removeArtboards( drafts );
        }
        setFailed( new Set() );
        setUnchecked( new Set() );
    }, [ entries, clearEdits, board ] );

    // One item on its own (D48).
    const discardOne = useCallback(
        ( key ) => {
            const entry = entries.find(
                ( candidate ) => candidate.key === key
            );
            if ( ! entry ) {
                return;
            }
            clearEdits( entry );
            // An unsaved new template or part leaves the board.
            if ( entry.isNew ) {
                board.removeArtboards( [ entry.artboardId ] );
            }
            const without = ( current ) => {
                if ( ! current.has( key ) ) {
                    return current;
                }
                const next = new Set( current );
                next.delete( key );
                return next;
            };
            setFailed( without );
            setUnchecked( without );
        },
        [ entries, clearEdits, board ]
    );

    const toggle = useCallback( ( key ) => {
        setUnchecked( ( current ) => {
            const next = new Set( current );
            if ( next.has( key ) ) {
                next.delete( key );
            } else {
                next.add( key );
            }
            return next;
        } );
    }, [] );

    // Closing the tab with unsaved changes asks first. New templates and
    // parts are not in WordPress's own list of dirty records, so this
    // covers them as well.
    const count = items.length;
    useEffect( () => {
        if ( ! count ) {
            return;
        }
        const warn = ( event ) => {
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener( 'beforeunload', warn );
        return () => window.removeEventListener( 'beforeunload', warn );
    }, [ count ] );

    return {
        count,
        isOpen,
        open: () => setIsOpen( true ),
        close: () => setIsOpen( false ),
        changedArtboardIds: isOpen ? changedArtboardIds : null,
        drawerProps: {
            isOpen,
            onClose: () => setIsOpen( false ),
            items,
            onToggleItem: toggle,
            onDiscardItem: discardOne,
            onSave: save,
            onDiscardAll: discardAll,
            isSaving,
        },
    };
}
