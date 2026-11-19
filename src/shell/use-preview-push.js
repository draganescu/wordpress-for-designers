/**
 * Sends the board's unsaved changes to the preview route while any browser
 * shows unsaved changes (D57), about one second after the last change.
 */
import apiFetch from '@wordpress/api-fetch';
import { useEffect } from '@wordpress/element';
import { useRegistry } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import { serialize } from '@wordpress/blocks';
import { store as boardStore } from '../board-store';
import { getDirtyEntityRecords } from '../adapter/experimental';

const DELAY = 1000;
// The server keeps what a board page sent for an hour after its last send
// (includes/preview.php); unsaved changes are sent again well inside that.
const RESEND_AFTER = 10 * 60 * 1000;
// A send that failed is tried again after 2 seconds, then 4, 8 and so on,
// up to a minute.
const LONGEST_RETRY = 60 * 1000;
const POST_TYPES = [ 'page', 'post', 'wp_block', 'wp_navigation' ];
const TEMPLATE_TYPES = [ 'wp_template', 'wp_template_part' ];

function textOf( value ) {
    if ( typeof value === 'string' ) {
        return value;
    }
    return value?.raw ?? '';
}

function contentOf( record ) {
    if ( typeof record?.content === 'function' ) {
        return record.content( record );
    }
    if ( Array.isArray( record?.blocks ) ) {
        return serialize( record.blocks );
    }
    return textOf( record?.content );
}

/**
 * Every unsaved change Review would list, in the preview route's shape.
 *
 * @param {Object} registry The data registry.
 * @return {Object} `posts`, `templates`, `styles` and `site`.
 */
export function previewChanges( registry ) {
    const select = registry.select;
    const core = select( coreStore );
    const changes = { posts: {}, templates: {}, styles: null, site: null };
    const addTemplate = ( postType, id, record ) => {
        changes.templates[ id ] = {
            postType,
            slug: record.slug ?? String( id ).split( '//' )[ 1 ],
            title: textOf( record.title ),
            content: contentOf( record ),
            area: record.area ?? '',
        };
    };
    for ( const dirty of getDirtyEntityRecords( select ) ?? [] ) {
        const record = core.getEditedEntityRecord(
            dirty.kind,
            dirty.name,
            dirty.key
        );
        if ( ! record ) {
            continue;
        }
        const edits =
            core.getEntityRecordEdits( dirty.kind, dirty.name, dirty.key ) ??
            {};
        if ( dirty.kind === 'postType' && POST_TYPES.includes( dirty.name ) ) {
            const post = {
                title: textOf( record.title ),
                content: contentOf( record ),
            };
            if ( 'template' in edits ) {
                post.template = record.template ?? '';
            }
            changes.posts[ dirty.key ] = post;
        } else if (
            dirty.kind === 'postType' &&
            TEMPLATE_TYPES.includes( dirty.name )
        ) {
            addTemplate( dirty.name, dirty.key, record );
        } else if ( dirty.kind === 'root' && dirty.name === 'globalStyles' ) {
            changes.styles = {
                styles: record.styles ?? {},
                settings: record.settings ?? {},
            };
        } else if ( dirty.kind === 'root' && dirty.name === 'site' ) {
            changes.site = {};
            for ( const field of [ 'title', 'description', 'site_logo' ] ) {
                if ( field in edits ) {
                    changes.site[ field ] = record[ field ];
                }
            }
        }
    }
    // New templates and parts, not saved yet.
    for ( const artboard of select( boardStore ).getArtboards() ) {
        if ( artboard.draft ) {
            const record = core.getEditedEntityRecord(
                'postType',
                artboard.draft.postType,
                artboard.entityId
            );
            if ( record ) {
                addTemplate( artboard.draft.postType, artboard.entityId, {
                    ...record,
                    slug: artboard.draft.slug,
                } );
            }
        }
    }
    return changes;
}

export function usePreviewPush() {
    const registry = useRegistry();
    useEffect( () => {
        let timer = null;
        let sent = null;
        let sentAt = 0;
        let isSending = false;
        let failures = 0;
        let retryAt = 0;
        // What the preview argument holds; it names this board page.
        let value = window.wfdConfig.preview;
        // What the last look at the stores saw. The changes are put together
        // again only when one of these is different.
        let isWanted = false;
        let seenDirty = null;
        let seenArtboards = null;
        let seenDrafts = '';

        function sendIn( delay ) {
            clearTimeout( timer );
            timer = setTimeout( send, Math.max( delay, retryAt - Date.now() ) );
        }

        async function send() {
            timer = null;
            if ( ! isWanted ) {
                return;
            }
            if ( isSending ) {
                sendIn( DELAY );
                return;
            }
            const changes = previewChanges( registry );
            const json = JSON.stringify( changes );
            const isEmpty =
                ! Object.keys( changes.posts ).length &&
                ! Object.keys( changes.templates ).length &&
                ! changes.styles &&
                ! changes.site;
            // The same changes are sent again only to keep them kept.
            const isDue = ! isEmpty && Date.now() - sentAt > RESEND_AFTER;
            if ( json === sent && ! isDue ) {
                return;
            }
            isSending = true;
            try {
                const { preview, held } = await apiFetch( {
                    path: '/wfd/v1/preview',
                    method: 'POST',
                    data: { ...JSON.parse( json ), preview: value },
                } );
                value = preview;
                sentAt = Date.now();
                failures = 0;
                retryAt = 0;
                // Browsers reload when the changes are new, or the server
                // had stopped keeping them.
                const isSent = json !== sent || ! held;
                sent = json;
                registry.dispatch( boardStore ).setPreview( preview, isSent );
            } catch {
                failures++;
                retryAt =
                    Date.now() +
                    Math.min( LONGEST_RETRY, DELAY * 2 ** failures );
                if ( sent === null && failures === 1 ) {
                    // Browsers waiting for the first send load the site as
                    // it is saved rather than wait for ever.
                    registry.dispatch( boardStore ).setPreview( value, true );
                }
                sendIn( 0 );
            }
            isSending = false;
        }

        const look = () => {
            const dirty = getDirtyEntityRecords( registry.select );
            const artboards = registry.select( boardStore ).getArtboards();
            let hasChanged = dirty !== seenDirty;
            seenDirty = dirty;
            if ( artboards !== seenArtboards ) {
                seenArtboards = artboards;
                const wasWanted = isWanted;
                isWanted = artboards.some(
                    ( artboard ) =>
                        artboard.kind === 'browser' &&
                        artboard.shows === 'unsaved'
                );
                // New templates and parts are found through their artboards.
                const drafts = artboards
                    .filter( ( artboard ) => artboard.draft )
                    .map( ( artboard ) => artboard.entityId )
                    .join();
                hasChanged ||= drafts !== seenDrafts;
                seenDrafts = drafts;
                if ( isWanted && ! wasWanted ) {
                    // At once, so the browsers can load.
                    sendIn( 0 );
                    return;
                }
            }
            if ( hasChanged && isWanted ) {
                sendIn( DELAY );
            }
        };
        look();
        const unsubscribe = registry.subscribe( look );
        const resend = setInterval( () => {
            if ( isWanted && ! timer ) {
                send();
            }
        }, RESEND_AFTER );
        return () => {
            unsubscribe();
            clearTimeout( timer );
            clearInterval( resend );
        };
    }, [ registry ] );
}
