/**
 * Fails the build when a tool declared in includes/agent-tools.json has no
 * function in src/agent/tools/, or a function there has no declaration
 * (spec/agent/surface.md, Declarations).
 */
import { readFileSync, readdirSync } from 'node:fs';

// Declared tools whose functions belong to a later milestone of
// spec/build-order.md. Empty once Milestone 17 is built.
const PENDING = [
    'blocks-get',
    'block-update',
    'blocks-insert',
    'blocks-remove',
    'blocks-move',
    'styles-get',
    'token-set',
    'styles-set',
    'styles-set-variation',
    'token-show-uses',
    'review-list',
    'review-discard',
];

const root = new URL( '..', import.meta.url );
const declared = JSON.parse(
    readFileSync( new URL( 'includes/agent-tools.json', root ), 'utf8' )
).map( ( tool ) => tool.name );
const files = readdirSync( new URL( 'src/agent/tools', root ) )
    .filter( ( file ) => file.endsWith( '.js' ) && file !== 'index.js' )
    .map( ( file ) => file.slice( 0, -3 ) );
const index = readFileSync(
    new URL( 'src/agent/tools/index.js', root ),
    'utf8'
);
const paired = [ ...index.matchAll( /^\s+'([a-z-]+)': \w+,$/gm ) ].map(
    ( match ) => match[ 1 ]
);

const problems = [
    ...declared
        .filter(
            ( name ) => ! paired.includes( name ) && ! PENDING.includes( name )
        )
        .map( ( name ) => `${ name } is declared and has no function.` ),
    ...paired
        .filter( ( name ) => ! declared.includes( name ) )
        .map( ( name ) => `${ name } has a function and no declaration.` ),
    ...files
        .filter( ( name ) => ! paired.includes( name ) )
        .map( ( name ) => `src/agent/tools/${ name }.js is not in the index.` ),
    ...paired
        .filter( ( name ) => ! files.includes( name ) )
        .map( ( name ) => `${ name } has no file in src/agent/tools/.` ),
];

if ( problems.length ) {
    console.error( problems.join( '\n' ) );
    process.exit( 1 );
}
