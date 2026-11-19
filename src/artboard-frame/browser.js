/**
 * A browser on the board (D48): the site's front end in a window at the
 * device width, as visitors see it, as tall as the browser's height (D49).
 */
import { useEffect, useRef, useState } from '@wordpress/element';
import { Skeleton } from '@wordpress/ui';

/**
 * WordPress's toolbar is not shown in a browser.
 */
const PAGE_CSS =
    '#wpadminbar { display: none !important; } html { margin-top: 0 !important; }';

/**
 * The query argument that asks for a page with the board's unsaved changes
 * (D50).
 */
const PREVIEW_ARG = 'wfd_preview';

/**
 * A URL with or without the preview argument.
 *
 * @param {string}  href      The URL.
 * @param {boolean} isPreview Whether it asks for unsaved changes.
 * @return {string} The URL.
 */
function withPreview( href, isPreview ) {
    const url = new URL( href );
    if ( isPreview ) {
        url.searchParams.set( PREVIEW_ARG, '1' );
    } else {
        url.searchParams.delete( PREVIEW_ARG );
    }
    return url.href;
}

/**
 * The address of a URL relative to the site's home, or null when the URL is
 * not on the site.
 *
 * @param {string} href    The URL.
 * @param {string} homeUrl The site's home URL, ending with a slash.
 * @return {string|null} The address, starting with a slash.
 */
export function addressOf( href, homeUrl ) {
    if ( typeof href !== 'string' || ! href.startsWith( homeUrl ) ) {
        return null;
    }
    // The preview argument is not part of the address.
    return '/' + withPreview( href, false ).slice( homeUrl.length );
}

/**
 * An address as typed: it always starts with a slash.
 *
 * @param {string} typed The typed address.
 * @return {string} The address.
 */
export function normalizeAddress( typed ) {
    const trimmed = typed.trim();
    return trimmed.startsWith( '/' ) ? trimmed : '/' + trimmed;
}

/**
 * The URL of an address on the site.
 *
 * @param {string}  path      The address, starting with a slash.
 * @param {string}  homeUrl   The site's home URL, ending with a slash.
 * @param {boolean} isPreview Whether it asks for unsaved changes (D50).
 * @return {string} The URL.
 */
export function urlOf( path, homeUrl, isPreview = false ) {
    return withPreview( homeUrl + path.slice( 1 ), isPreview );
}

/**
 * @param {Object}   props
 * @param {string}   props.path        The address to show.
 * @param {string}   props.homeUrl     The site's home URL.
 * @param {boolean}  props.isBrowsing  Whether the page takes input.
 * @param {boolean}  props.isPreview   Whether it shows unsaved changes (D50).
 * @param {number}   props.reloadToken Reloads the page when it changes.
 * @param {Function} props.onNavigate  Called with the address the page is on.
 * @param {Function} props.onEscape    Called when Esc is pressed in the page.
 * @param {Function} props.onWheel     Gets Cmd/Ctrl + wheel events, with the
 *                                     iframe, to zoom the board.
 */
export function ArtboardBrowser( {
    path,
    homeUrl,
    isBrowsing,
    isPreview = false,
    reloadToken,
    onNavigate,
    onEscape,
    onWheel,
} ) {
    const iframeRef = useRef();
    // The address the page is on, as last loaded.
    const current = useRef( null );
    const [ isLoaded, setLoaded ] = useState( false );
    const [ src ] = useState( () => urlOf( path, homeUrl, isPreview ) );
    // Where the page was scrolled to before a reload.
    const scrollBack = useRef( null );
    const latest = useRef( {} );
    latest.current = { onNavigate, onEscape, onWheel, homeUrl, isPreview };

    // A new address from outside (typed in the address field) is gone to.
    useEffect( () => {
        const frame = iframeRef.current;
        if ( current.current === null || current.current === path ) {
            return;
        }
        try {
            frame.contentWindow.location.assign(
                urlOf( path, homeUrl, latest.current.isPreview )
            );
        } catch {
            frame.src = urlOf( path, homeUrl, latest.current.isPreview );
        }
    }, [ path, homeUrl ] );

    const firstReload = useRef( reloadToken );
    useEffect( () => {
        if ( firstReload.current === reloadToken ) {
            return;
        }
        firstReload.current = reloadToken;
        try {
            const view = iframeRef.current.contentWindow;
            // A reload keeps the page where it was scrolled to.
            scrollBack.current = { x: view.scrollX, y: view.scrollY };
            view.location.reload();
        } catch {
            // The page is not reachable; the next load shows it again.
        }
    }, [ reloadToken ] );

    // Outside browsing the page takes no input; it stays where it was
    // scrolled to (D49).
    useEffect( () => {
        if ( isBrowsing ) {
            iframeRef.current.removeAttribute( 'inert' );
        } else {
            iframeRef.current.setAttribute( 'inert', '' );
        }
    }, [ isBrowsing ] );

    function onLoad() {
        const frame = iframeRef.current;
        const { homeUrl: home, isPreview: preview } = latest.current;
        let doc;
        let href;
        try {
            doc = frame.contentDocument;
            href = frame.contentWindow.location.href;
        } catch {
            doc = null;
        }
        const address = doc ? addressOf( href, home ) : null;
        if ( address === null ) {
            // Off the site: back to the page it was on.
            frame.src = urlOf( current.current ?? '/', home, preview );
            return;
        }
        current.current = address;
        setLoaded( true );
        if ( scrollBack.current ) {
            frame.contentWindow.scrollTo(
                scrollBack.current.x,
                scrollBack.current.y
            );
            scrollBack.current = null;
        }
        const style = doc.createElement( 'style' );
        style.textContent = PAGE_CSS;
        doc.head?.appendChild( style );
        doc.addEventListener(
            'click',
            ( event ) => {
                // A link to another site does nothing.
                const link = event.target.closest?.( 'a[href]' );
                if ( link && addressOf( link.href, home ) === null ) {
                    event.preventDefault();
                } else if ( link && preview ) {
                    // A link followed keeps showing unsaved changes.
                    link.href = withPreview( link.href, true );
                }
            },
            true
        );
        if ( preview ) {
            doc.addEventListener(
                'submit',
                ( event ) => {
                    const form = event.target;
                    if (
                        ! form.querySelector?.( `[name="${ PREVIEW_ARG }"]` )
                    ) {
                        const field = doc.createElement( 'input' );
                        field.type = 'hidden';
                        field.name = PREVIEW_ARG;
                        field.value = '1';
                        form.appendChild( field );
                    }
                },
                true
            );
        }
        doc.addEventListener( 'keydown', ( event ) => {
            if ( event.key === 'Escape' && ! event.defaultPrevented ) {
                latest.current.onEscape();
            }
        } );
        doc.addEventListener(
            'wheel',
            ( event ) => {
                // Cmd/Ctrl + wheel zooms the board; the plain wheel scrolls
                // the page.
                if ( event.ctrlKey || event.metaKey ) {
                    latest.current.onWheel( event, frame );
                }
            },
            { passive: false }
        );
        latest.current.onNavigate( address );
    }

    return (
        <>
            <iframe
                ref={ iframeRef }
                className="wfd-browser"
                src={ src }
                title={ path }
                onLoad={ onLoad }
            />
            { ! isLoaded && <Skeleton className="wfd-artboard__skeleton" /> }
        </>
    );
}
