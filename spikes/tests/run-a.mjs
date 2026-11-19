import { writeFileSync } from 'node:fs';
import { open, spikeUrl } from './lib.mjs';

const results = [];
const mode = process.argv[ 2 ] || 'naive';
const isMac = process.platform === 'darwin';
const mod = isMac ? 'Meta' : 'Control';

for ( const zoom of ( process.argv[ 3 ] || '50,75,100' ).split( ',' ).map( Number ) ) {
    const z = zoom / 100;
    const { browser, page, errors } = await open();
    await page.goto( spikeUrl( 'a', '&zoom=' + zoom + '&mode=' + mode ) );
    const frameEl = page.locator( '#wfd-scaled iframe' );
    const frame = page.frameLocator( '#wfd-scaled iframe' );
    const outer = async () => frameEl.evaluate( ( el ) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top, width: r.width, height: r.height, offsetWidth: el.offsetWidth };
    } );
    const inner = async ( loc ) => loc.evaluate( ( el ) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    } );
    const top = async ( sel ) => page.locator( sel ).first().evaluate( ( el ) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    } );
    const k = mode === 'inner' ? 1 : z;
    const map = ( o, r ) => ( {
        left: o.left + r.left * k,
        top: o.top + r.top * k,
        right: o.left + r.right * k,
        bottom: o.top + r.bottom * k,
    } );
    const r = { zoom, checks: {} };

    // 1. Docked toolbar.
    const para = frame.locator( 'p', { hasText: 'First paragraph' } );
    await para.click( { position: { x: 30, y: 5 } } );
    await page.waitForSelector( '#wfd-header .block-editor-block-toolbar' );
    r.checks.toolbar = await page.evaluate( () => {
        const all = Array.from( document.querySelectorAll( '.block-editor-block-toolbar' ) );
        return {
            count: all.length,
            inHeader: all.filter( ( el ) => el.closest( '#wfd-header' ) ).length,
            inPopover: all.filter( ( el ) => el.closest( '.components-popover' ) ).length,
        };
    } );
    r.checks.toolbar.pass = r.checks.toolbar.count === 1 && r.checks.toolbar.inHeader === 1 && r.checks.toolbar.inPopover === 0;
    const o = await outer();
    r.iframe = o;

    // 2. Hit testing and typing.
    await page.keyboard.press( 'End' );
    await page.keyboard.type( ' TYPED' );
    const text = await para.textContent();
    r.checks.typing = { text, pass: text.endsWith( 'TYPED' ) };

    // 3. Link popover anchored to the selected text.
    await page.keyboard.press( mod + '+a' );
    await page.keyboard.press( mod + '+k' );
    await page.waitForSelector( '.components-popover .block-editor-link-control' );
    await page.waitForTimeout( 500 );
    {
        const anchor = map( o, await inner( para ) );
        const pop = await top( '.components-popover:has(.block-editor-link-control) .components-popover__content' );
        const dTop = pop.top - anchor.bottom;
        const dAbove = anchor.top - pop.bottom;
        const centre = ( pop.left + pop.right ) / 2;
        const fullSize = pop.right - pop.left >= 300;
        r.checks.linkPopover = {
            anchor, pop, gapBelowAnchor: dTop, gapAboveAnchor: dAbove, fullSize,
            pass: ( ( dTop >= -2 && dTop <= 24 ) || ( dAbove >= -2 && dAbove <= 24 ) ) && centre >= anchor.left - 2 && pop.left <= anchor.right && fullSize,
        };
        await page.screenshot( { path: `spikes/evidence/a-${ mode }-link-${ zoom }.png` } );
    }
    await page.keyboard.press( 'Escape' );

    // 4. Slash inserter popover anchored to the caret in the empty paragraph.
    const empty = frame.locator( 'p[aria-label^="Empty block"]' ).first();
    await empty.click( { position: { x: 20, y: 5 } } );
    await page.keyboard.type( '/' );
    await page.waitForSelector( '.components-autocomplete__popover, .components-popover.components-autocomplete__popover' );
    await page.waitForTimeout( 500 );
    {
        const anchor = map( o, await inner( frame.locator( 'p.is-selected' ).first() ) );
        const pop = await top( '.components-autocomplete__popover .components-popover__content' );
        const dTop = pop.top - anchor.bottom;
        const dAbove = anchor.top - pop.bottom;
        const dLeft = pop.left - anchor.left;
        r.checks.slashPopover = {
            anchor, pop, gapBelowAnchor: dTop, gapAboveAnchor: dAbove, leftOffset: dLeft,
            pass: ( ( dTop >= -2 && dTop <= 24 ) || ( dAbove >= -2 && dAbove <= 24 ) ) && dLeft >= -4 && dLeft <= 40,
        };
        await page.screenshot( { path: `spikes/evidence/a-${ mode }-slash-${ zoom }.png` } );
    }
    await page.keyboard.press( 'Escape' );
    await page.keyboard.press( 'Backspace' );

    // 5. Side inserter ("Add block") beside the empty paragraph.
    await para.click( { position: { x: 30, y: 5 } } );
    await empty.click( { position: { x: 20, y: 5 } } );
    await page.waitForTimeout( 800 );
    {
        const sel = '.block-editor-block-list__block-side-inserter-popover .block-editor-inserter__toggle, .block-editor-block-list__empty-block-inserter .block-editor-inserter__toggle';
        const count = await page.locator( sel ).count();
        if ( count ) {
            const anchor = map( o, await inner( empty ) );
            const pop = await top( sel );
            const cy = ( pop.top + pop.bottom ) / 2;
            r.checks.sideInserter = {
                anchor, pop, buttonSize: pop.right - pop.left,
                pass: pop.right - pop.left >= 23 && cy >= anchor.top - 6 && cy <= anchor.bottom + 6 && pop.right <= anchor.right + 6 && pop.left >= anchor.left,
            };
        } else {
            r.checks.sideInserter = { present: false, pass: false };
        }
        await page.screenshot( { path: `spikes/evidence/a-${ mode }-side-${ zoom }.png` } );
    }

    // 6. Toolbar dropdown opens under the header toolbar.
    await para.click( { position: { x: 30, y: 5 } } );
    await page.locator( '#wfd-header button[aria-label="Options"]' ).click();
    await page.waitForSelector( '.components-popover .components-dropdown-menu__menu' );
    await page.waitForTimeout( 300 );
    {
        const btn = await top( '#wfd-header button[aria-label="Options"]' );
        const pop = await top( '.components-popover:has(.components-dropdown-menu__menu) .components-popover__content' );
        const dTop = pop.top - btn.bottom;
        r.checks.optionsMenu = { btn, pop, pass: dTop >= -2 && dTop <= 24 && pop.left <= btn.right && pop.right >= btn.left };
    }
    await page.keyboard.press( 'Escape' );

    r.consoleErrors = errors;
    r.pass = Object.values( r.checks ).every( ( c ) => c.pass ) && errors.length === 0;
    results.push( r );
    await browser.close();
}
writeFileSync( `spikes/evidence/a-${ mode }.json`, JSON.stringify( results, null, 2 ) );
for ( const r of results ) {
    console.log( mode, r.zoom, r.pass, Object.fromEntries( Object.entries( r.checks ).map( ( [ k, v ] ) => [ k, v.pass ] ) ), r.consoleErrors );
}
