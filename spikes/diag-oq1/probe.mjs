// OQ-1 extra probes: unlock opt-in names, cover resize drag under scale.
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { open, spikeUrl } from './lib.mjs';

const OUT = 'spikes/diag-oq1';
const out = { optIn: {}, resizeDrag: {} };

// 1. Which module names does the opt-in accept from a plugin script?
for ( const name of [ '@wordpress/block-editor', '@wordpress/edit-site', '@wordpress/theme', 'wordpress-for-designers', '@wordpress/not-a-core-module' ] ) {
    const { browser, page, errors } = await open();
    await page.goto( spikeUrl( 'a', '&zoom=100&mode=naive&optin=' + encodeURIComponent( name ) ) );
    await page.waitForTimeout( 1500 );
    out.optIn[ name ] = await page.evaluate( () => ( {
        ok: window.wfdUnlock.ok,
        error: window.wfdUnlock.error,
        privateKeyCount: window.wfdUnlock.privateKeys?.length,
        hasExperimentalBlockCanvas: window.wfdUnlock.privateKeys?.includes( 'ExperimentalBlockCanvas' ),
        wrongConsent: ( () => {
            try {
                window.wp.privateApis.__dangerousOptInToUnstableAPIsOnlyForCoreModules( 'wrong', '@wordpress/block-editor' );
                return 'accepted';
            } catch ( e ) {
                return e.message.slice( 0, 90 );
            }
        } )(),
    } ) );
    out.optIn[ name ].consoleErrors = errors.length;
    await browser.close();
}

// 2. Drag the cover block's bottom resize handle 60 visual px down.
for ( const [ mode, fix, zoom ] of [ [ 'naive', false, 100 ], [ 'counter', true, 50 ], [ 'counter', true, 75 ], [ 'expscale', true, 50 ], [ 'counter', false, 50 ] ] ) {
    const { browser, page, errors } = await open();
    page.setDefaultTimeout( 6000 );
    await page.goto( spikeUrl( 'a', `&zoom=${ zoom }&mode=${ mode }${ fix ? '&fix=1' : '' }` ) );
    const frameEl = page.locator( '#wfd-scaled iframe' );
    const frame = page.frameLocator( '#wfd-scaled iframe' );
    await frame.locator( '.wp-block-cover' ).first().waitFor();
    await page.waitForTimeout( 1200 );
    const visHeight = async () => {
        const o = await frameEl.evaluate( ( el ) => el.getBoundingClientRect().width / el.offsetWidth );
        const h = await frame.locator( '.wp-block-cover' ).first().evaluate( ( el ) => el.getBoundingClientRect().height );
        return h * o;
    };
    const key = `${ mode }${ fix ? '+cssfix' : '' }@${ zoom }`;
    try {
        await page.evaluate( () => {
            const b = window.wfdBE.select.getBlocks()[ 6 ];
            window.wfdBE.dispatch.selectBlock( b.clientId );
        } );
        await frame.locator( '.wp-block-cover' ).first().scrollIntoViewIfNeeded();
        await page.waitForTimeout( 800 );
        const before = await visHeight();
        const handle = page.locator( '.block-editor-block-popover .components-resizable-box__handle-bottom' ).first();
        await handle.scrollIntoViewIfNeeded();
        await page.evaluate( () => window.scrollBy( 0, 150 ) );
        await page.waitForTimeout( 300 );
        const hb = await handle.evaluate( ( el ) => {
            const b = el.getBoundingClientRect();
            return { x: b.left + b.width / 2, y: b.top + b.height / 2, left: b.left, right: b.right, top: b.top, bottom: b.bottom };
        } );
        await page.mouse.move( hb.x, hb.y );
        await page.mouse.down();
        await page.mouse.move( hb.x, hb.y + 20, { steps: 4 } );
        await page.mouse.move( hb.x, hb.y + 60, { steps: 8 } );
        await page.mouse.up();
        await page.waitForTimeout( 600 );
        const after = await visHeight();
        const minHeight = await page.evaluate( () => window.wfdBE.select.getBlocks()[ 6 ].attributes.minHeight );
        out.resizeDrag[ key ] = {
            handle: hb, visualHeightBefore: before, visualHeightAfter: after,
            visualDelta: after - before, draggedBy: 60, minHeightAttr: minHeight,
            pass: Math.abs( after - before - 60 ) <= 4, consoleErrors: errors,
        };
        await page.screenshot( { path: `${ OUT }/shots/${ key.replace( '@', '-' ) }-resizedrag.png` } );
    } catch ( e ) {
        out.resizeDrag[ key ] = { pass: false, error: e.message.split( '\n' )[ 0 ] };
    }
    await browser.close();
}

const file = OUT + '/results.json';
const all = existsSync( file ) ? JSON.parse( readFileSync( file, 'utf8' ) ) : {};
all.probes = out;
writeFileSync( file, JSON.stringify( all, null, 2 ) );
console.log( JSON.stringify( out, null, 1 ) );
