/**
 * A browser on the board (D55): the site's front end in a window at the
 * device width, as visitors see it, as tall as the browser's height (D56).
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
 * (D57). Its value is a nonce the server gives.
 */
const PREVIEW_ARG = 'wfd_preview';

/**
 * A URL with or without the preview argument.
 *
 * @param {string}      href    The URL.
 * @param {string|null} preview The argument's value, or null for none.
 * @return {string} The URL.
 */
function withPreview( href, preview ) {
    const url = new URL( href );
    if ( ( url.searchParams.get( PREVIEW_ARG ) ?? null ) === preview ) {
        // Left exactly as it is.
        return href;
    }
    if ( preview ) {
        url.searchParams.set( PREVIEW_ARG, preview );
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
    let url;
    let home;
    try {
        // The preview argument is not part of the address.
        url = new URL( withPreview( href, null ) );
        home = new URL( homeUrl );
    } catch {
        return null;
    }
    if (
        url.origin !== home.origin ||
        ! url.pathname.startsWith( home.pathname )
    ) {
        return null;
    }
    return (
        '/' +
        ( url.pathname + url.search + url.hash ).slice( home.pathname.length )
    );
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
 * @param {string}      path    The address, starting with a slash.
 * @param {string}      homeUrl The site's home URL, ending with a slash.
 * @param {string|null} preview The preview argument's value, to ask for
 *                              unsaved changes (D57).
 * @return {string} The URL.
 */
export function urlOf( path, homeUrl, preview = null ) {
    return withPreview( homeUrl + path.slice( 1 ), preview );
}

/**
 * The listeners of a browser's page. Each document the window loads gets
 * them as soon as it is there, before it has loaded, so that a link pressed
 * early is handled like any other.
 *
 * @param {Object} iframeRef Ref of the iframe.
 * @param {Object} latest    Ref of the component's latest props.
 * @return {Object} `prepare( doc )`, `awaitDocument()` and `stop()`.
 */
function createPageListeners( iframeRef, latest ) {
    // The document that has the listeners, and the frame request of the
    // wait for the next one.
    let prepared = null;
    let waiting = null;

    function prepare( doc ) {
        if ( prepared === doc ) {
            return;
        }
        prepared = doc;
        const frame = iframeRef.current;
        const addStyle = () => {
            const style = doc.createElement( 'style' );
            style.textContent = PAGE_CSS;
            doc.head?.appendChild( style );
        };
        if ( doc.readyState === 'loading' ) {
            doc.addEventListener( 'DOMContentLoaded', addStyle );
        } else {
            addStyle();
        }
        doc.addEventListener(
            'click',
            ( event ) => {
                const { homeUrl, preview } = latest.current;
                // A link to another site does nothing.
                const link = event.target.closest?.( 'a[href]' );
                if ( link && addressOf( link.href, homeUrl ) === null ) {
                    event.preventDefault();
                } else if ( link && preview ) {
                    // A link followed keeps showing unsaved changes, with
                    // no second request.
                    link.href = withPreview( link.href, preview );
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
        doc.defaultView.addEventListener( 'pagehide', awaitDocument );
    }

    function awaitDocument() {
        const view = iframeRef.current?.ownerDocument.defaultView;
        if ( ! view || waiting !== null ) {
            return;
        }
        const since = Date.now();
        const look = () => {
            waiting = null;
            let doc = null;
            try {
                doc = iframeRef.current?.contentDocument;
                if ( doc?.location.href === 'about:blank' ) {
                    doc = null;
                }
            } catch {
                doc = null;
            }
            if ( doc && doc !== prepared ) {
                prepare( doc );
            } else if ( iframeRef.current && Date.now() - since < 10000 ) {
                // A page slower than that gets them when it has loaded.
                waiting = view.requestAnimationFrame( look );
            }
        };
        waiting = view.requestAnimationFrame( look );
    }

    function stop() {
        if ( waiting !== null ) {
            iframeRef.current?.ownerDocument.defaultView.cancelAnimationFrame(
                waiting
            );
            waiting = null;
        }
    }

    return { prepare, awaitDocument, stop };
}

/**
 * @param {Object}   props
 * @param {string}   props.path        The address to show.
 * @param {string}   props.homeUrl     The site's home URL.
 * @param {boolean}  props.isBrowsing  Whether the page takes input.
 * @param {string}   props.preview     The preview argument's value when it
 *                                     shows unsaved changes (D57).
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
    preview = null,
    reloadToken,
    onNavigate,
    onEscape,
    onWheel,
} ) {
    const iframeRef = useRef();
    // The address the page is on, as last loaded.
    const current = useRef( null );
    const [ isLoaded, setLoaded ] = useState( false );
    const [ src ] = useState( () => urlOf( path, homeUrl, preview ) );
    // Where the page was scrolled to before a reload.
    const scrollBack = useRef( null );
    // Whether the page has been sent back once from a page that is off the
    // site or cannot be read.
    const hasGoneBack = useRef( false );
    // The address asked for again because it came without the preview
    // argument, so that it is asked for again only once.
    const askedAgain = useRef( null );
    const latest = useRef( {} );
    latest.current = {
        onNavigate,
        onEscape,
        onWheel,
        homeUrl,
        preview,
        path,
    };
    const [ listeners ] = useState( () =>
        createPageListeners( iframeRef, latest )
    );
    useEffect( () => {
        listeners.awaitDocument();
        return listeners.stop;
    }, [ listeners ] );

    // A new address from outside (typed in the address field) is gone to.
    useEffect( () => {
        const frame = iframeRef.current;
        if ( current.current === null || current.current === path ) {
            return;
        }
        try {
            frame.contentWindow.location.assign(
                urlOf( path, homeUrl, latest.current.preview )
            );
        } catch {
            frame.src = urlOf( path, homeUrl, latest.current.preview );
        }
    }, [ path, homeUrl ] );

    const firstReload = useRef( reloadToken );
    useEffect( () => {
        if ( firstReload.current === reloadToken ) {
            return;
        }
        firstReload.current = reloadToken;
        const frame = iframeRef.current;
        hasGoneBack.current = false;
        try {
            const view = frame.contentWindow;
            // A reload keeps the page where it was scrolled to.
            scrollBack.current = { x: view.scrollX, y: view.scrollY };
            const href = view.location.href;
            const wanted = withPreview( href, latest.current.preview );
            if ( wanted === href ) {
                view.location.reload();
            } else {
                view.location.replace( wanted );
            }
            listeners.awaitDocument();
        } catch {
            // The page cannot be read: its address is asked for again.
            frame.src = urlOf(
                current.current ?? latest.current.path,
                latest.current.homeUrl,
                latest.current.preview
            );
        }
    }, [ reloadToken, listeners ] );

    // Outside browsing the page takes no input; it stays where it was
    // scrolled to (D56).
    useEffect( () => {
        if ( isBrowsing ) {
            iframeRef.current.removeAttribute( 'inert' );
        } else {
            iframeRef.current.setAttribute( 'inert', '' );
        }
    }, [ isBrowsing ] );

    function onLoad() {
        listeners.stop();
        const frame = iframeRef.current;
        const { homeUrl: home, preview: value } = latest.current;
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
            // Off the site, or a page that cannot be read: back to the page
            // it was on, once. If that fails too it stays on what loaded,
            // and is not asked for again and again.
            if ( hasGoneBack.current ) {
                setLoaded( true );
                return;
            }
            hasGoneBack.current = true;
            frame.src = urlOf( current.current ?? '/', home, value );
            listeners.awaitDocument();
            return;
        }
        hasGoneBack.current = false;
        listeners.prepare( doc );
        const wanted = withPreview( href, value );
        if ( wanted !== href && askedAgain.current !== address ) {
            // The page came without the preview argument, or with an old
            // one (a form, a redirect, a script): it is asked for again
            // with it, once.
            askedAgain.current = address;
            frame.contentWindow.location.replace( wanted );
            return;
        }
        if ( wanted === href ) {
            askedAgain.current = null;
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
        latest.current.onNavigate( address );
    }

    return (
        <>
            <iframe
                ref={ iframeRef }
                className="wfd-browser"
                // The page cannot move the board itself to another address
                // or open windows.
                sandbox="allow-same-origin allow-scripts allow-forms"
                src={ src }
                title={ path }
                onLoad={ onLoad }
            />
            { ! isLoaded && <Skeleton className="wfd-artboard__skeleton" /> }
        </>
    );
}
