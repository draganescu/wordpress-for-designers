import type { Browser, Page } from '@playwright/test';
import type { RequestUtils } from '@wordpress/e2e-test-utils-playwright';

export type Artboard = {
    id: string;
    kind: 'page' | 'template' | 'template-part' | 'pattern';
    entityId: number | string;
    device: 'desktop' | 'tablet' | 'mobile';
    x: number;
    y: number;
    height: number;
};

export type Fixture = {
    users: { wfd_editor: number; wfd_admin2: number };
    boardId: number;
    layout: { version: 1; artboards: Artboard[] };
    pages: { about: number; member: number };
    patterns: { hero: number; sign: number };
    theme: string;
};

/**
 * Wipes the site's boards and content and, by default, seeds the fixture.
 *
 * @param requestUtils  The REST helper.
 * @param options       Whether to seed, and how many extra artboards to add.
 * @param options.seed
 * @param options.extra
 */
export async function resetFixture(
    requestUtils: RequestUtils,
    options: { seed?: boolean; extra?: number } = {}
): Promise< Fixture > {
    return requestUtils.rest( {
        method: 'POST',
        path: '/wfd-test/v1/reset',
        data: { seed: options.seed ?? true, extra: options.extra ?? 0 },
    } );
}

export const boardUrl = ( id: number ) =>
    `/wp-admin/admin.php?page=wfd-board&board=${ id }`;

export const BOARDS_URL = '/wp-admin/admin.php?page=wfd-boards';

/**
 * Opens a page logged in as another user.
 *
 * @param browser The browser.
 * @param login   The user's login name.
 */
export async function loginAs(
    browser: Browser,
    login: string
): Promise< Page > {
    const context = await browser.newContext( {
        storageState: undefined,
        baseURL: process.env.WP_BASE_URL,
    } );
    const page = await context.newPage();
    await page.goto( '/wp-login.php' );
    await page.locator( '#user_login' ).fill( login );
    await page.locator( '#user_pass' ).fill( 'password' );
    await page.locator( '#wp-submit' ).click();
    await page.waitForURL( /wp-admin/ );
    return page;
}

/**
 * The REST nonce of the user a page is logged in as.
 *
 * @param page A wp-admin page.
 */
export async function restNonce( page: Page ): Promise< string > {
    await page.goto( '/wp-admin/admin-ajax.php?action=rest-nonce' );
    return ( await page.locator( 'body' ).innerText() ).trim();
}

/**
 * Opens a board and waits for its artboards.
 *
 * @param page    The page.
 * @param boardId The board.
 * @param count   Number of artboards expected.
 */
export async function openBoard( page: Page, boardId: number, count = 9 ) {
    await page.goto( boardUrl( boardId ) );
    await page.locator( '[data-wfd-region="canvas"]' ).waitFor();
    if ( count ) {
        await page
            .locator( '[data-wfd-artboard]' )
            .nth( count - 1 )
            .waitFor( { state: 'attached' } );
    }
}

/**
 * The viewport as the app holds it outside React.
 *
 * @param page The page.
 */
export async function viewportOf(
    page: Page
): Promise< { x: number; y: number; zoom: number } > {
    return page.evaluate( () => ( window as any ).wfdTest.viewport.get() );
}

/**
 * The on-screen box of an artboard's frame.
 *
 * @param artboard Locator of the artboard.
 */
export async function frameBox(
    artboard: import( '@playwright/test' ).Locator
) {
    return artboard.locator( '.wfd-artboard__frame' ).boundingBox();
}

/**
 * Test counters exposed by the app in test builds.
 *
 * @param page The page.
 */
export async function counters( page: Page ): Promise< Record< string, any > > {
    return page.evaluate( () => ( {
        ...( window as any ).wfdTest.counters,
        viewportUpdates: ( window as any ).wfdTest.viewport.counters.updates,
    } ) );
}

/**
 * Waits until the board has finished what it does by itself after it opens:
 * no artboard is still waiting for its first render, and React has rendered
 * nothing for a while. A board that opens below the Preview tier renders its
 * artboards one at a time for several seconds, so a fixed wait can end in
 * the middle of that.
 *
 * @param page  The page.
 * @param quiet How long React has to have rendered nothing, in ms.
 */
export async function boardAtRest( page: Page, quiet = 1000 ) {
    await page.waitForFunction(
        ( wait ) => {
            const hooks = ( window as any ).wfdTest;
            const state = ( ( window as any ).wfdAtRest ??= {
                renders: -1,
                since: 0,
            } );
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
        { polling: 100, timeout: 60000 }
    );
}

/**
 * Sets the zoom, keeping a canvas point fixed, and waits for the app to settle.
 *
 * @param page  The page.
 * @param zoom  The zoom, 1 being 100%.
 * @param point The fixed point in canvas area pixels.
 */
export async function setZoom(
    page: Page,
    zoom: number,
    point = { x: 0, y: 0 }
) {
    await page.evaluate(
        ( [ z, p ] ) =>
            ( window as any ).wfdTest.viewport.zoomTo( z, p, {
                immediate: true,
            } ),
        [ zoom, point ] as const
    );
    await page.waitForTimeout( 100 );
}

/**
 * Sets the whole viewport and waits for the app to settle.
 *
 * @param page          The page.
 * @param viewport      The viewport.
 * @param viewport.x
 * @param viewport.y
 * @param viewport.zoom
 */
export async function setViewport(
    page: Page,
    viewport: { x: number; y: number; zoom: number }
) {
    await page.evaluate(
        ( v ) =>
            ( window as any ).wfdTest.viewport.set( v, { immediate: true } ),
        viewport
    );
    await page.waitForTimeout( 100 );
}

/**
 * The tier of every artboard, keyed by artboard id.
 *
 * @param page The page.
 */
export async function tiersOf(
    page: Page
): Promise< Record< string, string > > {
    return page
        .locator( '[data-wfd-artboard]' )
        .evaluateAll( ( els ) =>
            Object.fromEntries(
                els.map( ( el ) => [
                    el.getAttribute( 'data-wfd-artboard' ),
                    el.getAttribute( 'data-wfd-tier' ),
                ] )
            )
        );
}

/**
 * The width of the content document of an artboard's iframe.
 *
 * @param page The page.
 * @param id   The artboard id.
 */
export async function contentWidth( page: Page, id: string ) {
    const frame = page
        .locator( `[data-wfd-artboard="${ id }"] iframe` )
        .first();
    await frame.waitFor( { state: 'attached' } );
    return frame.evaluate(
        ( el: HTMLIFrameElement ) =>
            el.contentDocument!.documentElement.clientWidth
    );
}

/**
 * Reads, and optionally sets, who holds a post's lock (0 for nobody).
 *
 * @param requestUtils The REST helper.
 * @param id           The post.
 * @param user         A user id to give the lock to, or 0 to clear it.
 */
export async function postLock(
    requestUtils: RequestUtils,
    id: number,
    user?: number
): Promise< number > {
    const result = await requestUtils.rest< { holder: number } >( {
        method: 'POST',
        path: '/wfd-test/v1/lock',
        data: user === undefined ? { id } : { id, user },
    } );
    return result.holder;
}

/**
 * Enters edit on an artboard by double-clicking it, and waits for the editor.
 *
 * @param page The page.
 * @param id   The artboard id.
 */
export async function enterEdit( page: Page, id: string ) {
    const frame = page.locator(
        `[data-wfd-artboard="${ id }"] .wfd-artboard__frame`
    );
    const canvas = page.locator( '[data-wfd-region="canvas"]' );
    const visiblePoint = async () => {
        const c = ( await canvas.boundingBox() )!;
        const f = ( await frame.boundingBox() )!;
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
        // Bring every artboard into view first.
        await canvas.focus();
        await page.keyboard.press( 'Shift+Digit1' );
        await page.waitForTimeout( 150 );
        point = ( await visiblePoint() )!;
    }
    await page.mouse.dblclick( point.x, point.y );
    await page
        .locator( `[data-wfd-artboard="${ id }"][data-wfd-tier="live"]` )
        .waitFor();
    await editorFrame( page, id ).locator( '.is-root-container' ).waitFor();
}

/**
 * The canvas document of an artboard's editor.
 *
 * @param page The page.
 * @param id   The artboard id.
 */
export function editorFrame( page: Page, id: string ) {
    return page.frameLocator(
        `[data-wfd-artboard="${ id }"] iframe[name="editor-canvas"]`
    );
}

/**
 * The artboard of a kind and device in the fixture.
 *
 * @param fixture The fixture.
 * @param kind    The kind.
 * @param device  The device.
 * @param nth     Which one, when there are several.
 */
export function artboardOf(
    fixture: Fixture,
    kind: Artboard[ 'kind' ],
    device: Artboard[ 'device' ] = 'desktop',
    nth = 0
): Artboard {
    return fixture.layout.artboards.filter(
        ( a ) => a.kind === kind && a.device === device
    )[ nth ];
}

export type Point = { x: number; y: number };

/**
 * Fingers on a touch screen, for a page opened with `hasTouch`. Each call
 * names where every finger that is down is, in page pixels.
 *
 * @param page The page.
 */
export async function fingers( page: Page ) {
    const session = await page.context().newCDPSession( page );
    const send = (
        type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel',
        points: Point[]
    ) =>
        session.send( 'Input.dispatchTouchEvent', {
            type,
            touchPoints: points.map( ( { x, y }, id ) => ( { x, y, id } ) ),
        } );
    const api = {
        down: ( ...points: Point[] ) => send( 'touchStart', points ),
        move: ( ...points: Point[] ) => send( 'touchMove', points ),
        up: () => send( 'touchEnd', [] ),
        // The browser takes the fingers away.
        cancel: () => send( 'touchCancel', [] ),
        async tap( point: Point ) {
            await api.down( point );
            await api.up();
        },
        /**
         * Moves the fingers that are down in a straight line, in steps.
         *
         * @param from  Where they are.
         * @param to    Where they end.
         * @param steps The number of moves.
         */
        async glide( from: Point[], to: Point[], steps = 6 ) {
            for ( let i = 1; i <= steps; i++ ) {
                await api.move(
                    ...from.map( ( point, n ) => ( {
                        x: point.x + ( ( to[ n ].x - point.x ) * i ) / steps,
                        y: point.y + ( ( to[ n ].y - point.y ) * i ) / steps,
                    } ) )
                );
            }
        },
    };
    return api;
}

/**
 * The points of a 10 px grid over the canvas area that are on empty board, or
 * on the frame of one artboard.
 *
 * @param page The page.
 * @param id   The artboard, or null for empty board.
 */
export function gridOn( page: Page, id: string | null ): Promise< Point[] > {
    return page
        .locator( '[data-wfd-region="canvas"]' )
        .evaluate( ( area, artboardId ) => {
            const box = area.getBoundingClientRect();
            const found: { x: number; y: number }[] = [];
            for ( let y = box.top + 20; y < box.bottom - 20; y += 10 ) {
                for ( let x = box.left + 20; x < box.right - 20; x += 10 ) {
                    const element = document.elementFromPoint( x, y );
                    const isOn = artboardId
                        ? !! element?.closest(
                              `[data-wfd-artboard="${ artboardId }"] .wfd-artboard__frame`
                          )
                        : element === area;
                    if ( isOn ) {
                        found.push( { x, y } );
                    }
                }
            }
            return found;
        }, id );
}

/**
 * A point of the canvas area on the frame of an artboard, away from its
 * edges where it can be.
 *
 * @param page The page.
 * @param id   The artboard.
 */
export async function pointOn( page: Page, id: string ): Promise< Point > {
    const found = await gridOn( page, id );
    if ( ! found.length ) {
        throw new Error( 'The artboard is not in view' );
    }
    return found[ Math.floor( found.length / 2 ) ];
}

/**
 * Two points of the canvas area, 100 to 220 px apart, that are both on empty
 * board or both on the frame of one artboard.
 *
 * @param page The page.
 * @param id   The artboard, or null for empty board.
 */
export async function pointsOn(
    page: Page,
    id: string | null
): Promise< [ Point, Point ] > {
    const found = await gridOn( page, id );
    for ( const a of found ) {
        for ( const b of found ) {
            const distance = Math.hypot( b.x - a.x, b.y - a.y );
            if ( b.x >= a.x && distance >= 100 && distance <= 220 ) {
                return [ a, b ];
            }
        }
    }
    throw new Error( 'No two such points in view' );
}
