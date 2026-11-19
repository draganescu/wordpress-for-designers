import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import {
    resetFixture,
    boardUrl,
    enterEdit,
    artboardOf,
    type Fixture,
} from './utils';

test.describe( 'SHELL', () => {
    let fixture: Fixture;
    test.beforeEach( async ( { page, requestUtils } ) => {
        fixture = await resetFixture( requestUtils );
        await page.goto( boardUrl( fixture.boardId ) );
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 9 );
    } );

    test( 'AC-SHELL-01 With nothing selected the left panel lists artboards by kind and the right panel shows Styles on Tokens', async ( {
        page,
    } ) => {
        const left = page.locator( '[data-wfd-region="left"]' );
        await expect(
            left.getByRole( 'heading', { name: 'Artboards' } )
        ).toBeVisible();
        const groups = left.locator( '[data-wfd-group]' );
        await expect( groups ).toHaveCount( 4 );
        const expected = [
            [ 'Pages', '2', [ 'About', 'Become a member' ] ],
            [ 'Templates', '2', null ],
            [ 'Template parts', '3', [ 'Footer', 'Header', 'Header' ] ],
            [ 'Patterns', '2', [ 'Hero', 'Sign-off' ] ],
        ] as const;
        for ( const [
            index,
            [ heading, count, names ],
        ] of expected.entries() ) {
            const group = groups.nth( index );
            await expect( group.getByRole( 'heading' ) ).toHaveText( heading );
            await expect(
                group.locator( '.wfd-group-heading__suffix' )
            ).toHaveText( count );
            await expect( group.locator( '[data-wfd-row]' ) ).toHaveCount(
                Number( count )
            );
            if ( names ) {
                await expect( group.locator( '.wfd-row__name' ) ).toHaveText( [
                    ...names,
                ] );
            }
        }
        // Header on Desktop sorts before Header on Mobile.
        await expect(
            groups.nth( 2 ).locator( '.wfd-row__suffix' )
        ).toHaveText( [ 'Desktop', 'Desktop', 'Mobile' ] );

        const right = page.locator( '[data-wfd-region="right"]' );
        await expect(
            right.getByRole( 'heading', { name: 'Styles' } )
        ).toBeVisible();
        await expect(
            right.getByRole( 'tab', { name: 'Tokens' } )
        ).toHaveAttribute( 'aria-selected', 'true' );
        await expect( right.getByRole( 'tab' ) ).toHaveText( [
            'Tokens',
            'Blocks',
            'History',
        ] );
    } );

    test( 'AC-SHELL-02 Header controls are in the order H1 to H5, H10, H6, H7, H8, H11, H9, H5 disabled and H6 absent when nothing is in edit', async ( {
        page,
    } ) => {
        const controls = page.locator(
            '[data-wfd-region="header"] [data-wfd-control]'
        );
        const order = await controls.evaluateAll( ( elements ) =>
            elements
                .map( ( element ) => ( {
                    id: element.getAttribute( 'data-wfd-control' ),
                    left: element.getBoundingClientRect().left,
                } ) )
                .sort( ( a, b ) => a.left - b.left )
                .map( ( item ) => item.id )
        );
        expect( order ).toEqual( [
            'H1',
            'H2',
            'H3',
            'H4',
            'H5',
            'H10',
            'H7',
            'H8',
            'H11',
            'H9',
        ] );
        await expect( page.locator( '[data-wfd-control="H6"]' ) ).toHaveCount(
            0
        );
        const header = page.locator( '[data-wfd-region="header"]' );
        await expect(
            header.getByRole( 'link', { name: 'All boards' } )
        ).toBeVisible();
        await expect(
            header.getByRole( 'button', { name: 'Block inserter' } )
        ).toBeEnabled();
        await expect(
            header.getByRole( 'button', { name: 'List view' } )
        ).toBeDisabled();
        await expect(
            header.getByRole( 'button', { name: 'Zoom' } )
        ).toBeVisible();
        await expect( page.locator( '[data-wfd-control="H7"]' ) ).toHaveText(
            'Fixture board'
        );
        const review = header.getByRole( 'button', {
            name: 'Review changes',
        } );
        await expect( review ).toBeDisabled();
    } );

    test( 'AC-SHELL-03 Selecting an artboard highlights its row and shows artboard settings, not Styles', async ( {
        page,
    } ) => {
        const frame = page.locator(
            '[data-wfd-artboard][data-wfd-kind="pattern"] .wfd-artboard__frame'
        );
        await frame.first().click();
        const id = await page
            .locator( '[data-wfd-artboard][data-wfd-kind="pattern"]' )
            .first()
            .getAttribute( 'data-wfd-artboard' );
        const row = page.locator( `[data-wfd-row="${ id }"]` );
        await expect( row ).toHaveAttribute( 'aria-current', 'true' );
        await expect(
            page.locator( '[data-wfd-row][aria-current]' )
        ).toHaveCount( 1 );

        const right = page.locator( '[data-wfd-region="right"]' );
        await expect(
            right.locator( '[data-wfd-panel="settings"]' )
        ).toBeVisible();
        await expect(
            right.getByRole( 'button', { name: 'Edit', exact: true } )
        ).toBeVisible();
        await expect(
            right.getByRole( 'button', { name: 'Remove from board' } )
        ).toBeVisible();
        await expect(
            right.getByText(
                'Enter or double-click edits. Delete removes it from the board.'
            )
        ).toBeVisible();
        await expect(
            right.getByRole( 'heading', { name: 'Styles' } )
        ).toHaveCount( 0 );
        await expect(
            right.getByRole( 'tab', { name: 'Tokens' } )
        ).toHaveCount( 0 );
    } );

    test( 'AC-SHELL-04 The inserter toggle replaces the left panel in every state and restores it when turned off', async ( {
        page,
    } ) => {
        const header = page.locator( '[data-wfd-region="header"]' );
        const left = page.locator( '[data-wfd-region="left"]' );
        const artboards = left.locator( '[data-wfd-panel="artboards"]' );
        const inserter = left.locator( '.wfd-inserter' );

        const toggleOnOff = async () => {
            await header
                .getByRole( 'button', { name: 'Block inserter' } )
                .click();
            await expect( inserter ).toBeVisible();
            // The Blocks tab is there only while an artboard is in edit.
            const isEditing =
                ( await page.locator( '[data-wfd-tier="live"]' ).count() ) > 0;
            await expect( inserter.getByRole( 'tab' ) ).toHaveText(
                isEditing
                    ? [ 'Blocks', 'Patterns', 'Templates', 'Media' ]
                    : [ 'Patterns', 'Templates', 'Media' ]
            );
            await expect( artboards ).toHaveCount( 0 );
            await header
                .getByRole( 'button', { name: 'Close block inserter' } )
                .click();
            await expect( inserter ).toHaveCount( 0 );
        };

        // Nothing selected.
        await toggleOnOff();
        await expect( artboards ).toBeVisible();

        // An artboard selected: the right panel is unchanged by the toggle.
        await page
            .locator( '[data-wfd-artboard] .wfd-artboard__frame' )
            .first()
            .click();
        await header.getByRole( 'button', { name: 'Block inserter' } ).click();
        await expect( inserter ).toBeVisible();
        await expect(
            page.locator( '[data-wfd-panel="settings"]' )
        ).toBeVisible();
        await header
            .getByRole( 'button', { name: 'Close block inserter' } )
            .click();
        await expect( artboards ).toBeVisible();
        await expect(
            left.locator( '[data-wfd-row][aria-current="true"]' )
        ).toHaveCount( 1 );

        // An artboard in edit: the inserter replaces the list view, and
        // turning it off brings the list view back. The right panel stays.
        const part = artboardOf( fixture, 'template-part' );
        await enterEdit( page, part.id );
        const listView = left.locator( '[data-wfd-panel="list-view"]' );
        await expect( listView ).toBeVisible();
        await clickHeader( 'Block inserter' );
        await expect( inserter ).toBeVisible();
        await expect( listView ).toHaveCount( 0 );
        await expect(
            page.locator( '[data-wfd-panel="editing"]' )
        ).toBeVisible();
        await clickHeader( 'Close block inserter' );
        await expect( inserter ).toHaveCount( 0 );
        await expect( listView ).toBeVisible();

        // With the list view off, the left panel is closed; the inserter
        // still opens and closing it leaves the panel closed again.
        await clickHeader( 'List view' );
        await expect( left ).toHaveCount( 0 );
        await clickHeader( 'Block inserter' );
        await expect( inserter ).toBeVisible();
        await clickHeader( 'Close block inserter' );
        await expect( left ).toHaveCount( 0 );

        async function clickHeader( name: string ) {
            await page
                .locator( '[data-wfd-region="header"]' )
                .getByRole( 'button', { name, exact: true } )
                .click();
        }
    } );

    test( 'AC-SHELL-05 The left and right panel toggles each hide and show their panel, their labels and pressed state follow, and the canvas area takes the freed room', async ( {
        page,
    } ) => {
        const header = page.locator( '[data-wfd-region="header"]' );
        const left = page.locator( '[data-wfd-region="left"]' );
        const right = page.locator( '[data-wfd-region="right"]' );
        const canvas = page.locator( '[data-wfd-region="canvas"]' );
        const leftToggle = page.locator( '[data-wfd-control="H10"]' );
        const rightToggle = page.locator( '[data-wfd-control="H11"]' );
        const widthOf = async () => ( await canvas.boundingBox() )!.width;
        const full = page.viewportSize()!.width;

        await expect( leftToggle ).toHaveAccessibleName( 'Hide left panel' );
        await expect( leftToggle ).toHaveAttribute( 'aria-pressed', 'true' );
        await expect( rightToggle ).toHaveAccessibleName( 'Hide right panel' );
        await expect( rightToggle ).toHaveAttribute( 'aria-pressed', 'true' );
        expect( await widthOf() ).toBe( full - 280 - 360 );

        // Left.
        await leftToggle.click();
        await expect( left ).toHaveCount( 0 );
        await expect( right ).toBeVisible();
        await expect( leftToggle ).toHaveAccessibleName( 'Show left panel' );
        await expect( leftToggle ).toHaveAttribute( 'aria-pressed', 'false' );
        await expect.poll( widthOf ).toBe( full - 360 );
        expect( ( await canvas.boundingBox() )!.x ).toBe( 0 );

        // Right.
        await rightToggle.click();
        await expect( right ).toHaveCount( 0 );
        await expect( rightToggle ).toHaveAccessibleName( 'Show right panel' );
        await expect( rightToggle ).toHaveAttribute( 'aria-pressed', 'false' );
        await expect.poll( widthOf ).toBe( full );
        // The header stays, with every control.
        await expect( header ).toBeVisible();
        await expect( page.locator( '[data-wfd-control="H9"]' ) ).toBeVisible();
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 9 );

        // And back, one at a time.
        await header.getByRole( 'button', { name: 'Show left panel' } ).click();
        await expect(
            left.getByRole( 'heading', { name: 'Artboards' } )
        ).toBeVisible();
        await expect( right ).toHaveCount( 0 );
        await expect.poll( widthOf ).toBe( full - 280 );
        await header
            .getByRole( 'button', { name: 'Show right panel' } )
            .click();
        await expect(
            right.getByRole( 'heading', { name: 'Styles', exact: true } )
        ).toBeVisible();
        await expect.poll( widthOf ).toBe( full - 280 - 360 );
        await expect( leftToggle ).toHaveAccessibleName( 'Hide left panel' );
        await expect( rightToggle ).toHaveAccessibleName( 'Hide right panel' );
    } );

    test( 'AC-SHELL-06 Cmd/Ctrl + \\ hides both panels when either is shown and shows both when neither is, on the board and while an artboard is in edit', async ( {
        page,
    } ) => {
        const left = page.locator( '[data-wfd-region="left"]' );
        const right = page.locator( '[data-wfd-region="right"]' );
        const canvas = page.locator( '[data-wfd-region="canvas"]' );
        const shortcut = () => page.keyboard.press( 'ControlOrMeta+Backslash' );

        // On the board.
        await canvas.focus();
        await shortcut();
        await expect( left ).toHaveCount( 0 );
        await expect( right ).toHaveCount( 0 );
        await expect(
            page.locator( '[data-wfd-region="header"]' )
        ).toBeVisible();
        await shortcut();
        await expect( left ).toBeVisible();
        await expect( right ).toBeVisible();

        // With only one shown, the shortcut hides it; the next press shows both.
        await page.locator( '[data-wfd-control="H10"]' ).click();
        await expect( left ).toHaveCount( 0 );
        await shortcut();
        await expect( left ).toHaveCount( 0 );
        await expect( right ).toHaveCount( 0 );
        await shortcut();
        await expect( left ).toBeVisible();
        await expect( right ).toBeVisible();

        // While an artboard is in edit, with the caret in a block.
        const hero = artboardOf( fixture, 'pattern' );
        await enterEdit( page, hero.id );
        const paragraph = page
            .frameLocator(
                `[data-wfd-artboard="${ hero.id }"] iframe[name="editor-canvas"]`
            )
            .locator( 'p', { hasText: 'Hero paragraph.' } );
        await paragraph.click();
        await expect(
            left.locator( '[data-wfd-panel="list-view"]' )
        ).toBeVisible();
        await shortcut();
        await expect( left ).toHaveCount( 0 );
        await expect( right ).toHaveCount( 0 );
        // Still in edit, and nothing was typed.
        await expect(
            page.locator( `[data-wfd-artboard="${ hero.id }"]` )
        ).toHaveAttribute( 'data-wfd-tier', 'live' );
        await expect( paragraph ).toHaveText( 'Hero paragraph.' );
        await shortcut();
        await expect(
            left.locator( '[data-wfd-panel="list-view"]' )
        ).toBeVisible();
        await expect(
            right.locator( '[data-wfd-panel="editing"]' )
        ).toBeVisible();
    } );

    test( 'AC-SHELL-07 Turning the inserter or list view toggle on shows a hidden left panel; a hidden right panel stays hidden through selection and edit; after a reload both panels are shown', async ( {
        page,
    } ) => {
        const header = page.locator( '[data-wfd-region="header"]' );
        const left = page.locator( '[data-wfd-region="left"]' );
        const right = page.locator( '[data-wfd-region="right"]' );
        const leftToggle = page.locator( '[data-wfd-control="H10"]' );
        const click = ( name: string ) =>
            header.getByRole( 'button', { name, exact: true } ).click();

        // The inserter toggle shows a hidden left panel.
        await leftToggle.click();
        await expect( left ).toHaveCount( 0 );
        await click( 'Block inserter' );
        await expect( left.locator( '.wfd-inserter' ) ).toBeVisible();
        await expect( leftToggle ).toHaveAccessibleName( 'Hide left panel' );
        await click( 'Close block inserter' );
        await expect(
            left.getByRole( 'heading', { name: 'Artboards' } )
        ).toBeVisible();

        // A hidden right panel stays hidden through selection and edit.
        await page.locator( '[data-wfd-control="H11"]' ).click();
        await expect( right ).toHaveCount( 0 );
        const hero = artboardOf( fixture, 'pattern' );
        await page.locator( `[data-wfd-row="${ hero.id }"]` ).click();
        await expect( right ).toHaveCount( 0 );
        await enterEdit( page, hero.id );
        await expect( right ).toHaveCount( 0 );

        // In edit: hiding the left panel, then the list view toggle shows it.
        await expect(
            left.locator( '[data-wfd-panel="list-view"]' )
        ).toBeVisible();
        await leftToggle.click();
        await expect( left ).toHaveCount( 0 );
        await click( 'List view' );
        await expect( left ).toHaveCount( 0 );
        await expect( leftToggle ).toHaveAccessibleName( 'Show left panel' );
        await click( 'List view' );
        await expect(
            left.locator( '[data-wfd-panel="list-view"]' )
        ).toBeVisible();
        // With the list view off the panel is not shown, and the left toggle
        // turns the list view on.
        await click( 'List view' );
        await expect( left ).toHaveCount( 0 );
        await expect( leftToggle ).toHaveAccessibleName( 'Show left panel' );
        await leftToggle.click();
        await expect(
            left.locator( '[data-wfd-panel="list-view"]' )
        ).toBeVisible();
        await expect(
            header.getByRole( 'button', { name: 'List view', exact: true } )
        ).toHaveAttribute( 'aria-pressed', 'true' );

        // Leaving edit keeps the right panel hidden.
        await click( 'Back to the board' );
        await expect( right ).toHaveCount( 0 );

        // Nothing is stored: a reload shows both.
        await leftToggle.click();
        await expect( left ).toHaveCount( 0 );
        await page.reload();
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 9 );
        await expect( left ).toBeVisible();
        await expect( right ).toBeVisible();
    } );
} );
