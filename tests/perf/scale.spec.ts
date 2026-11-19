import { test } from '@wordpress/e2e-test-utils-playwright';
import { resetFixture, openBoard } from '../e2e/utils';
import {
    appCounters,
    collectGarbage,
    devtools,
    drawn,
    pageMetrics,
    processStats,
    record,
    trackRequests,
} from './support';

// What a board costs as it grows. A board opens fitted, so the larger ones
// open as Snapshots.
test.describe( 'Board size', { tag: '@once' }, () => {
    for ( const size of [ 9, 30, 100 ] ) {
        test( `a board of ${ size } artboards`, async ( {
            page,
            requestUtils,
            browser,
        }, testInfo ) => {
            const fixture = await resetFixture( requestUtils, {
                extra: size - 9,
            } );
            const requests = trackRequests( page );
            await openBoard( page, fixture.boardId, size );
            await drawn( page );

            const client = await devtools( page );
            await collectGarbage( client );
            const metrics = await pageMetrics( client );
            const memory = await processStats( browser );
            const counts = await appCounters( page );
            const name = ( what: string ) => `board-${ size }.${ what }`;

            record( testInfo, name( 'renders' ), counts.renders, 'count' );
            record( testInfo, name( 'rest-requests' ), requests.rest, 'count' );
            record(
                testInfo,
                name( 'iframes' ),
                await page.locator( 'iframe' ).count(),
                'count'
            );
            // Every document in the tab, the artboards' included.
            record( testInfo, name( 'documents' ), metrics.Documents, 'count' );
            record( testInfo, name( 'nodes' ), metrics.Nodes, 'count' );
            record( testInfo, name( 'heap' ), metrics.JSHeapUsedSize, 'bytes' );
            record( testInfo, name( 'tab-memory' ), memory.tab, 'bytes' );
            record( testInfo, name( 'gpu-memory' ), memory.gpu, 'bytes' );
        } );
    }
} );
