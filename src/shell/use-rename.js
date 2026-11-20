/**
 * Naming a page or pattern on its artboard's label (D62): which artboard is
 * being named, and the unsaved edit of the title that a new name is.
 *
 * This hook and `src/artboard-frame/name-field.js` are all of naming on the
 * board: the two to replace if WordPress comes to offer a rename of its own.
 */
import { useState } from '@wordpress/element';
import { useDispatch, useRegistry } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import { store as boardStore } from '../board-store';
import { KINDS } from './constants';

/**
 * @param {Object}               options
 * @param {Array}                options.artboards The artboards with their names.
 * @param {(id: string) => void} options.reveal    Brings an artboard into view.
 * @param {Object}               options.areaRef   Ref to the canvas area.
 * @return {Object} `renamingId`, the artboard being named or null; `start`,
 *                  which takes an artboard's id; `end`, which takes the name
 *                  typed, or null to leave the name as it was, and whether
 *                  the board takes focus back.
 */
export function useRename( { artboards, reveal, areaRef } ) {
    const registry = useRegistry();
    const [ renamingId, setRenamingId ] = useState( null );
    const { editEntityRecord } = useDispatch( coreStore );
    const { selectArtboard } = useDispatch( boardStore );

    // Only a page or a pattern that has loaded is named on the board.
    const start = ( id ) => {
        const artboard = artboards.find( ( a ) => a.id === id );
        if (
            ! artboard ||
            artboard.status !== 'ready' ||
            ! KINDS[ artboard.kind ].isNamed
        ) {
            return;
        }
        const board = registry.select( boardStore );
        if ( board.getLiveId() !== id && board.getSelectedId() !== id ) {
            selectArtboard( id );
        }
        reveal( id );
        setRenamingId( id );
    };

    // The new name is an unsaved edit of the page or pattern; an empty name
    // is not kept.
    const end = ( name, refocus ) => {
        const artboard = artboards.find( ( a ) => a.id === renamingId );
        setRenamingId( null );
        const next = name?.trim();
        if ( artboard && next && next !== artboard.name ) {
            editEntityRecord(
                'postType',
                KINDS[ artboard.kind ].postType,
                artboard.entityId,
                { title: next }
            );
        }
        if ( refocus ) {
            areaRef.current?.focus( { preventScroll: true } );
        }
    };

    return { renamingId, start, end };
}
