/**
 * Saves the layout 2 seconds after its last change (decision D25). The layout
 * is not site content: it goes straight to the board's REST route and never
 * appears in Review.
 */
import apiFetch from '@wordpress/api-fetch';
import { useEffect, useRef } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { store as boardStore, toLayout } from './index';

const DELAY = 2000;

export function useLayoutAutosave() {
    const { boardId, artboards, isLoaded } = useSelect( ( select ) => {
        const board = select( boardStore );
        return {
            boardId: board.getBoardId(),
            artboards: board.getArtboards(),
            isLoaded: board.isLoaded(),
        };
    }, [] );
    const saved = useRef( null );
    const pending = useRef( null );

    useEffect( () => {
        if ( ! isLoaded ) {
            return;
        }
        const layout = toLayout( artboards );
        const json = JSON.stringify( layout );
        if ( saved.current === null ) {
            saved.current = json;
            return;
        }
        if ( json === saved.current ) {
            return;
        }
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
        const timer = setTimeout( save, DELAY );
        return () => clearTimeout( timer );
    }, [ artboards, boardId, isLoaded ] );

    useEffect( () => {
        const flush = () => pending.current?.();
        window.addEventListener( 'pagehide', flush );
        return () => window.removeEventListener( 'pagehide', flush );
    }, [] );
}
