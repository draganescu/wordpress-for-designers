import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { BASE, POST } from './lib.mjs';

export const DIR = 'spikes/diag-oq2/';
export const cli = ( cmd ) => {
    try {
        return execSync(
            `docker exec wp-env-wordpress-for-designers-fededb01-cli-1 ${ cmd }`,
            { stdio: [ 'ignore', 'pipe', 'ignore' ] }
        )
            .toString()
            .trim();
    } catch ( e ) {
        return '';
    }
};
export const lockMeta = ( id = POST ) => cli( `wp post meta get ${ id } _edit_lock` );
export const clearLock = ( id = POST ) => cli( `wp post meta delete ${ id } _edit_lock` );
export const setLock = ( user, id = POST ) =>
    cli( `wp post meta update ${ id } _edit_lock ${ Math.floor( Date.now() / 1000 ) }:${ user }` );
export const now = () => Math.floor( Date.now() / 1000 );
export const age = ( meta ) => ( meta ? now() - Number( meta.split( ':' )[ 0 ] ) : null );

// Trigger a heartbeat and return the parsed response.
export async function hb( page ) {
    const [ res ] = await Promise.all( [
        page.waitForResponse(
            ( r ) =>
                r.url().includes( 'admin-ajax.php' ) &&
                ( r.request().postData() || '' ).includes( 'action=heartbeat' ),
            { timeout: 20000 }
        ),
        page.evaluate( () => window.wp.heartbeat.connectNow() ),
    ] );
    let json = null;
    try {
        json = await res.json();
    } catch ( e ) {}
    await page.waitForTimeout( 400 );
    return { sent: decodeURIComponent( res.request().postData() || '' ), received: json };
}

export const editorState = ( page ) =>
    page.evaluate( () => {
        const s = wp.data.select( 'core/editor' );
        return {
            currentPostId: s.getCurrentPostId(),
            currentPostType: s.getCurrentPostType(),
            isPostLocked: s.isPostLocked(),
            isTakeover: s.isPostLockTakeover() ?? null,
            activePostLock: s.getActivePostLock() ?? null,
            lockUser: s.getPostLockUser() ?? null,
            hasPostLockUtils: !! s.getEditorSettings().postLockUtils,
        };
    } );

export const modalInfo = ( page ) =>
    page.evaluate( () => {
        const m = document.querySelector( '.editor-post-locked-modal' );
        if ( ! m ) {
            return { shown: false };
        }
        const overlay = m.closest( '.components-modal__screen-overlay' );
        const r = overlay ? overlay.getBoundingClientRect() : null;
        return {
            shown: true,
            title: m.querySelector( 'h1' )?.textContent,
            text: Array.from( m.querySelectorAll( 'p' ) ).map( ( p ) => p.textContent ),
            links: Array.from( m.querySelectorAll( 'a' ) ).map(
                ( a ) => a.textContent.trim() + ' -> ' + a.getAttribute( 'href' )
            ),
            closeButton: !! m.querySelector( 'button[aria-label="Close"]' ),
            overlayRect: r && { x: r.x, y: r.y, w: r.width, h: r.height },
        };
    } );

export function watch( page ) {
    const logs = { errors: [], warnings: [], requests: [] };
    page.on( 'console', ( m ) => {
        if ( m.type() === 'error' ) {
            logs.errors.push( m.text().slice( 0, 300 ) );
        }
        if ( m.type() === 'warning' ) {
            logs.warnings.push( m.text().slice( 0, 300 ) );
        }
    } );
    page.on( 'pageerror', ( e ) => logs.errors.push( 'pageerror: ' + e.message.slice( 0, 300 ) ) );
    page.on( 'request', ( r ) => {
        const u = r.url();
        if ( r.method() !== 'GET' || /autosave|wp-json|rest_route/.test( u ) ) {
            logs.requests.push( `${ r.method() } ${ u.replace( BASE, '' ).slice( 0, 160 ) }` );
        }
    } );
    return logs;
}

export function save( key, value ) {
    const f = DIR + 'results.json';
    const all = existsSync( f ) ? JSON.parse( readFileSync( f ) ) : {};
    all[ key ] = value;
    writeFileSync( f, JSON.stringify( all, null, 2 ) );
    console.log( key, JSON.stringify( value, null, 2 ) );
}

// Dispatch the candidate core/editor actions (NOT on the allowlist).
export const feed = ( page, { post = true, utils = false, lock = false } ) =>
    page.evaluate(
        ( { post, utils, lock } ) => {
            const d = wp.data.dispatch( 'core/editor' );
            const info = window.wfdSpike.lockInfo;
            if ( utils ) {
                d.updateEditorSettings( { postLockUtils: info.postLockUtils } );
            }
            if ( lock ) {
                d.updatePostLock( info.postLock );
            }
            if ( post ) {
                d.setEditedPost( 'page', window.wfdSpike.postId );
            }
        },
        { post, utils, lock }
    );
