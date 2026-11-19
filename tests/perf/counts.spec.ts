import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import {
    resetFixture,
    openBoard,
    enterEdit,
    editorFrame,
    artboardOf,
} from '../e2e/utils';
import {
    VIEWS,
    appCounters,
    changeBackground,
    drawn,
    openBoardAt,
    pointOn,
    record,
    settle,
    trackRequests,
} from './support';

// Exact counts: the same on every run of the same code, so they are held to
// tests/perf/budgets.json. One run is enough.
test.describe( 'Counts', { tag: '@once' }, () => {
    test( 'opening the fixture board', async ( {
        page,
        requestUtils,
    }, testInfo ) => {
        const fixture = await resetFixture( requestUtils );
        const requests = trackRequests( page );
        await openBoard( page, fixture.boardId );
        await drawn( page );

        const counts = await appCounters( page );
        record( testInfo, 'open.requests', requests.total, 'count' );
        record( testInfo, 'open.rest-requests', requests.rest, 'count' );
        record( testInfo, 'open.renders', counts.renders, 'count' );
        record(
            testInfo,
            'open.style-generations',
            counts.styleGenerations,
            'count'
        );
        record( testInfo, 'open.parses', counts.parses, 'count' );
    } );

    test( 'one of each action', async ( { page, requestUtils }, testInfo ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoardAt(
            page,
            requestUtils,
            fixture.boardId,
            VIEWS.previews
        );
        await expect(
            page.locator( '[data-wfd-tier="preview"] iframe' )
        ).toHaveCount( 9 );
        await drawn( page );

        /**
         * Runs an action and records what the app did because of it.
         *
         * @param name   The action's name in the results.
         * @param action The action.
         * @param also   Counters to record besides renders.
         */
        const measure = async (
            name: string,
            action: () => Promise< unknown >,
            also: ( 'styleGenerations' | 'parses' )[] = []
        ) => {
            await settle( page );
            const before = await appCounters( page );
            await action();
            await settle( page );
            const after = await appCounters( page );
            record(
                testInfo,
                `${ name }.renders`,
                after.renders - before.renders,
                'count'
            );
            for ( const counter of also ) {
                record(
                    testInfo,
                    `${ name }.${
                        counter === 'parses' ? 'parses' : 'style-generations'
                    }`,
                    after[ counter ] - before[ counter ],
                    'count'
                );
            }
        };

        const about = artboardOf( fixture, 'page' );
        const hero = artboardOf( fixture, 'pattern' );

        await measure( 'select', async () => {
            const point = await pointOn( page, about.id );
            await page.mouse.click( point.x, point.y );
        } );

        await measure( 'move', async () => {
            const point = await pointOn( page, about.id );
            await page.mouse.move( point.x, point.y );
            await page.mouse.down();
            await page.mouse.move( point.x + 60, point.y + 40, { steps: 10 } );
            await page.mouse.up();
            // The layout saves itself two seconds later.
            await page.waitForTimeout( 2500 );
        } );

        await measure( 'edit-enter', () => enterEdit( page, hero.id ) );

        const heading = editorFrame( page, hero.id ).locator( 'h2' );
        await heading.click();
        await measure(
            'type',
            () => page.keyboard.type( 'twenty characters ok', { delay: 30 } ),
            [ 'parses' ]
        );

        await measure( 'edit-leave', () =>
            page.getByRole( 'button', { name: 'Back to the board' } ).click()
        );

        await measure(
            'style-change',
            () => changeBackground( page, '#445566' ),
            [ 'styleGenerations' ]
        );
    } );
} );
