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
let bw = await position( pw, { x: 320, y: 300 }, 'paragraph' );
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
out.layout.titleScreen = rr( await sbox( fl.locator( 'h1' ).first() ) );
out.layout.iframeScreen = rr( await ifr.boundingBox() );
console.log( tag, 'layout', JSON.stringify( out.layout ) );
const calib = async () => ( {
    toScreen: ( r ) => ( { x: M.ox + r.x * M.sx, y: M.oy + r.y * M.sy, width: r.w * M.sx, height: r.h * M.sy } ),
    toInner: ( p ) => ( { x: ( p.x - M.ox ) / M.sx, y: ( p.y - M.oy ) / M.sy } ),
} );

// 2. hit-testing and typing
await step( '2-hit-typing', async () => {
    const title = fl.locator( '[data-type="core/post-author-name"]' ).first();
    const tb = await sbox( title );
    await page.mouse.click( tb.x + tb.width / 2, tb.y + tb.height / 2 );
    await page.waitForTimeout( 300 );
    const selTitle = await selected();
    const titleId = await title.getAttribute( 'data-block' );
    const at = [ bw.x + bw.width / 2, bw.y + bw.height / 2 ];
    await page.mouse.click( at[ 0 ], at[ 1 ] );
    await page.waitForTimeout( 300 );
    const sel = await selected();
    let text = '';
    if ( sel.caretIn === pwid ) {
        await page.keyboard.type( 'Zq' );
        await page.waitForTimeout( 300 );
        text = await pw.innerText();
        await page.keyboard.press( 'Backspace' );
        await page.keyboard.press( 'Backspace' );
    }
    check( '2-hit-typing', sel.selected === pwid && sel.caretIn === pwid && text.includes( 'Zq' ) && selTitle.selected === titleId, {
        paragraphOnScreen: rr( bw ), clickedParagraphAt: at.map( r1 ), selectedType: sel.type,
        paragraphSelected: sel.selected === pwid, caretInParagraph: sel.caretIn === pwid, textAfterTyping: text,
        neighbourClickAt: [ r1( tb.x + tb.width / 2 ), r1( tb.y + tb.height / 2 ) ], neighbourClickSelected: selTitle.type, neighbourOnScreen: rr( tb ),
    } );
} );

// 1. toolbar docked
await step( '1-toolbar', async () => {
    const info = await page.evaluate( () => {
        const all = [ ...document.querySelectorAll( '.block-editor-block-toolbar, .block-editor-block-contextual-toolbar' ) ];
        const h6 = document.querySelector( '[data-wfd-control="H6"]' );
        const tb = h6 && h6.querySelector( '.block-editor-block-toolbar' );
        const b = tb && tb.getBoundingClientRect();
        const hb = h6 && h6.getBoundingClientRect();
        return { total: all.length, inH6: all.filter( ( e ) => h6 && h6.contains( e ) ).length, rect: b && [ b.x, b.y, b.width, b.height ].map( Math.round ), layoutH: tb && tb.offsetHeight, h6: hb && [ hb.x, hb.y, hb.width, hb.height ].map( Math.round ) };
    } );
    const innerToolbars = await inner( ( doc ) => doc.querySelectorAll( '.block-editor-block-toolbar' ).length );
    check( '1-toolbar', info.total >= 1 && info.total === info.inH6 && innerToolbars === 0 && info.rect && Math.abs( info.rect[ 3 ] - info.layoutH ) <= 1 && info.rect[ 3 ] >= 30, { ...info, innerToolbars } );
} );

// 3. link popover
await step( '3-link-popover', async () => {
    const c = await calib( pw );
    const word = await pw.evaluate( ( p ) => {
        const doc = p.ownerDocument;
        const walker = doc.createTreeWalker( p, 4 );
        let n;
        while ( ( n = walker.nextNode() ) ) {
            const i = n.data.indexOf( 'Written' );
            if ( i >= 0 ) {
                const r = doc.createRange();
                r.setStart( n, i );
                r.setEnd( n, i + 7 );
                const b = r.getBoundingClientRect();
                return { x: b.x, y: b.y, w: b.width, h: b.height };
            }
        }
    } );
    const ws = c.toScreen( word );
    await page.mouse.dblclick( ws.x + ws.width / 2, ws.y + ws.height / 2 );
    await page.waitForTimeout( 300 );
    const selText = await inner( ( doc ) => doc.getSelection().toString() );
    await page.keyboard.press( 'ControlOrMeta+k' );
    await page.waitForTimeout( 700 );
    const pop = await tool( '.block-editor-link-control', '.components-popover' );
    await shot( page, '3-link' );
    if ( pop ) {
        await page.keyboard.press( 'Escape' );
    }
    await page.waitForTimeout( 200 );
    if ( ! pop ) {
        return check( '3-link-popover', false, { selText, popover: null } );
    }
    const dy = r1( pop.y - ( ws.y + ws.height ) );
    const cx = ws.x + ws.width / 2;
    const containsX = pop.x - 2 <= cx && cx <= pop.x + pop.w + 2;
    check( '3-link-popover', selText.trim() === 'Written' && Math.abs( pop.scale - 1 ) < 0.02 && pop.onScreen && pop.topmost && dy >= -2 && dy <= 30 && containsX, { selText, selectionOnScreen: rr( ws ), popover: pop, gapBelowSelection: dy, popoverSpansSelectionCentre: containsX } );
} );

// 6. header toolbar dropdown
await step( '6-toolbar-menu', async () => {
    const btn = page.locator( '[data-wfd-control="H6"] button[aria-label="Options"]' ).first();
    const bbn = await btn.boundingBox();
    await btn.click();
    await page.waitForTimeout( 500 );
    const menu = await tool( '.components-dropdown-menu__menu', '.components-popover' );
    await shot( page, '6-menu' );
    if ( menu ) {
        await page.keyboard.press( 'Escape' );
    }
    await page.waitForTimeout( 200 );
    const dy = menu && r1( menu.y - ( bbn.y + bbn.height ) );
    const overlapX = menu && menu.x <= bbn.x + bbn.width && menu.x + menu.w >= bbn.x;
    check( '6-toolbar-menu', !! menu && Math.abs( menu.scale - 1 ) < 0.02 && menu.onScreen && menu.topmost && dy >= -4 && dy <= 24 && overlapX, { button: rr( bbn ), menu, gapBelowButton: dy, overlapX } );
} );

// 5. empty paragraph appender, 4. slash inserter
let p2 = null;
const title = fl.locator( 'h1[data-type="core/post-title"]' ).first();
const titleId = await title.getAttribute( 'data-block' );
await step( '5-add-block-button', async () => {
    // "Written by" sits in a content-only pattern; a free empty paragraph is made after the post title instead.
    const tb = await position( title, { x: 320, y: 250 }, 'post-title' );
    await page.mouse.click( tb.x + tb.width - 20, tb.y + tb.height / 2 );
    await page.waitForTimeout( 350 );
    if ( ( await selected() ).selected !== titleId ) {
        throw new Error( 'could not select the post title' );
    }
    await page.keyboard.press( 'Enter' );
    await page.waitForTimeout( 500 );
    // Typing mode hides the tools until the pointer moves.
    await page.mouse.move( tb.x + tb.width - 60, tb.y + tb.height + 80 * z, { steps: 3 } );
    await page.mouse.move( tb.x + tb.width - 80, tb.y + tb.height + 90 * z, { steps: 3 } );
    await page.waitForTimeout( 700 );
    const sel = await selected();
    p2 = fl.locator( `[data-block="${ sel.selected }"]` );
    const b2 = await sbox( p2 );
    const empty = await p2.getAttribute( 'data-empty' );
    const btn = await tool( '.block-editor-block-list__empty-block-inserter .block-editor-inserter__toggle' );
    const cover = await tool( '.block-editor-block-list__block-side-inserter-popover .components-popover__content > div' );
    await shot( page, '5-appender' );
    if ( ! btn ) {
        return check( '5-add-block-button', false, { emptyParagraph: rr( b2 ), type: sel.type, empty, button: null } );
    }
    const dRight = r1( btn.x + btn.w - ( b2.x + b2.width ) );
    const cy = btn.y + btn.h / 2;
    const dCy = r1( cy - ( b2.y + b2.height / 2 ) );
    const insideV = cy >= b2.y - 4 && cy <= b2.y + b2.height + 4;
    const sensible = btn.w >= 16 && btn.w <= 28 && btn.h >= 16 && btn.h <= 28;
    // Is it actually clickable where it is drawn?
    let opens = false;
    if ( btn.topmost && btn.onScreen ) {
        await page.mouse.click( btn.x + btn.w / 2, btn.y + btn.h / 2 );
        await page.waitForTimeout( 600 );
        const qi = await tool( '.block-editor-inserter__quick-inserter', '.components-popover' );
        opens = !! qi;
        out.quickInserter = qi;
        await shot( page, '5-quick-inserter' );
        if ( qi ) {
            await page.keyboard.press( 'Escape' );
        }
        await page.waitForTimeout( 300 );
    }
    check( '5-add-block-button', Math.abs( dRight ) <= 4 && insideV && sensible && btn.topmost && opens, { emptyParagraph: rr( b2 ), button: btn, coverContainer: cover, rightEdgeDelta: dRight, centreYDelta: dCy, clickOpensQuickInserter: opens, quickInserter: out.quickInserter } );
} );

await step( '4-slash-inserter', async () => {
    const b2 = await sbox( p2 );
    await page.mouse.click( b2.x + 10, b2.y + b2.height / 2 );
    await page.waitForTimeout( 200 );
    await page.keyboard.type( '/' );
    await page.waitForTimeout( 800 );
    const pop = await tool( '.components-autocomplete__popover' );
    await shot( page, '4-slash' );
    if ( ! pop ) {
        return check( '4-slash-inserter', false, { paragraph: rr( b2 ), popover: null } );
    }
    const dx = r1( pop.x - b2.x );
    const dy = r1( pop.y - ( b2.y + b2.height ) );
    check( '4-slash-inserter', Math.abs( pop.scale - 1 ) < 0.02 && pop.onScreen && pop.topmost && Math.abs( dx ) <= 30 && dy >= -b2.height - 2 && dy <= 30, { caretParagraph: rr( b2 ), popover: pop, leftDeltaFromCaret: dx, gapBelowLine: dy } );
} );

// 10. image block
let imgBlock = null;
await step( '10-image', async () => {
    await page.keyboard.type( 'image' );
    await page.waitForTimeout( 500 );
    await page.keyboard.press( 'Enter' );
    await page.waitForTimeout( 900 );
    imgBlock = fl.locator( '[data-type="core/image"]' ).first();
    const ev = { placeholder: rr( await sbox( imgBlock ) ) };
    const urlBtn = imgBlock.getByRole( 'button', { name: 'Insert from URL' } );
    const ub = await sbox( urlBtn );
    ev.insertFromUrlButton = rr( ub );
    await page.mouse.click( ub.x + ub.width / 2, ub.y + ub.height / 2 );
    await page.waitForTimeout( 700 );
    const pop = await tool( '.block-editor-media-placeholder__url-input-form', '.components-popover' );
    ev.urlPopover = pop;
    await shot( page, '10-url-popover' );
    const placeholderClickable = !! pop;
    let popOk = false;
    if ( pop ) {
        const dy = r1( pop.y - ( ub.y + ub.height ) );
        const overlapX = pop.x <= ub.x + ub.width && pop.x + pop.w >= ub.x;
        ev.urlPopoverGapBelowButton = dy;
        popOk = Math.abs( pop.scale - 1 ) < 0.02 && pop.topmost && overlapX && ( ( dy >= -4 && dy <= 30 ) || ( pop.y + pop.h <= ub.y + 4 && pop.y + pop.h >= ub.y - 30 ) );
        await page.keyboard.type( 'http://localhost:8888/wp-admin/images/wordpress-logo.png' );
        await page.keyboard.press( 'Enter' );
        await page.waitForTimeout( 1500 );
    }
    const img = imgBlock.locator( 'img' );
    let handlesOk = null;
    let dragOk = null;
    if ( await img.count() ) {
        let ib = await sbox( img );
        await page.mouse.click( ib.x + ib.width / 2, ib.y + ib.height / 2 );
        await page.waitForTimeout( 500 );
        ib = await sbox( img );
        ev.image = rr( ib );
        const handles = {};
        for ( const side of [ 'right', 'bottom', 'left', 'top' ] ) {
            const hl = imgBlock.locator( `.components-resizable-box__handle-${ side }` );
            if ( await hl.count() ) {
                handles[ side ] = rr( await sbox( hl.first() ) );
            }
        }
        ev.handles = handles;
        const hr = handles.right;
        const hb = handles.bottom;
        handlesOk = !! hr && !! hb && Math.abs( hr.x + hr.w / 2 - ( ib.x + ib.width ) ) <= 3 && Math.abs( hb.y + hb.h / 2 - ( ib.y + ib.height ) ) <= 3;
        await shot( page, '10-image-selected' );
        if ( hr ) {
            const sx = hr.x + hr.w / 2;
            const sy = hr.y + hr.h / 2;
            await page.mouse.move( sx, sy );
            await page.mouse.down();
            await page.mouse.move( sx + 20, sy, { steps: 4 } );
            await page.mouse.move( sx + 40, sy, { steps: 4 } );
            await page.mouse.up();
            await page.waitForTimeout( 500 );
            const after = await sbox( img );
            ev.dragRightHandleBy = 40;
            ev.imageWidthChangeOnScreen = r1( after.width - ib.width );
            dragOk = Math.abs( after.width - ib.width - 40 ) <= 3;
        }
    } else {
        ev.image = null;
    }
    check( '10-image', placeholderClickable && popOk && handlesOk === true && dragOk === true, { ...ev, placeholderClickable, urlPopoverPlaced: popOk, handlesOnEdges: handlesOk, resizeTracksPointer: dragOk } );
} );

// 8. selection outline + multi-selection
await step( '8-selection', async () => {
    const tb0 = await sbox( title );
    await page.mouse.click( tb0.x + tb0.width - 20, tb0.y + tb0.height / 2 );
    await page.waitForTimeout( 350 );
    const single = await inner( ( doc ) => {
        const s = doc.querySelector( '.is-selected' );
        const st = doc.defaultView.getComputedStyle( s, '::after' );
        return { id: s.dataset.block, outline: st.outlineStyle + ' ' + st.outlineWidth + ' ' + st.outlineColor, shadow: st.boxShadow };
    } );
    const target = fl.locator( `[data-block="${ titleId }"] + [data-block]` );
    const tb = await sbox( target );
    const targetId = await target.getAttribute( 'data-block' );
    await page.keyboard.down( 'Shift' );
    await page.mouse.click( tb.x + tb.width / 2, tb.y + tb.height / 2 );
    await page.keyboard.up( 'Shift' );
    await page.waitForTimeout( 400 );
    const multi = await inner( ( doc ) => [ ...doc.querySelectorAll( '.is-multi-selected' ) ].map( ( e ) => e.dataset.block ) );
    await shot( page, '8-multi' );
    check( '8-selection', single.id === titleId && multi.includes( titleId ) && multi.includes( targetId ) && multi.length === 2, { singleSelected: single.id === titleId, selectedOutlineInCanvas: single, multiSelectedCount: multi.length, multiIsTheTwoClicked: multi.includes( titleId ) && multi.includes( targetId ), firstOnScreen: rr( tb0 ), secondOnScreen: rr( tb ) } );
} );

// 7. in-between inserter (gap between the post title and the featured image)
await step( '7-inbetween', async () => {
    const prev = title;
    const next = fl.locator( `[data-block="${ titleId }"] + [data-block]` );
    // Deselect first so no tool of the selected block covers the gap.
    const fi = await sbox( fl.locator( '[data-type="core/post-featured-image"]' ).first() );
    await page.mouse.click( fi.x + fi.width / 2, Math.min( fi.y + fi.height / 2, 860 ) );
    await page.waitForTimeout( 300 );
    const pb = await sbox( prev );
    const nb = await sbox( next );
    const gap = { top: pb.y + pb.height, bottom: nb.y };
    const gy = ( gap.top + gap.bottom ) / 2;
    const gx = pb.x + pb.width / 2;
    await page.mouse.move( gx - 30, gy + 60 * z );
    for ( let i = 0; i < 8; i++ ) {
        await page.mouse.move( gx - 20 + i * 4, gy, { steps: 2 } );
        await page.waitForTimeout( 120 );
    }
    await page.waitForTimeout( 700 );
    const line = await tool( '.block-editor-block-list__insertion-point-indicator' );
    const plus = await tool( '.block-editor-block-list__insertion-point-inserter .block-editor-inserter__toggle' );
    const pop = await tool( '.block-editor-block-list__insertion-point', '.components-popover' );
    await shot( page, '7-inbetween' );
    const gapEv = { top: r1( gap.top ), bottom: r1( gap.bottom ), left: r1( pb.x ), width: r1( pb.width ) };
    if ( ! line && ! pop ) {
        check( '7-inbetween', null, { gapOnScreen: gapEv, hoveredAt: [ r1( gx ), r1( gy ) ], indicator: null, note: 'no in-between inserter appeared on hover' } );
    } else {
        const lineY = line && line.y + line.h / 2;
        const okY = line && lineY >= gap.top - 3 && lineY <= gap.bottom + 3;
        const okX = line && Math.abs( line.x - pb.x ) <= 4 && Math.abs( line.w - pb.width ) <= 4;
        check( '7-inbetween', !! ( okY && okX && plus && plus.w >= 16 && plus.w <= 28 && plus.topmost ), { gapOnScreen: gapEv, indicator: line, plusButton: plus, popover: pop } );
    }
    await page.mouse.move( 10, 10 );
    await page.waitForTimeout( 300 );
} );

// 9. drop indicator (synthetic drag events inside the canvas document; not a native drag)
await step( '9-drop-indicator', async () => {
    const prev = title;
    const next = fl.locator( `[data-block="${ titleId }"] + [data-block]` );
    const c = await calib( next );
    const pb = await sbox( prev );
    const nb = await sbox( next );
    // Pointer just inside the top edge of the featured image: the line is expected in the gap above it.
    const pointer = { x: nb.x + nb.width / 3, y: nb.y + Math.max( 1.5, 4 * z ) };
    const ip = c.toInner( pointer );
    const dispatched = await inner( ( doc, ip ) => {
        const w = doc.defaultView;
        const el = doc.elementFromPoint( ip.x, ip.y );
        if ( ! el ) {
            return null;
        }
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
        const b = el.closest( '[data-block]' );
        return el.tagName + ' in ' + ( b && b.dataset.type );
    }, ip );
    await page.waitForTimeout( 1000 );
    const line = await tool( '.block-editor-block-list__insertion-point-indicator' );
    const zone = await tool( '.block-editor-block-popover__drop-zone' );
    await shot( page, '9-drop' );
    await inner( ( doc ) => doc.defaultView.__zsDragEnd && doc.defaultView.__zsDragEnd() );
    const ev = { synthetic: true, pointerOnScreen: [ r1( pointer.x ), r1( pointer.y ) ], dispatchedOn: dispatched, gapOnScreen: { top: r1( pb.y + pb.height ), bottom: r1( nb.y ), left: r1( nb.x ), width: r1( nb.width ) }, indicator: line, dropZone: zone };
    if ( ! line && ! zone ) {
        return check( '9-drop-indicator', null, { ...ev, note: 'synthetic drag produced no indicator' } );
    }
    const lineY = line ? line.y + line.h / 2 : null;
    const ok = line && lineY >= pb.y + pb.height - 3 && lineY <= nb.y + 3 && Math.abs( line.x - nb.x ) <= 4 && Math.abs( line.w - nb.width ) <= 4;
    check( '9-drop-indicator', !! ok, ev );
} );

out.errors = errors;
fs.writeFileSync( `${ DIR }/results/${ tag }.json`, JSON.stringify( out, null, 1 ) );
await browser.close();
