import {
    resetFixture,
    enterEdit,
    editorFrame,
    artboardOf,
    counters,
    viewportOf,
    visiblePoint,
} from '../e2e/utils';
import {
    changeBackground,
    drawn,
    expect,
    leaveEdit,
    openBoardAt,
    settle,
    test,
    viewOn,
} from './support';

// What the app's own counters say one of each action costs. The same on
// every run of the same code, so each is held to tests/perf/budgets.json and
// one run is enough. The counts for opening a board are in scale.spec.ts.
test.describe( 'Counts', { tag: '@once' }, () => {
    test( 'one of each action', async ( { page, requestUtils, record } ) => {
        const fixture = await resetFixture( requestUtils );
        const about = artboardOf( fixture, 'page' );
        const hero = artboardOf( fixture, 'pattern' );
        const view = viewOn( artboardOf( fixture, 'template-part' ), 0.4 );
        await openBoardAt( page, requestUtils, fixture.boardId, view );
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
            const before = await counters( page );
            await action();
            await settle( page );
            const after = await counters( page );
            record(
                `${ name }.renders`,
                after.renders - before.renders,
                'count'
            );
            for ( const counter of also ) {
                record(
                    `${ name }.${
                        counter === 'parses' ? 'parses' : 'style-generations'
                    }`,
                    after[ counter ] - before[ counter ],
                    'count'
                );
            }
        };

        await measure( 'select', async () => {
            const point = ( await visiblePoint( page, about.id ) )!;
            await page.mouse.click( point.x, point.y );
        } );

        await measure( 'move', async () => {
            const point = ( await visiblePoint( page, about.id ) )!;
            // The layout saves itself two seconds after the move.
            const saved = page.waitForRequest(
                ( request ) =>
                    request.method() === 'POST' &&
                    request.url().includes( 'wfd-boards' )
            );
            await page.mouse.move( point.x, point.y );
            await page.mouse.down();
            await page.mouse.move( point.x + 60, point.y + 40, { steps: 10 } );
            await page.mouse.up();
            await saved;
        } );

        await measure( 'edit-enter', () => enterEdit( page, hero.id ) );
        // The board did not zoom to start the edit, which would have changed
        // the tier of the other artboards and been counted with it.
        expect( ( await viewportOf( page ) ).zoom ).toBe( view.zoom );

        const heading = editorFrame( page, hero.id ).locator( 'h2' );
        await heading.click();
        await measure(
            'type',
            () => page.keyboard.type( 'twenty characters ok', { delay: 30 } ),
            [ 'parses' ]
        );

        await measure( 'edit-leave', () => leaveEdit( page ) );

        await measure(
            'style-change',
            () => changeBackground( page, '#445566' ),
            [ 'styleGenerations' ]
        );
    } );
} );
