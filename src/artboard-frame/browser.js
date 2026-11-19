/**
 * A browser on the board (D48): the site's front end in a window at the
 * device width, as visitors see it.
 */
import { useEffect, useRef, useState } from '@wordpress/element';
import { Skeleton } from '@wordpress/ui';

/**
 * WordPress's toolbar is not shown in a browser.
 */
const PAGE_CSS =
    '#wpadminbar { display: none !important; } html { margin-top: 0 !important; }';

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
    return '/' + href.slice( homeUrl.length );
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
 * @param {string} path    The address, starting with a slash.
 * @param {string} homeUrl The site's home URL, ending with a slash.
 * @return {string} The URL.
 */
export function urlOf( path, homeUrl ) {
    return homeUrl + path.slice( 1 );
}

/**
 * @param {Object}   props
 * @param {string}   props.path        The address to show.
 * @param {string}   props.homeUrl     The site's home URL.
 * @param {boolean}  props.isBrowsing  Whether the page takes input.
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
    reloadToken,
    onNavigate,
    onEscape,
    onWheel,
} ) {
    const iframeRef = useRef();
    // The address the page is on, as last loaded.
    const current = useRef( null );
    const [ isLoaded, setLoaded ] = useState( false );
    const [ src ] = useState( () => urlOf( path, homeUrl ) );
    const latest = useRef( {} );
    latest.current = { onNavigate, onEscape, onWheel, homeUrl };

    // A new address from outside (typed in the address field) is gone to.
    useEffect( () => {
        const frame = iframeRef.current;
        if ( current.current === null || current.current === path ) {
            return;
        }
        try {
            frame.contentWindow.location.assign( urlOf( path, homeUrl ) );
        } catch {
            frame.src = urlOf( path, homeUrl );
        }
    }, [ path, homeUrl ] );

    const firstReload = useRef( reloadToken );
    useEffect( () => {
        if ( firstReload.current === reloadToken ) {
            return;
        }
        firstReload.current = reloadToken;
        try {
            iframeRef.current.contentWindow.location.reload();
        } catch {
            // The page is not reachable; the next load shows it again.
        }
    }, [ reloadToken ] );

    // Outside browsing the page takes no input and shows its top.
    useEffect( () => {
        const frame = iframeRef.current;
        if ( isBrowsing ) {
            frame.removeAttribute( 'inert' );
            return;
        }
        frame.setAttribute( 'inert', '' );
        try {
            frame.contentWindow.scrollTo( 0, 0 );
        } catch {
            // Nothing to scroll yet.
        }
    }, [ isBrowsing ] );

    function onLoad() {
        const frame = iframeRef.current;
        const { homeUrl: home } = latest.current;
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
            frame.src = urlOf( current.current ?? '/', home );
            return;
        }
        current.current = address;
        setLoaded( true );
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
                }
            },
            true
        );
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
