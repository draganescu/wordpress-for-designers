/**
 * Takes the screenshots of the README from the seeded demo site.
 *
 * Run from the repository root with the demo site up and freshly seeded:
 * node demo/tools/screenshots.mjs [step ...]
 *
 * Steps: sitemap, edit, system, coffee, home, frost. With none, all run.
 * Each board is opened at a view written here, so a shot is framed the same
 * every time.
 */
import { chromium } from 'playwright';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(
    dirname( fileURLToPath( import.meta.url ) ),
    '../../docs/screenshots'
);
const want = process.argv.slice( 2 );
const site = 'http://localhost:8900';
const b = await chromium.launch();
const ctx = await b.newContext( {
    viewport: { width: 1920, height: 1200 },
    deviceScaleFactor: 1.5,
} );
const page = await ctx.newPage();
await page.goto( site + '/wp-login.php' );
await page.fill( '#user_login', 'admin' );
await page.fill( '#user_pass', 'password' );
await page.click( '#wp-submit' );
await page.goto( site + '/wp-admin/admin.php?page=wfd-boards', {
    waitUntil: 'networkidle',
} );
const boards = Object.fromEntries(
    (
        await page.$$eval( 'a[href*="board="]', ( as ) =>
            as.map( ( a ) => [ a.textContent.trim(), a.href ] )
        )
    ).filter( ( [ t ] ) => t )
);
const shot = async ( name ) => {
    await page.screenshot( {
        path: `${ out }/${ name }.jpg`,
        type: 'jpeg',
        quality: 82,
    } );
    console.log( 'shot', name );
};
const zoom = () =>
    page.evaluate( () => {
        for ( const el of document.querySelectorAll( 'button' ) ) {
            const m = el.textContent.match( /(\d+)%/ );
            if ( m ) return +m[ 1 ];
        }
        return 0;
    } );
const open = async ( title, view, wait = 20000 ) => {
    const id = new URL( boards[ title ] ).searchParams.get( 'board' );
    await page.evaluate(
        ( [ key, value ] ) =>
            value
                ? window.localStorage.setItem( key, JSON.stringify( value ) )
                : window.localStorage.removeItem( key ),
        [ `wfd/viewport/1/${ id }`, view || null ]
    );
    await page.goto( boards[ title ], { waitUntil: 'domcontentloaded' } );
    await page.waitForTimeout( wait );
};
const variation = async ( name ) => {
    await page.getByRole( 'button', { name: /Variation:/ } ).click();
    await page.getByRole( 'menuitemradio', { name, exact: true } ).click();
    await page.waitForTimeout( 12000 );
};
const steps = {
    async sitemap() {
        await open( 'Site map', { x: 40, y: 150, zoom: 0.24 } );
        await shot( 'site-map' );
    },
    async system() {
        await open( 'Design system', { x: 40, y: 130, zoom: 0.27 } );
        await shot( 'design-system' );
        for ( const v of [ 'Night shift', 'Paper', 'Citrus' ] ) {
            await variation( v );
            await shot(
                'design-system-' + v.toLowerCase().replace( ' ', '-' )
            );
        }
    },
    async coffee() {
        await open(
            'Coffee pages, template and live data',
            { x: 40, y: 120, zoom: 0.2 },
            26000
        );
        await shot( 'coffee-pages' );
    },
    async frost() {
        await open( 'First Frost, winter campaign' );
        await shot( 'first-frost' );
    },
    async home() {
        await open( 'Homepage, every screen', { x: 40, y: 120, zoom: 0.17 } );
        await shot( 'homepage-widths' );
    },
    async edit() {
        await open( 'Site map', { x: 60, y: 70, zoom: 0.6 } );
        const box = await page
            .locator( '.wfd-artboard__frame' )
            .first()
            .boundingBox();
        await page.mouse.dblclick( box.x + 300, box.y + 300 );
        await page.waitForTimeout( 9000 );
        await page.mouse.click( 700, 300 );
        await page.waitForTimeout( 2500 );
        await shot( 'editing' );
    },
};
for ( const key of want.length ? want : Object.keys( steps ) ) {
    try {
        await steps[ key ]();
    } catch ( e ) {
        console.log( 'FAILED', key, e.message.split( '\n' )[ 0 ] );
        process.exitCode = 1;
    }
}
await b.close();
