/**
 * Spike (d): a chunk of the board's script is requested only when asked for.
 *
 * The board page is opened with ?wfd_spike_chunk=1, which makes the spike
 * plugin serve the board's own entry built with one dynamic import()
 * (spikes/agent/chunk.webpack.config.js).
 *
 *   node spikes/agent/tests/run-d.mjs
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { open, resetFixture, openBoard, boardAtRest, bringIntoView, enterEdit, save, ROOT } from './lib.mjs';

const { browser, page, errors } = await open();
const fixture = await resetFixture( page );
const scripts = [];
page.on( 'request', ( request ) => {
    if ( /\.js(\?|$)/.test( request.url() ) && /chunk-build|wordpress-for-designers\/build/.test( request.url() ) ) {
        scripts.push( { at: Date.now(), url: request.url().replace( /^https?:\/\/[^/]+/, '' ) } );
    }
} );
const responses = {};
page.on( 'response', ( response ) => {
    if ( /chunk-build\/agent\.js/.test( response.url() ) ) {
        responses.status = response.status();
        responses.type = response.headers()[ 'content-type' ];
    }
} );

await openBoard( page, fixture.boardId, '&wfd_spike_chunk=1' );
await boardAtRest( page );
const opened = Date.now();

// Use the board for a while: edit an artboard, leave, zoom, and wait.
const header = fixture.layout.artboards.find( ( a ) => String( a.entityId ).endsWith( '//header' ) );
await bringIntoView( page, header, 0.4 );
await enterEdit( page, header.id );
await page.waitForTimeout( 1000 );
await page.keyboard.press( 'Escape' );
await page.keyboard.press( 'Escape' );
await page.locator( '[data-wfd-region="canvas"]' ).focus();
await page.keyboard.press( 'Shift+Digit1' );
await page.waitForTimeout( 30000 );

const before = {
    waitedMs: Date.now() - opened,
    requests: scripts.map( ( s ) => s.url ),
    stub: await page.evaluate( () => Object.keys( window.wfdAgent ) ),
    chunkRuns: await page.evaluate( () => window.wfdSpikeChunkRuns ?? 0 ),
    chunkScriptTags: await page.evaluate(
        () => [ ...document.scripts ].filter( ( s ) => /agent\.js/.test( s.src ) ).length
    ),
};
const mainScript = scripts.find( ( s ) => /board\.js/.test( s.url ) )?.url;

// Ask for it, three times.
const asked = await page.evaluate( async () => {
    const first = window.wfdAgent.ready();
    const second = window.wfdAgent.ready();
    const surface = await first;
    const third = window.wfdAgent.ready();
    return {
        samePromise: first === second && second === third,
        version: surface.version,
        marker: surface.marker,
        artboards: surface.artboards(),
        blockEditorStore: surface.blockEditorStore,
        chunkRuns: window.wfdSpikeChunkRuns,
    };
} );
await page.waitForTimeout( 1000 );
const after = {
    requests: scripts.map( ( s ) => s.url ),
    chunkRequests: scripts.filter( ( s ) => /agent\.js/.test( s.url ) ).length,
    response: responses,
};

// The built files.
const build = path.join( ROOT, 'wfd-agent-spike/chunk-build' );
const main = readFileSync( path.join( build, 'board.js' ), 'utf8' );
const chunk = readFileSync( path.join( build, 'agent.js' ), 'utf8' );
const files = {
    chunkBytes: chunk.length,
    mainBytes: main.length,
    markerInMain: main.includes( 'wfd-spike-agent-chunk-body' ),
    markerInChunk: chunk.includes( 'wfd-spike-agent-chunk-body' ),
};

const result = { mainScript, before, asked, after, files, errors };
result.pass =
    before.requests.length === 1 &&
    /chunk-build\/board\.js/.test( before.requests[ 0 ] ) &&
    before.chunkRuns === 0 &&
    before.chunkScriptTags === 0 &&
    asked.samePromise &&
    asked.version === 1 &&
    asked.artboards === 9 &&
    asked.chunkRuns === 1 &&
    after.chunkRequests === 1 &&
    after.response.status === 200 &&
    ! files.markerInMain &&
    files.markerInChunk &&
    errors.length === 0;
save( 'd.json', result );
console.log( JSON.stringify( result, null, 1 ) );
await browser.close();
process.exit( result.pass ? 0 : 1 );
