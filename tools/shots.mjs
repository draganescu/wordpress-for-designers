/**
 * Screenshots every fixed-data screen into artifacts/shell/, for the visual
 * check recorded in spec/shell-check.md.
 *
 * Usage: node tools/shots.mjs [ScreenName ...]
 */
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const BASE = process.env.WP_BASE_URL || 'http://localhost:8888';
const ALL = [
    'Overview',
    'Main',
    'Selected',
    'EmptyBoard',
    'ErrorArtboard',
    'AddArtboard',
    'AddArtboard2',
    'DeleteDialog',
    'ResetDialog',
    'LockDialog',
    'LockDialogTaken',
    'InserterBlocks',
    'InserterEmpty',
    'InserterMedia',
    'InserterPages',
    'InserterTemplates',
    'Library',
    'Styles',
    'StylesBlocks',
    'StylesHistory',
    'Review',
    'ReviewEmpty',
    'ReviewError',
];
const names = process.argv.length > 2 ? process.argv.slice( 2 ) : ALL;

mkdirSync( 'artifacts/shell', { recursive: true } );
const browser = await chromium.launch();
const page = await browser.newPage( {
    viewport: { width: 1440, height: 900 },
} );
const errors = {};
let current = '';
page.on( 'console', ( m ) => {
    if ( m.type() === 'error' ) {
        ( errors[ current ] ||= [] ).push( m.text().slice( 0, 300 ) );
    }
} );
page.on( 'pageerror', ( e ) =>
    ( errors[ current ] ||= [] ).push(
        'pageerror: ' + e.message.slice( 0, 300 )
    )
);

await page.goto( BASE + '/wp-login.php' );
await page.fill( '#user_login', 'admin' );
await page.fill( '#user_pass', 'password' );
await page.click( '#wp-submit' );
await page.waitForURL( /wp-admin/, { waitUntil: 'commit' } );
await page.waitForSelector( '#wpadminbar' );
await page.goto( BASE + '/wp-admin/admin-ajax.php?action=rest-nonce' );
const nonce = ( await page.locator( 'body' ).innerText() ).trim();
const reset = await page.request.post(
    BASE + '/?rest_route=/wfd-test/v1/reset',
    {
        headers: { 'X-WP-Nonce': nonce },
        data: { seed: true },
    }
);
const { boardId } = await reset.json();

for ( const name of names ) {
    current = name;
    if ( name === 'Boards' || name === 'Live' ) {
        await page.goto(
            name === 'Boards'
                ? `${ BASE }/wp-admin/admin.php?page=wfd-boards`
                : `${ BASE }/wp-admin/admin.php?page=wfd-board&board=${ boardId }`
        );
    } else {
        await page.goto(
            `${ BASE }/wp-admin/admin.php?page=wfd-board&board=${ boardId }&wfd-screen=${ name }`
        );
    }
    await page.waitForTimeout( 1200 );
    await page.screenshot( { path: `artifacts/shell/${ name }.png` } );
}
console.log( JSON.stringify( errors, null, 1 ) );
await browser.close();
