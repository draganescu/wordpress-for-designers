import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import {
    resetFixture,
    openBoard,
    setViewport,
    contentWidth,
    enterEdit,
    type Fixture,
} from './utils';

const byKind = ( fixture: Fixture, kind: string, device = 'desktop' ) =>
    fixture.layout.artboards.find(
        ( a ) => a.kind === kind && a.device === device
    )!;

test.describe( 'DEV', () => {
    test.afterAll( async ( { requestUtils } ) => {
        await requestUtils.activateTheme( 'twentytwentyfive' );
    } );

    test( 'AC-DEV-01 Desktop renders at 1440, Tablet at 780 and Mobile at 360 on default breakpoints', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        const desktop = byKind( fixture, 'template-part', 'desktop' );
        const mobile = byKind( fixture, 'template-part', 'mobile' );
        const tablet = byKind( fixture, 'pattern' );
        await setViewport( page, { x: -400, y: 40, zoom: 0.3 } );

        // Make the Hero pattern a Tablet artboard from the right panel.
        await page
            .locator(
                `[data-wfd-artboard="${ tablet.id }"] .wfd-artboard__frame`
            )
            .click();
        await page
            .locator( '[data-wfd-panel="settings"]' )
            .getByRole( 'radio', { name: 'Tablet' } )
            .click();
        await expect(
            page.locator( `[data-wfd-artboard="${ tablet.id }"]` )
        ).toHaveAttribute( 'data-wfd-device', 'tablet' );

        await expect
            .poll( () => contentWidth( page, desktop.id ) )
            .toBe( 1440 );
        await expect.poll( () => contentWidth( page, tablet.id ) ).toBe( 780 );
        await expect.poll( () => contentWidth( page, mobile.id ) ).toBe( 360 );
    } );

    test( 'AC-DEV-02 With tablet 900px and mobile 320px breakpoints, Tablet renders at 898 and Mobile at 320', async ( {
        page,
        requestUtils,
    } ) => {
        await requestUtils.activateTheme( 'wfd-viewport' );
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        const mobile = byKind( fixture, 'template-part', 'mobile' );
        const tablet = byKind( fixture, 'pattern' );
        await setViewport( page, { x: -400, y: 40, zoom: 0.3 } );
        await page
            .locator(
                `[data-wfd-artboard="${ tablet.id }"] .wfd-artboard__frame`
            )
            .click();
        await page
            .locator( '[data-wfd-panel="settings"]' )
            .getByRole( 'radio', { name: 'Tablet' } )
            .click();
        await expect.poll( () => contentWidth( page, tablet.id ) ).toBe( 898 );
        await expect.poll( () => contentWidth( page, mobile.id ) ).toBe( 320 );
        await requestUtils.activateTheme( 'twentytwentyfive' );
    } );

    test( 'AC-DEV-03 Changing device from the Live label menu or the right panel re-renders at the new width and is undoable as a layout change', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        const hero = byKind( fixture, 'pattern' );
        const artboard = page.locator( `[data-wfd-artboard="${ hero.id }"]` );
        const undo = page.locator( '[data-wfd-control="H3"]' );

        // From the right panel, with the artboard selected.
        await setViewport( page, { x: -400, y: -300, zoom: 0.3 } );
        await artboard.locator( '.wfd-artboard__frame' ).click();
        await expect.poll( () => contentWidth( page, hero.id ) ).toBe( 1440 );
        await page
            .locator( '[data-wfd-panel="settings"]' )
            .getByRole( 'radio', { name: 'Tablet' } )
            .click();
        await expect( artboard ).toHaveAttribute( 'data-wfd-device', 'tablet' );
        await expect.poll( () => contentWidth( page, hero.id ) ).toBe( 780 );
        await expect( artboard ).toHaveCSS( 'width', '780px' );
        await expect( undo ).toHaveAccessibleName(
            'Undo change device, on the board'
        );
        await undo.click();
        await expect( artboard ).toHaveAttribute(
            'data-wfd-device',
            'desktop'
        );
        await expect.poll( () => contentWidth( page, hero.id ) ).toBe( 1440 );

        // From the Live label menu.
        await enterEdit( page, hero.id );
        await artboard
            .getByRole( 'button', { name: 'Artboard device' } )
            .click();
        await page.getByRole( 'menuitemradio', { name: 'Mobile' } ).click();
        await expect( artboard ).toHaveAttribute( 'data-wfd-device', 'mobile' );
        await expect( artboard ).toHaveAttribute( 'data-wfd-tier', 'live' );
        await expect.poll( () => contentWidth( page, hero.id ) ).toBe( 360 );
        // And from the right panel while editing.
        const right = page.locator( '[data-wfd-region="right"]' );
        await right.getByRole( 'tab', { name: 'Pattern' } ).click();
        await right.getByRole( 'radio', { name: 'Tablet' } ).click();
        await expect.poll( () => contentWidth( page, hero.id ) ).toBe( 780 );
        // Undoable as a layout change once back on the board.
        await page.getByRole( 'button', { name: 'Back to the board' } ).click();
        await expect( undo ).toHaveAccessibleName(
            'Undo change device, on the board'
        );
        await undo.click();
        await expect( artboard ).toHaveAttribute( 'data-wfd-device', 'mobile' );
        await undo.click();
        await expect( artboard ).toHaveAttribute(
            'data-wfd-device',
            'desktop'
        );
    } );

    test( 'AC-DEV-04 No control offers any width other than the three devices', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        const hero = byKind( fixture, 'pattern' );
        await page
            .locator(
                `[data-wfd-artboard="${ hero.id }"] .wfd-artboard__frame`
            )
            .click();
        const panel = page.locator( '[data-wfd-panel="settings"]' );
        await expect( panel.getByRole( 'radio' ) ).toHaveText( [
            'Desktop',
            'Tablet',
            'Mobile',
        ] );
        // No free width input, range or resize handle anywhere in the app.
        await expect(
            page.locator(
                'input[type="number"], input[type="range"], [class*="resiz"]'
            )
        ).toHaveCount( 0 );
        // The frame's width is always one of the three device widths.
        for ( const device of [ 'Tablet', 'Mobile', 'Desktop' ] ) {
            await panel.getByRole( 'radio', { name: device } ).click();
            const width = await page
                .locator( `[data-wfd-artboard="${ hero.id }"]` )
                .evaluate( ( el: HTMLElement ) =>
                    parseFloat( el.style.width )
                );
            expect( [ 1440, 780, 360 ] ).toContain( width );
        }
    } );
} );
