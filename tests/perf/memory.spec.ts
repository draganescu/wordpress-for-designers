import type { Page } from '@playwright/test';
import {
    resetFixture,
    openBoard,
    enterEdit,
    artboardOf,
    viewportOf,
} from '../e2e/utils';
import type { View } from './support';
import {
    VIEWS,
    drawn,
    expect,
    held,
    leaveEdit,
    openBoardAt,
    test,
    viewOn,
} from './support';

// Memory is measured once. The figures are sizes of processes and counts
// that depend on when Chromium collects garbage, so none of them has a
// budget: the report compares them with the base build's. Only the sizes of
// the frozen copies, which are exact, are held to tests/perf/budgets.json.
test.describe( 'Memory', { tag: '@once' }, () => {
    test( 'what each tier costs', async ( {
        browser,
        requestUtils,
        record,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        // One Live editor, then two more so that two are Warm.
        const parts = [
            artboardOf( fixture, 'template-part', 'desktop', 0 ),
            artboardOf( fixture, 'template-part', 'desktop', 1 ),
            artboardOf( fixture, 'template-part', 'mobile' ),
        ];
        // All nine as Previews, at a zoom the three can be edited at.
        const editable = viewOn( parts[ 0 ], 0.4 );

        /**
         * Opens the fixture board in a tab of its own, so that its memory
         * starts from nothing, and measures it.
         *
         * @param view  The viewport to open at, or none to open fitted.
         * @param after What to do before measuring.
         */
        const measure = async (
            view: View | null,
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
            editable,
            async ( page ) => {
                await expect(
                    page.locator( '[data-wfd-tier="preview"] iframe' )
                ).toHaveCount( 9 );
                await enterEdit( page, parts[ 0 ].id );
                const one = ( await held( page, browser ) ).tab;
                await leaveEdit( page );
                await enterEdit( page, parts[ 1 ].id );
                await leaveEdit( page );
                await enterEdit( page, parts[ 2 ].id );
                const three = ( await held( page, browser ) ).tab;
                // The board never zoomed to start an edit, which would have
                // changed the tier of the other artboards.
                expect( ( await viewportOf( page ) ).zoom ).toBe(
                    editable.zoom
                );
                return [ one, three ];
            }
        );

        record( 'memory.board-of-ghosts', ghosts, 'bytes' );
        record( 'memory.per-snapshot', ( snapshots - ghosts ) / 9, 'bytes' );
        record( 'memory.per-preview', ( previews - ghosts ) / 9, 'bytes' );
        record( 'memory.live-editor', oneEditor - previews, 'bytes' );
        record(
            'memory.per-warm-editor',
            ( threeEditors - oneEditor ) / 2,
            'bytes'
        );
    } );

    test( 'what is still held after editing twenty artboards', async ( {
        page,
        requestUtils,
        browser,
        record,
    } ) => {
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
                await leaveEdit( page );
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

        record( 'leak.documents', after.documents - before.documents, 'count' );
        record( 'leak.nodes', after.nodes - before.nodes, 'count' );
        record( 'leak.heap', after.heap - before.heap, 'bytes' );
        record( 'leak.tab-memory', after.tab - before.tab, 'bytes' );
    } );

    test( 'the weight of a frozen copy', async ( {
        page,
        requestUtils,
        record,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        // A long page: 120 paragraphs under a tall cover.
        const paragraph =
            '<!-- wp:paragraph --><p>A line of a long page, long enough to wrap on a phone.</p><!-- /wp:paragraph -->';
        await requestUtils.rest( {
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
                    bytes: new Blob( [ frame.srcdoc ] ).size,
                } ) )
            );
        expect( sizes ).toHaveLength( 9 );

        record(
            'snapshot.long-page',
            sizes.find( ( size ) => size.id === hero.id )!.bytes,
            'bytes'
        );
        record(
            'snapshot.all-nine',
            sizes.reduce( ( sum, size ) => sum + size.bytes, 0 ),
            'bytes'
        );
    } );
} );
