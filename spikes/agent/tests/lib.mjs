/**
 * Shared helpers of the Milestone 13 spikes. Throwaway.
 *
 * The spikes run against their own WordPress (spikes/agent/.wp-env.json,
 * port 8893), so that the site on port 8888 is not wiped.
 */
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname( fileURLToPath( import.meta.url ) );
export const ROOT = path.resolve( HERE, '..' );
export const BASE = process.env.WP_BASE_URL ?? 'http://localhost:8893';
export const EVIDENCE = path.join( ROOT, 'evidence' );

export const sleep = ( ms ) => new Promise( ( r ) => setTimeout( r, ms ) );

export function save( name, data ) {
    mkdirSync( EVIDENCE, { recursive: true } );
    writeFileSync(
        path.join( EVIDENCE, name ),
        JSON.stringify( data, null, 4 ) + '\n'
    );
}

/**
 * Opens a browser logged in as the administrator.
 */
export async function open() {
    const browser = await chromium.launch();
    const context = await browser.newContext( {
        viewport: { width: 1440, height: 900 },
        baseURL: BASE,
    } );
    const page = await context.newPage();
    const errors = [];
    page.on( 'console', ( m ) => {
        if ( m.type() === 'error' ) {
            errors.push( m.text() );
        }
    } );
    page.on( 'pageerror', ( e ) => errors.push( 'pageerror: ' + e.message ) );
    await page.goto( '/wp-login.php' );
    await page.fill( '#user_login', 'admin' );
    await page.fill( '#user_pass', 'password' );
    await page.click( '#wp-submit' );
    await page.waitForURL( /wp-admin/ );
    return { browser, context, page, errors };
}

/**
 * Wipes the site and seeds the fixture of spec/architecture.md.
 *
 * @param {import('@playwright/test').Page} page A logged-in page.
 */
export async function resetFixture( page ) {
    const nonce = (
        await (
            await page.request.get( '/wp-admin/admin-ajax.php?action=rest-nonce' )
        ).text()
    ).trim();
    const response = await page.request.post(
        '/?rest_route=/wfd-test/v1/reset',
        {
            headers: { 'X-WP-Nonce': nonce },
            data: { seed: true, extra: 0 },
        }
    );
    if ( ! response.ok() ) {
        throw new Error( 'reset failed: ' + ( await response.text() ) );
    }
    return response.json();
}

export async function openBoard( page, boardId, query = '' ) {
    await page.goto( `/wp-admin/admin.php?page=wfd-board&board=${ boardId }${ query }` );
    await page.locator( '[data-wfd-region="canvas"]' ).waitFor();
    await page
        .locator( '[data-wfd-artboard]' )
        .nth( 8 )
        .waitFor( { state: 'attached' } );
}

export async function boardAtRest( page, quiet = 1000 ) {
    await page.waitForFunction(
        ( wait ) => {
            const hooks = window.wfdTest;
            const state = ( window.wfdAtRest ??= { renders: -1, since: 0 } );
            const now = performance.now();
            if (
                hooks.counters.renders !== state.renders ||
                document.querySelector( '.wfd-artboard__skeleton' )
            ) {
                state.renders = hooks.counters.renders;
                state.since = now;
            }
            return now - state.since >= wait;
        },
        quiet,
        { polling: 100, timeout: 90000 }
    );
}

export async function setViewport( page, viewport ) {
    await page.evaluate(
        ( v ) => window.wfdTest.viewport.set( v, { immediate: true } ),
        viewport
    );
    await page.waitForTimeout( 200 );
}

export const tierOf = ( page, id ) =>
    page
        .locator( `[data-wfd-artboard="${ id }"]` )
        .getAttribute( 'data-wfd-tier' );

/**
 * Puts an artboard's top-left corner near the top-left of the canvas area.
 */
export async function bringIntoView( page, artboard, zoom ) {
    await setViewport( page, {
        x: 40 - artboard.x * zoom,
        y: 60 - artboard.y * zoom,
        zoom,
    } );
}

export async function enterEdit( page, id ) {
    const frame = page.locator(
        `[data-wfd-artboard="${ id }"] .wfd-artboard__frame`
    );
    const canvas = page.locator( '[data-wfd-region="canvas"]' );
    const c = await canvas.boundingBox();
    const f = await frame.boundingBox();
    const left = Math.max( c.x, f.x );
    const top = Math.max( c.y, f.y );
    const right = Math.min( c.x + c.width, f.x + f.width );
    const bottom = Math.min( c.y + c.height, f.y + f.height );
    await page.mouse.dblclick( ( left + right ) / 2, ( top + bottom ) / 2 );
    await page
        .locator( `[data-wfd-artboard="${ id }"][data-wfd-tier="live"]` )
        .waitFor();
    await page
        .frameLocator(
            `[data-wfd-artboard="${ id }"] iframe[name="editor-canvas"]`
        )
        .locator( '.is-root-container' )
        .waitFor();
}

/**
 * Runs a WP-CLI command in the spike site's CLI container, as `wp-env run
 * cli` does, and gives its standard output and how long it took.
 */
export function cliContainer() {
    const names = execFileSync( 'docker', [ 'ps', '--format', '{{.Names}}' ] )
        .toString()
        .split( '\n' );
    const web = execFileSync( 'docker', [ 'ps', '--format', '{{.Names}} {{.Ports}}' ] )
        .toString()
        .split( '\n' )
        .find( ( line ) => line.includes( ':8893->' ) );
    const prefix = web.split( ' ' )[ 0 ].replace( /-wordpress-1$/, '' );
    return names.find( ( name ) => name === prefix + '-cli-1' );
}
