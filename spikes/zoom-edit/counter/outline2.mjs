import { open, findArtboardId, enterEdit, DIR } from './lib.mjs';
import { recipeCss } from './recipe.mjs';
const z = 0.3;
const { browser, page } = await open();
const id = await findArtboardId( page );
await enterEdit( page, id );
await page.addStyleTag( { content: recipeCss( { z, variant: 'transform' } ) } );
await page.locator( '.block-editor-list-view-leaf' ).filter( { hasText: 'Group' } ).first().locator( 'a,button' ).first().click();
await page.waitForTimeout( 500 );
const read = () => page.evaluate( ( id ) => { const d = document.querySelector( `[data-wfd-artboard="${ id }"] iframe` ).contentDocument; const el = d.querySelector( '.is-selected' ); return d.defaultView.getComputedStyle( el, '::after' ).outline; }, id );
console.log( 'before', await read() );
// what BlockCanvas `styles` could carry (simulated by adding a style element to the canvas document)
await page.evaluate( ( [ id, z ] ) => { const d = document.querySelector( `[data-wfd-artboard="${ id }"] iframe` ).contentDocument; const s = d.createElement( 'style' ); s.textContent = `:root, body { --wp-admin-border-width-focus: ${ 2 / z }px; }`; d.head.appendChild( s ); }, [ id, z ] );
await page.waitForTimeout( 300 );
const after = await read();
console.log( 'after', after, 'on screen px', parseFloat( after ) * z );
await page.screenshot( { path: DIR + '/shots/outline-0.3-group-selected-compensated.png', clip: { x: 290, y: 95, width: 470, height: 400 } } );
await browser.close();
