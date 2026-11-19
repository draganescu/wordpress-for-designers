import * as pw from '/Users/andreidraganescu/Sites/wordpress-for-designers/node_modules/@playwright/test/index.mjs';

export const BASE = 'http://localhost:8888';
export const BOARD = BASE + '/wp-admin/admin.php?page=wfd-board&board=5215';
export const DIR = '/Users/andreidraganescu/Sites/wordpress-for-designers/spikes/zoom-edit/inner';
export const LABEL = 'Single Posts';

export async function open( browserName = 'chromium', viewport = { width: 1440, height: 900 } ) {
    const browser = await pw[ browserName ].launch();
    const context = await browser.newContext( {
        viewport,
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
    await page.fill( '#user_login', 'admin' );
    await page.fill( '#user_pass', 'password' );
    await page.click( '#wp-submit' );
    await page.waitForURL( /wp-admin/ );
    await page.goto( BOARD );
    await page.locator( '[data-wfd-region="canvas"]' ).waitFor();
    await page.locator( '[data-wfd-artboard]' ).nth( 8 ).waitFor( { state: 'attached' } );
    return { browser, context, page, errors };
}

export async function artboardId( page ) {
    return page.evaluate( ( label ) => {
        for ( const el of document.querySelectorAll( '[data-wfd-artboard]' ) ) {
            if ( el.textContent.includes( label ) ) {
                return el.getAttribute( 'data-wfd-artboard' );
            }
        }
        return null;
    }, LABEL );
}

export async function enterEdit( page, id ) {
    const frame = page.locator( `[data-wfd-artboard="${ id }"] .wfd-artboard__frame` );
    const canvas = page.locator( '[data-wfd-region="canvas"]' );
    const visiblePoint = async () => {
        const c = await canvas.boundingBox();
        const f = await frame.boundingBox();
        const left = Math.max( c.x, f.x );
        const top = Math.max( c.y, f.y );
        const right = Math.min( c.x + c.width, f.x + f.width );
        const bottom = Math.min( c.y + c.height, f.y + f.height );
        return right - left > 2 && bottom - top > 2
            ? { x: ( left + right ) / 2, y: ( top + bottom ) / 2 }
            : null;
    };
    let point = await visiblePoint();
    if ( ! point ) {
        await canvas.focus();
        await page.keyboard.press( 'Shift+Digit1' );
        await page.waitForTimeout( 300 );
        point = await visiblePoint();
    }
    await page.mouse.dblclick( point.x, point.y );
    await page.locator( `[data-wfd-artboard="${ id }"][data-wfd-tier="live"] iframe[name="editor-canvas"]` ).waitFor( { timeout: 20000 } );
    await page.frameLocator( 'iframe[name="editor-canvas"]' ).locator( '.is-root-container' ).waitFor();
    await page.waitForTimeout( 800 );
}
