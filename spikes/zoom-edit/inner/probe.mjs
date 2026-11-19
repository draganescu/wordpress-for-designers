import { open, artboardId, enterEdit, DIR } from './lib.mjs';
const { browser, page, errors } = await open();
const id = await artboardId( page );
console.log( 'id', id );
await enterEdit( page, id );
const info = await page.evaluate( ( id ) => {
    const ab = document.querySelector( `[data-wfd-artboard="${ id }"]` );
    const iframe = ab.querySelector( 'iframe[name="editor-canvas"]' );
    const chain = [];
    for ( let el = iframe; el && el !== document.documentElement; el = el.parentElement ) {
        const cs = getComputedStyle( el );
        const r = el.getBoundingClientRect();
        chain.push( { tag: el.tagName, cls: el.className?.toString().slice( 0, 90 ), attrs: [ ...el.attributes ].filter( a => a.name.startsWith( 'data-' ) ).map( a => a.name + '=' + a.value ).join( ' ' ), pos: cs.position, transform: cs.transform, inlineT: el.style.transform, overflow: cs.overflow, rect: [ r.x, r.y, r.width, r.height ].map( Math.round ), off: [ el.offsetWidth, el.offsetHeight ], zoom: cs.zoom } );
    }
    const doc = iframe.contentDocument;
    const blocks = [ ...doc.querySelectorAll( '[data-block]' ) ].map( b => ( { type: b.dataset.type, id: b.dataset.block.slice( 0, 8 ), tag: b.tagName, text: b.textContent.slice( 0, 40 ), r: ( ( r ) => [ r.x, r.y, r.width, r.height ].map( Math.round ) )( b.getBoundingClientRect() ), ce: b.isContentEditable } ) );
    return { chain, blocks, iw: doc.documentElement.clientWidth, vp: window.wfdTest?.viewport.get(), popSlots: [ ...document.querySelectorAll( '.popover-slot, .block-editor-block-tools, .components-popover__fallback-container' ) ].map( e => e.className + ' < ' + e.parentElement.className ) };
}, id );
console.log( JSON.stringify( info, null, 1 ) );
await page.screenshot( { path: DIR + '/shots/probe-live.png' } );
console.log( errors );
await browser.close();
