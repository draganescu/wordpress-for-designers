/**
 * Spike (b): a command run in the WP-CLI container writes a call to an
 * option, an open board page finds it by polling, answers, and the command
 * prints the answer, in under 3 seconds.
 *
 *   node spikes/agent/tests/run-b.mjs
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { open, resetFixture, openBoard, boardAtRest, cliContainer, sleep, save, ROOT } from './lib.mjs';

const run = ( command, args, cwd ) =>
    new Promise( ( resolve ) => {
        const start = performance.now();
        const child = spawn( command, args, { cwd } );
        let out = '';
        let err = '';
        child.stdout.on( 'data', ( d ) => ( out += d ) );
        child.stderr.on( 'data', ( d ) => ( err += d ) );
        child.on( 'close', ( code ) =>
            resolve( { code, out: out.trim(), err: err.trim(), wallMs: Math.round( performance.now() - start ) } )
        );
    } );

const { browser, page, errors } = await open();
const fixture = await resetFixture( page );
await openBoard( page, fixture.boardId );
await boardAtRest( page );

// The board page's side: ask once a second, answer what is handed over.
// `wp.apiFetch` is the page's own, with the REST nonce WordPress gave it.
await page.evaluate( ( board ) => {
    window.wfdSpikePolls = 0;
    window.wfdSpikeAnswered = 0;
    const tick = async () => {
        window.wfdSpikePolls++;
        const { call } = await window.wp.apiFetch( {
            path: '/wfd-spike/v1/poll',
            method: 'POST',
            data: { board },
        } );
        if ( call ) {
            const result = {
                tool: call.tool,
                title: document.title,
                artboards: window.wp.data.select( 'wfd/board' ).getArtboards().length,
            };
            await window.wp.apiFetch( {
                path: '/wfd-spike/v1/result',
                method: 'POST',
                data: { id: call.id, result },
            } );
            window.wfdSpikeAnswered++;
        }
    };
    window.wfdSpikeTimer = setInterval( () => tick().catch( () => {} ), 1000 );
}, fixture.boardId );

const container = cliContainer();
const wpEnv = path.resolve( ROOT, '../../node_modules/.bin/wp-env' );
const call = [ 'wp', 'wfd-spike', 'call', 'board-get', `--board=${ fixture.boardId }` ];
const parse = ( r ) => {
    const line = r.out.split( '\n' ).find( ( l ) => l.startsWith( '{' ) );
    return { ...r, json: line ? JSON.parse( line ) : null };
};

// 1. In the CLI container directly (what `wp-env run cli` does underneath).
const direct = [];
for ( let i = 0; i < 10; i++ ) {
    await sleep( 137 * i ); // start at different moments of the page's second
    direct.push( parse( await run( 'docker', [ 'exec', container, ...call ] ) ) );
}
// 2. Through `wp-env run cli`, as the end-to-end tests will run `wp wfd`.
const viaWpEnv = [];
for ( let i = 0; i < 5; i++ ) {
    await sleep( 211 * i );
    viaWpEnv.push( parse( await run( wpEnv, [ 'run', 'cli', '--', ...call ], ROOT ) ) );
}
// 3. The same wait, but reading the record with get_option in the command.
const cached = parse(
    await run( 'docker', [ 'exec', container, ...call, '--read=option', '--timeout=4' ] )
);
// 4. No page asking: the command gives up.
await page.evaluate( () => clearInterval( window.wfdSpikeTimer ) );
await sleep( 1500 );
const nobody = parse( await run( 'docker', [ 'exec', container, ...call, '--timeout=2' ] ) );

const stats = ( rows ) => {
    const ms = rows.map( ( r ) => r.wallMs ).sort( ( a, b ) => a - b );
    return {
        runs: rows.length,
        allAnswered: rows.every( ( r ) => r.code === 0 && r.json?.ok && r.json.result?.artboards === 9 ),
        wallMs: { min: ms[ 0 ], median: ms[ Math.floor( ms.length / 2 ) ], max: ms[ ms.length - 1 ] },
        waitMsInCommand: rows.map( ( r ) => r.json?.waitMs ),
        bootMsInCommand: rows.map( ( r ) => r.json?.bootMs ),
        recordsLeft: rows.map( ( r ) => r.json?.left ),
    };
};
const page_ = await page.evaluate( () => ( { polls: window.wfdSpikePolls, answered: window.wfdSpikeAnswered } ) );
const summary = {
    container,
    direct: stats( direct ),
    viaWpEnv: stats( viaWpEnv ),
    readWithGetOption: { code: cached.code, ...cached.json, wallMs: cached.wallMs },
    noPageAsking: { code: nobody.code, ...nobody.json, wallMs: nobody.wallMs },
    page: page_,
    sample: direct[ 0 ].out,
    errors,
};
summary.pass =
    summary.direct.allAnswered &&
    summary.viaWpEnv.allAnswered &&
    summary.direct.wallMs.max < 3000 &&
    summary.viaWpEnv.wallMs.max < 3000;
save( 'b.json', summary );
console.log( JSON.stringify( summary, null, 1 ) );
await browser.close();
process.exit( summary.pass ? 0 : 1 );
