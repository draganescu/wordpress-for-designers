/**
 * Reading the open board for the tools: the artboards as the left panel lists
 * them, and finding the artboard an input names.
 */
import { actionsSeam } from '../shell/seams';
import { surfaceActions } from './actions';
import { invalidArgs, notFound } from './errors';
import { artboardRef, isRef, noteRef, parseRef } from './refs';

let composedFrom = null;
let composed = null;

/**
 * @return {Object|null} The board actions: the seam onto the shell's hooks
 *                       with the surface's own actions; null before the
 *                       board has drawn.
 */
export function actions() {
    const seam = actionsSeam.current;
    if ( ! seam ) {
        return null;
    }
    if ( seam !== composedFrom ) {
        composedFrom = seam;
        composed = { ...seam, ...surfaceActions };
    }
    return composed;
}

/**
 * Finds what an artboard field names: an artboard's id, or a reference to an
 * artboard or to a block in it (spec/agent/tools.md, Rules for every tool).
 *
 * @param {string} value The field's value.
 * @param {string} field The field's name, for messages.
 * @return {Object} `{ artboard, path }`; `path` only for a block reference.
 */
export function findArtboard( value, field = 'artboard' ) {
    let id = value;
    let path;
    if ( isRef( value ) ) {
        const ref = parseRef( value, field );
        if ( ref.type !== 'artboard' && ref.type !== 'block' ) {
            throw invalidArgs( `${ field } does not name an artboard.` );
        }
        id = ref.id;
        path = ref.path;
    }
    const artboard = actions()
        .board()
        .artboards.find( ( item ) => item.id === id );
    if ( ! artboard ) {
        throw notFound( 'Artboard', value );
    }
    return { artboard, path };
}

/**
 * An artboard in the form `board-get` gives.
 *
 * @param {Object}   artboard The artboard with its name.
 * @param {Object}   board    What the seam's `board()` returned.
 * @param {Function} changed  Gives who changed an artboard's entity, if anyone.
 * @return {Object} The artboard.
 */
export function describeArtboard( artboard, board, changed ) {
    const isBrowser = artboard.kind === 'browser';
    const isMedia = artboard.kind === 'media';
    const out = {
        id: artboard.id,
        ref: artboardRef( artboard.id ),
        kind: artboard.kind,
        name: artboard.name,
    };
    if ( isBrowser ) {
        out.address = artboard.path;
    } else {
        out.entityId = artboard.entityId;
    }
    if ( ! isMedia ) {
        out.device = artboard.device;
    }
    out.x = artboard.x;
    out.y = artboard.y;
    out.width = board.widthOf( artboard );
    out.height = artboard.height;
    if ( ! isBrowser && ! isMedia ) {
        out.tier = board.tierOf( artboard.id );
    }
    const author = changed?.( artboard );
    if ( author ) {
        out.changed = author;
    }
    return out;
}

/**
 * A note in the form `board-get` gives.
 *
 * @param {Object} note The note.
 * @return {Object} The note.
 */
export const describeNote = ( note ) => ( {
    id: note.id,
    ref: noteRef( note.id ),
    text: note.text,
    color: note.color,
    x: note.x,
    y: note.y,
} );
