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
 * The middle of the part of an artboard's frame that is inside the canvas
 * area, or null when none of it is.
 *
 * @param page The page.
 * @param id   The artboard id.
 */
export async function visiblePoint( page: Page, id: string ) {
    const frame = page.locator(
        `[data-wfd-artboard="${ id }"] .wfd-artboard__frame`
    );
    const canvas = page.locator( '[data-wfd-region="canvas"]' );
    const c = ( await canvas.boundingBox() )!;
    const f = ( await frame.boundingBox() )!;
    const left = Math.max( c.x, f.x );
    const top = Math.max( c.y, f.y );
    const right = Math.min( c.x + c.width, f.x + f.width );
    const bottom = Math.min( c.y + c.height, f.y + f.height );
    return right - left > 2 && bottom - top > 2
        ? { x: ( left + right ) / 2, y: ( top + bottom ) / 2 }
        : null;
}

/**
 * Enters edit on an artboard by double-clicking it, and waits for the editor.
 *
 * @param page The page.
 * @param id   The artboard id.
 */
export async function enterEdit( page: Page, id: string ) {
    let point = await visiblePoint( page, id );
    if ( ! point ) {
        // Bring every artboard into view first.
        await page.locator( '[data-wfd-region="canvas"]' ).focus();
        await page.keyboard.press( 'Shift+Digit1' );
        await page.waitForTimeout( 150 );
        point = ( await visiblePoint( page, id ) )!;
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

/**
 * Turns the inserter on, if it is off, and gives its panel.
 *
 * @param page The page.
 * @param tab  A tab to switch to.
 */
export async function openInserter( page: Page, tab?: string ) {
    const panel = page.locator( '.wfd-inserter' );
    if ( ( await panel.count() ) === 0 ) {
        await page
            .locator( '[data-wfd-region="header"]' )
            .getByRole( 'button', { name: 'Block inserter', exact: true } )
            .click();
    }
    await panel.waitFor();
    if ( tab ) {
        await panel.getByRole( 'tab', { name: tab } ).click();
    }
    return panel;
}

/**
 * Arms placement of a new artboard from a New row of the inserter (D63). The
 * inserter is turned on for it and stays on, as it does for a user.
 *
 * @param page The page.
 * @param tab  The inserter tab the row is in.
 * @param row  The row's name, for example "New page".
 */
export async function armNew(
    page: Page,
    tab: 'Pages' | 'Patterns' | 'Templates',
    row: string
) {
    const panel = await openInserter( page, tab );
    await panel
        .locator( '[data-wfd-new]' )
        .filter( { hasText: row } )
        .first()
        .click();
    await page.locator( '[data-wfd-placer]' ).waitFor( { state: 'attached' } );
}

export type Guide = {
    id: string;
    axis: 'x' | 'y';
    at: number;
    artboard?: string;
    device?: Artboard[ 'device' ];
};

export type Layout = {
    version: number;
    artboards: Record< string, unknown >[];
    notes?: Record< string, unknown >[];
    guides?: Guide[];
};

/**
 * Saves a board's layout through the `wfd-boards` route.
 *
 * @param requestUtils The REST helper.
 * @param boardId      The board.
 * @param layout       The layout, valid or not.
 * @return 200, or the status the server refused it with.
 */
export async function saveBoardLayout(
    requestUtils: RequestUtils,
    boardId: number,
    layout: unknown
): Promise< number | undefined > {
    try {
        await requestUtils.rest( {
            method: 'POST',
            path: `/wp/v2/wfd-boards/${ boardId }`,
            data: { layout },
        } );
        return 200;
    } catch ( error ) {
        return ( error as { data?: { status?: number } } ).data?.status;
    }
}

/**
 * The layout a board has on the server.
 *
 * @param requestUtils The REST helper.
 * @param boardId      The board.
 */
export async function savedBoardLayout(
    requestUtils: RequestUtils,
    boardId: number
): Promise< Layout > {
    const board = await requestUtils.rest< { layout: Layout } >( {
        path: `/wp/v2/wfd-boards/${ boardId }`,
        params: { context: 'edit' },
    } );
    return board.layout;
}

/**
 * Stores, for the user a page is logged in as, whether rulers and guides are
 * shown on a board (D109). It is written once, before the board is opened,
 * so what the board stores later is kept across reloads. The page is left on
 * a blank wp-admin address: open the board after it.
 *
 * @param page           The page.
 * @param boardId        The board.
 * @param choices        The two choices.
 * @param choices.rulers Whether rulers are shown.
 * @param choices.guides Whether guides are shown.
 */
export async function setViewChoices(
    page: Page,
    boardId: number,
    choices: { rulers: boolean; guides: boolean }
) {
    const nonce = await restNonce( page );
    const me = await page.request.get( '/?rest_route=/wp/v2/users/me', {
        headers: { 'X-WP-Nonce': nonce },
    } );
    const { id } = await me.json();
    await page.evaluate(
        ( [ key, value ] ) => window.localStorage.setItem( key, value ),
        [ `wfd/view/${ id }/${ boardId }`, JSON.stringify( choices ) ] as const
    );
}

/**
 * Whether an item of the zoom menu (H8) that shows or hides rulers or guides
 * is checked. The menu is opened for it and closed again.
 *
 * @param page The board page.
 * @param name Which item.
 * @return The item's `aria-checked`.
 */
export async function viewChecked( page: Page, name: 'rulers' | 'guides' ) {
    const item = page.locator( `[data-wfd-view="${ name }"]` );
    if ( ! ( await item.isVisible() ) ) {
        await page.locator( '[data-wfd-control="H8"]' ).click();
    }
    await item.waitFor();
    const checked = await item.getAttribute( 'aria-checked' );
    await page.keyboard.press( 'Escape' );
    await item.waitFor( { state: 'hidden' } );
    return checked;
}

/**
 * Chooses the "Rulers" or the "Guides" item of the zoom menu (H8), and
 * leaves the menu closed.
 *
 * @param page The board page.
 * @param name Which item.
 */
export async function chooseView( page: Page, name: 'rulers' | 'guides' ) {
    const item = page.locator( `[data-wfd-view="${ name }"]` );
    if ( ! ( await item.isVisible() ) ) {
        await page.locator( '[data-wfd-control="H8"]' ).click();
    }
    await item.click();
    // A checkbox item may leave its menu open.
    await page.waitForTimeout( 150 );
    if ( await item.isVisible() ) {
        await page.keyboard.press( 'Escape' );
    }
    await item.waitFor( { state: 'hidden' } );
}

/**
 * What a ruler says of itself in its attributes.
 *
 * @param page The board page.
 * @param side Which ruler.
 * @return Where zero is in the canvas area along the ruler, in CSS px; the
 *         board units between two numbers; the two ends of the span, or
 *         null with no span; and the positions marked, as read from zero.
 */
export async function rulerOf(
    page: Page,
    side: 'top' | 'left'
): Promise< {
    zero: number;
    step: number;
    span: number[] | null;
    marks: number[];
} > {
    return page
        .locator( `[data-wfd-ruler="${ side }"]` )
        .evaluate( ( element ) => {
            const numbers = ( name: string ) =>
                ( element.getAttribute( name ) ?? '' )
                    .split( ' ' )
                    .filter( Boolean )
                    .map( Number );
            const span = numbers( 'data-wfd-span' );
            return {
                zero: Number( element.getAttribute( 'data-wfd-zero' ) ),
                step: Number( element.getAttribute( 'data-wfd-step' ) ),
                span: span.length ? span : null,
                marks: numbers( 'data-wfd-marks' ),
            };
        } );
}

/**
 * The guides drawn on the page, as their attributes describe them.
 *
 * @param page The board page.
 */
export async function guidesOn( page: Page ): Promise<
    {
        id: string;
        axis: string | null;
        at: string | null;
        owner: string | null;
        device: string | null;
        selected: boolean;
    }[]
> {
    return page.locator( '[data-wfd-guide]' ).evaluateAll( ( elements ) =>
        elements.map( ( element ) => ( {
            id: element.getAttribute( 'data-wfd-guide' )!,
            axis: element.getAttribute( 'data-wfd-axis' ),
            at: element.getAttribute( 'data-wfd-at' ),
            owner: element.getAttribute( 'data-wfd-owner' ),
            device: element.getAttribute( 'data-wfd-device' ),
            selected: element.getAttribute( 'data-wfd-selected' ) === 'true',
        } ) )
    );
}

/**
 * Sets the viewport so that a point of the board is drawn at a point of the
 * canvas area.
 *
 * @param page   The board page.
 * @param corner The point of the board, in board units.
 * @param zoom   The zoom, 1 being 100%.
 * @param at     Where it is drawn, in canvas area pixels.
 */
export async function putCornerAt(
    page: Page,
    corner: Point,
    zoom: number,
    at: Point
) {
    await setViewport( page, {
        x: at.x - corner.x * zoom,
        y: at.y - corner.y * zoom,
        zoom,
    } );
}

/**
 * Presses on a ruler and drags into the canvas area, which pulls a guide out
 * of it (D110): a horizontal guide from the top ruler, a vertical one from
 * the left ruler.
 *
 * @param page         The board page.
 * @param side         Which ruler.
 * @param to           Where the pointer ends, in page pixels.
 * @param options      Options.
 * @param options.hold Leave the button down, so the drag goes on.
 */
export async function pullGuide(
    page: Page,
    side: 'top' | 'left',
    to: Point,
    options: { hold?: boolean } = {}
) {
    const box = ( await page
        .locator( `[data-wfd-ruler="${ side }"]` )
        .boundingBox() )!;
    const from =
        side === 'top'
            ? { x: to.x, y: box.y + box.height / 2 }
            : { x: box.x + box.width / 2, y: to.y };
    await page.mouse.move( from.x, from.y );
    await page.mouse.down();
    await page.mouse.move( ( from.x + to.x ) / 2, ( from.y + to.y ) / 2, {
        steps: 4,
    } );
    await page.mouse.move( to.x, to.y, { steps: 4 } );
    if ( ! options.hold ) {
        await page.mouse.up();
    }
}

/**
 * A point on a guide's line: the middle of the part of it that is inside the
 * canvas area, in page pixels.
 *
 * @param page The board page.
 * @param id   The guide's id.
 */
export async function guidePoint( page: Page, id: string ): Promise< Point > {
    const area = ( await page
        .locator( '[data-wfd-region="canvas"]' )
        .boundingBox() )!;
    const line = ( await page
        .locator( `[data-wfd-guide="${ id }"]` )
        .boundingBox() )!;
    const left = Math.max( area.x, line.x );
    const top = Math.max( area.y, line.y );
    const right = Math.min( area.x + area.width, line.x + line.width );
    const bottom = Math.min( area.y + area.height, line.y + line.height );
    return { x: ( left + right ) / 2, y: ( top + bottom ) / 2 };
}
