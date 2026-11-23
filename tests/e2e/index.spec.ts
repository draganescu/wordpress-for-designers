import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import type { Page } from '@playwright/test';
import {
    resetFixture,
    openBoard,
    setViewport,
    enterEdit,
    artboardOf,
    tiersOf,
    counters,
    type Fixture,
} from './utils';

const right = ( page: Page ) => page.locator( '[data-wfd-region="right"]' );
const row = ( page: Page, name: string ) =>
    right( page ).locator( '.wfd-row', {
        has: page.locator( '.wfd-row__name', {
            hasText: new RegExp( `^${ name }$` ),
        } ),
    } );
const usesOf = async ( page: Page, name: string ) =>
    Number(
        await row( page, name ).locator( '.wfd-styles__uses' ).innerText()
    );

/**
 * References to a colour token in the theme's merged global styles.
 * @param page
 * @param slug
 */
const globalRefs = async ( page: Page, slug: string ) =>
    page.evaluate( ( token ) => {
        const { select } = ( window as any ).wp.data;
        const core = select( 'core' );
        const base = core.__experimentalGetCurrentThemeBaseGlobalStyles();
        const id = core.__experimentalGetCurrentGlobalStylesId();
        const user = core.getEditedEntityRecord( 'root', 'globalStyles', id );
        const merge = ( a: any, b: any ): any => {
            if ( b === undefined ) {
                return a;
            }
            if (
                typeof a !== 'object' ||
                typeof b !== 'object' ||
                ! a ||
                ! b ||
                Array.isArray( b )
            ) {
                return b;
            }
            const out: any = { ...a };
            for ( const key of Object.keys( b ) ) {
                out[ key ] = merge( a[ key ], b[ key ] );
            }
            return out;
        };
        const styles = merge( base.styles ?? {}, user.styles ?? {} );
        let count = 0;
        const walk = ( value: any ) => {
            if ( typeof value === 'string' ) {
                const pattern = new RegExp(
                    `var:preset\\|color\\|${ token }(?![a-z0-9-])|var\\(\\s*--wp--preset--color--${ token }\\s*\\)`,
                    'g'
                );
                count += ( value.match( pattern ) || [] ).length;
            } else if ( value && typeof value === 'object' ) {
                Object.values( value ).forEach( walk );
            }
        };
        walk( styles );
        return count;
    }, slug );

test.describe( 'INDEX', () => {
    let fixture: Fixture;
    test.beforeEach( async ( { page, requestUtils } ) => {
        fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        await expect( row( page, 'Accent 1' ) ).toBeVisible();
    } );

    test( "AC-INDEX-01 Each token row shows a use count equal to the referencing blocks across the board's entities plus global styles references", async ( {
        page,
    } ) => {
        // The fixture: About, Become a member and Hero each hold one paragraph
        // with the Accent 1 background and the Contrast text colour.
        const accent = await globalRefs( page, 'accent-1' );
        const contrast = await globalRefs( page, 'contrast' );
        await expect
            .poll( () => usesOf( page, 'Accent 1' ) )
            .toBe( 3 + accent );
        await expect
            .poll( () => usesOf( page, 'Contrast' ) )
            .toBe( 3 + contrast );
        // A token no block uses counts global styles references only.
        const accent5 = await globalRefs( page, 'accent-5' );
        await expect.poll( () => usesOf( page, 'Accent 5' ) ).toBe( accent5 );
        // The theme's styles do reference its own palette.
        expect( contrast ).toBeGreaterThan( 0 );
        // Header on Desktop and on Mobile show one entity: it is counted once.
        const base = await usesOf( page, 'Base' );
        expect( base ).toBe( await globalRefs( page, 'base' ) );
    } );

    test( 'AC-INDEX-02 Selecting a token shows the banner with correct counts, adds the count to labels, and outlines the referencing blocks on Previews', async ( {
        page,
    } ) => {
        const hero = artboardOf( fixture, 'pattern' );
        const about = artboardOf( fixture, 'page', 'desktop', 0 );
        const member = artboardOf( fixture, 'page', 'desktop', 1 );
        const header = artboardOf( fixture, 'template-part' );
        await setViewport( page, { x: -300, y: -120, zoom: 0.25 } );
        // The frozen copy lies over the Preview until that has settled.
        await expect(
            page.locator(
                `[data-wfd-artboard="${ hero.id }"] iframe:not([sandbox])`
            )
        ).toBeAttached();
        await expect(
            page.locator( `[data-wfd-artboard="${ hero.id }"] iframe` )
        ).toHaveCount( 1 );

        await row( page, 'Accent 1' ).click();
        await page.keyboard.press( 'Escape' );
        await expect( row( page, 'Accent 1' ) ).toHaveAttribute(
            'aria-current',
            'true'
        );
        const banner = page.locator( '[data-wfd-banner="usage"]' );
        await expect( banner ).toContainText(
            'Showing where Accent 1 is used: 3 places on 3 artboards'
        );
        await expect(
            banner.locator( '.component-color-indicator' )
        ).toBeVisible();

        for ( const artboard of [ hero, about, member ] ) {
            await expect(
                page.locator(
                    `[data-wfd-artboard="${ artboard.id }"] .wfd-artboard__label`
                )
            ).toContainText( '· 1 use' );
        }
        await expect(
            page.locator(
                `[data-wfd-artboard="${ hero.id }"] .wfd-artboard__label`
            )
        ).toHaveText( 'Hero · Pattern · 1 use' );
        await expect(
            page.locator(
                `[data-wfd-artboard="${ header.id }"] .wfd-artboard__label`
            )
        ).toHaveText( 'Header · Template part · Desktop' );

        // The referencing block is outlined in the Preview; others are not.
        const outline = ( selector: string ) =>
            page
                .locator( `[data-wfd-artboard="${ hero.id }"] iframe` )
                .first()
                .evaluate( ( frame: HTMLIFrameElement, sel ) => {
                    const el = frame.contentDocument!.querySelector( sel )!;
                    const style = frame.contentWindow!.getComputedStyle( el );
                    return `${ style.outlineStyle } ${ style.outlineWidth } ${ style.outlineOffset }`;
                }, selector );
        await expect
            .poll( () => outline( 'p.has-accent-1-background-color' ) )
            .toBe( 'solid 2px 2px' );
        expect( await outline( 'h2' ) ).not.toContain( 'solid' );

        // Clicking the selected row again clears the selection.
        await row( page, 'Accent 1' ).click();
        await expect( banner ).toHaveCount( 0 );
        await expect(
            page.locator(
                `[data-wfd-artboard="${ hero.id }"] .wfd-artboard__label`
            )
        ).toHaveText( 'Hero · Pattern · Desktop' );
        await expect
            .poll( () => outline( 'p.has-accent-1-background-color' ) )
            .not.toContain( 'solid' );
    } );

    test( 'AC-INDEX-03 Counts are correct for an artboard whose tier is ghost', async ( {
        page,
    } ) => {
        const member = artboardOf( fixture, 'page', 'desktop', 1 );
        const accent = await globalRefs( page, 'accent-1' );
        // Look at the top-left corner at 100%: the pages are far away.
        await setViewport( page, { x: 20, y: 20, zoom: 1 } );
        await expect
            .poll( async () => ( await tiersOf( page ) )[ member.id ] )
            .toBe( 'ghost' );
        await expect(
            page.locator( `[data-wfd-artboard="${ member.id }"] iframe` )
        ).toHaveCount( 0 );
        expect( await usesOf( page, 'Accent 1' ) ).toBe( 3 + accent );

        await row( page, 'Accent 1' ).click();
        await page.keyboard.press( 'Escape' );
        await expect(
            page.locator( '[data-wfd-banner="usage"]' )
        ).toContainText( '3 places on 3 artboards' );
        await expect(
            page.locator(
                `[data-wfd-artboard="${ member.id }"] .wfd-artboard__label`
            )
        ).toContainText( '· 1 use' );
        await expect(
            page.locator( `[data-wfd-artboard="${ member.id }"]` )
        ).toHaveAttribute( 'data-wfd-tier', 'ghost' );
    } );

    test( "AC-INDEX-04 Editing a block's colour in one artboard updates the counts without any other entity being re-parsed", async ( {
        page,
    } ) => {
        const hero = artboardOf( fixture, 'pattern' );
        const accent1 = await usesOf( page, 'Accent 1' );
        const accent2 = await usesOf( page, 'Accent 2' );
        await enterEdit( page, hero.id );
        await page.waitForTimeout( 500 );
        await page.evaluate( () => {
            ( window as any ).wfdTest.counters.parsedEntities.length = 0;
        } );

        // Change the paragraph's background from Accent 1 to Accent 2.
        await page.evaluate( () => {
            const { registry } = ( window as any ).wfdTest.editorBridge.current;
            const store = registry.select( 'core/block-editor' );
            const id = store
                .getClientIdsWithDescendants()
                .find(
                    ( clientId: string ) =>
                        store.getBlockName( clientId ) === 'core/paragraph'
                );
            registry
                .dispatch( 'core/block-editor' )
                .updateBlockAttributes( id, { backgroundColor: 'accent-2' } );
        } );
        await page.getByRole( 'button', { name: 'Back to the board' } ).click();
        await page.locator( '[data-wfd-region="canvas"]' ).focus();
        await page.keyboard.press( 'Escape' );

        await expect
            .poll( () => usesOf( page, 'Accent 1' ) )
            .toBe( accent1 - 1 );
        await expect
            .poll( () => usesOf( page, 'Accent 2' ) )
            .toBe( accent2 + 1 );
        const parsed: string[] = ( await counters( page ) ).parsedEntities;
        expect( parsed.length ).toBeGreaterThan( 0 );
        expect( new Set( parsed ) ).toEqual(
            new Set( [ `pattern:${ fixture.patterns.hero }` ] )
        );
    } );
} );
