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
 * A URL as it is: what a browser does to the URLs it asks for and shows
 * unless it is told otherwise.
 *
 * @param {string} href The URL.
 * @return {string} The URL.
 */
const asItIs = ( href ) => href;

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
        url = new URL( href );
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
 * @param {string} path    The address, starting with a slash.
 * @param {string} homeUrl The site's home URL, ending with a slash.
 * @return {string} The URL.
 */
export function urlOf( path, homeUrl ) {
    return homeUrl + path.slice( 1 );
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
                const { homeUrl, decorateUrl } = latest.current;
                // A link to another site does nothing.
                const link = event.target.closest?.( 'a[href]' );
                if ( link && addressOf( link.href, homeUrl ) === null ) {
                    event.preventDefault();
                } else if ( link ) {
                    // A link is followed as every page is asked for, with
                    // no second request.
                    link.href = decorateUrl( link.href );
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
 * @param {Object}                   props
 * @param {string}                   props.path        The address to show.
 * @param {string}                   props.homeUrl     The site's home URL.
 * @param {boolean}                  props.isBrowsing  Whether the page takes input.
 * @param {(href: string) => string} props.decorateUrl Gives the URL a page is
 *                                                     asked for with, from its plain URL.
 * @param {(href: string) => string} props.plainUrl    Gives the URL an address
 *                                                     shows, from the one a page came with.
 * @param {number}                   props.reloadToken Reloads the page when it changes.
 * @param {Function}                 props.onNavigate  Called with the address the page is on.
 * @param {Function}                 props.onEscape    Called when Esc is pressed in the page.
 * @param {Function}                 props.onWheel     Gets Cmd/Ctrl + wheel events, with the
 *                                                     iframe, to zoom the board.
 */
export function ArtboardBrowser( {
    path,
    homeUrl,
    isBrowsing,
    decorateUrl = asItIs,
    plainUrl = asItIs,
    reloadToken,
    onNavigate,
    onEscape,
    onWheel,
} ) {
    const iframeRef = useRef();
    // The address the page is on, as last loaded.
    const current = useRef( null );
    const [ isLoaded, setLoaded ] = useState( false );
    const [ src ] = useState( () => decorateUrl( urlOf( path, homeUrl ) ) );
    // Where the page was scrolled to before a reload.
    const scrollBack = useRef( null );
    // Whether the page has been sent back once from a page that is off the
    // site or cannot be read.
    const hasGoneBack = useRef( false );
    // The address asked for again because its page came with another URL
    // than it is asked for with, so that it is asked for again only once.
    const askedAgain = useRef( null );
    const latest = useRef( {} );
    latest.current = {
        onNavigate,
        onEscape,
        onWheel,
        homeUrl,
        decorateUrl,
        plainUrl,
        path,
    };
    const [ listeners ] = useState( () =>
        createPageListeners( iframeRef, latest )
    );
    useEffect( () => {
        listeners.awaitDocument();
        return listeners.stop;
    }, [ listeners ] );

    // A new address from outside (typed in the address field) is gone to,
    // also while an earlier one is still loading.
    const asked = useRef( path );
    useEffect( () => {
        const frame = iframeRef.current;
        if ( asked.current === path ) {
            return;
        }
        asked.current = path;
        try {
            frame.contentWindow.location.assign(
                latest.current.decorateUrl( urlOf( path, homeUrl ) )
            );
        } catch {
            frame.src = latest.current.decorateUrl( urlOf( path, homeUrl ) );
        }
    }, [ path, homeUrl ] );

    const firstReload = useRef( reloadToken );
    useEffect( () => {
        if ( firstReload.current === reloadToken ) {
            return;
        }
        firstReload.current = reloadToken;
        const frame = iframeRef.current;
        const { homeUrl: home, decorateUrl: decorate } = latest.current;
        hasGoneBack.current = false;
        let href = null;
        try {
            const view = frame.contentWindow;
            href = view.location.href;
            // A reload keeps the page where it was scrolled to.
            scrollBack.current = { x: view.scrollX, y: view.scrollY };
        } catch {
            href = null;
        }
        if (
            href === null ||
            addressOf( latest.current.plainUrl( href ), home ) === null
        ) {
            // No page of the site is there yet, or it cannot be read: the
            // address last asked for is asked for again.
            frame.src = decorate( urlOf( asked.current, home ) );
        } else if ( decorate( href ) === href ) {
            frame.contentWindow.location.reload();
        } else {
            frame.contentWindow.location.replace( decorate( href ) );
        }
        listeners.awaitDocument();
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
        const { homeUrl: home, decorateUrl: decorate } = latest.current;
        let doc;
        let href;
        try {
            doc = frame.contentDocument;
            href = frame.contentWindow.location.href;
        } catch {
            doc = null;
        }
        const address = doc
            ? addressOf( latest.current.plainUrl( href ), home )
            : null;
        if ( address === null ) {
            // Off the site, or a page that cannot be read: back to the page
            // it was on, once. If that fails too it stays on what loaded,
            // and is not asked for again and again.
            if ( hasGoneBack.current ) {
                setLoaded( true );
                return;
            }
            hasGoneBack.current = true;
            frame.src = decorate( urlOf( current.current ?? '/', home ) );
            listeners.awaitDocument();
            return;
        }
        hasGoneBack.current = false;
        listeners.prepare( doc );
        const wanted = decorate( href );
        if ( wanted !== href && askedAgain.current !== address ) {
            // The page came with another URL than it is asked for with (a
            // form, a redirect, a script): it is asked for again, once.
            askedAgain.current = address;
            frame.contentWindow.location.replace( wanted );
            return;
        }
        if ( wanted === href ) {
            askedAgain.current = null;
        }
        current.current = address;
        asked.current = address;
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
