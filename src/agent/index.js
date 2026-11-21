/**
 * The agent surface (spec/agent/surface.md): the page interface that
 * `window.wfdAgent.ready()` resolves to, and the relay client. This file is
 * the entry of a chunk of its own, requested on demand (constraint C27).
 */
import declarations from '../../includes/agent-tools.json';
import { actionsSeam } from '../shell/seams';
import {
    SKIPPED,
    ToolError,
    failed,
    invalidArgs,
    unavailable,
    unknownTool,
} from './errors';
import { functions } from './tools';
import { checkInput } from './validate';

// Calls run one at a time, in the order they arrive.
let last = Promise.resolve();

/**
 * Runs one tool: the same checks whatever the way in (constraint C31).
 *
 * @param {string} name  The tool's name.
 * @param {Object} input Its input.
 * @return {Promise<Object>} The envelope.
 */
async function run( name, input ) {
    try {
        const tool = declarations.find( ( item ) => item.name === name );
        if ( ! tool ) {
            throw unknownTool( name );
        }
        const wrong = checkInput( input, tool );
        if ( wrong ) {
            throw invalidArgs( wrong );
        }
        const fn = functions[ name ];
        // While the designer cannot use the board either, no tool can
        // (spec/agent/tools.md, Rules for every tool).
        if ( ! fn || actionsSeam.current.isBlocked() ) {
            throw unavailable();
        }
        return {
            ok: true,
            result: await fn( input, { changedOf: () => undefined } ),
        };
    } catch ( error ) {
        if ( error instanceof ToolError ) {
            return failed( error );
        }
        // Not a failure the tools know: the board could not do it.
        window.console.error( error );
        return failed( unavailable() );
    }
}

/**
 * @param {string} name  The tool's name.
 * @param {Object} input Its input; none is an empty object.
 * @return {Promise<Object>} The envelope. It resolves and never rejects.
 */
function call( name, input = {} ) {
    const result = last.then( () => run( name, input ) );
    last = result.catch( () => {} );
    return result;
}

/**
 * The page interface.
 */
export const surface = {
    version: 1,
    tools: declarations,
    call,
    targets: () => [],
    subscribe: () => () => {},
    setAnnotating: () => {},
};

/**
 * The relay client: takes what a poll answered, runs the call it handed
 * over, entry by entry, and sends the results (spec/agent/relay.md).
 *
 * @param {Object}   answer The poll's answer: `active` and `call`.
 * @param {Function} send   Sends the results of the answer's call.
 */
export async function relay( answer, send ) {
    if ( ! answer.call ) {
        return;
    }
    const results = [];
    let hasFailed = false;
    for ( const entry of answer.call.calls ) {
        if ( hasFailed ) {
            results.push( SKIPPED );
            continue;
        }
        const envelope = await call( entry.tool, entry.input );
        hasFailed = ! envelope.ok;
        results.push( envelope );
    }
    await send( results );
}
