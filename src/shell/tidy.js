/**
 * Tidy up (D45): everything on the board in one row per kind.
 */
import { groupArtboards } from './artboards-panel';
import { rectOf } from './use-canvas-interactions';

/**
 * Board units between two items in a row.
 */
const ITEM_GAP = 160;

/**
 * Board units between the bottom of a row and the top of the next, leaving
 * room for the labels drawn above each item.
 */
const ROW_GAP = 400;

/**
 * Where each item goes when the board is tidied up: one row per kind, in
 * left-panel order, starting at the top left corner of everything on the
 * board.
 *
 * @param {Array}    artboards Artboards with names.
 * @param {Function} widthOf   Gives the render width of a device.
 * @return {Array} The moves, as { id, x, y }.
 */
export function tidyMoves( artboards, widthOf ) {
    if ( ! artboards.length ) {
        return [];
    }
    const rects = artboards.map( ( artboard ) => rectOf( artboard, widthOf ) );
    const left = Math.min( ...rects.map( ( rect ) => rect.x ) );
    let top = Math.min( ...rects.map( ( rect ) => rect.y ) );
    const moves = [];
    groupArtboards( artboards ).forEach( ( group ) => {
        let x = left;
        let rowHeight = 0;
        group.artboards.forEach( ( artboard ) => {
            const rect = rectOf( artboard, widthOf );
            moves.push( { id: artboard.id, x, y: top } );
            x += rect.width + ITEM_GAP;
            rowHeight = Math.max( rowHeight, rect.height || 0 );
        } );
        top += rowHeight + ROW_GAP;
    } );
    return moves;
}
