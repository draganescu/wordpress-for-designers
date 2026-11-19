import { open, artboardId, enterEdit, DIR } from './lib.mjs';
import { applyMode } from './modes.mjs';
const mode = process.argv[ 2 ] || 'B';
const z = Number( process.argv[ 3 ] || 0.5 );
const { browser, page, errors } = await open();
await page.route( /wfd-boards\/\d+/, ( route ) => { const r = route.request(); if ( r.method() === 'GET' ) return route.continue(); console.log( 'BLOCKED', r.method(), r.url().slice( 0, 100 ), ( r.postData() || '' ).slice( 0, 600 ) ); return route.abort(); } );
const id = await artboardId( page );
await enterEdit( page, id );
const pre = await page.evaluate( () => {
    const f = document.querySelector( 'iframe[name="editor-canvas"]' );
    const out = [];
    for ( let el = f; ! el.matches( '[data-wfd-artboard]' ); el = el.parentElement ) out.push( el.tagName + '.' + el.className + ' style=' + el.getAttribute( 'style' ) );
    const ab = f.closest( '[data-wfd-artboard]' );
    out.push( 'AB style=' + ab.getAttribute( 'style' ) );
    return { out, h: f.offsetHeight };
} );
console.log( pre );
const h = pre.h;
await applyMode( page, mode, z, { x: 20, y: 40 }, h );
const fl = page.frameLocator( 'iframe[name="editor-canvas"]' );
const head = fl.locator( 'h2[data-type="core/heading"]', { hasText: 'Comments' } ).first();
let bb, t = { x: 20, y: 40 };
for ( let i = 0; i < 6; i++ ) {
    await page.waitForTimeout( 400 );
    bb = await head.boundingBox();
    console.log( 'heading bb', i, bb, t );
    if ( Math.abs( bb.x - 320 ) < 1 && Math.abs( bb.y - 300 ) < 1 ) break;
    t = { x: t.x + 320 - bb.x, y: t.y + 300 - bb.y };
    await applyMode( page, mode, z, t, h );
}
const scrolls = () => page.evaluate( () => { const out = []; for ( let el = document.querySelector( 'iframe[name="editor-canvas"]' ); el; el = el.parentElement ) if ( el.scrollTop || el.scrollLeft ) out.push( el.tagName + '.' + el.className + ' ' + el.scrollLeft + ',' + el.scrollTop ); const d = document.querySelector( 'iframe[name="editor-canvas"]' ).contentDocument; const s = d.querySelector( '.is-selected' ); return { out, inner: [ d.defaultView.scrollX, d.defaultView.scrollY ], sel: s && s.dataset.type + ':' + s.textContent.slice( 0, 20 ), hit: ( ( e ) => e && e.tagName + '.' + e.className.toString().slice(0,40) )( document.elementFromPoint( 340, 309 ) ) }; } );
console.log( 'before click', await scrolls() );
await page.screenshot( { path: `${ DIR }/shots/explore-${ mode }-${ z }-before.png` } );
await page.mouse.click( bb.x + 20, bb.y + bb.height / 2 );
await page.waitForTimeout( 300 );
console.log( 'after click', await scrolls(), await head.boundingBox() );
await page.keyboard.press( 'End' );
await page.keyboard.press( 'Enter' );
await page.waitForTimeout( 800 );
console.log( 'after enter', await scrolls(), await head.boundingBox() );
const dump = await page.evaluate( () => {
    const r = ( e ) => { const b = e.getBoundingClientRect(); return [ b.x, b.y, b.width, b.height ].map( ( n ) => Math.round( n * 10 ) / 10 ); };
    const pops = [ ...document.querySelectorAll( '.components-popover' ) ].map( ( p ) => {
        const chain = [];
        for ( let el = p.parentElement; el && chain.length < 4; el = el.parentElement ) chain.push( el.tagName + '.' + ( el.className?.toString() || '' ).slice( 0, 60 ) );
        return { cls: p.className, style: p.getAttribute( 'style' ), rect: r( p ), off: [ p.offsetWidth, p.offsetHeight ], chain, html: p.innerHTML.slice( 0, 700 ) };
    } );
    const slots = [ ...document.querySelectorAll( '.popover-slot' ) ].map( ( s ) => ( { parent: s.parentElement.tagName + '.' + s.parentElement.className, inFrame: !! s.closest( '.wfd-artboard__frame' ), n: s.children.length, rect: r( s ) } ) );
    const doc = document.querySelector( 'iframe[name="editor-canvas"]' ).contentDocument;
    const sel = doc.querySelector( '.is-selected' );
    return { pops, slots, sel: sel && { type: sel.dataset.type, rect: r( sel ), off: [ sel.offsetWidth, sel.offsetHeight ] }, inner: { iw: doc.defaultView.innerWidth, cw: doc.documentElement.clientWidth, dpr: doc.defaultView.devicePixelRatio } };
} );
console.log( JSON.stringify( dump, null, 1 ) );
const selBB = await fl.locator( '.is-selected' ).boundingBox();
console.log( 'selected bb (screen)', selBB );
await page.screenshot( { path: `${ DIR }/shots/explore-${ mode }-${ z }.png` } );
console.log( errors );
await browser.close();
