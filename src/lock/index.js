/**
 * The post lock of the Live page or pattern: taken when the artboard is about
 * to become Live, refreshed while it is Live, released when it leaves edit
 * and when the page unloads (spec/data-model.md, Locks).
 */
import apiFetch from '@wordpress/api-fetch';

/**
 * Short enough to keep WordPress's 150 second lock window with room to spare,
 * also when the tab is in the background.
 */
const REFRESH_INTERVAL = 30000;

const lockPath = ( id ) => `/wfd/v1/lock/${ id }`;

export const isLockable = ( artboard ) =>
    ! artboard.draft &&
    ( artboard.kind === 'page' || artboard.kind === 'pattern' );

/**
 * Asks for the lock.
 *
 * @param {number}  id       The post.
 * @param {boolean} takeover Whether to take it from another user.
 * @return {Promise<Object>} `{ held: true }` or `{ held: false, user }`.
 */
export function takeLock( id, takeover = false ) {
    return apiFetch( {
        path: lockPath( id ),
        method: 'POST',
        data: { takeover },
    } );
}

export function releaseLock( id ) {
    return apiFetch( {
        path: lockPath( id ),
        method: 'DELETE',
        keepalive: true,
    } ).catch( () => {} );
}

/**
 * Keeps a held lock alive and reports when another user takes it.
 *
 * @param {number}   id      The post.
 * @param {Function} onTaken Called with the user who took the lock.
 * @return {Function} Stops refreshing and releases the lock.
 */
export function holdLock( id, onTaken ) {
    let isHeld = true;
    const refresh = () => {
        if ( ! isHeld ) {
            return;
        }
        takeLock( id )
            .then( ( result ) => {
                if ( isHeld && ! result.held ) {
                    isHeld = false;
                    stop();
                    onTaken( result.user );
                }
            } )
            .catch( () => {} );
    };
    const timer = window.setInterval( refresh, REFRESH_INTERVAL );
    const onPageHide = () => isHeld && releaseLock( id );
    window.addEventListener( 'pagehide', onPageHide );
    function stop() {
        window.clearInterval( timer );
        window.removeEventListener( 'pagehide', onPageHide );
    }
    const release = () => {
        stop();
        if ( isHeld ) {
            isHeld = false;
            return releaseLock( id );
        }
    };
    release.refresh = refresh;
    return release;
}
