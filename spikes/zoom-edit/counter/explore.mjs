import { open, findArtboardId, enterEdit, DIR } from './lib.mjs';
const { browser, page, errors } = await open();
const id = await findArtboardId( page );
console.log( 'id', id );
await enterEdit( page, id );
const info = await page.evaluate( ( id ) => {
    const ab = document.querySelector( `[data-wfd-artboard="${ id }"]` );
    const iframe = ab.querySelector( 'iframe[name="editor-canvas"]' );
    const chain = [];
    let el = iframe;
    while ( el && el !== document.body ) {
        const cs = getComputedStyle( el );
        const r = el.getBoundingClientRect();
        chain.push( { tag: el.tagName, cls: el.className, attrs: [ ...el.attributes ].filter( a => a.name.startsWith( 'data-' ) ).map( a => a.name + '=' + a.value ).join( ' ' ), style: el.getAttribute( 'style' ), pos: cs.position, transform: cs.transform, overflow: cs.overflow, rect: [ r.x, r.y, r.width, r.height ].map( Math.round ), off: [ el.offsetWidth, el.offsetHeight ] } );
        el = el.parentElement;
    }
    const frame = ab.querySelector( '.wfd-artboard__frame' );
    const tree = ( el, d = 0 ) => d > 6 ? '' : '  '.repeat( d ) + el.tagName + '.' + String( el.className ).replace( / /g, '.' ) + '\n' + [ ...el.children ].map( c => tree( c, d + 1 ) ).join( '' );
    const doc = iframe.contentDocument;
    const blocks = [ ...doc.querySelectorAll( '[data-block]' ) ].slice( 0, 60 ).map( b => ( { t: b.getAttribute( 'data-type' ), id: b.getAttribute( 'data-block' ).slice( 0, 8 ), text: b.textContent.slice( 0, 30 ), ce: b.isContentEditable, r: ( ( r ) => [ r.x, r.y, r.width, r.height ].map( Math.round ) )( b.getBoundingClientRect() ) } ) );
    return { chain, tree: tree( frame ), blocks, popSlots: [ ...document.querySelectorAll( '.popover-slot, .components-popover__fallback-container' ) ].map( e => e.className + ' < ' + e.parentElement.className ) };
}, id );
console.log( JSON.stringify( info.chain, null, 1 ) );
console.log( info.tree );
console.log( info.popSlots );
console.log( info.blocks.map( b => JSON.stringify( b ) ).join( '\n' ) );
await page.screenshot( { path: DIR + '/shots/explore-z1.png' } );
console.log( 'errors', errors );
await browser.close();
