// OQ-1 diagnostic runner. Usage: node spikes/diag-oq1/run.mjs <mode> [fix] [zooms]
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { open, spikeUrl } from './lib.mjs';

const mode = process.argv[ 2 ] || 'naive';
const fix = process.argv[ 3 ] === 'fix';
const zooms = ( process.argv[ 4 ] || '50,75,100' ).split( ',' ).map( Number );
const key = mode + ( fix ? '+cssfix' : '' );
const OUT = 'spikes/diag-oq1';
const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
mkdirSync( OUT + '/shots', { recursive: true } );

const results = [];
for ( const zoom of zooms ) {
    const { browser, page, errors } = await open();
    page.setDefaultTimeout( 6000 );
    await page.goto(
        spikeUrl( 'a', `&zoom=${ zoom }&mode=${ mode }${ fix ? '&fix=1' : '' }` )
    );
    const frameEl = page.locator( '#wfd-scaled iframe' );
    const frame = page.frameLocator( '#wfd-scaled iframe' );
    const r = { mode: key, zoom, checks: {} };
    const shot = ( name ) =>
        page.screenshot( { path: `${ OUT }/shots/${ key }-${ zoom }-${ name }.png` } );

    const outer = () =>
        frameEl.evaluate( ( el ) => {
            const b = el.getBoundingClientRect();
            return { left: b.left, top: b.top, width: b.width, height: b.height, offsetWidth: el.offsetWidth };
        } );
    const rect = ( el ) => {
        const b = el.getBoundingClientRect();
        return { left: b.left, top: b.top, right: b.right, bottom: b.bottom };
    };
    // Rect of an element inside the iframe, in top-level viewport px.
    const vis = async ( loc ) => {
        const o = await outer();
        const k = o.width / o.offsetWidth;
        const b = await loc.evaluate( rect );
        return {
            left: o.left + b.left * k,
            top: o.top + b.top * k,
            right: o.left + b.right * k,
            bottom: o.top + b.bottom * k,
        };
    };
    const top = ( sel ) => page.locator( sel ).first().evaluate( rect );
    const round = ( o ) =>
        Object.fromEntries( Object.entries( o ).map( ( [ k2, v ] ) => [ k2, Math.round( v * 10 ) / 10 ] ) );
    const covers = ( a, b, tol = 3 ) =>
        Math.abs( a.left - b.left ) <= tol && Math.abs( a.top - b.top ) <= tol &&
        Math.abs( a.right - b.right ) <= tol && Math.abs( a.bottom - b.bottom ) <= tol;
    const check = async ( name, fn ) => {
        try {
            r.checks[ name ] = await fn();
        } catch ( e ) {
            r.checks[ name ] = { pass: false, error: e.message.split( '\n' )[ 0 ] };
        }
    };
    const selectBlock = ( path ) =>
        page.evaluate( ( p ) => {
            let blocks = window.wfdBE.select.getBlocks();
            let b;
            for ( const i of p ) {
                b = blocks[ i ];
                blocks = b.innerBlocks;
            }
            window.wfdBE.dispatch.selectBlock( b.clientId );
            return b.name;
        }, path );

    await frame.locator( 'p', { hasText: 'First paragraph' } ).waitFor();
    await page.waitForTimeout( 1200 );
    r.unlock = await page.evaluate( () => ( {
        ok: window.wfdUnlock.ok,
        error: window.wfdUnlock.error,
        zoomLevel: window.wfdBE?.privateSelect?.getZoomLevel?.(),
        isZoomOut: window.wfdBE?.privateSelect?.isZoomOut?.(),
    } ) );
    r.iframe = round( await outer() );
    r.htmlClass = await frame.locator( 'html' ).getAttribute( 'class' );
    const para = frame.locator( 'p', { hasText: 'First paragraph' } );
    const empty = frame.locator( 'p[aria-label^="Empty block"]' ).first();

    await check( 'toolbar', async () => {
        await para.click( { position: { x: 30, y: 5 } } );
        await page.waitForSelector( '#wfd-header .block-editor-block-toolbar' );
        const c = await page.evaluate( () => {
            const all = Array.from( document.querySelectorAll( '.block-editor-block-toolbar' ) );
            return {
                count: all.length,
                inHeader: all.filter( ( el ) => el.closest( '#wfd-header' ) ).length,
                inPopover: all.filter( ( el ) => el.closest( '.components-popover' ) ).length,
                selected: window.wfdBE.select.getBlockName( window.wfdBE.select.getSelectedBlockClientId() ),
            };
        } );
        c.pass = c.count === 1 && c.inHeader === 1 && c.inPopover === 0 && c.selected === 'core/paragraph';
        return c;
    } );

    await check( 'typing', async () => {
        await page.keyboard.press( 'End' );
        await page.keyboard.type( ' TYPED' );
        const text = await para.textContent();
        return { text, pass: text.endsWith( 'TYPED' ) };
    } );

    await check( 'linkPopover', async () => {
        await page.keyboard.press( mod + '+a' );
        await page.keyboard.press( mod + '+k' );
        await page.waitForSelector( '.components-popover .block-editor-link-control' );
        await page.waitForTimeout( 500 );
        const anchor = await vis( para );
        const pop = await top( '.components-popover:has(.block-editor-link-control) .components-popover__content' );
        const dTop = pop.top - anchor.bottom;
        const dAbove = anchor.top - pop.bottom;
        const centre = ( pop.left + pop.right ) / 2;
        const fullSize = pop.right - pop.left >= 300;
        return {
            anchor: round( anchor ), pop: round( pop ), fullSize,
            pass: ( ( dTop >= -2 && dTop <= 24 ) || ( dAbove >= -2 && dAbove <= 24 ) ) && centre >= anchor.left - 2 && pop.left <= anchor.right && fullSize,
        };
    } );
    await page.keyboard.press( 'Escape' );

    await check( 'slashPopover', async () => {
        await empty.click( { position: { x: 20, y: 5 } } );
        await page.keyboard.type( '/' );
        await page.waitForSelector( '.components-autocomplete__popover' );
        await page.waitForTimeout( 500 );
        const anchor = await vis( frame.locator( 'p.is-selected' ).first() );
        const pop = await top( '.components-autocomplete__popover .components-popover__content' );
        const dTop = pop.top - anchor.bottom;
        const dAbove = anchor.top - pop.bottom;
        const dLeft = pop.left - anchor.left;
        return {
            anchor: round( anchor ), pop: round( pop ),
            pass: ( ( dTop >= -2 && dTop <= 24 ) || ( dAbove >= -2 && dAbove <= 24 ) ) && dLeft >= -4 && dLeft <= 40,
        };
    } );
    await page.keyboard.press( 'Escape' );
    await page.keyboard.press( 'Backspace' );

    await check( 'sideInserter', async () => {
        await para.click( { position: { x: 30, y: 5 } } );
        await empty.click( { position: { x: 20, y: 5 } } );
        await page.waitForTimeout( 800 );
        const sel = '.block-editor-block-list__empty-block-inserter .block-editor-inserter__toggle';
        const count = await page.locator( sel ).count();
        await shot( 'side' );
        if ( ! count ) {
            return { present: false, pass: false };
        }
        const anchor = await vis( empty );
        const pop = await top( sel );
        const cover = await top( '.block-editor-block-list__block-side-inserter-popover .components-popover__content > div' );
        const cy = ( pop.top + pop.bottom ) / 2;
        const size = pop.right - pop.left;
        const out = {
            anchor: round( anchor ), button: round( pop ), coverContainer: round( cover ), buttonSize: size,
            pass: size >= 23 && size <= 25 && cy >= anchor.top - 6 && cy <= anchor.bottom + 6 && pop.right <= anchor.right + 6 && pop.right >= anchor.right - 60 && pop.left >= anchor.left,
        };
        // Does the button work where it is drawn?
        try {
            await page.locator( sel ).click( { timeout: 2000 } );
            await page.waitForSelector( '.block-editor-inserter__quick-inserter', { timeout: 2000 } );
            out.clickOpensQuickInserter = true;
            await page.keyboard.press( 'Escape' );
        } catch ( e ) {
            out.clickOpensQuickInserter = false;
        }
        return out;
    } );

    await check( 'optionsMenu', async () => {
        await para.click( { position: { x: 30, y: 5 } } );
        await page.locator( '#wfd-header button[aria-label="Options"]' ).click();
        await page.waitForSelector( '.components-popover .components-dropdown-menu__menu' );
        await page.waitForTimeout( 300 );
        const btn = await top( '#wfd-header button[aria-label="Options"]' );
        const pop = await top( '.components-popover:has(.components-dropdown-menu__menu) .components-popover__content' );
        const dTop = pop.top - btn.bottom;
        return { btn: round( btn ), pop: round( pop ), pass: dTop >= -2 && dTop <= 24 && pop.left <= btn.right && pop.right >= btn.left };
    } );
    await page.keyboard.press( 'Escape' );

    // 7. In-between insertion point (BlockPopoverInbetween, not a cover).
    await check( 'inbetweenInserter', async () => {
        await page.evaluate( () => window.wfdBE.dispatch.clearSelectedBlock() );
        const h = frame.locator( 'h1' ).first();
        await h.scrollIntoViewIfNeeded();
        const a = await vis( h );
        const b = await vis( para );
        const y = ( a.bottom + b.top ) / 2;
        const x = ( b.left + b.right ) / 2;
        await page.mouse.move( x, y - 40, { steps: 3 } );
        await page.mouse.move( x, y, { steps: 6 } );
        await page.mouse.move( x + 2, y, { steps: 2 } );
        await page.waitForSelector( '.block-editor-block-list__insertion-point-indicator', { timeout: 3000 } );
        await page.waitForTimeout( 500 );
        const line = await top( '.block-editor-block-list__insertion-point-indicator' );
        const btnCount = await page.locator( '.block-editor-block-list__insertion-point-inserter button' ).count();
        const btn = btnCount ? await top( '.block-editor-block-list__insertion-point-inserter button' ) : null;
        await shot( 'inbetween' );
        const ly = ( line.top + line.bottom ) / 2;
        return {
            gap: round( { top: a.bottom, bottom: b.top, left: b.left, right: b.right } ),
            line: round( line ), button: btn && round( btn ),
            pass: ly >= a.bottom - 3 && ly <= b.top + 3 && Math.abs( line.left - b.left ) <= 3 && Math.abs( line.right - b.right ) <= 3 &&
                !! btn && btn.right - btn.left >= 23 && btn.right - btn.left <= 25,
        };
    } );
    await page.mouse.move( 5, 5 );

    // 8. Grid visualizer (BlockPopoverCover) on the selected grid group.
    await check( 'gridVisualizer', async () => {
        const name = await selectBlock( [ 5 ] );
        const el = frame.locator( '.wp-block-group.is-layout-grid, .wp-block-group[class*="grid"]' ).first();
        await el.scrollIntoViewIfNeeded();
        await page.waitForTimeout( 800 );
        const count = await page.locator( '.block-editor-grid-visualizer__grid' ).count();
        await shot( 'grid' );
        if ( ! count ) {
            return { selected: name, present: false, pass: false };
        }
        const anchor = await vis( el );
        const cover = await top( '.block-editor-grid-visualizer__grid' );
        return { selected: name, anchor: round( anchor ), cover: round( cover ), pass: covers( anchor, cover ) };
    } );

    // 9. Grid item resizer (BlockPopoverCover) on a selected grid child.
    await check( 'gridItemResizer', async () => {
        const name = await selectBlock( [ 5, 0 ] );
        const el = frame.locator( 'p', { hasText: 'Grid one' } );
        await page.waitForTimeout( 800 );
        const count = await page.locator( '.block-editor-grid-item-resizer__box' ).count();
        await shot( 'griditem' );
        if ( ! count ) {
            return { selected: name, present: false, pass: false };
        }
        const anchor = await vis( el );
        const cover = await top( '.block-editor-grid-item-resizer__box' );
        return { selected: name, anchor: round( anchor ), cover: round( cover ), pass: covers( anchor, cover ) };
    } );

    // 10. Cover block resize box (ResizableBoxPopover -> BlockPopoverCover).
    await check( 'coverResizeBox', async () => {
        const name = await selectBlock( [ 6 ] );
        const el = frame.locator( '.wp-block-cover' ).first();
        await el.scrollIntoViewIfNeeded();
        await page.waitForTimeout( 800 );
        const sel = '.block-editor-block-popover .components-resizable-box__container';
        const count = await page.locator( sel ).count();
        await shot( 'cover' );
        if ( ! count ) {
            return { selected: name, present: false, pass: false };
        }
        const anchor = await vis( el );
        const cover = await top( sel );
        const handle = await page.locator( sel + ' .components-resizable-box__handle' ).first().evaluate( rect ).catch( () => null );
        return { selected: name, anchor: round( anchor ), cover: round( cover ), handle: handle && round( handle ), pass: covers( anchor, cover ) };
    } );

    r.consoleErrors = errors;
    r.pass = Object.values( r.checks ).every( ( c ) => c.pass ) && errors.length === 0;
    results.push( r );
    await browser.close();
}

const file = OUT + '/results.json';
const all = existsSync( file ) ? JSON.parse( readFileSync( file, 'utf8' ) ) : {};
all.runs ||= {};
for ( const r of results ) {
    all.runs[ `${ key }@${ r.zoom }` ] = r;
}
writeFileSync( file, JSON.stringify( all, null, 2 ) );
for ( const r of results ) {
    console.log( key, r.zoom, r.pass, JSON.stringify( Object.fromEntries( Object.entries( r.checks ).map( ( [ k, v ] ) => [ k, v.pass ? 'P' : 'F' + ( v.error ? '!' : v.present === false ? '-' : '' ) ] ) ) ), r.consoleErrors.length, JSON.stringify( r.unlock ), r.htmlClass );
}
