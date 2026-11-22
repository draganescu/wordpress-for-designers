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
import { frameOf } from '../artboard-frame/rects';
import {
    authorOf,
    beginCall,
    changedOf,
    endCall,
    startAuthorship,
} from './authorship';
import { documentBlocks } from './blocks';
import { findArtboard } from './board';
import { setAnnotating, setSession, workEnded, workStarted } from './marks';
import { subscribe, targets } from './targets';
import { functions } from './tools';
import { checkInput } from './validate';

// In a test build, the tree read from what an artboard draws (AC-TOOL-24).
if ( window.wfdTest ) {
    window.wfdTest.documentBlocks = ( id ) => {
        const doc = frameOf( id ).document;
        return doc
            ? documentBlocks( doc ).map(
                  ( { path, name } ) => `${ path.join( '.' ) } ${ name }`
              )
            : null;
    };
}

// From the moment the surface is loaded it records who changes what.
startAuthorship();

/**
 * The artboards a call names, in its `artboard` and `artboards` fields.
 *
 * @param {Object} input The call's input.
 * @return {string[]} Their ids; a field that names nothing is left out.
 */
function namedArtboards( input ) {
    const ids = new Set();
    for ( const value of [ input.artboard, ...( input.artboards ?? [] ) ] ) {
        if ( typeof value === 'string' ) {
            try {
                ids.add( findArtboard( value ).artboard.id );
            } catch {
                // The tool itself says what is wrong with it.
            }
        }
    }
    return [ ...ids ];
}

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
        const fn = functions[ name ];
        // While the designer cannot use the board either, no tool can, and
        // its input is not looked at (spec/agent/tools.md, Rules for every
        // tool).
        if ( ! fn || actionsSeam.current.isBlocked() ) {
            throw unavailable();
        }
        const wrong = checkInput( input, tool );
        if ( wrong ) {
            throw invalidArgs( wrong );
        }
        // What changes from here until the call ends is the agent's
        // (spec/agent/surface.md, Authorship), and the artboards the call
        // names are marked as worked on (Marks).
        const named = namedArtboards( input );
        beginCall();
        workStarted( named );
        try {
            const result = await fn( input, { changedOf, authorOf } );
            // A JSON value, in one piece: what a block keeps as rich text
            // is given as the markup it stands for.
            return {
                ok: true,
                result: JSON.parse( JSON.stringify( result ) ),
            };
        } finally {
            endCall();
            workEnded( named );
        }
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
    targets,
    subscribe,
    setAnnotating,
};

/**
 * The relay client: takes what a poll answered, runs the call it handed
 * over, entry by entry, and sends the results (spec/agent/relay.md).
 *
 * @param {Object}   answer The poll's answer: `active` and `call`.
 * @param {Function} send   Sends the results of the answer's call.
 */
export async function relay( answer, send ) {
    // The header chip shows from the poll that finds a session until the
    // poll that finds it ended.
    setSession( !! answer.active );
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
