// node run.mjs <browser> <mode> <zoom> [fix]
import fs from 'node:fs';
import { open, artboardId, enterEdit, DIR } from './lib.mjs';
import { applyMode } from './modes.mjs';
import utilsBundle from '/Users/andreidraganescu/Sites/wordpress-for-designers/node_modules/playwright-core/lib/utilsBundle.js';
const { PNG } = utilsBundle;

const [ , , browserName = 'chromium', mode = 'B', zArg = '0.5', fixArg ] = process.argv;
const z = Number( zArg );
const fix = fixArg === 'fix';
const tag = `${ browserName }__${ mode }${ fix ? '+fix' : '' }__${ z }`;
const out = { browser: browserName, mode, fix, zoom: z, checks: {}, notes: [] };
const r1 = ( n ) => Math.round( n * 10 ) / 10;
const rr = ( b ) => b && { x: r1( b.x ), y: r1( b.y ), w: r1( b.width ), h: r1( b.height ) };
const shot = ( page, name ) => page.screenshot( { path: `${ DIR }/shots/${ tag }__${ name }.png` } );

const VW = Number( process.env.ZS_VW || 1440 );
const { browser, page, errors } = await open( browserName, { width: VW, height: 900 } );
page.setDefaultTimeout( 6000 );
await page.route( /wfd-boards\/\d+/, ( route ) => {
    const r = route.request();
    if ( r.method() === 'GET' ) {
        return route.continue();
    }
    out.notes.push( 'blocked board autosave ' + r.method() );
    return route.abort();
} );
const id = await artboardId( page );
await enterEdit( page, id );
const fl = page.frameLocator( 'iframe[name="editor-canvas"]' );
const ifr = page.locator( 'iframe[name="editor-canvas"]' );
const h = await ifr.evaluate( ( f ) => f.offsetHeight );
await page.addStyleTag( { content: '.wfd-canvas{overflow:clip!important}.wfd-artboard__frame{overflow:clip!important}' } );

let t = { x: 20, y: 40 };
// --- Coordinate maps, measured, not derived --------------------------------
// paint map: where an element of the canvas document is DRAWN on screen (from a screenshot
//            of the element painted magenta) relative to its getBoundingClientRect in the canvas.
// event map: which canvas-document client coordinates a real mouse event at a screen point gets.
// If the two disagree, pointer hit-testing is off from what the user sees.
const cbox = await page.locator( '[data-wfd-region="canvas"]' ).boundingBox();
const CANVAS = { left: cbox.x, top: cbox.y, right: cbox.x + cbox.width, bottom: cbox.y + cbox.height };
let M = null;
const irect = ( locator ) => locator.evaluate( ( el ) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; } );
const sbox = async ( locator ) => {
    const r = await irect( locator );
    return { x: M.ox + r.x * M.sx, y: M.oy + r.y * M.sy, width: r.w * M.sx, height: r.h * M.sy };
};
async function paintBox( locator ) {
    await locator.evaluate( ( el ) => {
        const doc = el.ownerDocument;
        const st = doc.createElement( 'style' );
        st.id = 'zs-mark-style';
        st.textContent = '[data-zs-mark],[data-zs-mark] *{background:#ff00ff!important;color:#ff00ff!important;outline:none!important;box-shadow:none!important;caret-color:transparent!important}[data-zs-mark]::after,[data-zs-mark]::before{display:none!important}[data-zs-mark]::selection,[data-zs-mark] *::selection{background:#ff00ff!important;color:#ff00ff!important}';
        doc.head.appendChild( st );
        el.setAttribute( 'data-zs-mark', '' );
    } );
    await page.waitForTimeout( 120 );
    const buf = await page.screenshot();
    if ( process.env.ZS_DEBUG ) {
        ( await import( 'node:fs' ) ).writeFileSync( `${ DIR }/shots/${ tag }__mark-${ Date.now() }.png`, buf );
    }
    const png = PNG.sync.read( buf );
    await locator.evaluate( ( el ) => {
        el.removeAttribute( 'data-zs-mark' );
        el.ownerDocument.getElementById( 'zs-mark-style' ).remove();
    } );
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
    for ( let y = 0; y < png.height; y++ ) {
        for ( let x = 0; x < png.width; x++ ) {
            const i = ( y * png.width + x ) * 4;
            if ( png.data[ i ] > 235 && png.data[ i + 1 ] < 25 && png.data[ i + 2 ] > 235 ) {
                if ( x < x0 ) x0 = x;
                if ( x > x1 ) x1 = x;
                if ( y < y0 ) y0 = y;
                if ( y > y1 ) y1 = y;
            }
        }
    }
    if ( x1 < 0 ) {
        return null;
    }
    const box = { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
    box.clipped = x0 <= CANVAS.left || y0 <= CANVAS.top || x1 >= CANVAS.right - 1 || y1 >= CANVAS.bottom - 1;
    return box;
}
async function eventMap( points = [ [ 600, 400 ], [ 720, 520 ] ] ) {
    await ifr.evaluate( ( f ) => {
        const w = f.contentWindow;
        if ( ! w.__zsMove ) {
            w.__zsMove = true;
            f.contentDocument.addEventListener( 'mousemove', ( e ) => { w.__zsLast = [ e.clientX, e.clientY ]; }, true );
        }
        w.__zsLast = null;
    } );
    const got = [];
    for ( const [ x, y ] of points ) {
        await page.mouse.move( x - 9, y - 7 );
        await page.waitForTimeout( 80 );
        await ifr.evaluate( ( f ) => { f.contentWindow.__zsLast = null; } );
        let last = null;
        // Nudge by a pixel and back until the canvas reports a move at the final point twice.
        for ( let i = 0; i < 6; i++ ) {
            await page.mouse.move( x + 1, y );
            await page.mouse.move( x, y );
            await page.waitForTimeout( 90 );
            const now = await ifr.evaluate( ( f ) => f.contentWindow.__zsLast );
            if ( now && last && now[ 0 ] === last[ 0 ] && now[ 1 ] === last[ 1 ] ) {
                break;
            }
            last = now;
        }
        if ( ! last ) {
            return null;
        }
        got.push( last );
    }
    // screen = o + inner * s
    const sx = ( points[ 1 ][ 0 ] - points[ 0 ][ 0 ] ) / ( got[ 1 ][ 0 ] - got[ 0 ][ 0 ] );
    const sy = ( points[ 1 ][ 1 ] - points[ 0 ][ 1 ] ) / ( got[ 1 ][ 1 ] - got[ 0 ][ 1 ] );
    return { sx, sy, ox: points[ 0 ][ 0 ] - got[ 0 ][ 0 ] * sx, oy: points[ 0 ][ 1 ] - got[ 0 ][ 1 ] * sy };
}
out.maps = [];
async function position( locator, at = { x: 320, y: 300 }, name = '' ) {
    await applyMode( page, mode, z, t, h, { fix } );
    let E = await eventMap();
    if ( process.env.ZS_DEBUG ) {
        console.log( 'coarse E', JSON.stringify( E ), JSON.stringify( t ), JSON.stringify( await ifr.boundingBox() ) );
    }
    if ( E ) {
        const r = await irect( locator );
        t = { x: t.x + at.x - ( E.ox + r.x * E.sx ), y: t.y + at.y - ( E.oy + r.y * E.sy ) };
        await applyMode( page, mode, z, t, h, { fix } );
    }
    let P = null;
    for ( let i = 0; i < 5; i++ ) {
        P = await paintBox( locator );
        if ( ! P ) {
            break;
        }
        if ( Math.abs( P.x - at.x ) <= 1 && Math.abs( P.y - at.y ) <= 1 ) {
            break;
        }
        t = { x: t.x + at.x - P.x, y: t.y + at.y - P.y };
        await applyMode( page, mode, z, t, h, { fix } );
    }
    const r = await irect( locator );
    E = await eventMap( [ [ at.x + 8, at.y + 6 ], [ at.x + 128, at.y + 126 ] ] ) || await eventMap();
    let paintScaleMismatch = null;
    if ( P && ! P.clipped ) {
        // Whole-pixel boxes give a coarse scale; take the exact scale from the event map when the painted size agrees with it.
        let sx = P.width / r.w;
        let sy = P.height / r.h;
        if ( E && Math.abs( P.width - r.w * E.sx ) <= 2.5 && Math.abs( P.height - r.h * E.sy ) <= 2.5 ) {
            sx = E.sx;
            sy = E.sy;
        } else if ( E ) {
            paintScaleMismatch = { paintedSize: [ P.width, P.height ], sizeByEventScale: [ r1( r.w * E.sx ), r1( r.h * E.sy ) ] };
        }
        M = { sx, sy, ox: P.x - r.x * sx, oy: P.y - r.y * sy };
    } else {
        M = E;
        out.notes.push( `paint map unavailable for ${ name } (painted box ${ JSON.stringify( P ) }); event map used` );
    }
    const rec = { for: name, at, paintScaleMismatch, innerRect: { x: r1( r.x ), y: r1( r.y ), w: r1( r.w ), h: r1( r.h ) }, paintedBox: P, paint: M && { scale: [ Math.round( M.sx * 1000 ) / 1000, Math.round( M.sy * 1000 ) / 1000 ], origin: [ r1( M.ox ), r1( M.oy ) ] }, event: E && { scale: [ Math.round( E.sx * 1000 ) / 1000, Math.round( E.sy * 1000 ) / 1000 ], origin: [ r1( E.ox ), r1( E.oy ) ] } };
    if ( M && E ) {
        // Where the pointer "thinks" the painted centre of the element is, expressed as an on-screen error.
        const cx = M.ox + ( r.x + r.w / 2 ) * M.sx;
        const cy = M.oy + ( r.y + r.h / 2 ) * M.sy;
        const ix = ( cx - E.ox ) / E.sx;
        const iy = ( cy - E.oy ) / E.sy;
        rec.hitOffsetOnScreen = [ r1( ( ix - ( r.x + r.w / 2 ) ) * M.sx ), r1( ( iy - ( r.y + r.h / 2 ) ) * M.sy ) ];
    }
    out.maps.push( rec );
    console.log( tag, 'map', JSON.stringify( rec ) );
    await page.mouse.move( 700, 80 );
    return sbox( locator );
}
// Measures parent-document elements: on-screen box, layout size, visibility.
const tool = ( selector, closest ) =>
    page.evaluate(
        ( [ selector, closest ] ) => {
            let el = document.querySelector( selector );
            if ( el && closest ) {
                el = el.closest( closest );
            }
            if ( ! el ) {
                return null;
            }
            const b = el.getBoundingClientRect();
            const top = document.elementFromPoint( b.x + b.width / 2, b.y + b.height / 2 );
            return {
                x: Math.round( b.x * 10 ) / 10,
                y: Math.round( b.y * 10 ) / 10,
                w: Math.round( b.width * 10 ) / 10,
                h: Math.round( b.height * 10 ) / 10,
                layoutW: el.offsetWidth,
                layoutH: el.offsetHeight,
                scale: el.offsetWidth ? Math.round( ( b.width / el.offsetWidth ) * 1000 ) / 1000 : null,
                topmost: !! top && ( el.contains( top ) || top.contains( el ) ),
                inFrame: !! el.closest( '.wfd-artboard__frame' ),
                onScreen: b.x >= 0 && b.y >= 0 && b.right <= innerWidth && b.bottom <= innerHeight,
            };
        },
        [ selector, closest ]
    );
const inner = ( fn, arg ) => ifr.evaluate( ( f, [ src, arg ] ) => new Function( 'doc', 'arg', `return (${ src })(doc, arg)` )( f.contentDocument, arg ), [ fn.toString(), arg ] );
const selected = () => inner( ( doc ) => {
    const s = doc.querySelector( '.is-selected' );
    const a = doc.getSelection().anchorNode;
    const ab = a && ( a.nodeType === 1 ? a : a.parentElement ).closest( '[data-block]' );
    return { selected: s && s.dataset.block, type: s && s.dataset.type, caretIn: ab && ab.dataset.block };
} );
const check = ( name, pass, evidence ) => {
    out.checks[ name ] = { pass, evidence };
    console.log( `${ tag } ${ name }: ${ pass === null ? 'n/m' : pass ? 'PASS' : 'FAIL' } ${ JSON.stringify( evidence ) }` );
};
const step = async ( name, fn ) => {
    try {
        await fn();
    } catch ( e ) {
        check( name, false, { error: String( e.message || e ).split( '\n' )[ 0 ].slice( 0, 300 ) } );
        await shot( page, name + '-error' ).catch( () => {} );
    }
};

const pwid = await fl.locator( 'p[data-type="core/paragraph"]', { hasText: 'Written by' } ).first().getAttribute( 'data-block' );
const pw = fl.locator( `[data-block="${ pwid }"]` );
let bw = null;
const clickPw = async () => {
    bw = await sbox( pw );
    await page.mouse.click( bw.x + bw.width / 2, bw.y + bw.height / 2 );
    await page.waitForTimeout( 350 );
};
out.layout = await inner( ( doc ) => {
    const w = doc.defaultView;
    const root = doc.querySelector( '.is-root-container' );
    return {
        innerWidth: w.innerWidth,
        clientWidth: doc.documentElement.clientWidth,
        dpr: w.devicePixelRatio,
        mqMin1440: w.matchMedia( '(min-width: 1440px)' ).matches,
        mqMin782: w.matchMedia( '(min-width: 782px)' ).matches,
        mqMin600: w.matchMedia( '(min-width: 600px)' ).matches,
        rootOffsetWidth: root.offsetWidth,
        rootRectWidth: Math.round( root.getBoundingClientRect().width * 10 ) / 10,
        p1OffsetWidth: doc.querySelector( 'h1' ).offsetWidth,
        p1RectWidth: Math.round( doc.querySelector( 'h1' ).getBoundingClientRect().width * 10 ) / 10,
        vw100: ( () => { const d = doc.createElement( 'div' ); d.style.cssText = 'position:absolute;width:100vw;height:0'; doc.body.appendChild( d ); const v = d.offsetWidth + '/' + Math.round( d.getBoundingClientRect().width ); d.remove(); return v; } )(),
    };
} );
out.layout.iframeScreen = rr( await ifr.boundingBox() );
console.log( tag, 'layout', JSON.stringify( out.layout ) );
const calib = async () => ( {
    toScreen: ( r ) => ( { x: M.ox + r.x * M.sx, y: M.oy + r.y * M.sy, width: r.w * M.sx, height: r.h * M.sy } ),
    toInner: ( p ) => ( { x: ( p.x - M.ox ) / M.sx, y: ( p.y - M.oy ) / M.sy } ),
} );

// ---- 11. other tools built on BlockPopoverCover (appended to the head of run.mjs by gen-covers.sh) ----
const title = fl.locator( 'h1[data-type="core/post-title"]' ).first();
const titleId = await title.getAttribute( 'data-block' );
let p2 = null;
await step( '11-setup', async () => {
    const tb = await position( title, { x: 320, y: 250 }, 'post-title' );
    await page.mouse.click( tb.x + tb.width - 20, tb.y + tb.height / 2 );
    await page.waitForTimeout( 350 );
    await page.keyboard.press( 'Enter' );
    await page.waitForTimeout( 500 );
    await page.mouse.move( tb.x + tb.width - 60, tb.y + tb.height + 80 * z, { steps: 3 } );
    await page.waitForTimeout( 500 );
    const sel = await selected();
    p2 = fl.locator( `[data-block="${ sel.selected }"]` );
    if ( sel.type !== 'core/paragraph' ) {
        throw new Error( 'no empty paragraph' );
    }
} );

// 11a. drop-zone cover over an empty paragraph (synthetic drag)
await step( '11a-drop-zone-cover', async () => {
    const b2 = await sbox( p2 );
    const ip = { x: ( b2.x + b2.width / 3 - M.ox ) / M.sx, y: ( b2.y + b2.height / 2 - M.oy ) / M.sy };
    const on = await inner( ( doc, ip ) => {
        const w = doc.defaultView;
        const el = doc.elementFromPoint( ip.x, ip.y );
        const dt = new w.DataTransfer();
        try {
            dt.items.add( new w.File( [ 'x' ], 'a.png', { type: 'image/png' } ) );
        } catch ( e ) {}
        const fire = ( type ) => el.dispatchEvent( new w.DragEvent( type, { bubbles: true, cancelable: true, composed: true, dataTransfer: dt, clientX: ip.x, clientY: ip.y } ) );
        fire( 'dragenter' );
        fire( 'dragover' );
        w.setTimeout( () => fire( 'dragover' ), 250 );
        w.setTimeout( () => fire( 'dragover' ), 500 );
        w.__zsDragEnd = () => { fire( 'dragleave' ); doc.dispatchEvent( new w.DragEvent( 'dragend', { bubbles: true } ) ); };
        return el.tagName;
    }, ip );
    await page.waitForTimeout( 1000 );
    const zone = await tool( '.block-editor-block-popover__drop-zone [data-testid="block-popover-drop-zone"]' );
    await shot( page, '11a-drop-zone' );
    await inner( ( doc ) => doc.defaultView.__zsDragEnd && doc.defaultView.__zsDragEnd() );
    await page.waitForTimeout( 300 );
    if ( ! zone ) {
        return check( '11a-drop-zone-cover', null, { emptyParagraph: rr( b2 ), dispatchedOn: on, dropZone: null } );
    }
    const ok = Math.abs( zone.x - b2.x ) <= 3 && Math.abs( zone.y - b2.y ) <= 3 && Math.abs( zone.w - b2.width ) <= 4 && Math.abs( zone.h - b2.height ) <= 4;
    check( '11a-drop-zone-cover', ok, { synthetic: true, emptyParagraph: rr( b2 ), dropZone: zone } );
} );

// 11b. Cover block: its height handle is a ResizableBoxPopover (BlockPopoverCover)
let cover = null;
await step( '11b-resizable-box-popover', async () => {
    const b2 = await sbox( p2 );
    await page.mouse.click( b2.x + 10, b2.y + b2.height / 2 );
    await page.waitForTimeout( 200 );
    await page.keyboard.type( '/cover' );
    await page.waitForTimeout( 600 );
    await page.keyboard.press( 'Enter' );
    await page.waitForTimeout( 900 );
    cover = fl.locator( '[data-type="core/cover"]' ).first();
    const swatch = cover.locator( '.components-circular-option-picker__option' ).first();
    const sb = await sbox( swatch );
    await page.mouse.click( sb.x + sb.width / 2, sb.y + sb.height / 2 );
    await page.waitForTimeout( 900 );
    let sel = await selected();
    if ( sel.type !== 'core/cover' ) {
        const parentBtn = page.locator( '[data-wfd-control="H6"] button[aria-label^="Select parent block"]' ).first();
        if ( await parentBtn.count() ) {
            await parentBtn.click();
            await page.waitForTimeout( 500 );
        }
        sel = await selected();
    }
    await page.mouse.move( 700, 80 );
    await page.waitForTimeout( 400 );
    const cb = await sbox( cover );
    const box = await tool( '.block-library-cover__resize-container' );
    const handle = await tool( '.block-library-cover__resizable-box-popover .components-resizable-box__handle-bottom' );
    await shot( page, '11b-cover' );
    const ev = { selectedType: sel.type, coverOnScreen: rr( cb ), resizableBox: box, bottomHandle: handle };
    if ( ! handle ) {
        return check( '11b-resizable-box-popover', null, ev );
    }
    const hcy = handle.y + handle.h / 2;
    const hcx = handle.x + handle.w / 2;
    ev.handleCentre = [ r1( hcx ), r1( hcy ) ];
    ev.expectedHandleCentre = [ r1( cb.x + cb.width / 2 ), r1( cb.y + cb.height ) ];
    const placed = Math.abs( hcy - ( cb.y + cb.height ) ) <= 4 && hcx >= cb.x - 2 && hcx <= cb.x + cb.width + 2 && Math.abs( box.w - cb.width ) <= 4;
    // drag where the handle is drawn
    let tracks = null;
    const at = await page.evaluate( ( [ x, y ] ) => { const e = document.elementFromPoint( x, y ); return e && e.className.toString(); }, [ hcx, hcy ] );
    ev.elementAtHandleCentre = at;
    await page.mouse.move( hcx, hcy );
    await page.mouse.down();
    await page.mouse.move( hcx, hcy + 20, { steps: 4 } );
    await page.mouse.move( hcx, hcy + 40, { steps: 4 } );
    await page.mouse.up();
    await page.waitForTimeout( 500 );
    const after = await sbox( cover );
    ev.dragBottomHandleBy = 40;
    ev.coverHeightChangeOnScreen = r1( after.height - cb.height );
    tracks = Math.abs( after.height - cb.height - 40 ) <= 3;
    await shot( page, '11b-cover-after-drag' );
    check( '11b-resizable-box-popover', placed && tracks, { ...ev, handleOnBottomEdge: placed, resizeTracksPointer: tracks } );
} );

// 11c. padding visualizer (SpacingVisualizer -> BlockPopoverCover in the block-toolbar slot)
await step( '11c-spacing-visualizer', async () => {
    const panel = page.locator( '.block-editor-block-inspector' );
    const stylesTab = panel.getByRole( 'tab', { name: 'Styles' } );
    if ( await stylesTab.count() ) {
        await stylesTab.first().click();
        await page.waitForTimeout( 400 );
    }
    const controls = await page.evaluate( () => [ ...document.querySelectorAll( '.block-editor-block-inspector .spacing-sizes-control, .block-editor-block-inspector .dimensions-block-support-panel legend, .block-editor-block-inspector .components-tools-panel-header' ) ].map( ( e ) => e.className.toString().slice( 0, 60 ) + ':' + e.textContent.slice( 0, 40 ) ) );
    const ctl = page.locator( '.block-editor-block-inspector .spacing-sizes-control' ).first();
    if ( ! ( await ctl.count() ) ) {
        return check( '11c-spacing-visualizer', null, { note: 'no spacing control in the inspector for the selected block', controls } );
    }
    await ctl.scrollIntoViewIfNeeded();
    const cbx = await ctl.boundingBox();
    const hoverTarget = ctl.locator( 'input, .components-range-control, .spacing-sizes-control__wrapper' ).first();
    const hb = ( await hoverTarget.count() ) ? await hoverTarget.boundingBox() : cbx;
    await page.mouse.move( hb.x + hb.width / 2 - 5, hb.y + hb.height / 2 );
    await page.mouse.move( hb.x + hb.width / 2, hb.y + hb.height / 2, { steps: 3 } );
    await page.waitForTimeout( 500 );
    const vis = await tool( '.block-editor__spacing-visualizer' );
    const cb = await sbox( cover );
    await shot( page, '11c-spacing' );
    if ( ! vis ) {
        return check( '11c-spacing-visualizer', null, { note: 'visualizer did not appear on hover', controls, coverOnScreen: rr( cb ) } );
    }
    const ok = Math.abs( vis.x - cb.x ) <= 3 && Math.abs( vis.y - cb.y ) <= 3 && Math.abs( vis.w - cb.width ) <= 4 && Math.abs( vis.h - cb.height ) <= 4;
    check( '11c-spacing-visualizer', ok, { coverOnScreen: rr( cb ), visualizer: vis, label: controls.slice( 0, 4 ) } );
} );

out.errors = errors;
fs.writeFileSync( `${ DIR }/results-covers/${ tag }.json`, JSON.stringify( out, null, 1 ) );
await browser.close();
