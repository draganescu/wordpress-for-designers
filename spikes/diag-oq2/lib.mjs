import { chromium } from '@playwright/test';

export const BASE = 'http://localhost:8888';
export const POST = 11;

export async function open( user = 'admin' ) {
    const browser = await chromium.launch();
    const context = await browser.newContext( {
        viewport: { width: 1440, height: 900 },
    } );
    const page = await context.newPage();
    const errors = [];
    page.on( 'console', ( m ) => {
        if ( m.type() === 'error' ) {
            errors.push( m.text() );
        }
    } );
    page.on( 'pageerror', ( e ) => errors.push( 'pageerror: ' + e.message ) );
    await page.goto( BASE + '/wp-login.php' );
    await page.fill( '#user_login', user );
    await page.fill( '#user_pass', 'password' );
    await page.click( '#wp-submit' );
    await page.waitForURL( /wp-admin/ );
    return { browser, context, page, errors };
}

export const spikeUrl = ( spike, extra = '' ) =>
    `${ BASE }/wp-admin/admin.php?page=wfd-diag2&post=${ POST }&spike=${ spike }${ extra }`;
