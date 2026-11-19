import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { open, BASE } from './lib.mjs';

const meta = () => {
    try {
        return execSync( 'docker exec wp-env-wordpress-for-designers-fededb01-cli-1 wp post meta get 4 _edit_lock', { stdio: [ 'ignore', 'pipe', 'ignore' ] } ).toString().trim();
    } catch ( e ) {
        return '';
    }
};
const holder = () => ( meta().split( ':' )[ 1 ] || '' );
try {
    execSync( 'docker exec wp-env-wordpress-for-designers-fededb01-cli-1 wp post meta delete 4 _edit_lock', { stdio: 'ignore' } );
} catch ( e ) {}

const a = await open( 'admin' );
const b = await open( 'second' );
const call = ( s, method, body ) => s.page.evaluate( async ( [ m, bd ] ) => {
    const r = await fetch( '/?rest_route=/wfd/v1/lock/4', {
        method: m,
        headers: { 'X-WP-Nonce': window.wp.apiFetch.nonceMiddleware.nonce, 'Content-Type': 'application/json' },
        body: bd ? JSON.stringify( bd ) : undefined,
    } );
    return { status: r.status, body: await r.json() };
}, [ method, body ] );
for ( const s of [ a, b ] ) {
    await s.page.goto( BASE + '/wp-admin/admin.php?page=wfd-spikes&post=4&spike=none' );
    await s.page.waitForFunction( () => window.wp && window.wp.apiFetch && window.wp.apiFetch.nonceMiddleware );
}
const steps = [];
const step = async ( name, fn, check ) => {
    const res = await fn();
    const row = { name, response: res.body, holderAfter: holder() };
    row.pass = check( row );
    steps.push( row );
};
await step( 'admin takes a free lock', () => call( a, 'POST' ), ( r ) => r.response.held === true && r.holderAfter === '1' );
const before = meta();
await new Promise( ( ok ) => setTimeout( ok, 1500 ) );
await step( 'admin refreshes', () => call( a, 'POST' ), ( r ) => r.response.held === true && meta() !== before );
await step( 'second is told who holds it', () => call( b, 'POST' ), ( r ) => r.response.held === false && r.response.user.name === 'admin' && r.holderAfter === '1' );
await step( 'second takes over', () => call( b, 'POST', { takeover: true } ), ( r ) => r.response.held === true && r.holderAfter === '2' );
await step( 'admin refresh detects the takeover', () => call( a, 'POST' ), ( r ) => r.response.held === false && r.response.user.name === 'second' && r.holderAfter === '2' );
await step( 'admin cannot release second\'s lock', () => call( a, 'DELETE' ), ( r ) => r.response.released === false && r.holderAfter === '2' );
await step( 'second releases', () => call( b, 'DELETE' ), ( r ) => r.response.released === true && r.holderAfter === '' );
await step( 'admin takes it again', () => call( a, 'POST' ), ( r ) => r.response.held === true && r.holderAfter === '1' );
await call( a, 'DELETE' );
const out = { steps, pass: steps.every( ( s ) => s.pass ) };
writeFileSync( 'spikes/evidence/lock.json', JSON.stringify( out, null, 2 ) );
for ( const s of steps ) {
    console.log( s.pass ? 'PASS' : 'FAIL', s.name, JSON.stringify( s.response ), 'holder=' + s.holderAfter );
}
await a.browser.close();
await b.browser.close();
