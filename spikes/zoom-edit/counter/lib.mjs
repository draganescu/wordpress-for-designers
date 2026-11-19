import * as pw from '/Users/andreidraganescu/Sites/wordpress-for-designers/node_modules/@playwright/test/index.mjs';
export const DIR = '/Users/andreidraganescu/Sites/wordpress-for-designers/spikes/zoom-edit/counter';
export const BOARD = 'http://localhost:8888/wp-admin/admin.php?page=wfd-board&board=5215';
export const LABEL = 'Index · Template · Desktop';

export async function open( browserName = 'chromium', opts = {} ) {
    const browser = await pw[ browserName ].launch( { headless: true } );
    const context = await browser.newContext( { viewport: { width: 1440, height: 900 } } );
    const page = await context.newPage();
    const errors = [];
    page.on( 'console', ( m ) => m.type() === 'error' && errors.push( m.text() ) );
    page.on( 'pageerror', ( e ) => errors.push( 'PAGEERROR ' + e.message ) );
    await page.goto( 'http://localhost:8888/wp-login.php' );
    await page.fill( '#user_login', 'admin' );
    await page.fill( '#user_pass', 'password' );
    await page.click( '#wp-submit' );
    await page.waitForLoadState( 'domcontentloaded' );
    await page.goto( BOARD );
    await page.waitForSelector( '[data-wfd-artboard]' );
    await page.waitForTimeout( 1500 );
    return { browser, page, errors };
}

export async function findArtboardId( page, label = LABEL ) {
    return page.evaluate( ( label ) => {
        const all = [ ...document.querySelectorAll( '[data-wfd-artboard]' ) ];
        const hit = all.find( ( el ) => el.querySelector( '.wfd-artboard__label' )?.textContent.trim().startsWith( label ) );
        return hit ? hit.getAttribute( 'data-wfd-artboard' ) : all.map( ( el ) => el.querySelector( '.wfd-artboard__label' )?.textContent );
    }, label );
}

export async function enterEdit( page, id ) {
    const frame = page.locator( `[data-wfd-artboard="${ id }"] .wfd-artboard__frame` );
    const canvas = page.locator( '[data-wfd-region="canvas"]' );
    const visiblePoint = async () => {
        const c = await canvas.boundingBox();
        const f = await frame.boundingBox();
        const left = Math.max( c.x, f.x ), top = Math.max( c.y, f.y );
        const right = Math.min( c.x + c.width, f.x + f.width ), bottom = Math.min( c.y + c.height, f.y + f.height );
        return right - left > 2 && bottom - top > 2 ? { x: ( left + right ) / 2, y: ( top + bottom ) / 2 } : null;
    };
    await canvas.focus();
    await page.keyboard.press( 'Shift+Digit1' );
    await page.waitForTimeout( 400 );
    const point = await visiblePoint();
    await page.mouse.dblclick( point.x, point.y );
    await page.locator( `[data-wfd-artboard="${ id }"][data-wfd-tier="live"]` ).waitFor();
    await page.frameLocator( `[data-wfd-artboard="${ id }"] iframe[name="editor-canvas"]` ).locator( '.is-root-container' ).waitFor();
    await page.waitForTimeout( 800 );
}
