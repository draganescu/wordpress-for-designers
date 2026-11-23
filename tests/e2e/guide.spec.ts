import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import {
    resetFixture,
    openBoard,
    boardAtRest,
    loginAs,
    viewportOf,
    enterEdit,
    editorFrame,
    artboardOf,
    saveBoardLayout,
    savedBoardLayout,
    setViewChoices,
    viewChecked,
    chooseView,
    rulerOf,
    guidesOn,
    putCornerAt,
    pullGuide,
    guidePoint,
    type Artboard,
    type Fixture,
    type Guide,
    type Point,
} from './utils';
import { wfd, php, listening } from './agent-utils';

const GUIDE_A = '11111111-2222-4333-8444-777777777777';
const GUIDE_B = '11111111-2222-4333-8444-888888888888';
const GUIDE_C = '11111111-2222-4333-8444-999999999999';
const SAMPLE = path.join( __dirname, 'assets', 'wfd-sample.png' );

test.describe( 'GUIDE', () => {
    let fixture: Fixture;
    let about: Artboard;
    // A horizontal guide of About, a vertical board guide that crosses About
    // 1000 units from its left edge, and a vertical guide of About. Artboards
    // are measured much shorter than the fixture's heights, so the positions
    // counted from About's top are small.
    let ofAbout: Guide;
    let ofBoard: Guide;
    let alsoOfAbout: Guide;
    test.beforeEach( async ( { requestUtils } ) => {
        fixture = await resetFixture( requestUtils );
        about = artboardOf( fixture, 'page' );
        ofAbout = {
            id: GUIDE_A,
            axis: 'y',
            at: 40,
            artboard: about.id,
            device: 'desktop',
        };
        ofBoard = { id: GUIDE_B, axis: 'x', at: about.x + 1000 };
        alsoOfAbout = {
            id: GUIDE_C,
            axis: 'x',
            at: 96,
            artboard: about.id,
            device: 'desktop',
        };
    } );

    const seed = ( requestUtils: any, guides: unknown[] ) =>
        saveBoardLayout( requestUtils, fixture.boardId, {
            version: 1,
            artboards: fixture.layout.artboards,
            guides,
        } );

    // About at 50%, its corner 60 by 150 pixels into the canvas area: one
    // pixel is two units. Above it, up to the Footer part, the board is
    // empty.
    const ZOOM = 0.5;
    const showAbout = async ( page: Page ) => {
        await putCornerAt( page, about, ZOOM, { x: 60, y: 150 } );
        await boardAtRest( page );
    };
    // A point of empty board, above About and right of its label.
    const emptyPoint = async ( page: Page ): Promise< Point > => {
        const area = await areaBox( page );
        return { x: area.x + 500, y: area.y + 90 };
    };

    // Opens the fixture board with the stored choices of D109 given.
    const open = async (
        page: Page,
        choices: { rulers?: boolean; guides?: boolean } = {}
    ) => {
        await setViewChoices( page, fixture.boardId, {
            rulers: choices.rulers ?? true,
            guides: choices.guides ?? true,
        } );
        await openBoard( page, fixture.boardId );
        await showAbout( page );
    };

    const areaBox = async ( page: Page ) =>
        ( await page.locator( '[data-wfd-region="canvas"]' ).boundingBox() )!;
    const artboard = ( page: Page, id: string ) =>
        page.locator( `[data-wfd-artboard="${ id }"]` );
    const frameBoxOf = async ( page: Page, id: string ) =>
        ( await artboard( page, id )
            .locator( '.wfd-artboard__frame' )
            .boundingBox() )!;
    const guides = ( page: Page ) => page.locator( '[data-wfd-guide]' );
    const guide = ( page: Page, id: string ) =>
        page.locator( `[data-wfd-guide="${ id }"]` );
    const boxOf = async ( page: Page, id: string ) =>
        ( await guide( page, id ).boundingBox() )!;
    const selectedGuides = ( page: Page ) =>
        page.locator( '[data-wfd-guide][data-wfd-selected="true"]' );
    const card = ( page: Page ) =>
        page.locator( '[data-wfd-region="right"] [data-wfd-panel="guide"]' );
    const undo = ( page: Page ) => page.locator( '[data-wfd-control="H3"]' );
    const focusBoard = ( page: Page ) =>
        page.locator( '[data-wfd-region="canvas"]' ).focus();

    // A point on About's frame, in its lower right: clear of the guides
    // these tests put on it.
    const onAbout = async ( page: Page ): Promise< Point > => {
        const box = await frameBoxOf( page, about.id );
        return {
            x: box.x + box.width * 0.75,
            y: box.y + Math.min( box.height * 0.75, 200 ),
        };
    };
    // Where these tests drop a horizontal guide on About: half way down it.
    const dropPoint = async ( page: Page ): Promise< Point > => {
        const box = await frameBoxOf( page, about.id );
        return {
            x: box.x + box.width / 2,
            y: box.y + Math.min( box.height / 2, 150 ),
        };
    };
    const selectAbout = async ( page: Page ) => {
        const point = await onAbout( page );
        await page.mouse.click( point.x, point.y );
        await expect( artboard( page, about.id ) ).toHaveClass( /is-selected/ );
    };
    // A click on a guide's line.
    const select = async ( page: Page, id: string ) => {
        const point = await guidePoint( page, id );
        await page.mouse.click( point.x, point.y );
        await expect( guide( page, id ) ).toHaveAttribute(
            'data-wfd-selected',
            'true'
        );
    };
    const drag = async ( page: Page, from: Point, to: Point ) => {
        await page.mouse.move( from.x, from.y );
        await page.mouse.down();
        await page.mouse.move( from.x + 5, from.y + 5, { steps: 2 } );
        await page.mouse.move( to.x, to.y, { steps: 6 } );
        await page.mouse.up();
    };
    const atOf = async ( page: Page, id: string ) =>
        Number( await guide( page, id ).getAttribute( 'data-wfd-at' ) );
    // A position that came from the pointer: a pixel is several units.
    const expectAtNear = ( page: Page, id: string, at: number, within = 3 ) =>
        expect
            .poll( async () => Math.abs( ( await atOf( page, id ) ) - at ) )
            .toBeLessThanOrEqual( within );
    const expectNoDialog = async ( page: Page ) => {
        await expect( page.getByRole( 'alertdialog' ) ).toHaveCount( 0 );
        await expect( page.getByRole( 'dialog' ) ).toHaveCount( 0 );
    };

    test( "AC-GUIDE-01 Pressing on the top ruler and releasing over an artboard adds a horizontal guide that belongs to that artboard: it is drawn across that artboard only, its position is a whole number counted from the artboard's top, it holds the artboard's device, and it is selected. Undo's tooltip reads \"Undo add guide, on the board\" and Undo takes it away", async ( {
        page,
    } ) => {
        await open( page );
        await expect( guides( page ) ).toHaveCount( 0 );
        const frame = await frameBoxOf( page, about.id );
        const to = await dropPoint( page );
        await pullGuide( page, 'top', to );

        await expect( guides( page ) ).toHaveCount( 1 );
        const [ added ] = await guidesOn( page );
        expect( added.axis ).toBe( 'y' );
        expect( added.owner ).toBe( about.id );
        expect( added.device ).toBe( 'desktop' );
        expect( added.selected ).toBe( true );
        expect( added.id ).toMatch( /^[0-9a-f-]{36}$/ );
        // A whole number, counted from the artboard's top.
        expect( added.at ).toMatch( /^\d+$/ );
        expect(
            Math.abs( Number( added.at ) - ( to.y - frame.y ) / ZOOM )
        ).toBeLessThanOrEqual( 3 );
        // Drawn across About only, where it was released.
        const line = await boxOf( page, added.id );
        expect( Math.abs( line.x - frame.x ) ).toBeLessThanOrEqual( 2 );
        expect( Math.abs( line.width - frame.width ) ).toBeLessThanOrEqual( 3 );
        expect(
            Math.abs( line.y + line.height / 2 - to.y )
        ).toBeLessThanOrEqual( 3 );
        // It is selected alone, with its card.
        await expect( page.locator( '.wfd-artboard.is-selected' ) ).toHaveCount(
            0
        );
        await expect( card( page ) ).toBeVisible();

        await expect( undo( page ) ).toHaveAccessibleName(
            'Undo add guide, on the board'
        );
        await undo( page ).click();
        await expect( guides( page ) ).toHaveCount( 0 );
    } );

    test( 'AC-GUIDE-02 Pressing on the left ruler and releasing over empty board adds a vertical board guide that runs from edge to edge of the canvas area, with no owner and no device. Releasing over a ruler adds nothing', async ( {
        page,
    } ) => {
        await open( page );
        const area = await areaBox( page );
        const to = await emptyPoint( page );
        await pullGuide( page, 'left', to );

        await expect( guides( page ) ).toHaveCount( 1 );
        const [ added ] = await guidesOn( page );
        expect( added.axis ).toBe( 'x' );
        expect( added.owner ).toBeNull();
        expect( added.device ).toBeNull();
        expect( added.at ).toMatch( /^-?\d+$/ );
        // Counted from the board's origin.
        const view = await viewportOf( page );
        expect(
            Math.abs(
                Number( added.at ) - ( to.x - area.x - view.x ) / view.zoom
            )
        ).toBeLessThanOrEqual( 3 );
        // From edge to edge of the canvas area, under the pointer.
        const line = await boxOf( page, added.id );
        expect( line.y ).toBeLessThanOrEqual( area.y + 1 );
        expect( line.y + line.height ).toBeGreaterThanOrEqual(
            area.y + area.height - 1
        );
        expect(
            Math.abs( line.x + line.width / 2 - to.x )
        ).toBeLessThanOrEqual( 3 );

        // Out of the left ruler, into the canvas, and released over the top
        // ruler.
        const left = ( await page
            .locator( '[data-wfd-ruler="left"]' )
            .boundingBox() )!;
        const top = ( await page
            .locator( '[data-wfd-ruler="top"]' )
            .boundingBox() )!;
        await page.mouse.move( left.x + left.width / 2, area.y + 300 );
        await page.mouse.down();
        await page.mouse.move( area.x + 200, area.y + 300, { steps: 4 } );
        await page.mouse.move( area.x + 300, top.y + top.height / 2, {
            steps: 4,
        } );
        await page.mouse.up();
        await page.waitForTimeout( 200 );
        await expect( guides( page ) ).toHaveCount( 1 );

        // And released over the ruler it came from.
        await page.mouse.move( left.x + left.width / 2, area.y + 300 );
        await page.mouse.down();
        await page.mouse.move( area.x + 200, area.y + 300, { steps: 4 } );
        await page.mouse.move( left.x + left.width / 2, area.y + 400, {
            steps: 4,
        } );
        await page.mouse.up();
        await page.waitForTimeout( 200 );
        await expect( guides( page ) ).toHaveCount( 1 );
    } );

    test( "AC-GUIDE-03 While a guide is dragged, the chip beside the pointer shows its position, the rulers measure the artboard under the pointer, and nothing is added to the layout history until the button is released. Released 3 px beside an artboard's centre line, the guide is there and not on the centre: nothing snaps", async ( {
        page,
    } ) => {
        // About is at 50%: its centre line is 360 pixels from its left edge.
        await open( page );
        const area = await areaBox( page );
        const frame = await frameBoxOf( page, about.id );
        const undoBefore = await undo( page ).getAttribute( 'aria-label' );
        const chip = page.locator( '[data-wfd-guide-chip]' );
        await expect( chip ).toBeHidden();

        // 3 screen pixels right of the centre line: 726 of the page's pixels.
        const to = { x: frame.x + 363, y: ( await dropPoint( page ) ).y };
        await pullGuide( page, 'left', to, { hold: true } );

        // The button is still down.
        await expect( chip ).toBeVisible();
        await expect( chip ).toHaveText( /^\d+$/ );
        const shown = Number( await chip.innerText() );
        expect( Math.abs( shown - 726 ) ).toBeLessThanOrEqual( 2 );
        // The rulers measure About: zero at its corner, its extent shaded.
        await expect
            .poll( async () => ( await rulerOf( page, 'top' ) ).span )
            .toEqual( [ 0, 1440 ] );
        const top = await rulerOf( page, 'top' );
        const left = await rulerOf( page, 'left' );
        expect(
            Math.abs( top.zero - ( frame.x - area.x ) )
        ).toBeLessThanOrEqual( 1.5 );
        expect(
            Math.abs( left.zero - ( frame.y - area.y ) )
        ).toBeLessThanOrEqual( 1.5 );
        expect( left.span?.[ 0 ] ).toBe( 0 );
        // Nothing is in the layout or its history yet (C35).
        expect( await undo( page ).getAttribute( 'aria-label' ) ).toBe(
            undoBefore
        );
        expect(
            await page.evaluate(
                () =>
                    ( window as any ).wp.data.select( 'wfd/board' ).getGuides()
                        .length
            )
        ).toBe( 0 );

        await page.mouse.up();
        await expect( guides( page ) ).toHaveCount( 1 );
        await expect( chip ).toBeHidden();
        await expect( undo( page ) ).toHaveAccessibleName(
            'Undo add guide, on the board'
        );
        const [ added ] = await guidesOn( page );
        expect( added.axis ).toBe( 'x' );
        expect( added.owner ).toBe( about.id );
        // Where it was released, which is not the centre.
        expect( Number( added.at ) ).toBe( shown );
        expect( Number( added.at ) ).not.toBe( 720 );
        const line = await boxOf( page, added.id );
        expect(
            Math.abs( line.x + line.width / 2 - to.x )
        ).toBeLessThanOrEqual( 2 );
    } );

    test( 'AC-GUIDE-04 Moving an artboard moves its guides with it and leaves their positions as they were; the move is one step, named "move artboard", and Undo puts the artboard and its guides back. Board guides stay where they are', async ( {
        page,
        requestUtils,
    } ) => {
        expect(
            await seed( requestUtils, [ ofAbout, ofBoard, alsoOfAbout ] )
        ).toBe( 200 );
        await open( page );
        await expect( guides( page ) ).toHaveCount( 3 );
        const undoBefore = await undo( page ).getAttribute( 'aria-label' );
        const before = {
            frame: await frameBoxOf( page, about.id ),
            a: await boxOf( page, GUIDE_A ),
            b: await boxOf( page, GUIDE_B ),
            c: await boxOf( page, GUIDE_C ),
        };

        // About dragged by 50 and 30 pixels: 100 and 60 units at 50%.
        const from = await onAbout( page );
        await drag( page, from, { x: from.x + 50, y: from.y + 30 } );
        const frame = await frameBoxOf( page, about.id );
        expect( frame.x - before.frame.x ).toBeCloseTo( 50, 0 );
        expect( frame.y - before.frame.y ).toBeCloseTo( 30, 0 );
        for ( const [ id, was ] of [
            [ GUIDE_A, before.a ],
            [ GUIDE_C, before.c ],
        ] as const ) {
            const now = await boxOf( page, id );
            expect( now.x - was.x ).toBeCloseTo( 50, 0 );
            expect( now.y - was.y ).toBeCloseTo( 30, 0 );
        }
        // Their positions count from the artboard, and did not change.
        await expect( guide( page, GUIDE_A ) ).toHaveAttribute(
            'data-wfd-at',
            '40'
        );
        await expect( guide( page, GUIDE_C ) ).toHaveAttribute(
            'data-wfd-at',
            '96'
        );
        // The board guide stayed.
        const board = await boxOf( page, GUIDE_B );
        expect( board.x ).toBeCloseTo( before.b.x, 0 );
        await expect( guide( page, GUIDE_B ) ).toHaveAttribute(
            'data-wfd-at',
            String( about.x + 1000 )
        );

        // One step, named for the artboard.
        await expect( undo( page ) ).toHaveAccessibleName(
            'Undo move artboard, on the board'
        );
        await undo( page ).click();
        await expect( artboard( page, about.id ) ).toHaveCSS(
            'left',
            `${ about.x }px`
        );
        await expect( artboard( page, about.id ) ).toHaveCSS(
            'top',
            `${ about.y }px`
        );
        for ( const [ id, was ] of [
            [ GUIDE_A, before.a ],
            [ GUIDE_C, before.c ],
            [ GUIDE_B, before.b ],
        ] as const ) {
            const now = await boxOf( page, id );
            expect( now.x ).toBeCloseTo( was.x, 0 );
            expect( now.y ).toBeCloseTo( was.y, 0 );
        }
        expect( await undo( page ).getAttribute( 'aria-label' ) ).toBe(
            undoBefore
        );
    } );

    test( 'AC-GUIDE-05 A guide dropped on a Desktop artboard is not drawn after the artboard is switched to Mobile; a guide then dropped on Mobile is not drawn after switching back to Desktop, where the first guide is drawn again at its position; both are still there after a reload', async ( {
        page,
        requestUtils,
    } ) => {
        test.setTimeout( 90000 );
        await open( page );
        const setDevice = async ( name: 'Desktop' | 'Mobile' ) => {
            await selectAbout( page );
            await page
                .locator( '[data-wfd-panel="settings"]' )
                .getByRole( 'radio', { name } )
                .click();
            await expect( artboard( page, about.id ) ).toHaveAttribute(
                'data-wfd-device',
                name.toLowerCase()
            );
            await boardAtRest( page );
        };
        // Drops a horizontal guide on About.
        const drop = async () =>
            pullGuide( page, 'top', await dropPoint( page ) );

        // On Desktop.
        await drop();
        await expect( guides( page ) ).toHaveCount( 1 );
        const first = ( await guidesOn( page ) )[ 0 ];
        expect( first.device ).toBe( 'desktop' );
        expect( first.owner ).toBe( about.id );

        // On Mobile the Desktop guide is out of view.
        await setDevice( 'Mobile' );
        await expect( guides( page ) ).toHaveCount( 0 );
        await drop();
        await expect( guides( page ) ).toHaveCount( 1 );
        const second = ( await guidesOn( page ) )[ 0 ];
        expect( second.id ).not.toBe( first.id );
        expect( second.device ).toBe( 'mobile' );
        expect( second.owner ).toBe( about.id );

        // Back on Desktop: the first again, where it was.
        await setDevice( 'Desktop' );
        await expect( guides( page ) ).toHaveCount( 1 );
        await expect( guide( page, first.id ) ).toHaveAttribute(
            'data-wfd-at',
            first.at!
        );
        const frame = await frameBoxOf( page, about.id );
        const line = await boxOf( page, first.id );
        expect(
            Math.abs(
                line.y +
                    line.height / 2 -
                    ( frame.y + Number( first.at ) * ZOOM )
            )
        ).toBeLessThanOrEqual( 2 );

        // Both were saved, each with its device.
        await expect
            .poll(
                async () =>
                    (
                        await savedBoardLayout( requestUtils, fixture.boardId )
                    ).guides
                        ?.map( ( saved ) => `${ saved.id } ${ saved.device }` )
                        .sort(),
                { timeout: 10000 }
            )
            .toEqual(
                [ `${ first.id } desktop`, `${ second.id } mobile` ].sort()
            );

        // After a reload.
        await openBoard( page, fixture.boardId );
        await showAbout( page );
        await expect( guides( page ) ).toHaveCount( 1 );
        await expect( guide( page, first.id ) ).toHaveAttribute(
            'data-wfd-at',
            first.at!
        );
        await setDevice( 'Mobile' );
        await expect( guides( page ) ).toHaveCount( 1 );
        await expect( guide( page, second.id ) ).toHaveAttribute(
            'data-wfd-at',
            second.at!
        );
    } );

    test( 'AC-GUIDE-06 A click on a guide\'s line selects it alone: it is drawn in the brand colour, its position is marked with its number on its ruler, no artboard row is highlighted, and the right panel shows the Guide card with the heading "Guide", the description, the "Position" field with its help, "Remove guide" and the hint, as worded in GD4 for a horizontal guide of an artboard and for a vertical board guide', async ( {
        page,
        requestUtils,
    } ) => {
        expect( await seed( requestUtils, [ ofAbout, ofBoard ] ) ).toBe( 200 );
        await open( page );
        await expect( guides( page ) ).toHaveCount( 2 );
        // An artboard is selected first: the guide takes the selection.
        await selectAbout( page );
        await expect(
            page.locator( '[data-wfd-row][aria-current]' )
        ).toHaveCount( 1 );

        // The horizontal guide of About.
        await select( page, GUIDE_A );
        await expect( selectedGuides( page ) ).toHaveCount( 1 );
        await expect( page.locator( '.wfd-artboard.is-selected' ) ).toHaveCount(
            0
        );
        await expect(
            page.locator( '[data-wfd-row][aria-current]' )
        ).toHaveCount( 0 );
        // The rulers measure About, and mark the guide where it is read: a
        // horizontal guide on the left ruler. The board guide, 1000 units
        // right of About's left edge, is marked on the top ruler.
        await expect
            .poll( async () => ( await rulerOf( page, 'left' ) ).marks )
            .toEqual( [ 40 ] );
        expect( ( await rulerOf( page, 'top' ) ).marks ).toEqual( [ 1000 ] );
        expect( ( await rulerOf( page, 'top' ) ).span ).toEqual( [ 0, 1440 ] );

        const panel = card( page );
        await expect( panel ).toBeVisible();
        await expect( panel.getByRole( 'heading', { level: 2 } ) ).toHaveText(
            'Guide'
        );
        await expect(
            panel.getByText( 'Horizontal. On About.', { exact: true } )
        ).toBeVisible();
        const field = panel.getByLabel( 'Position', { exact: true } );
        await expect( field ).toHaveValue( '40' );
        await expect( panel ).toContainText( 'px' );
        await expect(
            panel.getByText( 'Measured from the top of About.', {
                exact: true,
            } )
        ).toBeVisible();
        await expect(
            panel.getByRole( 'button', { name: 'Remove guide', exact: true } )
        ).toBeVisible();
        await expect(
            panel.getByText( 'Drag moves it. Delete removes it.', {
                exact: true,
            } )
        ).toBeVisible();
        // The card takes the place of Styles.
        await expect(
            page
                .locator( '[data-wfd-region="right"]' )
                .getByRole( 'heading', { name: 'Styles' } )
        ).toHaveCount( 0 );

        // The vertical board guide.
        await select( page, GUIDE_B );
        await expect( selectedGuides( page ) ).toHaveCount( 1 );
        await expect( guide( page, GUIDE_A ) ).not.toHaveAttribute(
            'data-wfd-selected',
            'true'
        );
        await expect(
            page.locator( '[data-wfd-row][aria-current]' )
        ).toHaveCount( 0 );
        await expect( panel.getByRole( 'heading', { level: 2 } ) ).toHaveText(
            'Guide'
        );
        await expect(
            panel.getByText( 'Vertical. On the board.', { exact: true } )
        ).toBeVisible();
        await expect( field ).toHaveValue( String( about.x + 1000 ) );
        await expect(
            panel.getByText( 'Measured from the left of the board.', {
                exact: true,
            } )
        ).toBeVisible();
        await expect(
            panel.getByRole( 'button', { name: 'Remove guide', exact: true } )
        ).toBeVisible();
        await expect(
            panel.getByText( 'Drag moves it. Delete removes it.', {
                exact: true,
            } )
        ).toBeVisible();
        // A board guide selected counts as nothing selected: the rulers
        // count from the board's origin and mark the board guide only.
        await expect
            .poll( async () => ( await rulerOf( page, 'top' ) ).marks )
            .toEqual( [ about.x + 1000 ] );
        expect( ( await rulerOf( page, 'left' ) ).marks ).toEqual( [] );
        expect( ( await rulerOf( page, 'top' ) ).span ).toBeNull();
    } );

    test( 'AC-GUIDE-07 A selected guide moves along its axis when dragged, by 1 with an arrow key along its axis and by 10 with Shift, and to a position typed in the field and entered; each is a "move guide" step that Undo reverts. An artboard\'s guide stops at its artboard\'s edges, and a typed position outside the artboard is not kept', async ( {
        page,
        requestUtils,
    } ) => {
        expect( await seed( requestUtils, [ ofAbout ] ) ).toBe( 200 );
        await open( page );
        const line = guide( page, GUIDE_A );
        const expectAt = ( at: number ) =>
            expect( line ).toHaveAttribute( 'data-wfd-at', String( at ) );
        const expectMoveStep = () =>
            expect( undo( page ) ).toHaveAccessibleName(
                'Undo move guide, on the board'
            );
        const undoBefore = await undo( page ).getAttribute( 'aria-label' );
        const field = card( page ).getByLabel( 'Position', { exact: true } );

        await expectAt( 40 );

        // Dragged 10 pixels down: 20 of the page's pixels at 50%.
        await select( page, GUIDE_A );
        let from = await guidePoint( page, GUIDE_A );
        await drag( page, from, { x: from.x + 30, y: from.y + 10 } );
        await expectAtNear( page, GUIDE_A, 60 );
        // Along its axis only: it still runs across About.
        expect(
            Math.abs( ( await guidePoint( page, GUIDE_A ) ).x - from.x )
        ).toBeLessThanOrEqual( 1 );
        // The field follows it.
        await expect( field ).toHaveValue(
            String( await atOf( page, GUIDE_A ) )
        );
        await expectMoveStep();
        await undo( page ).click();
        await expectAt( 40 );
        expect( await undo( page ).getAttribute( 'aria-label' ) ).toBe(
            undoBefore
        );

        // Arrow keys along its axis: 1, and 10 with Shift.
        await select( page, GUIDE_A );
        await focusBoard( page );
        await page.keyboard.press( 'ArrowDown' );
        await expectAt( 41 );
        await expectMoveStep();
        await page.keyboard.press( 'Shift+ArrowDown' );
        await expectAt( 51 );
        await page.keyboard.press( 'ArrowUp' );
        await expectAt( 50 );
        await page.keyboard.press( 'Shift+ArrowUp' );
        await expectAt( 40 );
        // Each was a step.
        await undo( page ).click();
        await expectAt( 50 );
        await undo( page ).click();
        await expectAt( 51 );
        await undo( page ).click();
        await expectAt( 41 );
        await expectMoveStep();
        await undo( page ).click();
        await expectAt( 40 );
        expect( await undo( page ).getAttribute( 'aria-label' ) ).toBe(
            undoBefore
        );

        // A typed position, entered.
        await select( page, GUIDE_A );
        await expect( field ).toHaveValue( '40' );
        await field.fill( '5' );
        await field.press( 'Enter' );
        await expectAt( 5 );
        await expectMoveStep();
        await undo( page ).click();
        await expectAt( 40 );
        await select( page, GUIDE_A );
        await field.fill( '5' );
        await field.press( 'Enter' );
        await expectAt( 5 );

        // It stops at its artboard's top edge: nudged by 10 from 5.
        await select( page, GUIDE_A );
        await focusBoard( page );
        await page.keyboard.press( 'Shift+ArrowUp' );
        await expectAt( 0 );
        await undo( page ).click();
        await expectAt( 5 );
        await select( page, GUIDE_A );
        await focusBoard( page );
        await page.keyboard.press( 'Shift+ArrowUp' );
        await expectAt( 0 );
        await page.keyboard.press( 'ArrowUp' );
        await expectAt( 0 );
        // And dragged past it, from 40.
        await field.fill( '40' );
        await field.press( 'Enter' );
        await expectAt( 40 );
        await select( page, GUIDE_A );
        from = await guidePoint( page, GUIDE_A );
        const frame = await frameBoxOf( page, about.id );
        await drag( page, from, { x: from.x, y: frame.y - 60 } );
        await expectAt( 0 );
        await expectMoveStep();
        await undo( page ).click();
        await expectAt( 40 );

        // A typed position outside the artboard is not kept.
        await select( page, GUIDE_A );
        for ( const outside of [ '-5', '99999' ] ) {
            await field.fill( outside );
            await field.press( 'Enter' );
            await expectAt( 40 );
            await expect( field ).toHaveValue( '40' );
        }
    } );

    test( 'AC-GUIDE-08 Delete with a guide selected, and "Remove guide", each take the guide off the board with no dialog; Undo, whose tooltip reads "Undo remove guide, on the board", brings it back', async ( {
        page,
        requestUtils,
    } ) => {
        expect( await seed( requestUtils, [ ofAbout ] ) ).toBe( 200 );
        await open( page );
        const line = guide( page, GUIDE_A );
        const expectBack = async () => {
            await expect( undo( page ) ).toHaveAccessibleName(
                'Undo remove guide, on the board'
            );
            await undo( page ).click();
            await expect( line ).toHaveCount( 1 );
            await expect( line ).toHaveAttribute( 'data-wfd-at', '40' );
            await expect( line ).toHaveAttribute( 'data-wfd-owner', about.id );
        };

        // Delete and Backspace.
        for ( const key of [ 'Delete', 'Backspace' ] ) {
            await select( page, GUIDE_A );
            await focusBoard( page );
            await page.keyboard.press( key );
            await expect( line ).toHaveCount( 0 );
            await expectNoDialog( page );
            await expect( card( page ) ).toHaveCount( 0 );
            // The artboard it was on stays.
            await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount(
                9
            );
            await expectBack();
        }

        // "Remove guide" in its card.
        await select( page, GUIDE_A );
        await card( page )
            .getByRole( 'button', { name: 'Remove guide', exact: true } )
            .click();
        await expect( line ).toHaveCount( 0 );
        await expectNoDialog( page );
        await expectBack();
    } );

    test( 'AC-GUIDE-09 The server accepts a layout without `guides`, one with a board guide and one with an artboard\'s guide, each with exactly its fields. It answers 400 to a guide with an extra field, an `axis` of "z", an `at` of 1.5, an `id` used twice, an `artboard` without a `device`, a `device` without an `artboard`, an `artboard` that is not in the layout, and an `artboard` that is a media object. The plugin registers no route, option or capability that it did not before', async ( {
        requestUtils,
    } ) => {
        const artboards: Record< string, unknown >[] = [
            ...fixture.layout.artboards,
        ];
        const save = ( guideList?: unknown, withArtboards = artboards ) =>
            saveBoardLayout( requestUtils, fixture.boardId, {
                version: 1,
                artboards: withArtboards,
                ...( guideList === undefined ? {} : { guides: guideList } ),
            } );
        const saved = () => savedBoardLayout( requestUtils, fixture.boardId );

        // Accepted, and kept with exactly their fields.
        expect( await save() ).toBe( 200 );
        expect( Object.keys( await saved() ).sort() ).toEqual( [
            'artboards',
            'version',
        ] );
        expect( await save( [ ofBoard ] ) ).toBe( 200 );
        expect( ( await saved() ).guides ).toEqual( [ ofBoard ] );
        expect( await save( [ ofAbout ] ) ).toBe( 200 );
        expect( ( await saved() ).guides ).toEqual( [ ofAbout ] );
        expect( await save( [ ofAbout, ofBoard, alsoOfAbout ] ) ).toBe( 200 );
        expect( ( await saved() ).guides ).toEqual( [
            ofAbout,
            ofBoard,
            alsoOfAbout,
        ] );
        // A board guide may be left of or above the origin.
        expect( await save( [ { ...ofBoard, at: -120 } ] ) ).toBe( 200 );

        // Refused.
        expect( await save( 'none' ) ).toBe( 400 );
        expect( await save( [ { ...ofBoard, color: 'blue' } ] ) ).toBe( 400 );
        expect( await save( [ { ...ofAbout, selected: true } ] ) ).toBe( 400 );
        expect( await save( [ { ...ofBoard, axis: 'z' } ] ) ).toBe( 400 );
        expect( await save( [ { ...ofBoard, at: 1.5 } ] ) ).toBe( 400 );
        expect( await save( [ { ...ofAbout, at: 1.5 } ] ) ).toBe( 400 );
        expect(
            await save( [ ofAbout, { ...ofBoard, id: ofAbout.id } ] )
        ).toBe( 400 );
        const { device, ...noDevice } = ofAbout;
        expect( device ).toBe( 'desktop' );
        expect( await save( [ noDevice ] ) ).toBe( 400 );
        expect( await save( [ { ...ofBoard, device: 'desktop' } ] ) ).toBe(
            400
        );
        expect(
            await save( [
                {
                    ...ofAbout,
                    artboard: '99999999-2222-4333-8444-555555555555',
                },
            ] )
        ).toBe( 400 );
        // A media object is in the layout, and cannot own a guide.
        const media = ( await requestUtils.uploadMedia( SAMPLE ) ) as {
            id: number;
        };
        const mediaObject = {
            id: '11111111-2222-4333-8444-555555555555',
            kind: 'media',
            entityId: media.id,
            x: -400,
            y: -400,
            width: 40,
            height: 30,
        };
        const withMedia = [ ...artboards, mediaObject ];
        expect( await save( [ ofAbout ], withMedia ) ).toBe( 200 );
        expect(
            await save(
                [ { ...ofAbout, artboard: mediaObject.id } ],
                withMedia
            )
        ).toBe( 400 );
        // Nothing a refused save held was kept.
        expect( ( await saved() ).guides ).toEqual( [ ofAbout ] );

        // Nothing but that check is added to the server (C36). No earlier
        // list of routes, options and capabilities exists to compare with,
        // so none of them may be named for guides or rulers.
        const index = await requestUtils.rest< {
            routes: Record< string, unknown >;
        } >( { path: '/' } );
        expect(
            Object.keys( index.routes ).filter( ( route ) =>
                /guide|ruler/i.test( route )
            )
        ).toEqual( [] );
        const ran = await php(
            'global $wpdb; echo wp_json_encode( array( "options" => $wpdb->get_col( "SELECT option_name FROM $wpdb->options WHERE option_name LIKE \'%wfd%guide%\' OR option_name LIKE \'%wfd%ruler%\'" ), "caps" => array_keys( get_role( "administrator" )->capabilities ) ) );'
        );
        const site = JSON.parse( ran.stdout );
        expect( site.options ).toEqual( [] );
        expect(
            site.caps.filter( ( cap: string ) => /guide|ruler/i.test( cap ) )
        ).toEqual( [] );
    } );

    test( 'AC-GUIDE-10 Guides are on the board after waiting 3 seconds and reloading, without any save; nothing about them appears in Review; a second administrator who opens the board sees them', async ( {
        page,
        browser,
    } ) => {
        test.setTimeout( 90000 );
        await open( page );
        await pullGuide( page, 'top', await dropPoint( page ) );
        await expect( guides( page ) ).toHaveCount( 1 );
        await pullGuide( page, 'left', await emptyPoint( page ) );
        await expect( guides( page ) ).toHaveCount( 2 );
        const dropped = await guidesOn( page );
        const described = ( list: typeof dropped ) =>
            list
                .map( ( { id, axis, at, owner, device } ) =>
                    [ id, axis, at, owner, device ].join( ' ' )
                )
                .sort();

        // No save is pressed: the layout saves itself.
        await page.waitForTimeout( 3000 );
        await openBoard( page, fixture.boardId );
        await expect( guides( page ) ).toHaveCount( 2 );
        expect( described( await guidesOn( page ) ) ).toEqual(
            described( dropped )
        );

        // Review lists the one change made now, and nothing for guides.
        await page
            .locator( '[data-wfd-region="right"]' )
            .getByRole( 'button', { name: /^Variation:/ } )
            .click();
        await page.getByRole( 'menuitemradio', { name: 'Evening' } ).click();
        await page.locator( '[data-wfd-control="H9"]' ).click();
        const drawer = page.getByRole( 'dialog', { name: 'Review changes' } );
        await expect( drawer ).toBeVisible();
        await expect( drawer.locator( '.wfd-review__item' ) ).toHaveCount( 1 );
        await expect( drawer ).not.toContainText( /guide|ruler/i );

        // A second administrator.
        const second = await loginAs( browser, 'wfd_admin2' );
        await openBoard( second, fixture.boardId );
        await expect( second.locator( '[data-wfd-guide]' ) ).toHaveCount( 2 );
        expect( described( await guidesOn( second ) ) ).toEqual(
            described( dropped )
        );
        await second.context().close();
    } );

    test( 'AC-GUIDE-11 Taking an artboard off the board takes its guides with it: the saved layout holds none of them, and Undo brings the artboard and its guides back together', async ( {
        page,
        requestUtils,
    } ) => {
        expect(
            await seed( requestUtils, [ ofAbout, ofBoard, alsoOfAbout ] )
        ).toBe( 200 );
        await open( page );
        await expect( guides( page ) ).toHaveCount( 3 );

        await selectAbout( page );
        await focusBoard( page );
        await page.keyboard.press( 'Delete' );
        const dialog = page.getByRole( 'alertdialog' );
        await expect( dialog ).toContainText( 'Remove About from this board?' );
        await dialog.getByRole( 'button', { name: 'Remove' } ).click();
        await expect( artboard( page, about.id ) ).toHaveCount( 0 );
        await expect( guide( page, GUIDE_A ) ).toHaveCount( 0 );
        await expect( guide( page, GUIDE_C ) ).toHaveCount( 0 );
        await expect( guide( page, GUIDE_B ) ).toHaveCount( 1 );

        // The saved layout holds the board guide only.
        await expect
            .poll(
                async () =>
                    ( await savedBoardLayout( requestUtils, fixture.boardId ) )
                        .artboards.length,
                { timeout: 10000 }
            )
            .toBe( 8 );
        expect(
            ( await savedBoardLayout( requestUtils, fixture.boardId ) ).guides
        ).toEqual( [ ofBoard ] );

        // One step, named for the artboard, brings both back.
        await expect( undo( page ) ).toHaveAccessibleName(
            'Undo remove artboard, on the board'
        );
        await undo( page ).click();
        await expect( artboard( page, about.id ) ).toHaveCount( 1 );
        await expect( guides( page ) ).toHaveCount( 3 );
        await expect( guide( page, GUIDE_A ) ).toHaveAttribute(
            'data-wfd-at',
            '40'
        );
        await expect( guide( page, GUIDE_C ) ).toHaveAttribute(
            'data-wfd-at',
            '96'
        );
        await expect
            .poll(
                async () =>
                    (
                        await savedBoardLayout( requestUtils, fixture.boardId )
                    ).guides
                        ?.map( ( saved ) => saved.id )
                        .sort(),
                { timeout: 10000 }
            )
            .toEqual( [ GUIDE_A, GUIDE_B, GUIDE_C ].sort() );
    } );

    test( 'AC-GUIDE-12 Cmd/Ctrl + ; and the "Guides" item hide every guide and every guide mark on the rulers, and show them again; the choice is still in place after a reload and is not in the saved layout; with guides hidden, dragging a new guide out of a ruler shows guides again', async ( {
        page,
        requestUtils,
    } ) => {
        expect( await seed( requestUtils, [ ofAbout, ofBoard ] ) ).toBe( 200 );
        await open( page );
        await expect( guides( page ) ).toHaveCount( 2 );
        const expectMarks = async ( left: number[], top: number[] ) => {
            await expect
                .poll( async () => ( await rulerOf( page, 'left' ) ).marks )
                .toEqual( left );
            await expect
                .poll( async () => ( await rulerOf( page, 'top' ) ).marks )
                .toEqual( top );
        };
        // With About selected its guide is marked too.
        await selectAbout( page );
        await expectMarks( [ 40 ], [ 1000 ] );

        // Cmd/Ctrl + ; hides them, and their marks.
        await focusBoard( page );
        await page.keyboard.press( 'ControlOrMeta+Semicolon' );
        await expect( guides( page ) ).toHaveCount( 0 );
        await expectMarks( [], [] );
        // The rulers stay.
        await expect( page.locator( '[data-wfd-ruler]' ) ).toHaveCount( 2 );
        expect( await viewChecked( page, 'guides' ) ).toBe( 'false' );
        // And shows them again.
        await focusBoard( page );
        await page.keyboard.press( 'ControlOrMeta+Semicolon' );
        await expect( guides( page ) ).toHaveCount( 2 );
        await selectAbout( page );
        await expectMarks( [ 40 ], [ 1000 ] );
        expect( await viewChecked( page, 'guides' ) ).toBe( 'true' );

        // The "Guides" item does the same.
        await chooseView( page, 'guides' );
        await expect( guides( page ) ).toHaveCount( 0 );
        await selectAbout( page );
        await expectMarks( [], [] );
        await chooseView( page, 'guides' );
        await expect( guides( page ) ).toHaveCount( 2 );
        await selectAbout( page );
        await expectMarks( [ 40 ], [ 1000 ] );
        await chooseView( page, 'guides' );
        await expect( guides( page ) ).toHaveCount( 0 );

        // Hidden guides stay on the board, and the choice is not saved with
        // it: a layout the board saves now holds the guides and no choice.
        await selectAbout( page );
        await focusBoard( page );
        await page.keyboard.press( 'ArrowRight' );
        await expect
            .poll(
                async () =>
                    (
                        await savedBoardLayout( requestUtils, fixture.boardId )
                    ).artboards.find( ( a ) => a.id === about.id )?.x,
                { timeout: 10000 }
            )
            .toBe( about.x + 1 );
        const saved = await savedBoardLayout( requestUtils, fixture.boardId );
        expect( Object.keys( saved ).sort() ).toEqual( [
            'artboards',
            'guides',
            'version',
        ] );
        expect( saved.guides ).toEqual( [ ofAbout, ofBoard ] );

        // Still hidden after a reload.
        await openBoard( page, fixture.boardId );
        await showAbout( page );
        await expect( guides( page ) ).toHaveCount( 0 );
        expect( await viewChecked( page, 'guides' ) ).toBe( 'false' );

        // A new guide pulled out of a ruler shows guides again.
        await pullGuide( page, 'top', await dropPoint( page ) );
        await expect( guides( page ) ).toHaveCount( 3 );
        expect( await viewChecked( page, 'guides' ) ).toBe( 'true' );
    } );

    test( "AC-GUIDE-13 With an artboard in edit, its guides are drawn over it; a click on a guide's line selects the block under the line and no guide; a guide pulled out of a ruler onto the artboard is added, is not selected, and the artboard stays in edit", async ( {
        page,
        requestUtils,
    } ) => {
        test.setTimeout( 90000 );
        const hero = artboardOf( fixture, 'pattern' );
        // A vertical guide down the middle of Hero.
        expect(
            await seed( requestUtils, [
                {
                    id: GUIDE_A,
                    axis: 'x',
                    at: 720,
                    artboard: hero.id,
                    device: 'desktop',
                },
            ] )
        ).toBe( 200 );
        await open( page );
        // Hero at 50%, its corner 40 by 100 pixels into the canvas area.
        await putCornerAt( page, hero, 0.5, { x: 40, y: 100 } );
        await enterEdit( page, hero.id );
        const live = artboard( page, hero.id );
        const editor = editorFrame( page, hero.id );
        const heading = editor.locator( 'h2', { hasText: 'Hero' } );
        const paragraph = editor.locator( 'p', {
            hasText: 'Hero paragraph.',
        } );

        // Its guide is drawn over it.
        await expect( guide( page, GUIDE_A ) ).toBeVisible();
        const frame = await frameBoxOf( page, hero.id );
        const seeded = await boxOf( page, GUIDE_A );
        expect(
            Math.abs( seeded.x + seeded.width / 2 - ( frame.x + 360 ) )
        ).toBeLessThanOrEqual( 2 );

        // A guide pulled out of the top ruler, down to the paragraph.
        await heading.click();
        await expect( heading ).toHaveClass( /is-selected/ );
        const block = ( await paragraph.boundingBox() )!;
        // Left of the middle, where the seeded guide runs.
        const to = {
            x: block.x + block.width / 4,
            y: block.y + block.height / 2,
        };
        await pullGuide( page, 'top', to );
        await expect( guides( page ) ).toHaveCount( 2 );
        const added = ( await guidesOn( page ) ).find(
            ( { id } ) => id !== GUIDE_A
        )!;
        expect( added.axis ).toBe( 'y' );
        expect( added.owner ).toBe( hero.id );
        expect( added.device ).toBe( 'desktop' );
        await expect( selectedGuides( page ) ).toHaveCount( 0 );
        await expect( card( page ) ).toHaveCount( 0 );
        await expect( live ).toHaveAttribute( 'data-wfd-tier', 'live' );
        // Its line crosses the paragraph.
        const line = await boxOf( page, added.id );
        expect(
            Math.abs( line.y + line.height / 2 - to.y )
        ).toBeLessThanOrEqual( 2 );

        // A click on that line reaches the block under it.
        await heading.click();
        await expect( heading ).toHaveClass( /is-selected/ );
        await page.mouse.click( to.x, to.y );
        await expect( paragraph ).toHaveClass( /is-selected/ );
        await expect( heading ).not.toHaveClass( /is-selected/ );
        await expect( selectedGuides( page ) ).toHaveCount( 0 );
        await expect( card( page ) ).toHaveCount( 0 );
        await expect( live ).toHaveAttribute( 'data-wfd-tier', 'live' );
        // Typing goes to the block.
        await page.keyboard.press( 'End' );
        await page.keyboard.type( ' x' );
        await expect( paragraph ).toHaveText( 'Hero paragraph. x' );
        await expect( guides( page ) ).toHaveCount( 2 );
    } );

    test( 'AC-GUIDE-14 The left panel has no group and no row for guides, the artboard settings of an artboard that has guides are as on the "Selected" screen, and the keyboard shortcuts dialog has the four rows for rulers and guides', async ( {
        page,
        requestUtils,
    } ) => {
        expect(
            await seed( requestUtils, [ ofAbout, ofBoard, alsoOfAbout ] )
        ).toBe( 200 );
        await open( page );
        await expect( guides( page ) ).toHaveCount( 3 );

        // The left panel is as without guides: four groups, nine rows.
        const left = page.locator( '[data-wfd-region="left"]' );
        await expect( left.locator( '[data-wfd-group]' ) ).toHaveCount( 4 );
        await expect(
            left.locator( '[data-wfd-group]' ).getByRole( 'heading' )
        ).toHaveText( [ 'Pages', 'Templates', 'Template parts', 'Patterns' ] );
        await expect( left.locator( '[data-wfd-row]' ) ).toHaveCount( 9 );
        await expect( left ).not.toContainText( /guide/i );
        // With a guide selected too.
        await select( page, GUIDE_A );
        await expect( left.locator( '[data-wfd-group]' ) ).toHaveCount( 4 );
        await expect( left.locator( '[data-wfd-row]' ) ).toHaveCount( 9 );
        await expect( left ).not.toContainText( /guide/i );

        // The settings of About say nothing about its guides.
        await selectAbout( page );
        const right = page.locator( '[data-wfd-region="right"]' );
        const settings = right.locator( '[data-wfd-panel="settings"]' );
        await expect( settings ).toBeVisible();
        await expect( card( page ) ).toHaveCount( 0 );
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
        await expect( right ).not.toContainText( /guide/i );

        // The keyboard shortcuts dialog.
        await page.locator( '[data-wfd-control="A5"]' ).click();
        const dialog = page.getByRole( 'dialog', {
            name: 'Keyboard shortcuts',
        } );
        const rows = dialog.locator( '[data-wfd-shortcut-row]' );
        await expect(
            rows.filter( { hasText: 'Show or hide rulers' } )
        ).toHaveCount( 1 );
        await expect(
            rows.filter( { hasText: 'Show or hide guides' } )
        ).toHaveCount( 1 );
        await expect(
            rows.filter( { hasText: 'Move the selected guide' } )
        ).toHaveCount( 2 );
        await expect(
            rows.filter( { hasText: 'Move the selected guide further' } )
        ).toHaveCount( 1 );
    } );

    test( 'AC-GUIDE-15 On a site an agent has used, the result of `board-get` on a board with guides holds nothing about them, and `wp wfd tools` lists the same 21 tools', async ( {
        page,
        requestUtils,
    } ) => {
        expect(
            await seed( requestUtils, [ ofAbout, ofBoard, alsoOfAbout ] )
        ).toBe( 200 );
        // A way in is used: the site is one an agent has used (D94).
        await wfd( [ 'status' ] );
        const asked = listening( page );
        await setViewChoices( page, fixture.boardId, {
            rulers: true,
            guides: true,
        } );
        await openBoard( page, fixture.boardId );
        await asked;
        await expect( guides( page ) ).toHaveCount( 3 );

        const ran = await wfd( [ 'call', 'board-get' ] );
        expect( ran.code ).toBe( 0 );
        const envelope = JSON.parse( ran.stdout );
        expect( envelope.ok ).toBe( true );
        expect(
            envelope.result.artboards.map( ( a: any ) => a.id ).sort()
        ).toEqual( fixture.layout.artboards.map( ( a ) => a.id ).sort() );
        expect( Object.keys( envelope.result ) ).not.toContain( 'guides' );
        expect( ran.stdout ).not.toMatch( /guide|ruler/i );
        for ( const id of [ GUIDE_A, GUIDE_B, GUIDE_C ] ) {
            expect( ran.stdout ).not.toContain( id );
        }

        // The same 21 tools, none for guides or rulers.
        const declared = JSON.parse(
            readFileSync(
                path.join( process.cwd(), 'includes/agent-tools.json' ),
                'utf8'
            )
        );
        const listed = await wfd( [ 'tools', '--format=json' ] );
        expect( listed.code ).toBe( 0 );
        const tools = JSON.parse( listed.stdout );
        expect( tools ).toHaveLength( 21 );
        expect( tools ).toEqual( declared );
        expect( listed.stdout ).not.toMatch( /guide|ruler/i );
        const plain = await wfd( [ 'tools' ] );
        expect( plain.code ).toBe( 0 );
        expect( plain.stdout.match( /^## /gm ) ).toHaveLength( 21 );
        expect( plain.stdout ).not.toMatch( /guide|ruler/i );
    } );
} );
