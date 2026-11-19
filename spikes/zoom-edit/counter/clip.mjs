// Does the frame's overflow:hidden clip in-artboard popovers near the artboard edge?
import { open, findArtboardId, enterEdit, DIR } from './lib.mjs';
import { recipeCss } from './recipe.mjs';
const z = 0.3;
for ( const frameVisible of [ false, true ] ) {
    const { browser, page } = await open();
    const id = await findArtboardId( page );
    await enterEdit( page, id );
    await page.addStyleTag( { content: recipeCss( { z, variant: 'transform', frameVisible } ) } );
    await page.waitForTimeout( 500 );
    const target = await page.evaluate( ( id ) => { const ab = document.querySelector( `[data-wfd-artboard="${ id }"]` ); const f = ab.querySelector( 'iframe' ); const fr = f.getBoundingClientRect(); const s = fr.width / f.offsetWidth; const p = [ ...f.contentDocument.querySelectorAll( 'p' ) ].find( ( e ) => e.textContent.includes( 'Designed with' ) ); const r = p.getBoundingClientRect(); return { x: fr.x + ( r.x + r.width - 30 ) * s, y: fr.y + ( r.y + r.height / 2 ) * s }; }, id );
    await page.mouse.click( target.x, target.y ); await page.waitForTimeout( 300 );
    await page.mouse.click( target.x, target.y ); await page.waitForTimeout( 300 );
    await page.mouse.dblclick( target.x, target.y ); await page.waitForTimeout( 300 );
    await page.keyboard.press( 'Meta+k' );
    const ok = await page.waitForSelector( '.block-editor-link-control', { timeout: 4000 } ).then( () => true, () => false );
    await page.waitForTimeout( 500 );
    const m = ok && await page.evaluate( ( id ) => { const ab = document.querySelector( `[data-wfd-artboard="${ id }"]` ); const fr = ab.querySelector( '.wfd-artboard__frame' ).getBoundingClientRect(); const c = document.querySelector( '.block-editor-link-control' ).closest( '.components-popover__content' ); const r = c.getBoundingClientRect(); const pts = [ [ 0.1, 0.5 ], [ 0.5, 0.5 ], [ 0.9, 0.5 ], [ 0.5, 0.9 ] ].map( ( [ fx, fy ] ) => { const X = r.x + r.width * fx, Y = r.y + r.height * fy; const t = document.elementFromPoint( X, Y ); return { X: Math.round( X ), Y: Math.round( Y ), insideFrame: X <= fr.right && Y <= fr.bottom, hit: !! t && c.contains( t ) }; } ); return { sel: ab.querySelector( 'iframe' ).contentDocument.getSelection().toString(), frame: [ fr.x, fr.y, fr.right, fr.bottom ].map( Math.round ), popover: [ r.x, r.y, r.right, r.bottom ].map( Math.round ), inArtboardDom: ab.contains( c ), pts }; }, id );
    await page.screenshot( { path: `${ DIR }/shots/clip-frameVisible-${ frameVisible }.png` } );
    console.log( 'frameVisible', frameVisible, JSON.stringify( m ) );
    await browser.close();
}
