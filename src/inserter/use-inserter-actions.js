/**
 * What happens when an inserter row is clicked or dropped on the board
 * (decision D19).
 */
import {
    cloneElement,
    useCallback,
    useRef,
    useState,
} from '@wordpress/element';
import { useDispatch, useRegistry } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import { createBlock, parse } from '@wordpress/blocks';
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
 * @return {Object} Handlers for the panel and the canvas.
 */
export function useInserterActions( { lookup, bridgeRef, toBoard } ) {
    const registry = useRegistry();
    const { saveEntityRecord, invalidateResolution } = useDispatch( coreStore );
    const { addArtboard, selectArtboard } = useDispatch( boardStore );
    const dragged = useRef( null );
    const [ dropTarget, setDropTarget ] = useState( null );

    const insert = useCallback(
        ( blocks ) => {
            if ( bridgeRef.current && blocks.length ) {
                bridgeRef.current.insertBlocks( blocks );
            }
        },
        [ bridgeRef ]
    );

    const onInsertBlock = useCallback(
        ( name ) => insert( [ createBlock( name ) ] ),
        [ insert ]
    );

    const onInsertPattern = useCallback(
        ( id ) => {
            const item = lookup.patterns.get( id );
            if ( ! item ) {
                return;
            }
            if ( item.record ) {
                // A user pattern: synced patterns are inserted by reference.
                const isUnsynced =
                    item.record.wp_pattern_sync_status === 'unsynced';
                insert(
                    isUnsynced
                        ? parse( item.record.content?.raw ?? '' )
                        : [
                              createBlock( 'core/block', {
                                  ref: item.record.id,
                              } ),
                          ]
                );
                return;
            }
            insert( parse( item.pattern.content ?? '' ) );
        },
        [ lookup, insert ]
    );

    const onInsertTemplatePart = useCallback(
        ( id ) => {
            const part = lookup.parts.get( id );
            if ( part ) {
                insert( [
                    createBlock( 'core/template-part', {
                        slug: part.slug,
                        theme: part.theme,
                    } ),
                ] );
            }
        },
        [ lookup, insert ]
    );

    const onInsertMedia = useCallback(
        ( id ) => {
            const image = lookup.images.get( id );
            if ( image ) {
                insert( [
                    createBlock( 'core/image', {
                        id: image.id,
                        url: image.source_url,
                        alt: image.alt_text ?? '',
                    } ),
                ] );
            }
        },
        [ lookup, insert ]
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

    const onItemDragStart = useCallback( ( item ) => {
        dragged.current = item;
    }, [] );
    const onItemDragEnd = useCallback( () => {
        dragged.current = null;
        setDropTarget( null );
    }, [] );

    // Only empty board takes a drop.
    const isOverEmptyBoard = ( event ) =>
        !! dragged.current &&
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
            const image =
                dragged.current.type === 'media'
                    ? lookup.images.get( dragged.current.id )
                    : null;
            setDropTarget( {
                kind: KIND_OF[ dragged.current.type ],
                name: dragged.current.name,
                x: point.x,
                y: point.y,
                // A media object has its own size.
                size: image
                    ? mediaSize(
                          image.media_details?.width,
                          image.media_details?.height
                      )
                    : null,
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
            const { x, y } = toBoard( event );
            dragged.current = null;
            setDropTarget( null );

            let entityId = item.id;
            if ( item.type === 'media' ) {
                // An image goes on the board as an object of its own size.
                const image = lookup.images.get( item.id );
                if ( ! image ) {
                    return;
                }
                const object = {
                    id: window.crypto.randomUUID(),
                    kind: 'media',
                    entityId: image.id,
                    x: Math.round( x ),
                    y: Math.round( y ),
                    ...mediaSize(
                        image.media_details?.width,
                        image.media_details?.height
                    ),
                };
                addArtboard( object );
                if ( ! registry.select( boardStore ).getLiveId() ) {
                    selectArtboard( object.id );
                }
                return;
            }
            if ( item.type === 'pattern' ) {
                const entry = lookup.patterns.get( item.id );
                if ( entry?.record ) {
                    entityId = entry.record.id;
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
                    entityId = copy.id;
                } else {
                    return;
                }
            }
            const artboard = {
                id: window.crypto.randomUUID(),
                kind: KIND_OF[ item.type ],
                entityId,
                device: 'desktop',
                x: Math.round( x ),
                y: Math.round( y ),
                height: NEW_ARTBOARD_HEIGHT,
            };
            addArtboard( artboard );
            if ( ! registry.select( boardStore ).getLiveId() ) {
                selectArtboard( artboard.id );
            }
        },
    };

    return {
        panelProps: {
            onInsertBlock,
            onInsertPattern,
            onInsertTemplatePart,
            onInsertMedia,
            onItemDragStart,
            onItemDragEnd,
            renderUpload,
        },
        canvasDropProps,
        dropTarget,
    };
}
