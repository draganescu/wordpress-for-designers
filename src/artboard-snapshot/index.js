/**
 * The Snapshot tier: a frozen copy of an artboard's last Preview render, with
 * no React root and no store subscription.
 *
 * Everything outside this file talks to snapshots through the store returned
 * by `createSnapshotStore` (capture, has, mount, isStale), so a bitmap
 * implementation can replace this one behind the same interface.
 */
import { useLayoutEffect, useRef } from '@wordpress/element';

// A frozen copy does not move: an animation left running in it, a theme's
// or a block's, would keep the board drawing for as long as the copy is
// shown (OQ-54). Each animation is taken to its end at once, not paused
// where it starts: the copy's document plays them from the beginning, and
// content that fades in would be frozen invisible.
const STILL =
    '*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; animation-iteration-count: 1 !important; }\n';

/**
 * Copies a rendered Preview with plain DOM calls. Each iframe is replaced by
 * a static one that holds the serialised document and its CSS, cannot run
 * scripts and has no animation running.
 *
 * @param {Element} preview The Preview's root element.
 * @return {Element} The frozen copy, not attached to the document.
 */
function freeze( preview ) {
    const copy = preview.cloneNode( true );
    const sources = preview.querySelectorAll( 'iframe' );
    const targets = copy.querySelectorAll( 'iframe' );
    sources.forEach( ( source, index ) => {
        const target = targets[ index ];
        const doc = source.contentDocument;
        if ( ! doc?.documentElement ) {
            target.remove();
            return;
        }
        let css = '';
        for ( const sheet of doc.styleSheets ) {
            try {
                for ( const rule of sheet.cssRules ) {
                    css += rule.cssText + '\n';
                }
            } catch {
                // A sheet from another origin: keep loading it by address.
                if ( sheet.href ) {
                    css += `@import url("${ sheet.href }");\n`;
                }
            }
        }
        const html = doc.documentElement.cloneNode( true );
        html.querySelectorAll(
            'script, style, link[rel="stylesheet"]'
        ).forEach( ( node ) => node.remove() );
        const style = doc.createElement( 'style' );
        style.textContent = css + STILL;
        html.querySelector( 'head' )?.appendChild( style );
        target.removeAttribute( 'src' );
        target.removeAttribute( 'name' );
        target.setAttribute( 'sandbox', 'allow-same-origin' );
        target.setAttribute( 'tabindex', '-1' );
        target.srcdoc = '<!DOCTYPE html>' + html.outerHTML;
    } );
    copy.classList.add( 'wfd-snapshot__copy' );
    return copy;
}

/**
 * Calls back once every iframe in a frozen copy has loaded its document.
 *
 * @param {Element}  node     The frozen copy.
 * @param {Function} callback Called once.
 */
function whenLoaded( node, callback ) {
    const iframes = [ ...node.querySelectorAll( 'iframe' ) ];
    let left = iframes.length;
    let isDone = false;
    const done = () => {
        if ( ! isDone ) {
            isDone = true;
            callback();
        }
    };
    if ( ! left ) {
        done();
        return;
    }
    iframes.forEach( ( iframe ) =>
        iframe.addEventListener(
            'load',
            () => {
                left -= 1;
                if ( ! left ) {
                    done();
                }
            },
            { once: true }
        )
    );
    // A copy that never loads is shown anyway.
    window.setTimeout( done, 2000 );
}

/**
 * Whether every document of a Preview had its blocks and style sheets when
 * it was copied. A copy taken earlier is taken again.
 *
 * @param {Element} preview The Preview's root element.
 * @return {boolean} Whether the copy is of the whole render.
 */
function isWhole( preview ) {
    return [ ...preview.querySelectorAll( 'iframe' ) ].every( ( iframe ) => {
        const doc = iframe.contentDocument;
        return (
            doc?.readyState === 'complete' &&
            doc.querySelector( '.is-root-container' ) &&
            [ ...doc.querySelectorAll( 'link[rel="stylesheet"]' ) ].every(
                ( link ) => link.sheet
            )
        );
    } );
}

export function createSnapshotStore() {
    const snapshots = new Map();
    return {
        /**
         * Freezes an artboard's Preview. A copy of the artboard that is on
         * screen is replaced where it is (decision D51).
         *
         * @param {string}  id      The artboard.
         * @param {Element} preview The Preview's root element.
         * @param {*}       version What the Preview was rendered from.
         * @return {boolean} Whether there was a Preview to freeze.
         */
        capture( id, preview, version ) {
            if ( ! preview?.querySelector( 'iframe' )?.contentDocument?.body ) {
                return false;
            }
            // A copy of what the Preview was rendered from is what it shows
            // already. Copying again costs a serialisation and a second load
            // on screen, which a zoom out did for every artboard.
            const current = snapshots.get( id );
            if ( current?.isWhole && current.version === version ) {
                return true;
            }
            const node = freeze( preview );
            const old = current?.node;
            snapshots.set( id, { node, version, isWhole: isWhole( preview ) } );
            if ( old?.isConnected ) {
                // An iframe shows nothing until its document has loaded, so
                // the copy on screen stays until the new one has.
                node.classList.add( 'is-loading' );
                old.after( node );
                whenLoaded( node, () => {
                    node.classList.remove( 'is-loading' );
                    old.remove();
                } );
            }
            return true;
        },
        has: ( id ) => snapshots.has( id ),
        /**
         * Whether shared things changed since the snapshot was taken.
         *
         * @param {string} id      The artboard.
         * @param {*}      version What a Preview would be rendered from now.
         * @return {boolean} True when the snapshot is out of date.
         */
        isStale: ( id, version ) =>
            snapshots.has( id ) && snapshots.get( id ).version !== version,
        /**
         * Puts an artboard's frozen copy in an element.
         *
         * @param {string}  id   The artboard.
         * @param {Element} host The element to fill.
         * @return {Function} Takes the copy out again.
         */
        mount( id, host ) {
            const snapshot = snapshots.get( id );
            if ( snapshot ) {
                snapshot.node.classList.remove( 'is-loading' );
                host.appendChild( snapshot.node );
            }
            return () => host.replaceChildren();
        },
        forget: ( id ) => snapshots.delete( id ),
    };
}

/**
 * Shows an artboard's frozen copy. React renders the empty host only.
 *
 * @param {Object}  props
 * @param {string}  props.id     The artboard.
 * @param {Object}  props.store  The snapshot store.
 * @param {boolean} props.isOver Whether it lies over the render that will replace it.
 */
export function ArtboardSnapshot( { id, store, isOver = false } ) {
    const host = useRef();
    useLayoutEffect( () => store.mount( id, host.current ), [ id, store ] );
    return (
        <div
            className={ 'wfd-snapshot' + ( isOver ? ' is-over' : '' ) }
            ref={ host }
        />
    );
}
