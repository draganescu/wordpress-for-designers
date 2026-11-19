/**
 * What happens when an inserter row is clicked or dragged (decision D39):
 * with an artboard in edit the item goes into its content, with none in edit
 * it goes onto the board.
 */
import {
    cloneElement,
    useCallback,
    useRef,
    useState,
} from '@wordpress/element';
import { useDispatch, useRegistry } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import { createBlock, parse, serialize } from '@wordpress/blocks';
import { MediaUpload } from '@wordpress/block-editor';
import { store as boardStore } from '../board-store';
import { NEW_ARTBOARD_HEIGHT } from '../shell/use-placement';
import { mediaSize } from '../shell/constants';
import { DRAG_DATA_TYPE } from './inserter-panel';
import { MEDIA_QUERY } from './use-inserter-data';

const KIND_OF = {
    media: 'media',
    pattern: 'pattern',
    template: 'template',
    'template-part': 'template-part',
};

/**
 * @param {Object}   options
 * @param {Object}   options.lookup    Maps from useInserterData.
 * @param {Object}   options.bridgeRef The Live editor's bridge, if any.
 * @param {Function} options.toBoard   Converts a pointer event to board units.
 * @param {Function} options.findSpace Receives a size or null, returns a free
 *                                     point of the board in view.
 * @return {Object} Handlers for the panel and the canvas.
 */
export function useInserterActions( {
    lookup,
    bridgeRef,
    toBoard,
    findSpace,
} ) {
    const registry = useRegistry();
    const { saveEntityRecord, invalidateResolution } = useDispatch( coreStore );
    const { addArtboard, selectArtboard } = useDispatch( boardStore );
    const dragged = useRef( null );
    const [ dropTarget, setDropTarget ] = useState( null );

    // A browser being browsed has no content to insert into (D55).
    const isEditing = useCallback( () => {
        const board = registry.select( boardStore );
        const live = board.getArtboard( board.getLiveId() );
        return !! live && live.kind !== 'browser';
    }, [ registry ] );

    /**
     * The blocks an item becomes inside an artboard. A template has none.
     */
    const blocksFor = useCallback(
        ( { type, id } ) => {
            if ( type === 'block' ) {
                return [ createBlock( id ) ];
            }
            if ( type === 'pattern' ) {
                const item = lookup.patterns.get( id );
                if ( ! item ) {
                    return [];
                }
                if ( ! item.record ) {
                    return parse( item.pattern.content ?? '' );
                }
                // A user pattern: synced patterns are inserted by reference.
                return item.record.wp_pattern_sync_status === 'unsynced'
                    ? parse( item.record.content?.raw ?? '' )
                    : [ createBlock( 'core/block', { ref: item.record.id } ) ];
            }
            if ( type === 'template-part' ) {
                const part = lookup.parts.get( id );
                return part
                    ? [
                          createBlock( 'core/template-part', {
                              slug: part.slug,
                              theme: part.theme,
                          } ),
                      ]
                    : [];
            }
            if ( type === 'media' ) {
                const image = lookup.images.get( id );
                return image
                    ? [
                          createBlock( 'core/image', {
                              id: image.id,
                              url: image.source_url,
                              alt: image.alt_text ?? '',
                          } ),
                      ]
                    : [];
            }
            return [];
        },
        [ lookup ]
    );

    /**
     * The size an item takes on the board, or null for an artboard's own.
     */
    const sizeOf = useCallback(
        ( { type, id } ) => {
            const image = type === 'media' ? lookup.images.get( id ) : null;
            return image
                ? mediaSize(
                      image.media_details?.width,
                      image.media_details?.height
                  )
                : null;
        },
        [ lookup ]
    );

    /**
     * Puts an item on the board with its top-left corner at a point: an
     * image as a media object, anything else as a Desktop artboard. It is
     * selected, not in edit.
     */
    const openOnBoard = useCallback(
        async ( item, { x, y } ) => {
            const object = {
                id: window.crypto.randomUUID(),
                kind: KIND_OF[ item.type ],
                entityId: item.id,
                x: Math.round( x ),
                y: Math.round( y ),
            };
            if ( item.type === 'media' ) {
                if ( ! lookup.images.has( item.id ) ) {
                    return;
                }
                Object.assign( object, sizeOf( item ) );
            } else {
                object.device = 'desktop';
                object.height = NEW_ARTBOARD_HEIGHT;
            }
            if ( item.type === 'pattern' ) {
                const entry = lookup.patterns.get( item.id );
                if ( entry?.record ) {
                    object.entityId = entry.record.id;
                } else if ( entry?.pattern ) {
                    // A theme pattern is copied to a new user pattern first.
                    const copy = await saveEntityRecord(
                        'postType',
                        'wp_block',
                        {
                            title: entry.pattern.title,
                            content: entry.pattern.content,
                            status: 'draft',
                        },
                        { throwOnError: true }
                    );
                    object.entityId = copy.id;
                } else {
                    return;
                }
            }
            addArtboard( object );
            if ( ! isEditing() ) {
                selectArtboard( object.id );
            }
        },
        [
            lookup,
            sizeOf,
            saveEntityRecord,
            addArtboard,
            selectArtboard,
            isEditing,
        ]
    );

    /**
     * A click on a row (decision D39): into the artboard in edit, or with
     * none in edit onto the board.
     */
    const onItemClick = useCallback(
        ( item ) => {
            if ( isEditing() ) {
                const blocks = blocksFor( item );
                if ( bridgeRef.current && blocks.length ) {
                    bridgeRef.current.insertBlocks( blocks );
                }
                return;
            }
            if ( KIND_OF[ item.type ] ) {
                openOnBoard( item, findSpace( sizeOf( item ) ) );
            }
        },
        [ isEditing, blocksFor, bridgeRef, openOnBoard, findSpace, sizeOf ]
    );

    const renderUpload = useCallback(
        ( button ) => (
            <MediaUpload
                allowedTypes={ [ 'image' ] }
                onSelect={ () =>
                    invalidateResolution( 'getEntityRecords', [
                        'postType',
                        'attachment',
                        MEDIA_QUERY,
                    ] )
                }
                onClose={ () =>
                    invalidateResolution( 'getEntityRecords', [
                        'postType',
                        'attachment',
                        MEDIA_QUERY,
                    ] )
                }
                render={ ( { open } ) =>
                    cloneElement( button, { onClick: open } )
                }
            />
        ),
        [ invalidateResolution ]
    );

    const onItemDragStart = useCallback(
        ( item, event ) => {
            dragged.current = item;
            if ( ! isEditing() ) {
                return;
            }
            // With an artboard in edit the drag carries the item's blocks as
            // markup, which the editor takes like any dropped HTML and
            // inserts where it is dropped.
            const blocks = blocksFor( item );
            if ( blocks.length ) {
                event.dataTransfer.setData( 'text/html', serialize( blocks ) );
            }
        },
        [ isEditing, blocksFor ]
    );
    const onItemDragEnd = useCallback( () => {
        dragged.current = null;
        setDropTarget( null );
    }, [] );

    // Only empty board takes a drop, and only with no artboard in edit.
    const isOverEmptyBoard = ( event ) =>
        !! dragged.current &&
        ! isEditing() &&
        event.dataTransfer?.types?.includes( DRAG_DATA_TYPE ) &&
        ! event.target.closest?.( '[data-wfd-artboard]' );

    const canvasDropProps = {
        onDragOver( event ) {
            if ( ! isOverEmptyBoard( event ) ) {
                setDropTarget( null );
                return;
            }
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
            const point = toBoard( event );
            setDropTarget( {
                kind: KIND_OF[ dragged.current.type ],
                name: dragged.current.name,
                x: point.x,
                y: point.y,
                // A media object has its own size.
                size: sizeOf( dragged.current ),
            } );
        },
        onDragLeave( event ) {
            if ( ! event.currentTarget.contains( event.relatedTarget ) ) {
                setDropTarget( null );
            }
        },
        async onDrop( event ) {
            if ( ! isOverEmptyBoard( event ) ) {
                return;
            }
            event.preventDefault();
            const item = dragged.current;
            const point = toBoard( event );
            dragged.current = null;
            setDropTarget( null );
            await openOnBoard( item, point );
        },
    };

    return {
        panelProps: {
            onItemClick,
            onItemDragStart,
            onItemDragEnd,
            renderUpload,
        },
        canvasDropProps,
        dropTarget,
    };
}
