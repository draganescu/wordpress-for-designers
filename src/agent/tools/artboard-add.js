/**
 * `artboard-add`: open something that exists on the site as an artboard, or
 * add a browser (spec/agent/tools.md).
 */
import { actions, describeArtboard } from '../board';
import { editor } from '../edit';
import { invalidArgs, notFound } from '../errors';

const THINGS = {
    page: 'Page',
    pattern: 'Pattern',
    template: 'Template',
    'template-part': 'Template part',
    media: 'Media',
};
// The longest address a browser keeps (spec/data-model.md, Board).
const MAX_PATH = 2000;

export default async function artboardAdd(
    { kind, entityId, path, device },
    { changedOf }
) {
    const isBrowser = kind === 'browser';
    if ( isBrowser && entityId !== undefined ) {
        throw invalidArgs( 'entityId is not allowed for a browser.' );
    }
    if ( isBrowser && path === undefined ) {
        throw invalidArgs( 'path is required for a browser.' );
    }
    if ( isBrowser && path.length > MAX_PATH ) {
        throw invalidArgs( `path must be ${ MAX_PATH } characters or less.` );
    }
    if ( ! isBrowser && path !== undefined ) {
        throw invalidArgs( 'path is allowed for a browser only.' );
    }
    if ( ! isBrowser && entityId === undefined ) {
        throw invalidArgs( `entityId is required for a ${ kind }.` );
    }
    const wantsNumber = [ 'page', 'pattern', 'media' ].includes( kind );
    if ( ! isBrowser && wantsNumber !== ( typeof entityId === 'number' ) ) {
        throw invalidArgs(
            wantsNumber
                ? `entityId must be a number for a ${ kind }.`
                : `entityId must be a string for a ${ kind }.`
        );
    }
    if ( kind === 'media' && device !== undefined ) {
        throw invalidArgs( 'device is not allowed for media.' );
    }

    // A row clicked in edit inserts into the artboard and does not open
    // one (D39), so edit ends first.
    editor().leave();
    let id;
    if ( isBrowser ) {
        // "New browser", then the click that places it (D55).
        id = await actions().createNew( 'browser' );
        if ( path !== '/' ) {
            actions().setAddress( id, path );
        }
    } else {
        id = await actions().openExisting( kind, entityId );
        if ( ! id ) {
            throw notFound( THINGS[ kind ], entityId );
        }
    }
    if ( device ) {
        // Set after placing, as the device control sets it (E6).
        actions().setDevice( id, device );
    }
    const board = actions().board();
    return describeArtboard(
        board.artboards.find( ( artboard ) => artboard.id === id ),
        board,
        changedOf
    );
}
