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
import { LIMIT, nextFrame, withinLimit } from './limit';
import { hasEveryBlock, isDrawn } from './settle';

/**
 * @return {Object} The editor in edit seam.
 */
export const editor = () => editSeam.current;

/**
 * Puts an artboard in edit, unless it is in edit already, and waits until
 * its editor is mounted, the page's `core` store reports no selector still
 * resolving, and the blocks of its template parts, synced patterns, menus
 * and page content are in. An artboard already in edit and settled is not
 * waited for. A browser has no editor. At the safety limit a mounted editor
 * with nothing resolving is taken as it is (D90).
 *
 * @param {Object} artboard The artboard with its name.
 * @return {Promise<void>} Resolves once the editor has settled.
 */
export async function putInEdit( artboard ) {
    const before = editor().bridgeRef.current;
    const wasLive = !! before && editor().liveId() === artboard.id;
    const result = await withinLimit( editor().enter( artboard.id ) );
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
    // The editor of this artboard is mounted and has its settings, and the
    // page's `core` store resolves nothing.
    const isMounted = () => {
        const bridge = editor().bridgeRef.current;
        return (
            !! bridge &&
            // The bridge of the editor that was in edit before is not
            // this one's.
            ( wasLive || bridge !== before ) &&
            editor().liveId() === artboard.id &&
            bridge.isReady() &&
            ! select( coreStore ).hasResolvingSelectors()
        );
    };
    const isSettled = () => {
        if ( ! isMounted() ) {
            return false;
        }
        const { registry } = editor().bridgeRef.current;
        // What has resolved is drawn a moment later: the blocks that come
        // from records are all in.
        return (
            hasEveryBlock( registry, artboard ) &&
            isDrawn( registry, frameOf( artboard.id ).document )
        );
    };
    if ( wasLive && isSettled() ) {
        return;
    }
    const started = Date.now();
    while ( ! isSettled() ) {
        if ( Date.now() - started > LIMIT ) {
            // A block of a plugin, or a pattern that holds itself, may never
            // meet the conditions on inner blocks and elements: a mounted
            // editor with nothing resolving is taken as it is (D90).
            if ( isMounted() ) {
                return;
            }
            throw notReady( `${ artboard.name } did not finish loading.` );
        }
        await nextFrame();
    }
}
