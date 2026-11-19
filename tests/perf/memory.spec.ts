import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import type { Browser, Page } from '@playwright/test';
import type { RequestUtils } from '@wordpress/e2e-test-utils-playwright';
import {
    resetFixture,
    openBoard,
    enterEdit,
    artboardOf,
    type Fixture,
} from '../e2e/utils';
import {
    VIEWS,
    collectGarbage,
    devtools,
    drawn,
    openBoardAt,
    pageMetrics,
    processStats,
    record,
} from './support';

/**
 * What the tab holds now, after collecting garbage.
 *
 * @param page    The page.
 * @param browser The browser.
 */
async function held( page: Page, browser: Browser ) {
    const client = await devtools( page );
    await collectGarbage( client );
    await page.waitForTimeout( 500 );
    const metrics = await pageMetrics( client );
    const memory = await processStats( browser );
    await client.detach();
    return {
        tab: memory.tab,
        heap: metrics.JSHeapUsedSize,
        documents: metrics.Documents,
        nodes: metrics.Nodes,
    };
}

const leave = ( page: Page ) =>
    page.getByRole( 'button', { name: 'Back to the board' } ).click();

// Memory is measured once. It varies by a few per cent between runs, so
// only the ceilings in tests/perf/budgets.json are enforced.
test.describe( 'Memory', { tag: '@once' }, () => {
    test( 'what each tier costs', async ( {
        browser,
        requestUtils,
    }, testInfo ) => {
        const fixture = await resetFixture( requestUtils );

        /**
         * Opens the fixture board in a tab of its own, so that its memory
         * starts from nothing, and measures it.
         *
         * @param view  The viewport to open at, or none to open fitted.
         * @param after What to do before measuring.
         */
        const measure = async (
            view: ( typeof VIEWS )[ keyof typeof VIEWS ] | null,
            after?: ( page: Page ) => Promise< number[] >
        ) => {
            const context = await browser.newContext( {
                storageState: process.env.STORAGE_STATE_PATH,
                baseURL: process.env.WP_BASE_URL,
                viewport: { width: 1440, height: 900 },
            } );
            const page = await context.newPage();
            if ( view ) {
                await openBoardAt( page, requestUtils, fixture.boardId, view );
            } else {
                await openBoard( page, fixture.boardId );
            }
            await drawn( page );
            const first = ( await held( page, browser ) ).tab;
            const more = after ? await after( page ) : [];
            await context.close();
            return [ first, ...more ];
        };

        // All nine artboards as Ghosts, as Snapshots and as Previews.
        const [ ghosts ] = await measure( VIEWS.far );
        const [ snapshots ] = await measure( null );
        const [ previews, oneEditor, threeEditors ] = await measure(
            VIEWS.previews,
            async ( page ) => {
                await expect(
                    page.locator( '[data-wfd-tier="preview"] iframe' )
                ).toHaveCount( 9 );
                // One Live editor, then two more so that two are Warm.
                const parts = [
                    artboardOf( fixture, 'template-part', 'desktop', 0 ),
                    artboardOf( fixture, 'template-part', 'desktop', 1 ),
                    artboardOf( fixture, 'template-part', 'mobile' ),
                ];
                await enterEdit( page, parts[ 0 ].id );
                const one = ( await held( page, browser ) ).tab;
                await leave( page );
                await enterEdit( page, parts[ 1 ].id );
                await leave( page );
                await enterEdit( page, parts[ 2 ].id );
                const three = ( await held( page, browser ) ).tab;
                return [ one, three ];
            }
        );

        record( testInfo, 'memory.board-of-ghosts', ghosts, 'bytes' );
        record(
            testInfo,
            'memory.per-snapshot',
            ( snapshots - ghosts ) / 9,
            'bytes'
        );
        record(
            testInfo,
            'memory.per-preview',
            ( previews - ghosts ) / 9,
            'bytes'
        );
        record( testInfo, 'memory.live-editor', oneEditor - previews, 'bytes' );
        record(
            testInfo,
            'memory.per-warm-editor',
            ( threeEditors - oneEditor ) / 2,
            'bytes'
        );
    } );

    test( 'what is still held after editing twenty artboards', async ( {
        page,
        requestUtils,
        browser,
    }, testInfo ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoardAt(
            page,
            requestUtils,
            fixture.boardId,
            VIEWS.previews
        );
        await drawn( page );
        // Template parts and patterns, in a fixed order, so that the board
        // is in the same state each time the cycle ends.
        const cycle = [
            artboardOf( fixture, 'template-part', 'desktop', 0 ),
            artboardOf( fixture, 'pattern', 'desktop', 0 ),
            artboardOf( fixture, 'template-part', 'desktop', 1 ),
            artboardOf( fixture, 'pattern', 'desktop', 1 ),
        ];
        const editEach = async () => {
            for ( const artboard of cycle ) {
                await enterEdit( page, artboard.id );
                await leave( page );
            }
        };

        // Once round first: the Warm editors and caches are part of the
        // steady state, not a leak.
        await editEach();
        await drawn( page );
        const before = await held( page, browser );
        for ( let i = 0; i < 5; i++ ) {
            await editEach();
        }
        await drawn( page );
        const after = await held( page, browser );

        record(
            testInfo,
            'leak.documents',
            after.documents - before.documents,
            'count'
        );
        record( testInfo, 'leak.nodes', after.nodes - before.nodes, 'count' );
        record( testInfo, 'leak.heap', after.heap - before.heap, 'bytes' );
        record( testInfo, 'leak.tab-memory', after.tab - before.tab, 'bytes' );
    } );

    test( 'the weight of a frozen copy', async ( {
        page,
        requestUtils,
    }, testInfo ) => {
        const fixture: Fixture = await resetFixture( requestUtils );
        // A long page: 120 paragraphs under a tall cover.
        const paragraph =
            '<!-- wp:paragraph --><p>A line of a long page, long enough to wrap on a phone.</p><!-- /wp:paragraph -->';
        await ( requestUtils as RequestUtils ).rest( {
            method: 'POST',
            path: `/wp/v2/blocks/${ fixture.patterns.hero }`,
            data: {
                content:
                    '<!-- wp:group {"style":{"dimensions":{"minHeight":"3000px"}},"layout":{"type":"constrained"}} -->' +
                    '<div class="wp-block-group" style="min-height:3000px"><!-- wp:paragraph --><p>Tall.</p><!-- /wp:paragraph --></div>' +
                    '<!-- /wp:group -->' +
                    paragraph.repeat( 120 ),
            },
        } );
        // Opened fitted, every artboard is a Snapshot.
        await openBoard( page, fixture.boardId );
        await drawn( page );
        const hero = fixture.layout.artboards.find(
            ( a ) => a.entityId === fixture.patterns.hero
        )!;
        const sizes = await page
            .locator( '.wfd-snapshot__copy iframe' )
            .evaluateAll( ( frames: HTMLIFrameElement[] ) =>
                frames.map( ( frame ) => ( {
                    id: frame
                        .closest( '[data-wfd-artboard]' )!
                        .getAttribute( 'data-wfd-artboard' ),
                    bytes: frame.srcdoc.length,
                } ) )
            );
        expect( sizes ).toHaveLength( 9 );

        record(
            testInfo,
            'snapshot.long-page',
            sizes.find( ( size ) => size.id === hero.id )!.bytes,
            'bytes'
        );
        record(
            testInfo,
            'snapshot.all-nine',
            sizes.reduce( ( sum, size ) => sum + size.bytes, 0 ),
            'bytes'
        );
    } );
} );
