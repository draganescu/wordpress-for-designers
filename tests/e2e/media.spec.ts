import path from 'path';
import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import {
    resetFixture,
    openBoard,
    boardUrl,
    setViewport,
    type Fixture,
} from './utils';

const SAMPLE = path.join( __dirname, 'assets', 'wfd-sample.png' );

type Media = { id: number; title: { raw: string } };

const mediaObject = ( media: Media, x = -400, y = -400 ) => ( {
    id: '11111111-2222-4333-8444-555555555555',
    kind: 'media',
    entityId: media.id,
    x,
    y,
    width: 40,
    height: 30,
} );

test.describe( 'MEDIA', () => {
    let fixture: Fixture;
    let media: Media;
    test.beforeEach( async ( { requestUtils } ) => {
        fixture = await resetFixture( requestUtils );
        media = ( await requestUtils.uploadMedia( SAMPLE ) ) as Media;
    } );

    const saveLayout = async ( requestUtils: any, artboards: unknown[] ) => {
        try {
            await requestUtils.rest( {
                method: 'POST',
                path: `/wp/v2/wfd-boards/${ fixture.boardId }`,
                data: { layout: { version: 1, artboards } },
            } );
            return 200;
        } catch ( error ) {
            return ( error as { data?: { status?: number } } ).data?.status;
        }
    };

    const savedLayout = async ( requestUtils: any ) =>
        (
            await requestUtils.rest( {
                path: `/wp/v2/wfd-boards/${ fixture.boardId }`,
                params: { context: 'edit' },
            } )
        ).layout.artboards as Record< string, unknown >[];

    test( 'AC-MEDIA-01 With no artboard in edit, clicking an image in the Media tab places a media object in view, and dragging one to empty board shows the drop target at the image\'s size and places a media object there, labelled "{Name} · Media", listed under "Media" in the left panel; after a reload it is still there', async ( {
        page,
        requestUtils,
    } ) => {
        await openBoard( page, fixture.boardId );
        // At 100% the object's size on screen is the image's size.
        await setViewport( page, { x: 3000, y: 3000, zoom: 1 } );
        const header = page.locator( '[data-wfd-region="header"]' );
        await header
            .getByRole( 'button', { name: 'Block inserter', exact: true } )
            .click();
        const panel = page.locator( '.wfd-inserter' );
        await panel.getByRole( 'tab', { name: 'Media' } ).click();
        const row = panel.locator( '.wfd-row', { hasText: 'wfd-sample' } );
        await expect( row ).toHaveCount( 1 );

        const canvas = page.locator( '[data-wfd-region="canvas"]' );
        const box = ( await canvas.boundingBox() )!;
        const target = { x: box.width - 260, y: box.height - 180 };
        const start = ( await row.boundingBox() )!;
        await page.mouse.move( start.x + 30, start.y + start.height / 2 );
        await page.mouse.down();
        await page.mouse.move( start.x + 60, start.y + start.height / 2 + 6, {
            steps: 3,
        } );
        await page.mouse.move( box.x + target.x - 30, box.y + target.y - 20, {
            steps: 6,
        } );
        await page.mouse.move( box.x + target.x, box.y + target.y, {
            steps: 3,
        } );
        const outline = page.locator( '[data-wfd-placement]' );
        await expect( outline ).toBeVisible();
        await expect( outline ).toContainText( /wfd-sample.* · Media/ );
        const outlineBox = ( await outline
            .locator( '.wfd-placement__outline' )
            .boundingBox() )!;
        expect( Math.round( outlineBox.width ) ).toBe( 40 );
        expect( Math.round( outlineBox.height ) ).toBe( 30 );
        await page.mouse.up();
        await expect( outline ).toHaveCount( 0 );

        const object = page.locator( '[data-wfd-kind="media"]' );
        await expect( object ).toHaveCount( 1 );
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 10 );
        await expect( object.locator( '.wfd-artboard__label' ) ).toHaveText(
            'wfd-sample · Media'
        );
        await expect( object ).not.toHaveAttribute( 'data-wfd-device' );
        await expect( object ).toHaveClass( /is-selected/ );
        const image = object.locator( 'img' );
        await expect( image ).toHaveAttribute( 'src', /wfd-sample/ );
        const frame = ( await object
            .locator( '.wfd-artboard__frame' )
            .boundingBox() )!;
        expect( Math.round( frame.width ) ).toBe( 40 );
        expect( Math.round( frame.height ) ).toBe( 30 );
        expect( frame.x - box.x ).toBeCloseTo( target.x, -1 );
        expect( frame.y - box.y ).toBeCloseTo( target.y, -1 );
        await expect( object.locator( 'iframe' ) ).toHaveCount( 0 );
        await expect( page.locator( '[data-wfd-tier="live"]' ) ).toHaveCount(
            0
        );

        // Listed under Media in the left panel, with no device word.
        await header
            .getByRole( 'button', { name: 'Close block inserter' } )
            .click();
        const group = page.locator(
            '[data-wfd-region="left"] [data-wfd-group="media"]'
        );
        await expect( group.getByRole( 'heading' ) ).toHaveText( /media/i );
        await expect( group.locator( '[data-wfd-row]' ) ).toHaveCount( 1 );
        await expect( group.locator( '[data-wfd-row]' ) ).toHaveText(
            'wfd-sample'
        );

        // Saved with the board, with a width and no device.
        await expect
            .poll(
                async () =>
                    ( await savedLayout( requestUtils ) ).find(
                        ( item ) => item.kind === 'media'
                    ),
                { timeout: 10000 }
            )
            .toBeTruthy();
        const stored = ( await savedLayout( requestUtils ) ).find(
            ( item ) => item.kind === 'media'
        )!;
        expect( Object.keys( stored ).sort() ).toEqual( [
            'entityId',
            'height',
            'id',
            'kind',
            'width',
            'x',
            'y',
        ] );
        expect( stored.entityId ).toBe( media.id );
        expect( stored.width ).toBe( 40 );
        expect( stored.height ).toBe( 30 );

        await page.reload();
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 10 );
        await expect(
            page.locator( '[data-wfd-kind="media"] img' )
        ).toHaveAttribute( 'src', /wfd-sample/ );

        // A click places one too: selected, in view, not in edit.
        await page
            .locator( '[data-wfd-region="header"]' )
            .getByRole( 'button', { name: 'Block inserter', exact: true } )
            .click();
        await page
            .locator( '.wfd-inserter' )
            .getByRole( 'tab', { name: 'Media' } )
            .click();
        await expect( page.locator( '.wfd-inserter' ) ).toContainText(
            'Click or drag to the board to place it there.'
        );
        await page
            .locator( '.wfd-inserter .wfd-row', { hasText: 'wfd-sample' } )
            .click();
        const objects = page.locator( '[data-wfd-kind="media"]' );
        await expect( objects ).toHaveCount( 2 );
        await expect( objects.last() ).toHaveClass( /is-selected/ );
        await expect(
            objects.last().locator( '.wfd-artboard__frame' )
        ).toBeInViewport();
        await expect( page.locator( '[data-wfd-tier="live"]' ) ).toHaveCount(
            0
        );
    } );

    test( 'AC-MEDIA-02 A media object is selected by a click, moved by dragging and removed with Delete through a dialog with no checkbox; double-click and Enter do not enter edit; its settings show the image\'s pixel size and only "Remove from board"', async ( {
        page,
        requestUtils,
    } ) => {
        expect(
            await saveLayout( requestUtils, [
                ...fixture.layout.artboards,
                mediaObject( media ),
            ] )
        ).toBe( 200 );
        await page.goto( boardUrl( fixture.boardId ) );
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 10 );
        await setViewport( page, { x: 700, y: 700, zoom: 1 } );
        const object = page.locator( '[data-wfd-kind="media"]' );
        const frame = object.locator( '.wfd-artboard__frame' );
        const centre = async () => {
            const box = ( await frame.boundingBox() )!;
            return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        };

        // Click selects.
        let point = await centre();
        await page.mouse.click( point.x, point.y );
        await expect( object ).toHaveClass( /is-selected/ );
        const settings = page.locator( '[data-wfd-panel="settings"]' );
        await expect(
            settings.getByRole( 'heading', { name: 'wfd-sample' } )
        ).toBeVisible();
        await expect( settings ).toContainText( '40 × 30' );
        await expect( settings.getByRole( 'button' ) ).toHaveCount( 1 );
        await expect(
            settings.getByRole( 'button', { name: 'Remove from board' } )
        ).toBeVisible();
        await expect( settings ).not.toContainText( 'Artboard device' );
        await expect( settings ).not.toContainText( 'Template' );

        // Double-click and Enter do not enter edit.
        await page.mouse.dblclick( point.x, point.y );
        await page.keyboard.press( 'Enter' );
        await page.waitForTimeout( 300 );
        await expect( page.locator( '[data-wfd-tier="live"]' ) ).toHaveCount(
            0
        );
        await expect( page.locator( '[data-wfd-control="H7"]' ) ).toHaveText(
            'Fixture board'
        );
        await expect( object ).toHaveClass( /is-selected/ );

        // Dragging moves it.
        const before = ( await frame.boundingBox() )!;
        await page.mouse.move( point.x, point.y );
        await page.mouse.down();
        await page.mouse.move( point.x + 40, point.y + 25, { steps: 5 } );
        await page.mouse.move( point.x + 120, point.y + 70, { steps: 5 } );
        await page.mouse.up();
        const after = ( await frame.boundingBox() )!;
        expect( Math.round( after.x - before.x ) ).toBe( 120 );
        expect( Math.round( after.y - before.y ) ).toBe( 70 );
        await expect(
            page.locator( '[data-wfd-control="H3"]' )
        ).toHaveAccessibleName( 'Undo move artboard, on the board' );

        // Delete removes it through a dialog with no checkbox.
        await page.keyboard.press( 'Delete' );
        const dialog = page.getByRole( 'alertdialog' );
        await expect( dialog ).toContainText(
            'Remove wfd-sample from this board?'
        );
        await expect( dialog.getByRole( 'checkbox' ) ).toHaveCount( 0 );
        await dialog.getByRole( 'button', { name: 'Cancel' } ).click();
        await expect( object ).toHaveCount( 1 );
        point = await centre();
        await page.mouse.click( point.x, point.y );
        await settings
            .getByRole( 'button', { name: 'Remove from board' } )
            .click();
        await page
            .getByRole( 'alertdialog' )
            .getByRole( 'button', { name: 'Remove' } )
            .click();
        await expect( object ).toHaveCount( 0 );
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 9 );
        // The image stays in the media library.
        const kept = await requestUtils.rest< { id: number } >( {
            path: `/wp/v2/media/${ media.id }`,
        } );
        expect( kept.id ).toBe( media.id );
    } );

    test( 'AC-MEDIA-03 The server accepts a media object with exactly its fields and rejects one with a device or without a width; a media object whose image no longer exists is removed from the board on load', async ( {
        page,
        requestUtils,
    } ) => {
        const others = fixture.layout.artboards;
        const good = mediaObject( media );
        const { width, ...withoutWidth } = good;
        expect( width ).toBe( 40 );
        const bad = [
            { ...good, device: 'desktop' },
            withoutWidth,
            { ...good, width: '40' },
            { ...good, entityId: String( media.id ) },
            { ...withoutWidth, device: 'desktop' },
            { ...good, note: 'x' },
        ];
        for ( const object of bad ) {
            expect(
                await saveLayout( requestUtils, [ ...others, object ] ),
                JSON.stringify( object )
            ).toBe( 400 );
        }
        // An artboard of another kind still may not carry a width.
        expect(
            await saveLayout( requestUtils, [ { ...others[ 0 ], width: 10 } ] )
        ).toBe( 400 );
        expect( await saveLayout( requestUtils, [ ...others, good ] ) ).toBe(
            200
        );
        expect( await savedLayout( requestUtils ) ).toHaveLength( 10 );

        // The image is deleted for good.
        await requestUtils.rest( {
            method: 'DELETE',
            path: `/wp/v2/media/${ media.id }`,
            params: { force: true },
        } );
        await page.goto( boardUrl( fixture.boardId ) );
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 9 );
        await expect( page.locator( '[data-wfd-kind="media"]' ) ).toHaveCount(
            0
        );
        await expect
            .poll( async () => ( await savedLayout( requestUtils ) ).length, {
                timeout: 10000,
            } )
            .toBe( 9 );
    } );
} );
