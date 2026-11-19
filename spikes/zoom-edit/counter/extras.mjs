// Check 11: other tools built on BlockPopoverCover (cover block resizer, grid visualizer, spacing visualizer, drop zone).
import fs from 'node:fs';
import { open, findArtboardId, enterEdit, DIR } from './lib.mjs';
import { recipeCss } from './recipe.mjs';
const [ , , browserName = 'chromium', zArg = '0.5', variant = 'transform' ] = process.argv;
const z = Number( zArg );
const tag = `${ browserName }-${ zArg }-${ variant }-extras`;
const out = { browser: browserName, z, variant, checks: {} };
const shot = ( page, name ) => page.screenshot( { path: `${ DIR }/shots/${ tag }-${ name }.png` } );
const r4 = ( r ) => r && { x: +r.x.toFixed( 1 ), y: +r.y.toFixed( 1 ), w: +r.width.toFixed( 1 ), h: +r.height.toFixed( 1 ) };
const { browser, page, errors } = await open( browserName );
const id = await findArtboardId( page );
await enterEdit( page, id );
await page.addStyleTag( { content: recipeCss( { z, variant } ) } );
await page.waitForTimeout( 600 );
await page.evaluate( ( id ) => {
    const ab = document.querySelector( `[data-wfd-artboard="${ id }"]` );
    window.__w = {
        ab, iframe: () => ab.querySelector( 'iframe[name="editor-canvas"]' ), doc: () => ab.querySelector( 'iframe[name="editor-canvas"]' ).contentDocument,
        scale() { const f = this.iframe(); return f.getBoundingClientRect().width / f.offsetWidth; },
        toScreen( r ) { const f = this.iframe().getBoundingClientRect(); const s = this.scale(); return { x: f.x + r.x * s, y: f.y + r.y * s, width: r.width * s, height: r.height * s }; },
        block( sel ) { const el = typeof sel === 'string' ? this.doc().querySelector( sel ) : sel; return el ? this.toScreen( el.getBoundingClientRect() ) : null; },
        rect( el ) { if ( ! el ) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; },
        covers() { return [ ...document.querySelectorAll( '.block-editor-block-popover' ) ].map( ( p ) => { const c = p.querySelector( ':scope > .components-popover__content > div[style*="position: absolute"]' ); return { cls: p.className.replace( /components-popover|block-editor-block-popover(?!_)|is-positioned|is-unstyled/g, '' ).trim(), inArtboard: ab.contains( p ), cover: c && this.rect( c ), style: c?.getAttribute( 'style' ) }; } ); },
    };
}, id );
const ev = ( fn, arg ) => page.evaluate( fn, arg );
const blockRect = ( sel ) => ev( ( sel ) => window.__w.block( sel ), sel );
const cmp = ( a, b ) => ( { dx: +( a.x - b.x ).toFixed( 1 ), dy: +( a.y - b.y ).toFixed( 1 ), dw: +( a.width - b.width ).toFixed( 1 ), dh: +( a.height - b.height ).toFixed( 1 ) } );
const near = ( d, t = 2 ) => Math.abs( d.dx ) <= t && Math.abs( d.dy ) <= t && Math.abs( d.dw ) <= t && Math.abs( d.dh ) <= t;
async function check( name, fn ) {
    try { out.checks[ name ] = await fn(); } catch ( e ) { out.checks[ name ] = { pass: false, error: String( e.message ).slice( 0, 300 ) }; await shot( page, name + '-error' ).catch( () => {} ); }
    console.log( name, JSON.stringify( out.checks[ name ] ) );
}
const selectedSel = () => ev( () => { const el = window.__w.doc().querySelector( '.is-selected' ); return el ? '#' + el.id : null; } );
async function addRootParagraph() {
    await page.locator( '.block-editor-list-view-leaf' ).filter( { hasText: 'Group' } ).first().locator( 'a,button' ).first().click();
    await page.waitForTimeout( 300 );
    await page.locator( '[data-wfd-control="H6"] button[aria-label="Options"]' ).click();
    await page.getByRole( 'menuitem', { name: /Add before/ } ).click();
    await page.waitForTimeout( 500 );
    return selectedSel();
}
async function slash( name ) {
    await page.keyboard.type( '/' + name );
    await page.waitForSelector( '.components-autocomplete__popover [role="option"]', { timeout: 4000 } );
    await page.waitForTimeout( 300 );
    await page.keyboard.press( 'Enter' );
    await page.waitForTimeout( 900 );
}

// ---- 11a. spacing visualizer on the top-level Group ----
await check( 'c11a_spacing_visualizer', async () => {
    await page.locator( '.block-editor-list-view-leaf' ).filter( { hasText: 'Group' } ).first().locator( 'a,button' ).first().click();
    await page.waitForTimeout( 400 );
    const G = await selectedSel();
    const tabs = await page.locator( '[data-wfd-region="right-panel"] [role="tab"], .wfd-slot-inspector [role="tab"]' ).evaluateAll( ( els ) => els.map( ( e ) => e.textContent + '|' + ( e.getAttribute( 'aria-label' ) || '' ) ) );
    const stylesTab = page.locator( '[role="tab"][aria-label="Styles"]' );
    if ( await stylesTab.count() ) { await stylesTab.first().click(); await page.waitForTimeout( 400 ); }
    const ctl = page.locator( '.spacing-sizes-control' ).first();
    const have = await ctl.count();
    if ( ! have ) { await shot( page, 'c11a-no-control' ); return { pass: false, note: 'no spacing control in inspector', tabs }; }
    await ctl.scrollIntoViewIfNeeded();
    const cb = await ctl.locator( 'input[type="range"], .components-range-control, .components-custom-select-control' ).first().boundingBox();
    await page.mouse.move( cb.x + cb.width / 2, cb.y + cb.height / 2, { steps: 5 } );
    await page.waitForTimeout( 700 );
    const m = await ev( ( G ) => { const w = window.__w; const v = document.querySelector( '.block-editor__spacing-visualizer' ); if ( ! v ) return { covers: w.covers() }; const cover = v.parentElement; return { vis: w.rect( v ), visStyle: v.getAttribute( 'style' ), cover: w.rect( cover ), inArtboard: w.ab.contains( v ), block: w.block( G ), pad: ( ( cs ) => [ cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft ] )( w.doc().defaultView.getComputedStyle( w.doc().querySelector( G ) ) ) }; }, G );
    await shot( page, 'c11a-spacing' );
    if ( ! m.vis ) return { pass: false, note: 'visualizer not shown', tabs, covers: m.covers };
    const d = cmp( m.cover, m.block );
    return { label: await ctl.textContent().then( ( t ) => t.slice( 0, 40 ) ), block: r4( m.block ), cover: r4( m.cover ), visualizer: r4( m.vis ), visStyle: m.visStyle, blockPadding: m.pad, renderedInsideArtboard: m.inArtboard, coverVsBlock: d, pass: near( d ) };
} );

// ---- 11b. cover block resizer (ResizableBoxPopover) ----
let P = null;
await check( 'c11b_cover_resizer', async () => {
    P = await addRootParagraph();
    await slash( 'cover' );
    const C = await ev( () => { const el = window.__w.doc().querySelector( '[data-type="core/cover"]' ); return el ? '#' + el.id : null; } );
    if ( ! C ) return { pass: false, note: 'cover not inserted' };
    // pick the first colour of the placeholder
    const sw = await ev( ( C ) => { const w = window.__w; const b = w.doc().querySelector( C + ' .components-circular-option-picker__option' ); return b ? w.block( b ) : null; }, C );
    if ( sw ) { await page.mouse.click( sw.x + sw.width / 2, sw.y + sw.height / 2 ); await page.waitForTimeout( 800 ); }
    // select the cover itself through the list view
    await page.locator( '.block-editor-list-view-leaf' ).filter( { hasText: 'Cover' } ).first().locator( 'a,button' ).first().click();
    await page.waitForTimeout( 700 );
    const m = await ev( ( C ) => { const w = window.__w; const p = document.querySelector( '.block-library-cover__resizable-box-popover' ); if ( ! p ) return { covers: w.covers(), swatch: true }; const cover = p.querySelector( ':scope > .components-popover__content > div' ); const handle = p.querySelector( '.components-resizable-box__handle-bottom' ); const box = p.querySelector( '.components-resizable-box__container' ); return { cover: w.rect( cover ), coverStyle: cover.getAttribute( 'style' ), box: w.rect( box ), handle: w.rect( handle ), block: w.block( C ), inArtboard: w.ab.contains( p ) }; }, C );
    await shot( page, 'c11b-cover' );
    if ( ! m.cover ) return { pass: false, note: 'resizable box popover not shown', swatchFound: !! sw, covers: m.covers };
    const d = cmp( m.cover, m.block );
    const res = { block: r4( m.block ), cover: r4( m.cover ), coverStyle: m.coverStyle, resizableBox: r4( m.box ), handle: r4( m.handle ), coverVsBlock: d, renderedInsideArtboard: m.inArtboard };
    res.handleCenterDyFromBlockBottom = +( m.handle.y + m.handle.height / 2 - ( m.block.y + m.block.height ) ).toFixed( 1 );
    // drag the bottom handle 40 screen px down
    const hx = m.handle.x + m.handle.width / 2, hy = m.handle.y + m.handle.height / 2;
    await page.mouse.move( hx, hy ); await page.mouse.down(); await page.mouse.move( hx, hy + 20, { steps: 4 } ); await page.mouse.move( hx, hy + 40, { steps: 4 } ); await page.mouse.up();
    await page.waitForTimeout( 700 );
    const after = await blockRect( C );
    res.drag = { draggedScreenPx: 40, screenHeightBefore: +m.block.height.toFixed( 1 ), screenHeightAfter: +after.height.toFixed( 1 ), screenDelta: +( after.height - m.block.height ).toFixed( 1 ) };
    res.drag.followsPointer = Math.abs( res.drag.screenDelta - 40 ) <= 3;
    await shot( page, 'c11b-cover-resized' );
    res.placementPass = near( d ) && Math.abs( res.handleCenterDyFromBlockBottom ) <= 4;
    res.pass = res.placementPass && res.drag.followsPointer;
    return res;
} );

// ---- 11c. grid visualizer ----
await check( 'c11c_grid_visualizer', async () => {
    await addRootParagraph();
    await slash( 'grid' );
    const G = await ev( () => { const el = window.__w.doc().querySelector( '.wp-block-group.is-layout-grid, [data-type="core/group"].is-selected' ); return el ? '#' + el.id : null; } );
    await page.waitForTimeout( 500 );
    const m = await ev( ( G ) => { const w = window.__w; const p = document.querySelector( '.block-editor-grid-visualizer' ); const info = { selected: w.doc().querySelector( '.is-selected' )?.className.slice( 0, 120 ), G, covers: w.covers() }; if ( ! p || ! G ) return info; const cover = p.querySelector( ':scope > .components-popover__content > div' ); const grid = p.querySelector( '.block-editor-grid-visualizer__grid' ); return { ...info, cover: w.rect( cover ), grid: w.rect( grid ), cells: p.querySelectorAll( '.block-editor-grid-visualizer__cell' ).length, block: w.block( G ), inArtboard: w.ab.contains( p ) }; }, G );
    await shot( page, 'c11c-grid' );
    if ( ! m.cover ) return { pass: false, note: 'grid visualizer not shown', selected: m.selected, G: m.G, covers: m.covers };
    const d = cmp( m.cover, m.block );
    return { block: r4( m.block ), cover: r4( m.cover ), grid: r4( m.grid ), cells: m.cells, coverVsBlock: d, renderedInsideArtboard: m.inArtboard, pass: near( d ) };
} );

// ---- 11d. drop zone cover (drag a list-view row over an empty group) ----
await check( 'c11d_drop_zone', async () => {
    const all = await ev( () => window.__w.covers() );
    const rows = page.locator( '.block-editor-list-view-leaf' );
    const names = await rows.evaluateAll( ( els ) => els.map( ( e ) => e.textContent.trim().slice( 0, 10 ) ) );
    const target = await ev( () => { const w = window.__w; const el = w.doc().querySelector( '.wp-block-group.is-layout-grid' ) || w.doc().querySelector( '[data-type="core/cover"] .wp-block-cover__inner-container' ); return el ? { rect: w.block( el ), cls: el.className.slice( 0, 80 ) } : null; } );
    if ( ! target ) return { pass: false, note: 'no empty container to drag over', names };
    const src = rows.filter( { hasText: 'Header' } ).first();
    const sb = await src.locator( '.block-editor-list-view-block-select-button' ).boundingBox();
    const tx = Math.min( target.rect.x + target.rect.width / 2, 1000 ), ty = target.rect.y + target.rect.height / 2;
    await page.mouse.move( sb.x + sb.width / 2, sb.y + sb.height / 2 );
    await page.mouse.down();
    await page.mouse.move( sb.x + 40, sb.y + 20, { steps: 5 } );
    await page.mouse.move( tx, ty - 10, { steps: 10 } );
    for ( let i = 0; i < 8; i++ ) { await page.mouse.move( tx + i, ty, { steps: 2 } ); await page.waitForTimeout( 120 ); }
    await page.waitForTimeout( 600 );
    const m = await ev( () => { const w = window.__w; const dz = document.querySelector( '.block-editor-block-popover__drop-zone' ); const fg = dz?.querySelector( '.block-editor-block-popover__drop-zone-foreground' ); const ind = document.querySelector( '.block-editor-block-list__insertion-point-indicator' ); return { dropZone: w.rect( fg ), cover: w.rect( fg?.parentElement ), indicator: w.rect( ind ), covers: w.covers() }; } );
    await shot( page, 'c11d-dropzone' );
    await page.mouse.move( sb.x + sb.width / 2, sb.y + sb.height / 2, { steps: 6 } );
    await page.keyboard.press( 'Escape' ); await page.mouse.up();
    await page.waitForTimeout( 300 );
    const res = { target: r4( target.rect ), targetClass: target.cls, dropZone: r4( m.dropZone ), cover: r4( m.cover ), indicator: r4( m.indicator ), popovers: m.covers.map( ( c ) => c.cls ) };
    if ( m.cover ) {
        // the drop zone covers the block the insertion point is in
        const candidates = await ev( () => { const w = window.__w; return [ ...w.doc().querySelectorAll( '[data-block]' ) ].map( ( e ) => ( { t: e.getAttribute( 'data-type' ), r: w.block( e ) } ) ); } );
        const best = candidates.map( ( c ) => ( { t: c.t, d: cmp( m.cover, c.r ) } ) ).sort( ( a, b ) => ( Math.abs( a.d.dx ) + Math.abs( a.d.dy ) + Math.abs( a.d.dw ) + Math.abs( a.d.dh ) ) - ( Math.abs( b.d.dx ) + Math.abs( b.d.dy ) + Math.abs( b.d.dw ) + Math.abs( b.d.dh ) ) )[ 0 ];
        res.closestBlock = best; res.pass = near( best.d );
    } else { res.pass = false; res.note = 'no drop-zone cover shown (an in-between indicator may be used instead)'; }
    return res;
} );

out.consoleErrors = errors;
fs.writeFileSync( `${ DIR }/results/${ tag }.json`, JSON.stringify( out, null, 1 ) );
console.log( 'SUMMARY', tag, Object.entries( out.checks ).map( ( [ k, v ] ) => k + '=' + ( v.pass ? 'PASS' : 'FAIL' ) ).join( ' ' ), 'errors', errors.length );
await browser.close();
