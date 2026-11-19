import fs from 'node:fs';
import { open, findArtboardId, enterEdit, DIR } from './lib.mjs';
import { recipeCss } from './recipe.mjs';

const [ , , browserName = 'chromium', zArg = '0.5', variant = 'transform', frameVis = '1' ] = process.argv;
const z = Number( zArg );
const tag = `${ browserName }-${ zArg }-${ variant }${ frameVis === '1' ? '' : '-clip' }`;
const MOD = browserName === 'webkit' || process.platform === 'darwin' ? 'Meta' : 'Control';
const out = { browser: browserName, z, variant, frameVisible: frameVis === '1', checks: {} };
const shot = ( page, name ) => page.screenshot( { path: `${ DIR }/shots/${ tag }-${ name }.png` } );
const r4 = ( r ) => r && { x: +r.x.toFixed( 1 ), y: +r.y.toFixed( 1 ), w: +r.width.toFixed( 1 ), h: +r.height.toFixed( 1 ) };

const { browser, page, errors } = await open( browserName );
const id = await findArtboardId( page );
await enterEdit( page, id );
const setPan = async ( tx, ty = 44 ) => {
    await page.evaluate( ( css ) => { let s = document.getElementById( 'wfd-sim' ); if ( ! s ) { s = document.createElement( 'style' ); s.id = 'wfd-sim'; document.head.appendChild( s ); } s.textContent = css; window.dispatchEvent( new Event( 'resize' ) ); }, recipeCss( { z, tx, ty, variant, frameVisible: frameVis === '1' } ) );
    await page.waitForTimeout( 400 );
};
await setPan( 24 );
await page.waitForTimeout( 600 );

// ---- helpers evaluated in the page ----
await page.evaluate( ( id ) => {
    const ab = document.querySelector( `[data-wfd-artboard="${ id }"]` );
    const rr = ( r ) => ( { x: r.x, y: r.y, width: r.width, height: r.height } );
    window.__w = {
        ab,
        iframe: () => ab.querySelector( 'iframe[name="editor-canvas"]' ),
        doc: () => ab.querySelector( 'iframe[name="editor-canvas"]' ).contentDocument,
        scale() { const f = this.iframe(); return f.getBoundingClientRect().width / f.offsetWidth; },
        // iframe-document rect -> top-window viewport rect
        toScreen( r ) { const f = this.iframe().getBoundingClientRect(); const s = this.scale(); return { x: f.x + r.x * s, y: f.y + r.y * s, width: r.width * s, height: r.height * s }; },
        block( sel ) { const el = typeof sel === 'string' ? this.doc().querySelector( sel ) : sel; return el ? this.toScreen( el.getBoundingClientRect() ) : null; },
        rect( el ) { return el ? rr( el.getBoundingClientRect() ) : null; },
        // is the element really hittable at a few inner points (not clipped / covered)?
        hittable( el ) {
            const r = el.getBoundingClientRect();
            const pts = [ [ 0.5, 0.5 ], [ 0.1, 0.2 ], [ 0.9, 0.8 ] ];
            return pts.map( ( [ fx, fy ] ) => { const t = document.elementFromPoint( r.x + r.width * fx, r.y + r.height * fy ); return !! t && ( el.contains( t ) || t.contains( el ) && t !== document.body && ! t.matches( '.wfd-canvas,.wfd-shell,.wfd-main' ) && el.contains( t ) ); } );
        },
        uiScale( el ) { return el.offsetWidth ? el.getBoundingClientRect().width / el.offsetWidth : null; },
        selectedIds() { return [ ...this.doc().querySelectorAll( '.is-selected,.is-multi-selected' ) ].map( ( e ) => e.getAttribute( 'data-type' ) + ':' + e.textContent.slice( 0, 12 ) ); },
    };
}, id );

const ev = ( fn, arg ) => page.evaluate( fn, arg );
const blockRect = ( sel ) => ev( ( sel ) => window.__w.block( sel ), sel );
const HEADING = '.wp-block-heading[data-type="core/heading"]';
const HEADERP = '[data-type="core/template-part"] p[data-type="core/paragraph"]';
async function check( name, fn ) {
    try { out.checks[ name ] = await fn(); } catch ( e ) { out.checks[ name ] = { pass: false, error: String( e.message ).slice( 0, 300 ) }; await shot( page, name + '-error' ).catch( () => {} ); }
    console.log( name, JSON.stringify( out.checks[ name ] ) );
}

out.geometry = await ev( () => { const w = window.__w; const f = w.iframe(); return { frame: w.rect( w.ab.querySelector( '.wfd-artboard__frame' ) ), iframe: w.rect( f ), iframeLayout: [ f.offsetWidth, f.offsetHeight ], innerWidth: f.contentWindow.innerWidth, scale: w.scale() }; } );
console.log( 'geometry', JSON.stringify( out.geometry ) );
await shot( page, '00-start' );

// ---- 2. hit-testing + typing ----
await check( 'c2_hit_typing', async () => {
    const res = {};
    // (a) heading: caret + typing
    const r = await blockRect( HEADING );
    await page.mouse.click( r.x + 30 * z, r.y + r.height / 2 );
    await page.waitForTimeout( 300 );
    const before = await ev( ( sel ) => window.__w.doc().querySelector( sel ).textContent, HEADING );
    const caretIn = await ev( ( sel ) => { const d = window.__w.doc(); const n = d.getSelection().anchorNode; return !! n && d.querySelector( sel ).contains( n ); }, HEADING );
    await page.keyboard.press( 'End' );
    await page.keyboard.type( ' Zed' );
    await page.waitForTimeout( 200 );
    const after = await ev( ( sel ) => window.__w.doc().querySelector( sel ).textContent, HEADING );
    res.heading = { screenRect: r4( r ), caretInBlock: caretIn, before, after, selected: await ev( () => window.__w.selectedIds() ) };
    // (b) elementFromPoint grid: every sampled on-screen point of 4 blocks resolves to that block
    res.grid = await ev( () => { const w = window.__w; const d = w.doc(); const f = w.iframe().getBoundingClientRect(); const s = w.scale(); const out = {}; for ( const sel of [ '.wp-block-heading[data-type="core/heading"]', '[data-type="core/post-title"]', '[data-type="core/post-date"]', '[data-type="core/template-part"] p' ] ) { const el = d.querySelector( sel ); const b = w.block( el ); let ok = 0, n = 0; for ( const fx of [ 0.05, 0.5, 0.95 ] ) for ( const fy of [ 0.2, 0.5, 0.8 ] ) { const X = b.x + b.width * fx, Y = b.y + b.height * fy; if ( X < 281 || X > 1079 || Y < 62 || Y > 899 ) continue; n++; const top = document.elementFromPoint( X, Y ); if ( top !== w.iframe() ) continue; const inner = d.elementFromPoint( ( X - f.x ) / s, ( Y - f.y ) / s ); if ( inner && ( el.contains( inner ) || ( inner.contains( el ) && inner.closest( '[data-type="core/template-part"]' ) ) ) ) ok++; } out[ sel ] = ok + '/' + n; } return out; } );
    // (c) a click on the header template part selects the header (first click selects the part)
    const hp = await blockRect( HEADERP );
    await page.mouse.click( hp.x + 30 * z, hp.y + hp.height / 2 );
    await page.waitForTimeout( 300 );
    res.headerClickSelects = await ev( () => window.__w.selectedIds() );
    res.pass = caretIn && after === before + ' Zed' && Object.values( res.grid ).every( ( v ) => v.split( '/' )[ 0 ] === v.split( '/' )[ 1 ] ) && /template-part/.test( res.headerClickSelects[ 0 ] || '' );
    return res;
} );

// ---- 1. toolbar docked ----
await check( 'c1_toolbar', async () => {
    const res = await ev( () => {
        const all = [ ...document.querySelectorAll( '.block-editor-block-toolbar' ) ];
        const host = document.querySelector( '[data-wfd-control="H6"]' );
        const inIframe = window.__w.doc().querySelectorAll( '.block-editor-block-toolbar, .block-editor-block-contextual-toolbar' ).length;
        const floating = document.querySelectorAll( '.block-editor-block-list__block-popover' ).length;
        return { count: all.length, inHeader: all.filter( ( t ) => host?.contains( t ) ).length, inIframe, floating, rect: window.__w.rect( all[ 0 ] ), uiScale: all[ 0 ] && window.__w.uiScale( all[ 0 ] ), offsetHeight: all[ 0 ]?.offsetHeight };
    } );
    res.rect = r4( res.rect );
    res.pass = res.count === 1 && res.inHeader === 1 && res.inIframe === 0 && res.floating === 0 && Math.abs( res.uiScale - 1 ) < 0.01 && Math.abs( res.rect.h - res.offsetHeight ) < 1;
    return res;
} );

// ---- 6. header toolbar dropdown (also used to add a root paragraph before the Group) ----
let P1 = null, P2 = null;
await check( 'c6_toolbar_menu', async () => {
    await page.locator( '.block-editor-list-view-leaf' ).filter( { hasText: 'Group' } ).first().locator( 'a,button' ).first().click();
    await page.waitForTimeout( 300 );
    const btn = page.locator( '[data-wfd-control="H6"] button[aria-label="Options"]' );
    const bb = await btn.boundingBox();
    await btn.click();
    await page.waitForSelector( '[role="menuitem"]', { timeout: 4000 } );
    await page.waitForTimeout( 400 );
    const m = await ev( () => { const w = window.__w; const menu = document.querySelector( '[role="menu"]' ).closest( '.components-popover__content' ) || document.querySelector( '[role="menu"]' ); return { rect: w.rect( menu ), uiScale: w.uiScale( menu ), hittable: w.hittable( menu ) }; } );
    await shot( page, 'c6-menu' );
    await page.getByRole( 'menuitem', { name: /Add before/ } ).click();
    await page.waitForTimeout( 500 );
    P1 = await ev( () => { const el = window.__w.doc().querySelector( '.is-selected[data-type="core/paragraph"]' ); return el ? '#' + el.id : null; } );
    const res = { button: r4( { x: bb.x, y: bb.y, width: bb.width, height: bb.height } ), menu: r4( m.rect ), uiScale: m.uiScale, hittable: m.hittable, addBeforeMadeParagraph: !! P1 };
    res.gapBelow = +( m.rect.y - ( bb.y + bb.height ) ).toFixed( 1 );
    res.hOverlap = m.rect.x <= bb.x + bb.width && m.rect.x + m.rect.width >= bb.x;
    res.pass = Math.abs( m.uiScale - 1 ) < 0.01 && res.gapBelow >= -2 && res.gapBelow <= 24 && res.hOverlap && m.hittable.every( Boolean ) && !! P1;
    return res;
} );

// ---- 4. slash inserter ----
await check( 'c4_slash', async () => {
    await page.keyboard.type( '/' );
    await page.waitForSelector( '.components-autocomplete__popover', { timeout: 5000 } );
    await page.waitForTimeout( 500 );
    const m = await ev( ( P1 ) => { const w = window.__w; const p = document.querySelector( '.components-autocomplete__popover' ); const content = p.querySelector( '.components-popover__content' ); const s = w.doc().getSelection().getRangeAt( 0 ); const rects = s.getClientRects(); const para = w.doc().querySelector( P1 ); const pr = para.getBoundingClientRect(); const caret = rects.length ? rects[ 0 ] : pr; return { rect: w.rect( content ), uiScale: w.uiScale( content ), hittable: w.hittable( content ), items: p.querySelectorAll( '[role="option"]' ).length, caret: w.toScreen( caret ), para: w.toScreen( pr ) }; }, P1 );
    await shot( page, 'c4-slash' );
    const p = m.rect, c = m.caret;
    const res = { paragraph: r4( m.para ), caret: r4( c ), popover: r4( p ), uiScale: m.uiScale, items: m.items, hittable: m.hittable };
    res.gapBelow = +( p.y - ( c.y + c.height ) ).toFixed( 1 ); res.gapAbove = +( c.y - ( p.y + p.height ) ).toFixed( 1 );
    res.dx = +( p.x - c.x ).toFixed( 1 );
    const adjacent = ( res.gapBelow >= -1 && res.gapBelow <= 24 ) || ( res.gapAbove >= -1 && res.gapAbove <= 24 );
    res.onScreen = p.x >= 0 && p.y >= 0 && p.x + p.width <= 1440 && p.y + p.height <= 900;
    res.pass = m.items > 0 && Math.abs( m.uiScale - 1 ) < 0.01 && adjacent && Math.abs( res.dx ) <= 40 && res.onScreen && m.hittable.every( Boolean );
    return res;
} );

// ---- 5. empty paragraph appender ----
await check( 'c5_add_block_button', async () => {
    await page.keyboard.press( 'Backspace' );
    await page.waitForTimeout( 300 );
    // bring the paragraph's right end into the visible canvas (the root paragraph is as wide as the artboard)
    let pr0 = await blockRect( P1 );
    let panned = null;
    if ( pr0.x + pr0.width > 1070 ) { panned = Math.max( 2200, Math.ceil( pr0.x + pr0.width + 420 ) ); await page.setViewportSize( { width: panned, height: 900 } ); await page.waitForTimeout( 500 ); pr0 = await blockRect( P1 ); }
    await page.mouse.move( pr0.x + pr0.width - 200, pr0.y + pr0.height / 2 + 1, { steps: 4 } );
    await page.waitForSelector( '.block-editor-block-list__empty-block-inserter .block-editor-inserter__toggle', { timeout: 5000 } );
    await page.waitForTimeout( 500 );
    const m = await ev( ( P1 ) => { const w = window.__w; const btn = document.querySelector( '.block-editor-block-list__empty-block-inserter .block-editor-inserter__toggle' ); const cover = btn.closest( '.components-popover__content' ).firstElementChild; return { button: w.rect( btn ), cover: w.rect( cover ), coverStyle: cover.getAttribute( 'style' ), para: w.block( P1 ), hittable: w.hittable( btn ), paraLayout: [ w.doc().querySelector( P1 ).offsetWidth, w.doc().querySelector( P1 ).offsetHeight ] }; }, P1 );
    await shot( page, 'c5-appender' );
    const b = m.button, p = m.para;
    const res = { viewportWidenedTo: panned, paragraph: r4( p ), paragraphLayout: m.paraLayout, cover: r4( m.cover ), coverStyle: m.coverStyle, button: r4( b ), hittable: m.hittable };
    res.rightDx = +( ( b.x + b.width ) - ( p.x + p.width ) ).toFixed( 1 );
    res.topDy = +( b.y - p.y ).toFixed( 1 );
    res.coverDw = +( m.cover.width - p.width ).toFixed( 1 ); res.coverDh = +( m.cover.height - p.height ).toFixed( 1 );
    res.sizeOk = Math.abs( b.width - 24 ) <= 1 && Math.abs( b.height - 24 ) <= 1;
    res.placedPass = Math.abs( res.rightDx ) <= 2 && Math.abs( res.topDy ) <= 2 && res.sizeOk && m.hittable.every( Boolean );
    if ( res.placedPass ) {
        await page.mouse.click( b.x + b.width / 2, b.y + b.height / 2 );
        const ok = await page.waitForSelector( '.block-editor-inserter__quick-inserter', { timeout: 4000 } ).then( () => true, () => false );
        await page.waitForTimeout( 400 );
        if ( ok ) {
            const q = await ev( () => { const w = window.__w; const c = document.querySelector( '.block-editor-inserter__quick-inserter' ).closest( '.components-popover__content' ); return { rect: w.rect( c ), uiScale: w.uiScale( c ), hittable: w.hittable( c ) }; } );
            await shot( page, 'c5-quick-inserter' );
            res.quickInserter = { rect: r4( q.rect ), uiScale: q.uiScale, hittable: q.hittable, gapBelowButton: +( q.rect.y - ( b.y + b.height ) ).toFixed( 1 ), gapAboveButton: +( b.y - ( q.rect.y + q.rect.height ) ).toFixed( 1 ), gapLeftOfButton: +( b.x - ( q.rect.x + q.rect.width ) ).toFixed( 1 ), hOverlap: q.rect.x <= b.x + b.width && q.rect.x + q.rect.width >= b.x };
            const qi = res.quickInserter;
            res.quickPass = Math.abs( q.uiScale - 1 ) < 0.01 && q.hittable.every( Boolean ) && ( ( qi.hOverlap && ( Math.abs( qi.gapBelowButton ) <= 24 || Math.abs( qi.gapAboveButton ) <= 24 ) ) || Math.abs( qi.gapLeftOfButton ) <= 24 );
            await page.keyboard.press( 'Escape' );
            await page.waitForTimeout( 300 );
        } else { res.quickInserter = null; res.quickPass = false; }
    }
    res.pass = !! ( res.placedPass && res.quickPass );
    if ( panned !== null ) { await page.setViewportSize( { width: 1440, height: 900 } ); await page.waitForTimeout( 500 ); }
    return res;
} );

// two root paragraphs with text
await check( 'setup_paragraphs', async () => {
    const pr = await blockRect( P1 );
    await page.mouse.click( pr.x + 20 * z, pr.y + pr.height / 2 );
    await page.keyboard.type( 'Second paragraph words' );
    await page.keyboard.press( 'Enter' );
    await page.waitForTimeout( 300 );
    P2 = await ev( () => { const el = window.__w.doc().querySelector( '.is-selected[data-type="core/paragraph"]' ); return el ? '#' + el.id : null; } );
    await page.keyboard.type( 'Third paragraph words' );
    await page.waitForTimeout( 300 );
    const t = await ev( ( [ a, b ] ) => [ window.__w.doc().querySelector( a ).textContent, window.__w.doc().querySelector( b ).textContent ], [ P1, P2 ] );
    return { texts: t, pass: t[ 0 ] === 'Second paragraph words' && t[ 1 ] === 'Third paragraph words' && P1 !== P2 };
} );

// ---- 3. link popover ----
await check( 'c3_link_popover', async () => {
    const h = await blockRect( P1 );
    await page.mouse.dblclick( h.x + 25 * z, h.y + h.height / 2 );
    await page.waitForTimeout( 300 );
    const sel = await ev( () => { const w = window.__w; const s = w.doc().getSelection(); return { text: s.toString(), rect: w.toScreen( s.getRangeAt( 0 ).getBoundingClientRect() ) }; } );
    await page.keyboard.press( `${ MOD }+k` );
    await page.waitForSelector( '.block-editor-link-control', { timeout: 5000 } );
    await page.waitForTimeout( 500 );
    const m = await ev( () => { const w = window.__w; const lc = document.querySelector( '.block-editor-link-control' ); const p = lc.closest( '.components-popover' ); const content = p.querySelector( '.components-popover__content' ); return { rect: w.rect( content ), uiScale: w.uiScale( content ), offsetWidth: content.offsetWidth, hittable: w.hittable( content ), insideArtboardDom: w.ab.contains( p ) }; } );
    await shot( page, 'c3-link' );
    await page.keyboard.press( 'Escape' );
    await page.waitForTimeout( 200 );
    const s = sel.rect, p = m.rect;
    const res = { selectedText: sel.text, selection: r4( s ), popover: r4( p ), uiScale: m.uiScale, hittable: m.hittable, insideArtboardDom: m.insideArtboardDom };
    res.gapBelow = +( p.y - ( s.y + s.height ) ).toFixed( 1 ); res.gapAbove = +( s.y - ( p.y + p.height ) ).toFixed( 1 );
    res.hOverlap = p.x <= s.x + s.width && p.x + p.width >= s.x;
    res.onScreen = p.x >= 0 && p.y >= 0 && p.x + p.width <= 1440 && p.y + p.height <= 900;
    const adjacent = ( res.gapBelow >= -1 && res.gapBelow <= 24 ) || ( res.gapAbove >= -1 && res.gapAbove <= 24 );
    res.pass = !! sel.text.trim() && Math.abs( m.uiScale - 1 ) < 0.01 && adjacent && res.hOverlap && res.onScreen && m.hittable.every( Boolean );
    return res;
} );

// ---- 8. selection + multi selection ----
await check( 'c8_selection', async () => {
    const a = await blockRect( P1 ), b = await blockRect( P2 );
    await page.mouse.click( a.x + 200 * z, a.y + a.height / 2 );
    await page.waitForTimeout( 250 );
    const single = await ev( ( sel ) => { const w = window.__w; const el = w.doc().querySelector( sel ); const cs = el.ownerDocument.defaultView.getComputedStyle( el, '::after' ); return { ids: w.selectedIds(), isSelected: el.classList.contains( 'is-selected' ), afterOutline: cs.outlineWidth + ' ' + cs.outlineStyle, afterBoxShadow: cs.boxShadow, focusVar: el.ownerDocument.defaultView.getComputedStyle( el ).getPropertyValue( '--wp-admin-border-width-focus' ) }; }, P1 );
    await page.keyboard.down( 'Shift' );
    await page.mouse.click( b.x + 200 * z, b.y + b.height / 2 );
    await page.keyboard.up( 'Shift' );
    await page.waitForTimeout( 300 );
    const multi = await ev( () => [ ...window.__w.doc().querySelectorAll( '.is-multi-selected' ) ].map( ( e ) => '#' + e.id ) );
    await shot( page, 'c8-multi' );
    await page.mouse.click( a.x + 200 * z, a.y + a.height / 2 );
    await page.waitForTimeout( 200 );
    return { single, multi, expected: [ P1, P2 ], pass: single.isSelected && single.ids.length === 1 && multi.length === 2 && multi[ 0 ] === P1 && multi[ 1 ] === P2 };
} );

// ---- 7. in-between inserter ----
await check( 'c7_inbetween', async () => {
    const h = await blockRect( P1 ), q = await blockRect( P2 );
    const gap = { x: ( h.x + q.x ) / 2, y: h.y + h.height, width: ( h.width + q.width ) / 2, height: q.y - ( h.y + h.height ) };
    const gx = Math.min( h.x + h.width / 2, 900 ), gy = gap.y + gap.height / 2;
    await page.mouse.move( gx - 40, h.y + h.height / 2 );
    for ( let i = 0; i < 6; i++ ) { await page.mouse.move( gx + i, gy, { steps: 3 } ); await page.waitForTimeout( 80 ); }
    await page.waitForTimeout( 700 );
    const m = await ev( () => { const w = window.__w; const p = document.querySelector( '.block-editor-block-list__insertion-point' ); if ( ! p ) return null; const ind = p.querySelector( '.block-editor-block-list__insertion-point-indicator' ); const btn = p.querySelector( '.block-editor-inserter__toggle' ); return { indicator: w.rect( ind ), button: w.rect( btn ), buttonUiScale: btn && w.uiScale( btn ), container: w.rect( p.closest( '.components-popover' )?.querySelector( '.block-editor-block-popover__inbetween-container' ) ) }; } );
    await shot( page, 'c7-inbetween' );
    if ( ! m ) return { pass: false, present: false, gap: r4( gap ), pointer: [ gx, gy ] };
    const res = { present: true, gap: r4( gap ), container: r4( m.container ), indicator: r4( m.indicator ), button: r4( m.button ), buttonUiScale: m.buttonUiScale };
    const c = m.indicator;
    res.dx = +( c.x - gap.x ).toFixed( 1 ); res.dw = +( c.width - gap.width ).toFixed( 1 );
    res.dyCenter = +( ( c.y + c.height / 2 ) - ( gap.y + gap.height / 2 ) ).toFixed( 1 );
    res.pass = Math.abs( res.dx ) <= 2 && Math.abs( res.dw ) <= 2 && Math.abs( res.dyCenter ) <= 2 && ( ! m.button || Math.abs( m.buttonUiScale - 1 ) < 0.01 );
    if ( m.button ) { res.buttonDyCenter = +( ( m.button.y + m.button.height / 2 ) - ( gap.y + gap.height / 2 ) ).toFixed( 1 ); res.pass = res.pass && Math.abs( res.buttonDyCenter ) <= 2; }
    await page.mouse.move( h.x + 200 * z, h.y + h.height / 2 );
    return res;
} );

// ---- 9. drag from list view, drop indicator ----
await check( 'c9_drag_indicator', async () => {
    const rows = page.locator( '.block-editor-list-view-leaf' );
    const names = await rows.evaluateAll( ( els ) => els.map( ( e ) => e.textContent.trim().slice( 0, 12 ) ) );
    const src = rows.filter( { hasText: 'Paragraph' } ).nth( 1 ); // P2
    const sb = await src.locator( '.block-editor-list-view-block-select-button' ).boundingBox();
    const g = await ev( ( P1 ) => { const w = window.__w; const p1 = w.doc().querySelector( P1 ); const prev = p1.previousElementSibling; return { prevType: prev?.getAttribute( 'data-type' ), prev: prev && w.block( prev ), p1: w.block( p1 ) }; }, P1 );
    const targetY = g.p1.y + Math.max( 2, 4 * z ), targetX = Math.min( g.p1.x + g.p1.width / 2, 900 );
    await page.mouse.move( sb.x + sb.width / 2, sb.y + sb.height / 2 );
    await page.mouse.down();
    await page.mouse.move( sb.x + sb.width / 2 + 20, sb.y + sb.height / 2 + 10, { steps: 5 } );
    await page.mouse.move( targetX, targetY + 60, { steps: 10 } );
    for ( let i = 0; i < 8; i++ ) { await page.mouse.move( targetX + i, targetY, { steps: 2 } ); await page.waitForTimeout( 120 ); }
    await page.waitForTimeout( 600 );
    const m = await ev( () => { const w = window.__w; const ip = document.querySelector( '.block-editor-block-list__insertion-point' ); const ind = ip?.querySelector( '.block-editor-block-list__insertion-point-indicator' ); const dzf = document.querySelector( '.block-editor-block-popover__drop-zone-foreground' ); return { indicator: w.rect( ind ), dropZone: w.rect( dzf ), popovers: [ ...document.querySelectorAll( '.components-popover' ) ].map( ( p ) => p.className.replace( /components-popover|is-positioned|is-unstyled/g, '' ).trim() ) }; } );
    await shot( page, 'c9-drag' );
    await page.mouse.move( sb.x + sb.width / 2, sb.y + sb.height / 2, { steps: 6 } );
    await page.keyboard.press( 'Escape' );
    await page.mouse.up();
    await page.waitForTimeout( 400 );
    const order = await ev( () => [ ...window.__w.doc().querySelector( '.is-root-container' ).children ].map( ( e ) => e.getAttribute( 'data-type' ).replace( 'core/', '' ) + ( e.id ? '' : '' ) ) );
    const res = { listRows: names, pointer: { x: +targetX.toFixed( 1 ), y: +targetY.toFixed( 1 ) }, prevBlock: g.prevType, prevRect: r4( g.prev ), p1Rect: r4( g.p1 ), indicator: r4( m.indicator ), dropZone: r4( m.dropZone ), popovers: m.popovers, orderAfterCancel: order };
    if ( m.indicator ) {
        const c = m.indicator; const gapTop = g.prev.y + g.prev.height, gapBottom = g.p1.y;
        res.gapOnScreen = [ +gapTop.toFixed( 1 ), +gapBottom.toFixed( 1 ) ];
        res.indicatorCenterY = +( c.y + c.height / 2 ).toFixed( 1 );
        res.dyFromGapCenter = +( c.y + c.height / 2 - ( gapTop + gapBottom ) / 2 ).toFixed( 1 );
        res.dyFromPointer = +( c.y + c.height / 2 - targetY ).toFixed( 1 );
        const expX = ( g.prev.x + g.p1.x ) / 2, expW = ( g.prev.width + g.p1.width ) / 2;
        res.dx = +( c.x - expX ).toFixed( 1 ); res.dw = +( c.width - expW ).toFixed( 1 );
        res.pass = Math.abs( res.dyFromGapCenter ) <= 3 && Math.abs( res.dx ) <= 2 && Math.abs( res.dw ) <= 2;
    } else { res.pass = false; res.note = 'no drop indicator seen'; }
    return res;
} );

// ---- 10. image block ----
await check( 'c10_image', async () => {
    const pr = await blockRect( P2 );
    await page.mouse.click( pr.x + 20 * z, pr.y + pr.height / 2 );
    await page.keyboard.press( 'End' );
    await page.keyboard.press( 'Enter' );
    await page.keyboard.type( '/image' );
    await page.waitForSelector( '.components-autocomplete__popover [role="option"]', { timeout: 4000 } );
    await page.waitForTimeout( 300 );
    await page.keyboard.press( 'Enter' );
    await page.waitForTimeout( 800 );
    const res = {};
    const ph = await ev( () => { const w = window.__w; const img = w.doc().querySelector( '.is-selected[data-type="core/image"]' ); if ( ! img ) return null; const btns = [ ...img.querySelectorAll( 'button' ) ].map( ( b ) => ( { text: b.textContent.trim(), rect: w.block( b ) } ) ); return { rect: w.block( img ), btns }; } );
    if ( ! ph ) return { pass: false, note: 'image block not inserted' };
    res.placeholder = r4( ph.rect ); res.buttons = ph.btns.map( ( b ) => b.text + '@' + JSON.stringify( r4( b.rect ) ) );
    await shot( page, 'c10-placeholder' );
    const urlBtn = ph.btns.find( ( b ) => /URL/i.test( b.text ) );
    await page.mouse.click( urlBtn.rect.x + urlBtn.rect.width / 2, urlBtn.rect.y + urlBtn.rect.height / 2 );
    const opened = await page.waitForSelector( '.block-editor-media-placeholder__url-input-form input', { timeout: 4000 } ).then( () => true, () => false );
    await page.waitForTimeout( 400 );
    res.placeholderButtonClickOpensUrlForm = opened;
    if ( ! opened ) { res.pass = false; return res; }
    const up = await ev( () => { const w = window.__w; const input = document.querySelector( '.block-editor-media-placeholder__url-input-form input' ); const c = input.closest( '.components-popover__content' ); return { rect: w.rect( c ), uiScale: w.uiScale( c ), hittable: w.hittable( c ) }; } );
    await shot( page, 'c10-url-popover' );
    const b = urlBtn.rect;
    res.urlButton = r4( b );
    res.urlPopover = { rect: r4( up.rect ), uiScale: up.uiScale, hittable: up.hittable, gapBelowButton: +( up.rect.y - ( b.y + b.height ) ).toFixed( 1 ), gapAboveButton: +( b.y - ( up.rect.y + up.rect.height ) ).toFixed( 1 ), hOverlap: up.rect.x <= b.x + b.width && up.rect.x + up.rect.width >= b.x };
    await page.keyboard.type( 'http://localhost:8888/wp-admin/images/wordpress-logo.png' );
    await page.keyboard.press( 'Enter' );
    await page.waitForFunction( () => { const i = window.__w.doc().querySelector( '[data-type="core/image"] img' ); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 8000 } );
    await page.waitForTimeout( 800 );
    const hm = await ev( () => { const w = window.__w; const blk = w.doc().querySelector( '[data-type="core/image"]' ); const img = blk.querySelector( 'img' ); const ir = img.getBoundingClientRect(); const handles = [ ...blk.querySelectorAll( '.components-resizable-box__handle' ) ].filter( ( h ) => h.getBoundingClientRect().width > 0 ).map( ( h ) => { const r = h.getBoundingClientRect(); return { cls: h.className.replace( /components-resizable-box__/g, '' ), cx: r.x + r.width / 2, cy: r.y + r.height / 2, screen: w.toScreen( r ) }; } ); return { selected: blk.classList.contains( 'is-selected' ), img: { x: ir.x, y: ir.y, width: ir.width, height: ir.height }, imgScreen: w.toScreen( ir ), handles, toolsHandles: document.querySelectorAll( '.components-resizable-box__handle' ).length }; } );
    await shot( page, 'c10-image' );
    res.imageScreen = r4( hm.imgScreen ); res.imageLayout = r4( hm.img ); res.selected = hm.selected; res.handlesInTopDocument = hm.toolsHandles;
    res.handles = hm.handles.map( ( h ) => ( { cls: h.cls, dxFromRightEdge: +( h.cx - ( hm.img.x + hm.img.width ) ).toFixed( 1 ), dyFromBottomEdge: +( h.cy - ( hm.img.y + hm.img.height ) ).toFixed( 1 ), screen: r4( h.screen ) } ) );
    const right = hm.handles.find( ( h ) => /handle-right/.test( h.cls ) );
    if ( right ) {
        const sx = right.screen.x + right.screen.width / 2, sy = right.screen.y + right.screen.height / 2;
        await page.mouse.move( sx, sy ); await page.mouse.down(); await page.mouse.move( sx - 15, sy, { steps: 4 } ); await page.mouse.move( sx - 30, sy, { steps: 4 } ); await page.mouse.up();
        await page.waitForTimeout( 600 );
        const after = await ev( () => { const w = window.__w; const img = w.doc().querySelector( '[data-type="core/image"] img' ); return { layoutW: img.getBoundingClientRect().width, screen: w.block( img ) }; } );
        res.resizeDrag = { draggedScreenPx: -30, layoutWidthBefore: hm.img.width, layoutWidthAfter: after.layoutW, screenWidthBefore: +hm.imgScreen.width.toFixed( 1 ), screenWidthAfter: +after.screen.width.toFixed( 1 ), screenDelta: +( after.screen.width - hm.imgScreen.width ).toFixed( 1 ) };
        res.resizeDrag.followsPointer = Math.abs( res.resizeDrag.screenDelta + 30 ) <= 3;
        await shot( page, 'c10-image-resized' );
    }
    const rh = res.handles.find( ( h ) => /handle-right/.test( h.cls ) );
    res.pass = opened && hm.selected && !! rh && Math.abs( rh.dxFromRightEdge ) <= 8 && Math.abs( res.urlPopover.uiScale - 1 ) < 0.01 && res.urlPopover.hittable.every( Boolean ) && !! res.resizeDrag?.followsPointer;
    return res;
} );

out.consoleErrors = errors;
fs.writeFileSync( `${ DIR }/results/${ tag }.json`, JSON.stringify( out, null, 1 ) );
console.log( 'SUMMARY', tag, Object.entries( out.checks ).map( ( [ k, v ] ) => k + '=' + ( v.pass ? 'PASS' : 'FAIL' ) ).join( ' ' ), 'errors', errors.length );
await browser.close();
