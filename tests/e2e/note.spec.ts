import type { Page } from '@playwright/test';
import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import {
    resetFixture,
    openBoard,
    setViewport,
    type Artboard,
    type Fixture,
} from './utils';

const NOTE_ID = '11111111-2222-4333-8444-666666666666';

type Note = {
    id: string;
    x: number;
    y: number;
    text: string;
    color: string;
};

test.describe( 'NOTE', () => {
    let fixture: Fixture;
    let first: Artboard;
    test.beforeEach( async ( { requestUtils } ) => {
        fixture = await resetFixture( requestUtils );
        first = fixture.layout.artboards[ 0 ];
    } );

    const saveLayout = async ( requestUtils: any, layout: unknown ) => {
        try {
            await requestUtils.rest( {
                method: 'POST',
                path: `/wp/v2/wfd-boards/${ fixture.boardId }`,
                data: { layout },
            } );
            return 200;
        } catch ( error ) {
            return ( error as { data?: { status?: number } } ).data?.status;
        }
    };

    const savedNotes = async ( requestUtils: any ) =>
        ( (
            await requestUtils.rest( {
                path: `/wp/v2/wfd-boards/${ fixture.boardId }`,
                params: { context: 'edit' },
            } )
        ).layout.notes ?? [] ) as Note[];

    // A note over the first artboard, 40 units in from its corner.
    const seedNote = ( requestUtils: any, note: Partial< Note > = {} ) =>
        saveLayout( requestUtils, {
            version: 1,
            artboards: fixture.layout.artboards,
            notes: [
                {
                    id: NOTE_ID,
                    x: first.x + 40,
                    y: first.y + 40,
                    text: 'Check the spacing',
                    color: 'yellow',
                    ...note,
                },
            ],
        } );

    // The first artboard at 50%, its corner 200 by 150 pixels into the
    // canvas area.
    const showFirst = ( page: Page ) =>
        setViewport( page, {
            x: 200 - first.x * 0.5,
            y: 150 - first.y * 0.5,
            zoom: 0.5,
        } );

    const canvasBox = async ( page: Page ) =>
        ( await page.locator( '[data-wfd-region="canvas"]' ).boundingBox() )!;

    const addNoteButton = ( page: Page ) =>
        page
            .locator( '[data-wfd-region="header"]' )
            .getByRole( 'button', { name: 'Add note', exact: true } );

    const drag = async (
        page: Page,
        from: { x: number; y: number },
        to: { x: number; y: number }
    ) => {
        await page.mouse.move( from.x, from.y );
        await page.mouse.down();
        await page.mouse.move( from.x + 5, from.y + 5, { steps: 2 } );
        await page.mouse.move( to.x, to.y, { steps: 6 } );
        await page.mouse.up();
    };

    test( 'AC-NOTE-01 With no artboard in edit, pressing "Add note" and then clicking over an artboard places a Yellow note there, drawn above the artboard, selected, with its text field focused; "Add note" is no longer pressed. Esc after arming places nothing', async ( {
        page,
    } ) => {
        await openBoard( page, fixture.boardId );
        await showFirst( page );
        const box = await canvasBox( page );
        const button = addNoteButton( page );
        await expect( button ).toHaveAttribute( 'aria-pressed', 'false' );
        await button.click();
        await expect( button ).toHaveAttribute( 'aria-pressed', 'true' );

        // Over the first artboard, 100 by 80 board units in.
        const at = { x: box.x + 250, y: box.y + 190 };
        await page.mouse.click( at.x, at.y );
        const note = page.locator( '[data-wfd-note]' );
        await expect( note ).toHaveCount( 1 );
        await expect( note ).toHaveAttribute( 'data-wfd-color', 'yellow' );
        await expect( note ).toHaveClass( /is-selected/ );
        await expect( note.locator( 'textarea' ) ).toBeFocused();
        await expect( button ).toHaveAttribute( 'aria-pressed', 'false' );
        // Placed at the click: its corner is where the pointer was.
        const noteBox = ( await note.boundingBox() )!;
        expect( noteBox.x ).toBeCloseTo( at.x, -1 );
        expect( noteBox.y ).toBeCloseTo( at.y, -1 );
        // 240 board units wide at 50%.
        expect( Math.round( noteBox.width ) ).toBe( 120 );
        // No artboard became selected or entered edit.
        await expect( page.locator( '.wfd-artboard.is-selected' ) ).toHaveCount(
            0
        );
        await expect( page.locator( '[data-wfd-tier="live"]' ) ).toHaveCount(
            0
        );
        // Drawn above the artboard it covers.
        const onTop = await page.evaluate(
            ( { x, y } ) =>
                !! document
                    .elementFromPoint( x, y )
                    ?.closest( '[data-wfd-note]' ),
            { x: noteBox.x + 10, y: noteBox.y + 10 }
        );
        expect( onTop ).toBe( true );

        // Esc ends typing; armed again, Esc switches the tool off.
        await page.keyboard.press( 'Escape' );
        await expect( note.locator( 'textarea' ) ).toHaveCount( 0 );
        await expect( note ).toHaveClass( /is-selected/ );
        await button.click();
        await expect( button ).toHaveAttribute( 'aria-pressed', 'true' );
        await page.keyboard.press( 'Escape' );
        await expect( button ).toHaveAttribute( 'aria-pressed', 'false' );
        await expect( page.locator( '[data-wfd-placer="note"]' ) ).toHaveCount(
            0
        );
        await page.mouse.click( box.x + 400, box.y + 300 );
        await expect( note ).toHaveCount( 1 );
    } );

    test( 'AC-NOTE-02 Text typed in a note, line breaks included, is on the board after a reload without any save, and is listed under "Notes" in the left panel by its first line', async ( {
        page,
        requestUtils,
    } ) => {
        await openBoard( page, fixture.boardId );
        await showFirst( page );
        const box = await canvasBox( page );
        await addNoteButton( page ).click();
        await page.mouse.click( box.x + 250, box.y + 190 );
        const field = page.locator( '[data-wfd-note] textarea' );
        await expect( field ).toBeFocused();
        await page.keyboard.type( 'Hero too tall' );
        await page.keyboard.press( 'Enter' );
        await page.keyboard.type( 'Try 600px' );

        // Saved while still typing, with no button pressed.
        await expect
            .poll(
                async () => ( await savedNotes( requestUtils ) )[ 0 ]?.text,
                {
                    timeout: 10000,
                }
            )
            .toBe( 'Hero too tall\nTry 600px' );
        const stored = ( await savedNotes( requestUtils ) )[ 0 ];
        expect( Object.keys( stored ).sort() ).toEqual( [
            'color',
            'id',
            'text',
            'x',
            'y',
        ] );
        await expect( page.locator( '[data-wfd-control="H9"]' ) ).toHaveText(
            'Review changes'
        );

        const group = page.locator(
            '[data-wfd-region="left"] [data-wfd-group="note"]'
        );
        await expect( group.getByRole( 'heading' ) ).toHaveText( 'Notes' );
        await expect( group.locator( '[data-wfd-row]' ) ).toHaveText(
            'Hero too tall'
        );

        await openBoard( page, fixture.boardId );
        const note = page.locator( '[data-wfd-note]' );
        await expect( note ).toHaveCount( 1 );
        expect( await note.innerText() ).toBe( 'Hero too tall\nTry 600px' );
        await expect(
            page.locator(
                '[data-wfd-region="left"] [data-wfd-group="note"] [data-wfd-row]'
            )
        ).toHaveText( 'Hero too tall' );
    } );

    test( 'AC-NOTE-03 A note is selected by a click, moved by dragging, moved together with a selected artboard after Cmd/Ctrl + click, and taken off the board by Delete with no dialog; Undo brings it back', async ( {
        page,
        requestUtils,
    } ) => {
        expect( await seedNote( requestUtils ) ).toBe( 200 );
        await openBoard( page, fixture.boardId );
        await showFirst( page );
        const note = page.locator( '[data-wfd-note]' );
        const start = ( await note.boundingBox() )!;
        await page.mouse.click( start.x + 20, start.y + 10 );
        await expect( note ).toHaveClass( /is-selected/ );
        await expect(
            page.locator( '[data-wfd-region="right"] [data-wfd-panel="note"]' )
        ).toBeVisible();

        // Dragged by 50 pixels: 100 units at 50%.
        await drag(
            page,
            { x: start.x + 20, y: start.y + 10 },
            { x: start.x + 70, y: start.y + 10 }
        );
        const moved = ( await note.boundingBox() )!;
        expect( moved.x - start.x ).toBeCloseTo( 50, 0 );
        expect( moved.y ).toBeCloseTo( start.y, 0 );

        // Cmd/Ctrl + click on the artboard adds it; a drag moves both.
        const artboard = page.locator(
            `[data-wfd-artboard="${ first.id }"] .wfd-artboard__frame`
        );
        const artboardStart = ( await artboard.boundingBox() )!;
        await page.keyboard.down( 'ControlOrMeta' );
        await page.mouse.click( artboardStart.x + 10, artboardStart.y + 200 );
        await page.keyboard.up( 'ControlOrMeta' );
        await expect(
            page.locator( `[data-wfd-artboard="${ first.id }"]` )
        ).toHaveClass( /is-selected/ );
        await expect( note ).toHaveClass( /is-selected/ );
        await drag(
            page,
            { x: moved.x + 20, y: moved.y + 10 },
            { x: moved.x + 20, y: moved.y + 40 }
        );
        expect( ( await note.boundingBox() )!.y - moved.y ).toBeCloseTo(
            30,
            0
        );
        expect(
            ( await artboard.boundingBox() )!.y - artboardStart.y
        ).toBeCloseTo( 30, 0 );

        // A click on the note alone, then Delete: gone, with no dialog.
        const last = ( await note.boundingBox() )!;
        await page.mouse.click( last.x + 20, last.y + 10 );
        await expect(
            page.locator( `[data-wfd-artboard="${ first.id }"]` )
        ).not.toHaveClass( /is-selected/ );
        await page.keyboard.press( 'Delete' );
        await expect( note ).toHaveCount( 0 );
        await expect( page.getByRole( 'alertdialog' ) ).toHaveCount( 0 );
        await expect( page.getByRole( 'dialog' ) ).toHaveCount( 0 );
        const undo = page.locator( '[data-wfd-control="H3"]' );
        await expect( undo ).toHaveAccessibleName(
            'Undo remove note, on the board'
        );
        await page.keyboard.press( 'ControlOrMeta+z' );
        await expect( note ).toHaveCount( 1 );
        await expect( note ).toHaveText( 'Check the spacing' );
    } );

    test( 'AC-NOTE-04 Choosing Green in the right panel recolours the selected note, and the colour is kept after a reload', async ( {
        page,
        requestUtils,
    } ) => {
        expect( await seedNote( requestUtils ) ).toBe( 200 );
        await openBoard( page, fixture.boardId );
        await showFirst( page );
        const note = page.locator( '[data-wfd-note]' );
        const box = ( await note.boundingBox() )!;
        await page.mouse.click( box.x + 20, box.y + 10 );
        const panel = page.locator(
            '[data-wfd-region="right"] [data-wfd-panel="note"]'
        );
        await expect( panel.getByRole( 'heading', { level: 2 } ) ).toHaveText(
            'Note'
        );
        await panel.getByRole( 'option', { name: 'Green' } ).click();
        await expect( note ).toHaveAttribute( 'data-wfd-color', 'green' );
        await expect
            .poll(
                async () => ( await savedNotes( requestUtils ) )[ 0 ]?.color,
                { timeout: 10000 }
            )
            .toBe( 'green' );
        await openBoard( page, fixture.boardId );
        await expect( page.locator( '[data-wfd-note]' ) ).toHaveAttribute(
            'data-wfd-color',
            'green'
        );
    } );

    test( 'AC-NOTE-05 The server accepts a layout without `notes` and one whose notes have exactly their fields, and rejects a note with an unknown colour, a missing field or an extra one', async ( {
        requestUtils,
    } ) => {
        const note = {
            id: NOTE_ID,
            x: 0,
            y: 0,
            text: '<b>A & B</b>',
            color: 'blue',
        };
        const layout = ( notes?: unknown[] ) => ( {
            version: 1,
            artboards: fixture.layout.artboards,
            ...( notes ? { notes } : {} ),
        } );
        expect( await saveLayout( requestUtils, layout() ) ).toBe( 200 );
        expect( await saveLayout( requestUtils, layout( [] ) ) ).toBe( 200 );
        expect( await saveLayout( requestUtils, layout( [ note ] ) ) ).toBe(
            200
        );
        // The text comes back as it was sent.
        expect( ( await savedNotes( requestUtils ) )[ 0 ] ).toEqual( note );
        expect(
            await saveLayout(
                requestUtils,
                layout( [ { ...note, color: 'red' } ] )
            )
        ).toBe( 400 );
        const { text, ...noText } = note;
        expect( text ).toBeTruthy();
        expect( await saveLayout( requestUtils, layout( [ noText ] ) ) ).toBe(
            400
        );
        expect(
            await saveLayout(
                requestUtils,
                layout( [ { ...note, width: 240 } ] )
            )
        ).toBe( 400 );
        expect(
            await saveLayout( requestUtils, layout( [ { ...note, x: '0' } ] ) )
        ).toBe( 400 );
        expect(
            await saveLayout( requestUtils, {
                ...layout( [ note ] ),
                extra: true,
            } )
        ).toBe( 400 );
    } );
} );
