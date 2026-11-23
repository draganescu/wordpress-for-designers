/**
 * The errors a tool fails with (spec/agent/tools.md, Errors). The codes are
 * these and no others, and the messages are the ones given there, in English:
 * agents read them, designers never see them.
 */

/**
 * A tool's failure: a code and its message.
 */
export class ToolError extends Error {
    constructor( code, message ) {
        super( message );
        this.code = code;
    }
}

export const unknownTool = ( name ) =>
    new ToolError( 'unknown_tool', `There is no tool named ${ name }.` );

export const invalidArgs = ( message ) =>
    new ToolError( 'invalid_args', message );

export const notFound = ( thing, value ) =>
    new ToolError( 'not_found', `${ thing } ${ value } was not found.` );

export const notEditable = ( name ) =>
    new ToolError( 'not_editable', `${ name } cannot be edited.` );

export const locked = ( name, user ) =>
    new ToolError( 'locked', `${ name } is being edited by ${ user }.` );

export const notAllowed = () =>
    new ToolError( 'not_allowed', 'The editor does not allow this change.' );

export const notAgents = ( name ) =>
    new ToolError(
        'not_agents',
        `${ name } also has changes made by the designer.`
    );

export const notReady = ( message ) => new ToolError( 'not_ready', message );

export const STYLES_NOT_READY = 'The styles did not finish updating.';

export const unavailable = () =>
    new ToolError( 'unavailable', 'The board cannot be used right now.' );

/**
 * The envelope of a failed call.
 *
 * @param {ToolError} error The failure.
 * @return {Object} `{ ok: false, error }`.
 */
export const failed = ( error ) => ( {
    ok: false,
    error: { code: error.code, message: error.message },
} );

/**
 * What an entry of a batch gets after an earlier entry failed
 * (spec/agent/relay.md).
 */
export const SKIPPED = {
    ok: false,
    error: { code: 'skipped', message: 'An earlier call failed.' },
};

/**
 * What an entry of a call gets when the command's time ran out before it
 * started (spec/agent/relay.md; decision D89).
 */
export const OUT_OF_TIME = {
    ok: false,
    error: { code: 'skipped', message: 'The call ran out of time.' },
};
