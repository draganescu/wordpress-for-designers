/**
 * Opens the seeded board, runs a snippet in the page and takes a screenshot.
 *
 * Usage: node tools/peek.mjs "<js expression>" [wait ms] [output name]
 */
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const BASE = process.env.WP_BASE_URL || 'http://localhost:8888';
const [ code = 'null', wait = '2500', name = 'peek' ] = process.argv.slice( 2 );
mkdirSync( 'artifacts/shell', { recursive: true } );
const browser = await chromium.launch();
const page = await browser.newPage( {
    viewport: { width: 1440, height: 900 },
} );
const errors = [];
page.on(
    'console',
    ( m ) => m.type() === 'error' && errors.push( m.text().slice( 0, 400 ) )
);
page.on( 'pageerror', ( e ) =>
    errors.push( 'pageerror: ' + e.message.slice( 0, 400 ) )
);
await page.goto( BASE + '/wp-login.php' );
await page.fill( '#user_login', 'admin' );
await page.fill( '#user_pass', 'password' );
await page.click( '#wp-submit' );
await page.waitForSelector( '#wpadminbar' );
await page.goto( BASE + '/wp-admin/admin-ajax.php?action=rest-nonce' );
const nonce = ( await page.locator( 'body' ).innerText() ).trim();
const reset = await page.request.post(
    BASE + '/?rest_route=/wfd-test/v1/reset',
    {
        headers: { 'X-WP-Nonce': nonce },
        data: { seed: true, extra: Number( process.env.EXTRA || 0 ) },
    }
);
const fixture = await reset.json();
await page.goto(
    `${ BASE }/wp-admin/admin.php?page=wfd-board&board=${ fixture.boardId }`
);
await page.waitForSelector( '[data-wfd-artboard]' );
await page.waitForTimeout( 800 );
const result = await page.evaluate(
    new Function( 'fixture', `return (async () => { ${ code } })()` ),
    fixture
);
await page.waitForTimeout( Number( wait ) );
await page.screenshot( { path: `artifacts/shell/${ name }.png` } );
console.log(
    JSON.stringify(
        {
            result,
            errors,
            tiers: await page
                .locator( '[data-wfd-artboard]' )
                .evaluateAll( ( els ) =>
                    els.map(
                        ( el ) => el.dataset.wfdTier + ':' + el.dataset.wfdKind
                    )
                ),
        },
        null,
        1
    )
);
await browser.close();
