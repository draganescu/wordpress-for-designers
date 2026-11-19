import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import {
    resetFixture,
    openBoard,
    setViewport,
    enterEdit,
    editorFrame,
    artboardOf,
} from './utils';

test.describe( 'DATA', () => {
    test( 'AC-DATA-01 Editing the Header artboard changes the header in the template Preview and in Header (Mobile), without saving', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        const header = artboardOf( fixture, 'template-part', 'desktop' );
        const mobile = artboardOf( fixture, 'template-part', 'mobile' );
        const template = artboardOf( fixture, 'template' );
        await enterEdit( page, header.id );
        const paragraph = editorFrame( page, header.id ).locator( 'p', {
            hasText: 'Fixture header text',
        } );
        await paragraph.click();
        await page.keyboard.press( 'End' );
        await page.keyboard.type( ' EDITED LIVE' );
        await expect( paragraph ).toHaveText(
            'Fixture header text EDITED LIVE'
        );

        // Both are within one viewport of the Live artboard, so they are Previews.
        for ( const other of [ template, mobile ] ) {
            const artboard = page.locator(
                `[data-wfd-artboard="${ other.id }"]`
            );
            await expect( artboard ).toHaveAttribute(
                'data-wfd-tier',
                'preview'
            );
            await expect(
                artboard.frameLocator( 'iframe' ).locator( 'p', {
                    hasText: 'Fixture header text EDITED LIVE',
                } )
            ).toBeAttached();
        }
        // Nothing was saved.
        const saved = await requestUtils.rest< { content: { raw: string } } >( {
            path: `/wp/v2/template-parts/${ fixture.theme }//header`,
            params: { context: 'edit' },
        } );
        expect( saved.content.raw ).not.toContain( 'EDITED LIVE' );
    } );

    test( 'AC-DATA-02 The saved board layout contains no block markup', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        // Render previews so heights are measured, then change the layout.
        await setViewport( page, { x: 40, y: 40, zoom: 0.25 } );
        await expect(
            page.locator( '[data-wfd-artboard] iframe' ).first()
        ).toBeAttached();
        await page
            .locator( '[data-wfd-artboard] .wfd-artboard__frame' )
            .first()
            .click();
        await page.locator( '[data-wfd-region="canvas"]' ).focus();
        await page.keyboard.press( 'ArrowRight' );
        await page.waitForTimeout( 3000 );

        const raw = await requestUtils.rest< {
            layout: { version: number; artboards: Record< string, unknown >[] };
        } >( {
            path: `/wp/v2/wfd-boards/${ fixture.boardId }`,
            params: { context: 'edit' },
        } );
        const json = JSON.stringify( raw.layout );
        expect( json ).not.toContain( '<!--' );
        expect( json ).not.toContain( 'wp:' );
        expect( json ).not.toMatch( /<[a-z]/i );
        expect( Object.keys( raw.layout ).sort() ).toEqual( [
            'artboards',
            'version',
        ] );
        expect( raw.layout.artboards ).toHaveLength( 9 );
        for ( const artboard of raw.layout.artboards ) {
            expect( Object.keys( artboard ).sort() ).toEqual( [
                'device',
                'entityId',
                'height',
                'id',
                'kind',
                'x',
                'y',
            ] );
        }
        // The stored post content is that same JSON and nothing else.
        const stored = await requestUtils.rest< { content: string } >( {
            method: 'POST',
            path: '/wfd-test/v1/board-content',
            data: { id: fixture.boardId },
        } );
        expect( JSON.parse( stored.content ) ).toEqual( raw.layout );
    } );
} );
