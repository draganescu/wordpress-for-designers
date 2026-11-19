/**
 * The client side of the preview of unsaved changes (D57), all of it: the
 * hook that sends the board's unsaved changes to the preview route about one
 * second after the last change, while any browser shows them, and the two
 * functions a browser needs to ask for its pages with them. Nothing else in
 * the app knows the preview argument, its value or the route; they come from
 * includes/preview.php, the server side. When WordPress can show unsaved
 * edits on the front end by itself, these two files go.
 */
import apiFetch from '@wordpress/api-fetch';
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from '@wordpress/element';
import { useRegistry } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import { serialize } from '@wordpress/blocks';
import { store as boardStore } from '../board-store';
import { getDirtyEntityRecords } from '../adapter/experimental';
import { changedEntries, rawContent } from '../review/entries';

const DELAY = 1000;
// The server keeps what a board page sent for an hour after its last send
// (includes/preview.php); unsaved changes are sent again well inside that.
const RESEND_AFTER = 10 * 60 * 1000;
// A send that failed is tried again after 2 seconds, then 4, 8 and so on,
// up to a minute.
const LONGEST_RETRY = 60 * 1000;

/**
 * A URL with the preview argument holding a value, or without the argument.
 * A URL that is already so is given back exactly as it is.
 *
 * @param {string}      href  The URL.
 * @param {string}      arg   The argument's name.
 * @param {string|null} value The argument's value, or null for none.
 * @return {string} The URL.
 */
function withArg( href, arg, value ) {
    const url = new URL( href );
    if ( ( url.searchParams.get( arg ) ?? null ) === value ) {
        return href;
    }
    if ( value ) {
        url.searchParams.set( arg, value );
    } else {
        url.searchParams.delete( arg );
    }
    return url.href;
}

function textOf( value ) {
    return typeof value === 'string' ? value : ( value?.raw ?? '' );
}

function contentOf( record ) {
    if ( typeof record.content === 'function' ) {
        return record.content( record );
    }
    return Array.isArray( record.blocks )
        ? serialize( record.blocks )
        : rawContent( record );
}

/**
 * Every unsaved change Review lists, in the preview route's shape.
 *
 * @param {Object} registry The data registry.
 * @return {Object} `posts`, `templates`, `styles` and `site`.
 */
function previewChanges( registry ) {
    const core = registry.select( coreStore );
    const changes = { posts: {}, templates: {}, styles: null, site: null };
    for ( const entry of changedEntries( registry.select ) ) {
        const record = entry.edited;
        if ( ! record ) {
            continue;
        }
        const edits = entry.isNew
            ? {}
            : ( core.getEntityRecordEdits( entry.kind, entry.name, entry.id ) ??
              {} );
        switch ( entry.type ) {
            case 'page':
            case 'pattern':
            case 'navigation':
                changes.posts[ entry.id ] = {
                    title: textOf( record.title ),
                    content: contentOf( record ),
                    ...( 'template' in edits && {
                        template: record.template ?? '',
                    } ),
                };
                break;
            case 'template':
            case 'template-part':
                changes.templates[ entry.id ] = {
                    postType: entry.name,
                    slug: record.slug ?? String( entry.id ).split( '//' )[ 1 ],
                    title: textOf( record.title ),
                    content: contentOf( record ),
                    area: record.area ?? '',
                };
                break;
            case 'styles':
                changes.styles = {
                    styles: record.styles ?? {},
                    settings: record.settings ?? {},
                };
                break;
            case 'site':
                changes.site = {};
                for ( const field of [ 'title', 'description', 'site_logo' ] ) {
                    if ( field in edits ) {
                        changes.site[ field ] = record[ field ];
                    }
                }
        }
    }
    return changes;
}

/**
 * Sends the unsaved changes, and says how a browser asks for them. Used once,
 * by the app.
 *
 * @return {Object} `version`: 0 until the first send has been answered or has
 *                  failed, then one more each time browsers showing unsaved
 *                  changes should reload; `decorateUrl( href )`: the URL that
 *                  asks for a page with the unsaved changes; `plainUrl( href )`:
 *                  that URL as an address shows it.
 */
export function usePreview() {
    const registry = useRegistry();
    const { arg, value: firstValue, path } = window.wfdConfig.preview;
    // What the preview argument holds: a nonce of this user and the name of
    // this board page. The server gives a new one with each answer.
    const value = useRef( firstValue );
    const [ version, setVersion ] = useState( 0 );
    const decorateUrl = useCallback(
        ( href ) => withArg( href, arg, value.current ),
        [ arg ]
    );
    const plainUrl = useCallback(
        ( href ) => withArg( href, arg, null ),
        [ arg ]
    );

    useEffect( () => {
        let timer = null;
        let sent = null;
        let sentAt = 0;
        let isSending = false;
        let failures = 0;
        let retryAt = 0;
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
                    path,
                    method: 'POST',
                    data: { ...JSON.parse( json ), preview: value.current },
                } );
                value.current = preview;
                sentAt = Date.now();
                failures = 0;
                retryAt = 0;
                // Browsers reload when the changes are new, or the server
                // had stopped keeping them.
                if ( json !== sent || ! held ) {
                    setVersion( ( current ) => current + 1 );
                }
                sent = json;
            } catch {
                failures++;
                retryAt =
                    Date.now() +
                    Math.min( LONGEST_RETRY, DELAY * 2 ** failures );
                if ( sent === null && failures === 1 ) {
                    // Browsers waiting for the first send load the site as
                    // it is saved rather than wait for ever.
                    setVersion( 1 );
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
                    ( artboard ) => artboard.shows === 'unsaved'
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
    }, [ registry, path ] );

    return useMemo(
        () => ( { version, decorateUrl, plainUrl } ),
        [ version, decorateUrl, plainUrl ]
    );
}
