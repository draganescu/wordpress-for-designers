import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { open, spikeUrl } from './lib.mjs';

const { browser, page, errors } = await open();
await page.goto( spikeUrl( 'c' ) );
const pv = page.frameLocator( '#wfd-preview iframe' );
await pv.locator( 'h1', { hasText: 'Spike heading' } ).waitFor();
await page.waitForTimeout( 2500 );
await page.evaluate( () => document.fonts.ready );
await page.evaluate( () => window.wfdFreeze() );
const sn = page.frameLocator( '#wfd-snapshot iframe' );
await sn.locator( 'h1', { hasText: 'Spike heading' } ).waitFor();
await page.waitForTimeout( 2000 );

const box = async ( sel ) => page.locator( sel ).evaluate( ( el ) => {
    const r = el.getBoundingClientRect();
    return { w: Math.round( r.width ), h: Math.round( r.height ) };
} );
const sizes = { preview: await box( '#wfd-preview iframe' ), snapshot: await box( '#wfd-snapshot iframe' ) };
await page.locator( '#wfd-preview iframe' ).screenshot( { path: 'spikes/evidence/c-preview.png' } );
await page.locator( '#wfd-snapshot iframe' ).screenshot( { path: 'spikes/evidence/c-snapshot.png' } );

// Pixel comparison inside the browser (no extra dependency).
const diff = async ( a, b ) => {
    const p2 = await browser.newPage();
    const toUrl = ( f ) => 'data:image/png;base64,' + execSync( `base64 -i ${ f }` ).toString().replace( /\s/g, '' );
    const res = await p2.evaluate( async ( [ ua, ub ] ) => {
        const load = ( u ) => new Promise( ( ok ) => { const i = new Image(); i.onload = () => ok( i ); i.src = u; } );
        const [ ia, ib ] = [ await load( ua ), await load( ub ) ];
        const data = ( i ) => { const c = document.createElement( 'canvas' ); c.width = i.width; c.height = i.height; const x = c.getContext( '2d' ); x.drawImage( i, 0, 0 ); return x.getImageData( 0, 0, i.width, i.height ).data; };
        if ( ia.width !== ib.width || ia.height !== ib.height ) {
            return { sameSize: false, a: [ ia.width, ia.height ], b: [ ib.width, ib.height ] };
        }
        const da = data( ia ), db = data( ib );
        let n = 0;
        for ( let i = 0; i < da.length; i += 4 ) {
            if ( da[ i ] !== db[ i ] || da[ i + 1 ] !== db[ i + 1 ] || da[ i + 2 ] !== db[ i + 2 ] ) {
                n++;
            }
        }
        return { sameSize: true, pixels: da.length / 4, differing: n };
    }, [ toUrl( a ), toUrl( b ) ] );
    await p2.close();
    return res;
};
const first = await diff( 'spikes/evidence/c-preview.png', 'spikes/evidence/c-snapshot.png' );

// No React root, no scripts in the frozen copy.
const inert = await page.evaluate( () => {
    const host = document.querySelector( '#wfd-snapshot' );
    const frame = host.querySelector( 'iframe' );
    const hostIsReactOwned = Object.keys( host ).some( ( k ) => k.startsWith( '__react' ) );
    const nodes = [ ...host.querySelectorAll( '*' ), ...frame.contentDocument.querySelectorAll( '*' ) ];
    const reactKeys = nodes.filter( ( n ) => Object.keys( n ).some( ( k ) => k.startsWith( '__react' ) ) ).length;
    return { hostIsReactOwned, nodes: nodes.length, nodesWithReactKeys: reactKeys, scripts: frame.contentDocument.querySelectorAll( 'script' ).length, sandbox: frame.getAttribute( 'sandbox' ) };
} );

// Edit the entity: the Preview changes, the Snapshot does not.
await page.evaluate( () => window.wfdEdit() );
await pv.locator( 'p', { hasText: 'Changed after freeze' } ).waitFor();
await page.waitForTimeout( 1000 );
await page.locator( '#wfd-snapshot iframe' ).screenshot( { path: 'spikes/evidence/c-snapshot-after-edit.png' } );
const second = await diff( 'spikes/evidence/c-snapshot.png', 'spikes/evidence/c-snapshot-after-edit.png' );
const snapshotStillOld = ( await sn.locator( 'h1', { hasText: 'Spike heading' } ).count() ) === 1;

const out = {
    sizes, previewVsSnapshot: first, inert, snapshotBeforeVsAfterEdit: second, snapshotStillOld, consoleErrors: errors,
    pass: first.sameSize && first.differing === 0 && inert.nodesWithReactKeys === 0 && inert.scripts === 0 && second.differing === 0 && snapshotStillOld,
};
writeFileSync( 'spikes/evidence/c.json', JSON.stringify( out, null, 2 ) );
console.log( JSON.stringify( out, null, 2 ) );
await browser.close();
