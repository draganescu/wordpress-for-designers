/**
 * Saves the layout 2 seconds after its last change (decision D25), notes and
 * their text included (D43), and guides (D113). The layout
 * is not site content: it goes straight to the board's REST route and never
 * appears in Review.
 */
import apiFetch from '@wordpress/api-fetch';
import { useEffect, useRef } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { store as boardStore, toLayout } from './index';

const DELAY = 2000;

export function useLayoutAutosave() {
    const { boardId, artboards, notes, guides, isLoaded } = useSelect(
        ( select ) => {
            const board = select( boardStore );
            return {
                boardId: board.getBoardId(),
                artboards: board.getArtboards(),
                notes: board.getNotes(),
                guides: board.getGuides(),
                isLoaded: board.isLoaded(),
            };
        },
        []
    );
    const saved = useRef( null );
    const pending = useRef( null );
    // When the pending save is due, and what it was started for.
    const due = useRef( 0 );
    const placed = useRef( '' );

    useEffect( () => {
        if ( ! isLoaded ) {
            return;
        }
        const layout = toLayout( artboards, notes, guides );
        const json = JSON.stringify( layout );
        // The layout without the measured heights.
        const placement = JSON.stringify( [
            layout.artboards.map( ( { height, ...rest } ) => rest ),
            layout.notes,
            layout.guides,
        ] );
        const wasPlaced = placed.current;
        placed.current = placement;
        if ( saved.current === null ) {
            saved.current = json;
            return;
        }
        if ( json === saved.current ) {
            pending.current = null;
            return;
        }
        // A height measured while a save is waiting does not put it off,
        // even when the save is overdue because the page was busy.
        const now = Date.now();
        const delay =
            pending.current && placement === wasPlaced
                ? Math.max( 0, due.current - now )
                : DELAY;
        due.current = now + delay;
        const save = () => {
            pending.current = null;
            saved.current = json;
            apiFetch( {
                path: `/wp/v2/wfd-boards/${ boardId }`,
                method: 'POST',
                data: { layout },
                keepalive: true,
            } ).catch( () => {
                // Try again with the next change.
                saved.current = '';
            } );
        };
        pending.current = save;
        const timer = setTimeout( save, delay );
        return () => clearTimeout( timer );
    }, [ artboards, notes, guides, boardId, isLoaded ] );

    useEffect( () => {
        const flush = () => pending.current?.();
        window.addEventListener( 'pagehide', flush );
        return () => window.removeEventListener( 'pagehide', flush );
    }, [] );
}
