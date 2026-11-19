import { open, artboardId, enterEdit, DIR } from './lib.mjs';
import { applyMode } from './modes.mjs';
const { browser, page } = await open();
page.setDefaultTimeout( 5000 );
await page.route( /wfd-boards\/\d+/, ( route ) => route.request().method() === 'GET' ? route.continue() : route.abort() );
const id = await artboardId( page );
await enterEdit( page, id );
await page.addStyleTag( { content: '.wfd-canvas{overflow:clip!important}.wfd-artboard__frame{overflow:clip!important}' } );
const fl = page.frameLocator( 'iframe[name="editor-canvas"]' );
const ifr = page.locator( 'iframe[name="editor-canvas"]' );
const h = await ifr.evaluate( ( f ) => f.offsetHeight );
let t = { x: 20, y: 40 };
async function position( locator, at = { x: 320, y: 300 } ) {
    let b;
    for ( let i = 0; i < 8; i++ ) {
        await applyMode( page, 'naive', 1, t, h );
        b = await locator.boundingBox();
        if ( Math.abs( b.x - at.x ) < 0.6 && Math.abs( b.y - at.y ) < 0.6 ) return b;
        t = { x: t.x + at.x - b.x, y: t.y + at.y - b.y };
    }
    return b;
}
const sel = () => ifr.evaluate( ( f ) => { const d = f.contentDocument; const s = d.querySelector( '.is-selected' ); const a = d.getSelection().anchorNode; const ab = a && ( a.nodeType === 1 ? a : a.parentElement ).closest( '[data-block]' ); return ( s ? s.dataset.type + ':' + s.textContent.slice( 0, 15 ) + ' empty=' + s.dataset.empty : null ) + ' | caret in ' + ( ab && ab.dataset.type ); } );
for ( const [ name, loc ] of [ [ 'more', fl.locator( 'h2', { hasText: 'More posts' } ) ], [ 'written', fl.locator( 'p', { hasText: 'Written by' } ) ], [ 'headerP', fl.locator( 'header p' ).first() ] ] ) {
    const b = await position( loc );
    await page.mouse.click( b.x + 20, b.y + b.height / 2 );
    await page.waitForTimeout( 300 );
    console.log( name, 'click1', await sel() );
    await page.mouse.click( b.x + 20, b.y + b.height / 2 );
    await page.waitForTimeout( 300 );
    console.log( name, 'click2', await sel() );
    await page.keyboard.press( 'End' );
    await page.keyboard.press( 'Enter' );
    await page.waitForTimeout( 600 );
    console.log( name, 'enter', await sel() );
    await page.screenshot( { path: `${ DIR }/shots/explore2-${ name }.png` } );
}
// what is in the toolbar
console.log( await page.evaluate( () => [ ...document.querySelectorAll( '[data-wfd-control="H6"] button' ) ].map( ( b ) => b.getAttribute( 'aria-label' ) || b.textContent ) ) );
await browser.close();
