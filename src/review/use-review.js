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
import { store as boardStore } from '../board-store';
import { recordName } from '../shell/use-artboards';
import { countTemplatesUsing } from '../shell/use-entity-info';
import { changeLines } from './diff';
import { discardEntityEdits } from './discard-entity-edits';
import { changedEntries, rawContent } from './entries';

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

function editedBlocks( record ) {
    if ( Array.isArray( record?.blocks ) ) {
        return record.blocks;
    }
    const content = record?.content;
    return parse(
        typeof content === 'function' ? content( record ) : rawContent( record )
    );
}

export function useReview() {
    const registry = useRegistry();
    const [ unchecked, setUnchecked ] = useState( () => new Set() );
    const [ failed, setFailed ] = useState( () => new Set() );
    const [ isSaving, setIsSaving ] = useState( false );
    const [ isOpen, setIsOpen ] = useState( false );

    const entries = useSelect( changedEntries, [] );

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
            // From now on the artboard is part of the board's layout.
            board.updateArtboard( entry.artboardId, {
                entityId: created.id,
                draft: undefined,
            } );
            discardEntityEdits( registry, entry.kind, entry.name, entry.id );
            const args = [ entry.kind, entry.name, created.id ];
            core.invalidateResolution( 'getEntityRecord', args );
            core.invalidateResolution( 'getEditedEntityRecord', args );
        },
        [ registry, core, board ]
    );

    const save = useCallback( async () => {
        setIsSaving( true );
        const nextFailed = new Set();
        let hasSaved = false;
        for ( const entry of entries ) {
            if ( unchecked.has( entry.key ) ) {
                continue;
            }
            try {
                // One request per item.
                await saveOne( entry );
                hasSaved = true;
            } catch {
                nextFailed.add( entry.key );
            }
        }
        if ( hasSaved ) {
            // Browsers show the saved site (D55).
            board.bumpSiteVersion();
        }
        setFailed( nextFailed );
        setIsSaving( false );
    }, [ entries, unchecked, saveOne, board ] );

    // Discards the changes of the given entries. An unsaved new template or
    // part leaves the board, which is not undoable; the rest revert,
    // together one step of the content history (D48).
    const discard = useCallback(
        ( list ) => {
            let isStepStarted = false;
            for ( const entry of list ) {
                const isInStep = discardEntityEdits(
                    registry,
                    entry.kind,
                    entry.name,
                    entry.id,
                    { undoable: ! entry.isNew, continued: isStepStarted }
                );
                isStepStarted = isStepStarted || isInStep;
            }
            const drafts = list
                .filter( ( entry ) => entry.isNew )
                .map( ( entry ) => entry.artboardId );
            if ( drafts.length ) {
                board.removeArtboards( drafts );
            }
            const without = ( current ) => {
                const next = new Set( current );
                list.forEach( ( entry ) => next.delete( entry.key ) );
                return next.size === current.size ? current : next;
            };
            setFailed( without );
            setUnchecked( without );
        },
        [ registry, board ]
    );

    const discardAll = useCallback(
        () => discard( entries ),
        [ discard, entries ]
    );

    const discardOne = useCallback(
        ( key ) => discard( entries.filter( ( entry ) => entry.key === key ) ),
        [ discard, entries ]
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
