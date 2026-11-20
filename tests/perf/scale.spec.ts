import { resetFixture, openBoard, counters } from '../e2e/utils';
import { drawn, held, test, trackRequests } from './support';

// What a board costs to open as it grows. A board opens fitted, so its
// artboards open as Snapshots. The counts are held to budgets; the memory
// figures are compared with the base build's and never fail the run.
test.describe( 'Board size', { tag: '@once' }, () => {
    for ( const size of [ 9, 30, 100 ] ) {
        test( `a board of ${ size } artboards`, async ( {
            page,
            requestUtils,
            browser,
            record,
        } ) => {
            const fixture = await resetFixture( requestUtils, {
                extra: size - 9,
            } );
            const requests = trackRequests( page );
            await openBoard( page, fixture.boardId, size );
            await drawn( page );

            const counts = await counters( page );
            const memory = await held( page, browser );
            const name = ( what: string ) => `board-${ size }.${ what }`;

            record( name( 'requests' ), requests.total, 'count' );
            record( name( 'rest-requests' ), requests.rest, 'count' );
            record( name( 'renders' ), counts.renders, 'count' );
            record(
                name( 'style-generations' ),
                counts.styleGenerations,
                'count'
            );
            record( name( 'parses' ), counts.parses, 'count' );
            record(
                name( 'iframes' ),
                await page.locator( 'iframe' ).count(),
                'count'
            );
            // Every document in the tab, the artboards' included.
            record( name( 'documents' ), memory.documents, 'count' );
            record( name( 'nodes' ), memory.nodes, 'count' );
            record( name( 'heap' ), memory.heap, 'bytes' );
            record( name( 'tab-memory' ), memory.tab, 'bytes' );
            record( name( 'gpu-memory' ), memory.gpu, 'bytes' );
        } );
    }
} );
