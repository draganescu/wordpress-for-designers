/**
 * Decides each artboard's tier from visibility and zoom, and mounts Previews
 * through a priority queue: nearest to the viewport centre first, one mount
 * per idle slice (spec/architecture.md, Tiers).
 */
import { createQueue } from '@wordpress/priority-queue';
import { useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { visibleRect } from '../viewport/math';

export const MAX_PREVIEWS = 12;
const SNAPSHOT_BELOW = 0.2;
const HYSTERESIS = 0.02;

function intersects( a, b ) {
    return (
        a.x <= b.x + b.width &&
        a.x + a.width >= b.x &&
        a.y <= b.y + b.height &&
        a.y + a.height >= b.y
    );
}

/**
 * @param {Object}  input
 * @param {Array}   input.rects       Artboard rectangles as { id, x, y, width, height }.
 * @param {Object}  input.viewport    The settled viewport.
 * @param {Object}  input.size        The canvas area size.
 * @param {string}  input.liveId      The Live artboard, if any.
 * @param {Array}   input.warmIds     Editors kept mounted but inactive.
 * @param {boolean} input.wasBelow    Whether zoom was below the Snapshot threshold.
 * @param {number}  input.maxPreviews The Preview cap.
 * @return {Object} `tiers` (Map of id to tier), `order` (Preview ids nearest
 *                  first), `snapshotOrder` (Snapshot ids nearest first) and
 *                  `isBelow`.
 */
export function computeTiers( {
    rects,
    viewport,
    size,
    liveId,
    warmIds = [],
    wasBelow = false,
    maxPreviews = MAX_PREVIEWS,
} ) {
    const tiers = new Map();
    const visible = visibleRect( viewport, size );
    // More than one viewport width or height outside the visible area.
    const near = {
        x: visible.x - visible.width,
        y: visible.y - visible.height,
        width: visible.width * 3,
        height: visible.height * 3,
    };
    const centre = {
        x: visible.x + visible.width / 2,
        y: visible.y + visible.height / 2,
    };
    // Going down the tier changes at 20%; going up, at 22%.
    const isBelow =
        viewport.zoom < SNAPSHOT_BELOW + ( wasBelow ? HYSTERESIS : 0 );

    const candidates = [];
    const frozen = [];
    for ( const rect of rects ) {
        if ( rect.id === liveId ) {
            tiers.set( rect.id, 'live' );
        } else if ( warmIds.includes( rect.id ) ) {
            tiers.set( rect.id, 'warm' );
        } else if ( ! size.width || ! intersects( rect, near ) ) {
            tiers.set( rect.id, 'ghost' );
        } else {
            const dx = Math.max(
                rect.x - centre.x,
                0,
                centre.x - ( rect.x + rect.width )
            );
            const dy = Math.max(
                rect.y - centre.y,
                0,
                centre.y - ( rect.y + rect.height )
            );
            ( isBelow ? frozen : candidates ).push( {
                id: rect.id,
                distance: Math.hypot( dx, dy ),
            } );
        }
    }
    candidates.sort( ( a, b ) => a.distance - b.distance );
    const order = [];
    candidates.forEach( ( candidate, index ) => {
        if ( index < maxPreviews ) {
            tiers.set( candidate.id, 'preview' );
            order.push( candidate.id );
        } else {
            frozen.push( candidate );
        }
    } );
    frozen.sort( ( a, b ) => a.distance - b.distance );
    const snapshotOrder = frozen.map( ( item ) => {
        tiers.set( item.id, 'snapshot' );
        return item.id;
    } );
    return { tiers, order, snapshotOrder, isBelow };
}

/**
 * @param {Object}   options
 * @param {Array}    options.rects    Artboard rectangles with ids.
 * @param {Object}   options.viewport The settled viewport.
 * @param {Object}   options.size     The canvas area size.
 * @param {string}   options.liveId   The Live artboard.
 * @param {Array}    options.warmIds  The warm editors.
 * @param {Function} options.onMount  Called with an id when its Preview mounts.
 * @param {Function} options.hasCopy  Whether a Snapshot artboard has its frozen copy, or cannot get one. A new function whenever an answer changes.
 * @return {Object} `tiers` (Map), `mounted` (Set of Preview ids mounted) and
 *                  `source` (the Snapshot artboard being rendered once to
 *                  make its frozen copy, if any).
 */
export function useTiers( {
    rects,
    viewport,
    size,
    liveId,
    warmIds,
    onMount,
    hasCopy,
} ) {
    const wasBelow = useRef( false );
    const { tiers, order, snapshotOrder } = useMemo( () => {
        const result = computeTiers( {
            rects,
            viewport,
            size,
            liveId,
            warmIds,
            wasBelow: wasBelow.current,
        } );
        wasBelow.current = result.isBelow;
        return result;
    }, [ rects, viewport, size, liveId, warmIds ] );

    const [ mounted, setMounted ] = useState( () => new Set() );
    const mountedRef = useRef( mounted );
    mountedRef.current = mounted;
    const queue = useRef();
    const pending = useRef( [] );
    const report = useRef( onMount );
    report.current = onMount;
    if ( ! queue.current ) {
        queue.current = createQueue();
    }

    useEffect( () => {
        const wanted = new Set( order );
        // Unmount what is no longer a Preview.
        setMounted( ( current ) => {
            const kept = [ ...current ].filter( ( id ) => wanted.has( id ) );
            return kept.length === current.size ? current : new Set( kept );
        } );
        // Queue what is not mounted yet, nearest to the viewport centre
        // first. One callback runs per idle slice.
        pending.current.forEach( ( key ) => queue.current.cancel( key ) );
        pending.current = [];
        for ( const id of order ) {
            if ( mountedRef.current.has( id ) ) {
                continue;
            }
            const key = { id };
            pending.current.push( key );
            queue.current.add( key, () => {
                pending.current = pending.current.filter(
                    ( item ) => item !== key
                );
                report.current?.( id );
                setMounted( ( current ) => new Set( current ).add( id ) );
            } );
        }
    }, [ order ] );

    // A Snapshot artboard that was never rendered has no frozen copy. They
    // are rendered once each, one at a time, nearest first, through the
    // same queue.
    const wanted = useMemo(
        () =>
            ( hasCopy && snapshotOrder.find( ( id ) => ! hasCopy( id ) ) ) ??
            null,
        [ snapshotOrder, hasCopy ]
    );
    const [ source, setSource ] = useState( null );
    useEffect( () => {
        if ( wanted === null ) {
            setSource( null );
            return undefined;
        }
        const current = queue.current;
        const key = { id: wanted };
        current.add( key, () => setSource( wanted ) );
        return () => current.cancel( key );
    }, [ wanted ] );

    useEffect( () => {
        const current = queue.current;
        return () => current.reset();
    }, [] );

    return { tiers, mounted, source };
}
