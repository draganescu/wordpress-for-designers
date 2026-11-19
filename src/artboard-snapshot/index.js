/**
 * The Snapshot tier: a frozen copy of an artboard's last Preview render, with
 * no React root and no store subscription.
 *
 * Everything outside this file talks to snapshots through the store returned
 * by `createSnapshotStore` (capture, has, mount, isStale), so a bitmap
 * implementation can replace this one behind the same interface.
 */
import { useLayoutEffect, useRef } from '@wordpress/element';

/**
 * Copies a rendered Preview with plain DOM calls. Each iframe is replaced by
 * a static one that holds the serialised document and its CSS, and cannot
 * run scripts.
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
        style.textContent = css;
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

export function createSnapshotStore() {
    const snapshots = new Map();
    return {
        /**
         * Freezes an artboard's Preview.
         *
         * @param {string}  id      The artboard.
         * @param {Element} preview The Preview's root element.
         * @param {*}       version What the Preview was rendered from.
         */
        capture( id, preview, version ) {
            if ( preview?.querySelector( 'iframe' )?.contentDocument?.body ) {
                snapshots.set( id, { node: freeze( preview ), version } );
            }
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
            if ( ! snapshot ) {
                return () => {};
            }
            host.appendChild( snapshot.node );
            return () => snapshot.node.remove();
        },
        forget: ( id ) => snapshots.delete( id ),
    };
}

/**
 * Shows an artboard's frozen copy. React renders the empty host only.
 *
 * @param {Object} props
 * @param {string} props.id    The artboard.
 * @param {Object} props.store The snapshot store.
 */
export function ArtboardSnapshot( { id, store } ) {
    const host = useRef();
    useLayoutEffect( () => store.mount( id, host.current ), [ id, store ] );
    return <div className="wfd-snapshot" ref={ host } />;
}
