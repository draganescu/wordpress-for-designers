/**
 * Putting an artboard in edit for a tool, as `artboard-edit` does
 * (spec/agent/tools.md): the designer's own way in, without the lock dialog,
 * and waiting for its editor to settle (Settling; decision D82).
 */
import { select } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import { editSeam } from '../shell/seams';
import { locked, notEditable, notFound, notReady } from './errors';
import { frameOf } from '../artboard-frame/rects';
import { hasEveryBlock, isDrawn } from './settle';

// The one safety limit of a wait, in ms.
const LIMIT = 10000;

/**
 * @return {Object} The editor in edit seam.
 */
export const editor = () => editSeam.current;

/**
 * Lets React draw what the stores hold now.
 *
 * @return {Promise<void>} Resolves after the next frame's work.
 */
const nextRender = () =>
    new Promise( ( resolve ) => {
        const after = () => window.setTimeout( resolve, 0 );
        if ( document.hidden ) {
            after();
        } else {
            window.requestAnimationFrame( after );
        }
    } );

/**
 * Puts an artboard in edit, unless it is in edit already, and waits until
 * its editor is mounted, the page's `core` store reports no selector still
 * resolving, and the blocks of its template parts, synced patterns, menus
 * and page content are in. An artboard already in edit and settled is not
 * waited for. A browser has no editor.
 *
 * @param {Object} artboard The artboard with its name.
 * @return {Promise<void>} Resolves once the editor has settled.
 */
export async function putInEdit( artboard ) {
    const before = editor().bridgeRef.current;
    const wasLive = !! before && editor().liveId() === artboard.id;
    const result = await editor().enter( artboard.id );
    if ( result === 'not-editable' ) {
        throw notEditable( artboard.name );
    }
    if ( result === 'missing' ) {
        throw notFound( 'Artboard', artboard.id );
    }
    if ( result?.lockedBy !== undefined ) {
        throw locked( artboard.name, result.lockedBy );
    }
    if ( artboard.kind === 'browser' ) {
        return;
    }
    const isSettled = () => {
        const bridge = editor().bridgeRef.current;
        return (
            !! bridge &&
            // The bridge of the editor that was in edit before is not
            // this one's.
            ( wasLive || bridge !== before ) &&
            editor().liveId() === artboard.id &&
            bridge.isReady() &&
            ! select( coreStore ).hasResolvingSelectors() &&
            // What has resolved is drawn a moment later: the blocks that
            // come from records are all in.
            hasEveryBlock( bridge.registry, artboard ) &&
            isDrawn( bridge.registry, frameOf( artboard.id ).document )
        );
    };
    if ( wasLive && isSettled() ) {
        return;
    }
    const started = Date.now();
    while ( ! isSettled() ) {
        if ( Date.now() - started > LIMIT ) {
            throw notReady( `${ artboard.name } did not finish loading.` );
        }
        await nextRender();
    }
}
