// Reviewer probe: drag the grid item resizer's right handle onto the next cell.
import { open, spikeUrl } from './lib.mjs';

const out = {};
const injectCss = process.env.RV_CSS || '';
const cases = process.env.RV_CASES ? JSON.parse( process.env.RV_CASES ) : [ [ 'naive', false, 100 ], [ 'counter', true, 50 ], [ 'counter', true, 75 ], [ 'counter', false, 50 ] ];
for ( const [ mode, fix, zoom ] of cases ) {
    const { browser, page, errors } = await open();
    page.setDefaultTimeout( 6000 );
    await page.goto( spikeUrl( 'a', `&zoom=${ zoom }&mode=${ mode }${ fix ? '&fix=1' : '' }` ) );
    if ( injectCss ) {
        await page.addStyleTag( { content: injectCss } );
    }
    const frameEl = page.locator( '#wfd-scaled iframe' );
    const frame = page.frameLocator( '#wfd-scaled iframe' );
    const key = `${ mode }${ fix ? '+cssfix' : '' }@${ zoom }`;
    try {
        await frame.locator( 'p', { hasText: 'Grid one' } ).waitFor();
        await page.waitForTimeout( 1200 );
        const vis = async ( loc ) => {
            const o = await frameEl.evaluate( ( el ) => {
                const b = el.getBoundingClientRect();
                return { left: b.left, top: b.top, k: b.width / el.offsetWidth };
            } );
            const b = await loc.evaluate( ( el ) => {
                const r = el.getBoundingClientRect();
                return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
            } );
            return { left: o.left + b.left * o.k, top: o.top + b.top * o.k, right: o.left + b.right * o.k, bottom: o.top + b.bottom * o.k };
        };
        await page.evaluate( () => {
            const g = window.wfdBE.select.getBlocks()[ 5 ];
            window.wfdBE.dispatch.selectBlock( g.innerBlocks[ 0 ].clientId );
        } );
        await frame.locator( 'p', { hasText: 'Grid one' } ).scrollIntoViewIfNeeded();
        await page.waitForTimeout( 800 );
        const one = await vis( frame.locator( 'p', { hasText: 'Grid one' } ) );
        const two = await vis( frame.locator( 'p', { hasText: 'Grid two' } ) );
        const handle = page.locator( '.block-editor-grid-item-resizer__box .components-resizable-box__handle-right' ).first();
        const hb = await handle.evaluate( ( el ) => {
            const b = el.getBoundingClientRect();
            return { x: b.left + b.width / 2, y: b.top + b.height / 2, left: b.left, right: b.right, top: b.top, bottom: b.bottom };
        } );
        const targetX = ( two.left + two.right ) / 2 + ( two.right - two.left ) * 0.3;
        await page.mouse.move( hb.x, hb.y );
        await page.mouse.down();
        await page.mouse.move( hb.x + 10, hb.y, { steps: 3 } );
        await page.mouse.move( targetX, hb.y, { steps: 12 } );
        await page.waitForTimeout( 200 );
        const boxDuring = await page.locator( '.block-editor-grid-item-resizer__box' ).first().evaluate( ( el ) => {
            const b = el.getBoundingClientRect();
            return { left: b.left, right: b.right };
        } );
        await page.mouse.up();
        await page.waitForTimeout( 600 );
        const attrs = await page.evaluate( () => window.wfdBE.select.getBlocks()[ 5 ].innerBlocks[ 0 ].attributes.style );
        const oneAfter = await vis( frame.locator( 'p', { hasText: 'Grid one' } ) );
        out[ key ] = { one, two, handle: hb, pointerEndX: targetX, boxRightDuringDrag: boxDuring.right, styleAfter: attrs, oneAfter, consoleErrors: errors };
    } catch ( e ) {
        out[ key ] = { error: e.message.split( '\n' )[ 0 ] };
    }
    await browser.close();
}
console.log( JSON.stringify( out, null, 1 ) );
