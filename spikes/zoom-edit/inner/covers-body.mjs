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
