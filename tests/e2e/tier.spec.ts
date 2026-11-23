import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import {
    resetFixture,
    openBoard,
    setViewport,
    setZoom,
    tiersOf,
    counters,
    viewportOf,
    enterEdit,
    editorFrame,
    artboardOf,
} from './utils';

const WIDTH = { desktop: 1440, tablet: 780, mobile: 360 } as const;

test.describe( 'TIER', () => {
    test( 'AC-TIER-03 On a board of 30 artboards at 25% zoom at most 12 are previews and the rest in view are snapshots', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils, { extra: 21 } );
        expect( fixture.layout.artboards ).toHaveLength( 30 );
        await openBoard( page, fixture.boardId, 30 );
        // Show the dense grid of extra artboards.
        await setViewport( page, { x: -1560, y: 20, zoom: 0.25 } );
        const canvas = ( await page
            .locator( '[data-wfd-region="canvas"]' )
            .boundingBox() )!;
        await expect
            .poll(
                async () =>
                    Object.values( await tiersOf( page ) ).filter(
                        ( tier ) => tier === 'preview'
                    ).length
            )
            .toBe( 12 );
        const tiers = await tiersOf( page );
        let inView = 0;
        for ( const artboard of fixture.layout.artboards ) {
            const box = ( await page
                .locator(
                    `[data-wfd-artboard="${ artboard.id }"] .wfd-artboard__frame`
                )
                .boundingBox() )!;
            const visible =
                box.x < canvas.x + canvas.width &&
                box.x + box.width > canvas.x &&
                box.y < canvas.y + canvas.height &&
                box.y + box.height > canvas.y;
            if ( visible ) {
                inView++;
                expect( [ 'preview', 'snapshot' ] ).toContain(
                    tiers[ artboard.id ]
                );
            }
        }
        expect( inView ).toBeGreaterThan( 12 );
        // Only previews hold a running document, apart from the one
        // snapshot at a time that is rendered to make its frozen copy.
        expect(
            await page
                .locator( '[data-wfd-tier="snapshot"] iframe:not([sandbox])' )
                .count()
        ).toBeLessThanOrEqual( 1 );
        await expect
            .poll( () =>
                page.locator( '[data-wfd-tier="preview"] iframe' ).count()
            )
            .toBe( 12 );
    } );

    test( 'AC-TIER-04 An artboard more than one viewport outside the visible area is a ghost with no iframe', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        // Look at the top-left artboard at 100%: the far column is more than
        // one viewport away.
        await setViewport( page, { x: 20, y: 20, zoom: 1 } );
        const view = await viewportOf( page );
        const size = ( await page
            .locator( '[data-wfd-region="canvas"]' )
            .boundingBox() )!;
        const visible = {
            x: -view.x / view.zoom,
            y: -view.y / view.zoom,
            width: size.width / view.zoom,
            height: size.height / view.zoom,
        };
        const tiers = await tiersOf( page );
        let ghosts = 0;
        for ( const artboard of fixture.layout.artboards ) {
            const element = page.locator(
                `[data-wfd-artboard="${ artboard.id }"]`
            );
            const height = await element
                .locator( '.wfd-artboard__frame' )
                .evaluate( ( el: HTMLElement ) =>
                    parseFloat( el.style.height )
                );
            const outside =
                artboard.x > visible.x + visible.width * 2 ||
                artboard.x + WIDTH[ artboard.device ] <
                    visible.x - visible.width ||
                artboard.y > visible.y + visible.height * 2 ||
                artboard.y + height < visible.y - visible.height;
            if ( outside ) {
                ghosts++;
                expect( tiers[ artboard.id ] ).toBe( 'ghost' );
                await expect( element.locator( 'iframe' ) ).toHaveCount( 0 );
                await expect(
                    element.locator( '.wfd-artboard__frame > *' )
                ).toHaveCount( 0 );
            } else {
                expect( tiers[ artboard.id ] ).not.toBe( 'ghost' );
            }
        }
        expect( ghosts ).toBeGreaterThan( 0 );
    } );

    test( 'AC-TIER-05 Previews mount nearest-to-centre first', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils, { extra: 21 } );
        await openBoard( page, fixture.boardId, 30 );
        // Start below the Snapshot threshold so nothing is mounted.
        await setViewport( page, { x: 0, y: 0, zoom: 0.1 } );
        await page.evaluate( () => {
            ( window as any ).wfdTest.counters.mountOrder.length = 0;
        } );
        const target = { x: -1560, y: 20, zoom: 0.25 };
        await setViewport( page, target );
        await expect
            .poll( async () => ( await counters( page ) ).mountOrder.length )
            .toBe( 12 );
        const order: string[] = ( await counters( page ) ).mountOrder;
        const size = ( await page
            .locator( '[data-wfd-region="canvas"]' )
            .boundingBox() )!;
        const centre = {
            x: ( size.width / 2 - target.x ) / target.zoom,
            y: ( size.height / 2 - target.y ) / target.zoom,
        };
        const distance = ( id: string ) => {
            const a = fixture.layout.artboards.find(
                ( item ) => item.id === id
            )!;
            const dx = Math.max(
                a.x - centre.x,
                0,
                centre.x - ( a.x + WIDTH[ a.device ] )
            );
            const dy = Math.max(
                a.y - centre.y,
                0,
                centre.y - ( a.y + a.height )
            );
            return Math.hypot( dx, dy );
        };
        const distances = order.map( distance );
        for ( let i = 1; i < distances.length; i++ ) {
            expect( distances[ i ] ).toBeGreaterThanOrEqual(
                distances[ i - 1 ]
            );
        }
    } );

    test( 'AC-TIER-01 At most one artboard is live at any time', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        // Record every tier change for the whole test.
        await page.evaluate( () => {
            ( window as any ).maxLive = 0;
            const count = () => {
                const live = document.querySelectorAll(
                    '[data-wfd-tier="live"]'
                ).length;
                ( window as any ).maxLive = Math.max(
                    ( window as any ).maxLive,
                    live
                );
            };
            new MutationObserver( count ).observe( document.body, {
                subtree: true,
                attributes: true,
                attributeFilter: [ 'data-wfd-tier' ],
            } );
        } );
        const ids = [
            artboardOf( fixture, 'template-part' ).id,
            artboardOf( fixture, 'pattern' ).id,
            artboardOf( fixture, 'template' ).id,
        ];
        for ( const id of ids ) {
            await page.locator( '[data-wfd-control="H8"]' ).click();
            await page.getByRole( 'menuitem', { name: 'Fit all' } ).click();
            await enterEdit( page, id );
            await expect(
                page.locator( '[data-wfd-tier="live"]' )
            ).toHaveCount( 1 );
        }
        expect( await page.evaluate( () => ( window as any ).maxLive ) ).toBe(
            1
        );
    } );

    test( 'AC-TIER-02 Only the Live artboard fills the header toolbar, list view and Block tab', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        const header = artboardOf( fixture, 'template-part' );
        const hero = artboardOf( fixture, 'pattern' );
        const tree = page
            .locator( '[data-wfd-region="left"]' )
            .getByRole( 'treegrid' );
        const inspector = page.locator(
            '[data-wfd-region="right"] .block-editor-block-inspector'
        );

        await enterEdit( page, header.id );
        await editorFrame( page, header.id )
            .locator( 'p', { hasText: 'Fixture header text' } )
            .click();
        await expect( tree.getByRole( 'row' ) ).toHaveCount( 2 );
        await expect( tree ).toContainText( 'Group' );
        await expect(
            page.locator( '.block-editor-block-toolbar' )
        ).toHaveCount( 1 );
        await expect(
            inspector.locator( '.block-editor-block-card__title' )
        ).toContainText( 'Paragraph' );

        // Hero becomes Live; Header stays mounted but fills nothing.
        await page.locator( '[data-wfd-control="H8"]' ).click();
        await page.getByRole( 'menuitem', { name: 'Fit all' } ).click();
        await enterEdit( page, hero.id );
        await expect(
            page.locator( `[data-wfd-artboard="${ header.id }"]` )
        ).toHaveAttribute( 'data-wfd-tier', 'warm' );
        await expect(
            page.locator( '[data-wfd-region="left"] [role="treegrid"]' )
        ).toHaveCount( 1 );
        await expect( tree.getByRole( 'row' ) ).toHaveCount( 2 );
        await expect( tree ).toContainText( 'Paragraph' );
        await expect( tree ).not.toContainText( 'Group' );
        await expect(
            page.locator( '.block-editor-block-toolbar' )
        ).toHaveCount( 0 );
        await expect( inspector ).toHaveCount( 0 );
        await editorFrame( page, hero.id ).locator( 'h2' ).click();
        await expect(
            page.locator( '.block-editor-block-toolbar' )
        ).toHaveCount( 1 );
        await expect(
            page.locator( '.block-editor-block-inspector' )
        ).toHaveCount( 1 );
        await expect(
            inspector.locator( '.block-editor-block-card__title' )
        ).toContainText( 'Heading' );
    } );

    test( 'AC-TIER-07 Double-clicking an artboard below 30% zoom ends Live with the zoom set so its width fits the canvas area, its top-left at the top-left; at 30% or more it enters edit without changing zoom or pan', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        const hero = artboardOf( fixture, 'pattern' );
        const artboard = page.locator( `[data-wfd-artboard="${ hero.id }"]` );
        const frame = artboard.locator( '.wfd-artboard__frame' );
        const canvas = ( await page
            .locator( '[data-wfd-region="canvas"]' )
            .boundingBox() )!;

        // From below 30%: fitted to the canvas area's width.
        await setViewport( page, {
            x: 30 - hero.x * 0.2,
            y: 60 - hero.y * 0.2,
            zoom: 0.2,
        } );
        await enterEdit( page, hero.id );
        const fitted = await viewportOf( page );
        expect( fitted.zoom ).toBeGreaterThanOrEqual( 0.3 );
        expect( fitted.zoom ).toBeLessThanOrEqual( 1 );
        const box = ( await frame.boundingBox() )!;
        // A Desktop artboard is wider than the canvas area here, so it fills
        // the width, with room for its label above it.
        expect( box.x - canvas.x ).toBeGreaterThanOrEqual( 0 );
        expect( box.x - canvas.x ).toBeLessThanOrEqual( 48 );
        expect( box.y - canvas.y ).toBeGreaterThanOrEqual( 0 );
        expect( box.y - canvas.y ).toBeLessThanOrEqual( 48 );
        expect( box.x + box.width ).toBeLessThanOrEqual(
            canvas.x + canvas.width
        );
        expect( box.x + box.width ).toBeGreaterThan(
            canvas.x + canvas.width - 48
        );
        expect( box.width ).toBeCloseTo( 1440 * fitted.zoom, 0 );

        // From 30% or more: nothing moves.
        await page.getByRole( 'button', { name: 'Back to the board' } ).click();
        for ( const zoom of [ 0.3, 0.4, 1 ] ) {
            const view = { x: 50 - hero.x * zoom, y: 70 - hero.y * zoom, zoom };
            await setViewport( page, view );
            await enterEdit( page, hero.id );
            await expect( artboard ).toHaveAttribute( 'data-wfd-tier', 'live' );
            const now = await viewportOf( page );
            expect( now.zoom ).toBe( zoom );
            expect( now.x ).toBeCloseTo( view.x, 3 );
            expect( now.y ).toBeCloseTo( view.y, 3 );
            await page
                .getByRole( 'button', { name: 'Back to the board' } )
                .click();
        }
    } );

    test( 'AC-TIER-08 Zooming while an artboard is Live keeps it in edit at 30% or more; settling below 30% leaves edit and keeps it selected; panning does not leave edit', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        const hero = artboardOf( fixture, 'pattern' );
        const artboard = page.locator( `[data-wfd-artboard="${ hero.id }"]` );
        const canvas = page.locator( '[data-wfd-region="canvas"]' );
        const box = ( await canvas.boundingBox() )!;
        const isLive = () =>
            expect( artboard ).toHaveAttribute( 'data-wfd-tier', 'live' );

        await setViewport( page, {
            x: 50 - hero.x * 0.6,
            y: 70 - hero.y * 0.6,
            zoom: 0.6,
        } );
        await enterEdit( page, hero.id );
        // Panning keeps it Live.
        await page.mouse.move(
            box.x + box.width - 30,
            box.y + box.height - 30
        );
        await page.mouse.wheel( 30, 20 );
        await page.waitForTimeout( 400 );
        await isLive();

        // So does zooming, by wheel, menu, shortcut, in or out.
        await page.keyboard.down( 'Control' );
        await page.mouse.wheel( 0, 40 );
        await page.keyboard.up( 'Control' );
        await page.waitForTimeout( 400 );
        expect( ( await viewportOf( page ) ).zoom ).toBeLessThan( 0.6 );
        await isLive();
        await page.locator( '[data-wfd-control="H8"]' ).click();
        await page.getByRole( 'menuitem', { name: 'Zoom in' } ).click();
        await page.waitForTimeout( 300 );
        await isLive();
        await page.locator( '[data-wfd-control="H8"]' ).click();
        await page.getByRole( 'menuitem', { name: 'Zoom to 100%' } ).click();
        await page.waitForTimeout( 300 );
        expect( ( await viewportOf( page ) ).zoom ).toBe( 1 );
        await isLive();
        await setZoom( page, 1.5 );
        await page.waitForTimeout( 300 );
        await isLive();
        await setZoom( page, 0.3 );
        await page.waitForTimeout( 300 );
        await isLive();
        // The editor is still the same one: what was typed is there.
        await expect( page.locator( '[data-wfd-control="H7"]' ) ).toHaveText(
            'Hero · Pattern'
        );

        // Below 30% edit ends and the artboard stays selected.
        await setZoom( page, 0.29 );
        await expect( artboard ).not.toHaveAttribute( 'data-wfd-tier', 'live' );
        await expect( page.locator( '[data-wfd-tier="live"]' ) ).toHaveCount(
            0
        );
        await expect( artboard ).toHaveClass( /is-selected/ );
        await expect( page.locator( '[data-wfd-control="H7"]' ) ).toHaveText(
            'Fixture board'
        );
        // Zooming back in does not start edit again.
        await setZoom( page, 0.6 );
        await page.waitForTimeout( 300 );
        await expect( page.locator( '[data-wfd-tier="live"]' ) ).toHaveCount(
            0
        );
    } );

    test( 'AC-TIER-09 After editing A, B, C, D in turn, D is live, C and B are warm, A is not', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        const [ a, b, c, d ] = [
            artboardOf( fixture, 'template-part' ),
            artboardOf( fixture, 'pattern', 'desktop', 0 ),
            artboardOf( fixture, 'pattern', 'desktop', 1 ),
            artboardOf( fixture, 'template-part', 'desktop', 1 ),
        ];
        for ( const artboard of [ a, b, c, d ] ) {
            await page.locator( '[data-wfd-control="H8"]' ).click();
            await page.getByRole( 'menuitem', { name: 'Fit all' } ).click();
            await enterEdit( page, artboard.id );
        }
        const tiers = await tiersOf( page );
        expect( tiers[ d.id ] ).toBe( 'live' );
        expect( tiers[ c.id ] ).toBe( 'warm' );
        expect( tiers[ b.id ] ).toBe( 'warm' );
        expect( [ 'live', 'warm' ] ).not.toContain( tiers[ a.id ] );
        // Warm editors stay mounted.
        await expect(
            page.locator(
                `[data-wfd-artboard="${ c.id }"] iframe[name="editor-canvas"]`
            )
        ).toBeAttached();
        await expect(
            page.locator(
                `[data-wfd-artboard="${ a.id }"] iframe[name="editor-canvas"]`
            )
        ).toHaveCount( 0 );
    } );

    test( 'AC-TIER-06 Below 20% zoom every non-Ghost artboard is a snapshot; zooming back to 22% or more returns eligible ones to preview', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        const ids = fixture.layout.artboards.map( ( a ) => a.id );
        const all = async ( tier: string ) => {
            const tiers = await tiersOf( page );
            return ids.every( ( id ) => tiers[ id ] === tier );
        };
        await setViewport( page, { x: 40, y: 40, zoom: 0.25 } );
        await expect.poll( () => all( 'preview' ) ).toBe( true );
        await expect
            .poll( () =>
                page.locator( '[data-wfd-tier="preview"] iframe' ).count()
            )
            .toBe( 9 );

        // Going down, the change is at 20%.
        await setZoom( page, 0.2 );
        expect( await all( 'preview' ) ).toBe( true );
        await setZoom( page, 0.19 );
        await expect.poll( () => all( 'snapshot' ) ).toBe( true );
        // Each shows the frozen copy of its last Preview.
        await expect(
            page.locator( '.wfd-snapshot__copy iframe' )
        ).toHaveCount( 9 );
        await expect( page.locator( '.wfd-artboard__skeleton' ) ).toHaveCount(
            0
        );

        // Going up, 21% is still a snapshot; 22% is a preview again.
        await setZoom( page, 0.21 );
        expect( await all( 'snapshot' ) ).toBe( true );
        await setZoom( page, 0.22 );
        await expect.poll( () => all( 'preview' ) ).toBe( true );
        await setZoom( page, 0.1 );
        await expect.poll( () => all( 'snapshot' ) ).toBe( true );
        await setZoom( page, 0.25 );
        await expect.poll( () => all( 'preview' ) ).toBe( true );
        await expect( page.locator( '.wfd-snapshot__copy' ) ).toHaveCount( 0 );
    } );

    test( "AC-TIER-10 A snapshot artboard's frame contains no React root and triggers no store subscription callbacks when an entity changes", async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        const header = artboardOf( fixture, 'template-part' );
        await setViewport( page, { x: 40, y: 40, zoom: 0.25 } );
        await expect
            .poll( () =>
                page.locator( '[data-wfd-tier="preview"] iframe' ).count()
            )
            .toBe( 9 );
        await page
            .locator( `[data-wfd-artboard="${ header.id }"]` )
            .frameLocator( 'iframe' )
            .locator( 'p', { hasText: 'Fixture header text' } )
            .waitFor();
        await setZoom( page, 0.15 );
        const frame = page.locator( `[data-wfd-artboard="${ header.id }"]` );
        await expect( frame ).toHaveAttribute( 'data-wfd-tier', 'snapshot' );
        await expect(
            frame.locator( '.wfd-snapshot__copy iframe' )
        ).toHaveCount( 1 );

        const inspect = () =>
            frame.locator( '.wfd-snapshot' ).evaluate( ( host ) => {
                const copy = host.querySelector( '.wfd-snapshot__copy' )!;
                const inner = copy.querySelector( 'iframe' )!;
                const nodes = [
                    copy,
                    ...copy.querySelectorAll( '*' ),
                    ...inner.contentDocument!.querySelectorAll( '*' ),
                ];
                return {
                    nodes: nodes.length,
                    reactNodes: nodes.filter( ( node ) =>
                        Object.keys( node ).some( ( key ) =>
                            key.startsWith( '__react' )
                        )
                    ).length,
                    scripts:
                        inner.contentDocument!.querySelectorAll( 'script' )
                            .length,
                    sandbox: inner.getAttribute( 'sandbox' ),
                    text: inner.contentDocument!.body.textContent,
                };
            } );
        const before = await inspect();
        expect( before.nodes ).toBeGreaterThan( 5 );
        expect( before.reactNodes ).toBe( 0 );
        expect( before.scripts ).toBe( 0 );
        expect( before.sandbox ).toBe( 'allow-same-origin' );
        expect( before.text ).toContain( 'Fixture header text' );

        // Watch the frozen copy, then change its entity.
        await frame.locator( '.wfd-snapshot' ).evaluate( ( host ) => {
            const copy = host.querySelector( '.wfd-snapshot__copy' )!;
            const inner = copy.querySelector( 'iframe' )!;
            ( window as any ).snapshotMutations = 0;
            const count = () => ( window as any ).snapshotMutations++;
            const options = {
                subtree: true,
                childList: true,
                attributes: true,
                characterData: true,
            };
            new MutationObserver( count ).observe( copy, options );
            new MutationObserver( count ).observe(
                inner.contentDocument!,
                options
            );
        } );
        await page.evaluate( ( id ) => {
            ( window as any ).wp.data
                .dispatch( 'core' )
                .editEntityRecord( 'postType', 'wp_template_part', id, {
                    blocks: undefined,
                    content:
                        '<!-- wp:paragraph --><p>Changed while frozen</p><!-- /wp:paragraph -->',
                } );
        }, `${ fixture.theme }//header` );
        await expect( page.locator( '[data-wfd-control="H9"]' ) ).toHaveText(
            'Review 1 change'
        );
        await page.waitForTimeout( 500 );
        expect(
            await page.evaluate( () => ( window as any ).snapshotMutations )
        ).toBe( 0 );
        const after = await inspect();
        expect( after.text ).toContain( 'Fixture header text' );
        expect( after.text ).not.toContain( 'Changed while frozen' );
        expect( after.reactNodes ).toBe( 0 );
        // It is marked stale, and shows the change once it is a Preview again.
        await expect( frame ).toHaveAttribute( 'data-wfd-stale', 'true' );
        await setZoom( page, 0.25 );
        // The frozen copy lies over the Preview until that has settled.
        await expect( frame.locator( 'iframe' ) ).toHaveCount( 1 );
        await expect(
            frame
                .frameLocator( 'iframe' )
                .locator( 'p', { hasText: 'Changed while frozen' } )
        ).toBeAttached();
    } );

    test( 'AC-TIER-11 After a global style change, an artboard that is a snapshot shows the new style without becoming a preview', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        const hero = artboardOf( fixture, 'pattern' );
        const frame = page.locator( `[data-wfd-artboard="${ hero.id }"]` );
        const background = ( selector: string ) =>
            frame
                .locator( selector )
                .first()
                .evaluate( ( el: HTMLIFrameElement ) => {
                    const paragraph = el.contentDocument!.querySelector(
                        '.has-accent-1-background-color'
                    )!;
                    return el.contentWindow!.getComputedStyle( paragraph )
                        .backgroundColor;
                } );
        await setViewport( page, { x: -300, y: -120, zoom: 0.25 } );
        await expect
            .poll( () => background( 'iframe' ) )
            .toBe( 'rgb(255, 238, 88)' );
        await setZoom( page, 0.15 );
        await expect( frame ).toHaveAttribute( 'data-wfd-tier', 'snapshot' );
        await expect(
            frame.locator( '.wfd-snapshot__copy iframe' )
        ).toHaveCount( 1 );

        // Watch the artboard: its tier, and whether it is ever left without
        // a frozen copy.
        await page.evaluate( ( id ) => {
            const element = document.querySelector(
                `[data-wfd-artboard="${ id }"]`
            )!;
            const seen = { tiers: [] as string[], withoutCopy: 0 };
            const note = () => {
                const tier = element.getAttribute( 'data-wfd-tier' )!;
                if ( ! seen.tiers.includes( tier ) ) {
                    seen.tiers.push( tier );
                }
                if ( ! element.querySelector( '.wfd-snapshot__copy iframe' ) ) {
                    seen.withoutCopy++;
                }
            };
            note();
            new MutationObserver( note ).observe( element, {
                attributes: true,
                childList: true,
                subtree: true,
            } );
            ( window as any ).wfdSeen = seen;
        }, hero.id );

        // Change the Accent 1 colour while the artboard is a snapshot.
        await page.evaluate( () => {
            const { select, dispatch } = ( window as any ).wp.data;
            const core = select( 'core' );
            const id = core.__experimentalGetCurrentGlobalStylesId();
            const base = core.__experimentalGetCurrentThemeBaseGlobalStyles();
            const palette = base.settings.color.palette.theme.map(
                ( color: any ) =>
                    color.slug === 'accent-1'
                        ? { ...color, color: '#0a0b0c' }
                        : color
            );
            dispatch( 'core' ).editEntityRecord( 'root', 'globalStyles', id, {
                settings: { color: { palette: { theme: palette } } },
            } );
        } );
        await expect( page.locator( '[data-wfd-control="H9"]' ) ).toHaveText(
            'Review 1 change'
        );
        // Its frozen copy is renewed in place (D51).
        await expect
            .poll(
                () =>
                    frame
                        .locator( '.wfd-snapshot__copy iframe' )
                        .first()
                        .evaluate( ( el: HTMLIFrameElement ) => {
                            const paragraph = el.contentDocument?.querySelector(
                                '.has-accent-1-background-color'
                            );
                            return paragraph
                                ? el.contentWindow!.getComputedStyle(
                                      paragraph
                                  ).backgroundColor
                                : null;
                        } )
                        .catch( () => null ),
                { timeout: 30000 }
            )
            .toBe( 'rgb(10, 11, 12)' );
        await expect( frame ).toHaveAttribute( 'data-wfd-tier', 'snapshot' );
        await expect( frame ).not.toHaveAttribute( 'data-wfd-stale', 'true' );
        await expect(
            frame.locator( '.wfd-snapshot__copy iframe' )
        ).toHaveCount( 1 );
        expect(
            await page.evaluate( () => ( window as any ).wfdSeen )
        ).toEqual( { tiers: [ 'snapshot' ], withoutCopy: 0 } );
    } );

    test( 'AC-TIER-12 Below 20% zoom an artboard that was never rendered gets its frozen copy without becoming a preview', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils, { extra: 21 } );
        await openBoard( page, fixture.boardId, 30 );
        // Before most artboards were ever a Preview.
        await setViewport( page, { x: 20, y: 20, zoom: 0.1 } );
        const tiers = await tiersOf( page );
        const frozen = Object.keys( tiers ).filter(
            ( id ) => tiers[ id ] === 'snapshot'
        );
        expect( frozen.length ).toBeGreaterThan( 12 );
        expect( Object.values( tiers ) ).not.toContain( 'preview' );
        await expect
            .poll(
                () =>
                    page
                        .locator(
                            '[data-wfd-tier="snapshot"] .wfd-snapshot__copy iframe'
                        )
                        .count(),
                { timeout: 60000 }
            )
            .toBe( frozen.length );
        await expect( page.locator( '.wfd-artboard__skeleton' ) ).toHaveCount(
            0
        );
        expect( Object.values( await tiersOf( page ) ) ).not.toContain(
            'preview'
        );
        const header = artboardOf( fixture, 'template-part' );
        await expect(
            page
                .locator( `[data-wfd-artboard="${ header.id }"]` )
                .frameLocator( '.wfd-snapshot__copy iframe' )
                .locator( 'p', { hasText: 'Fixture header text' } )
        ).toBeAttached();
    } );

    test( 'AC-TIER-13 An artboard whose content is taller than 2000 px shows all of it as a Preview and as a Snapshot, at the height it has in edit', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await requestUtils.rest( {
            method: 'POST',
            path: `/wp/v2/blocks/${ fixture.patterns.hero }`,
            data: {
                content:
                    '<!-- wp:group {"style":{"dimensions":{"minHeight":"3000px"}},"layout":{"type":"constrained"}} -->' +
                    '<div class="wp-block-group" style="min-height:3000px"><!-- wp:paragraph --><p>Tall.</p><!-- /wp:paragraph --></div>' +
                    '<!-- /wp:group -->' +
                    '<!-- wp:paragraph --><p>Bottom line.</p><!-- /wp:paragraph -->',
            },
        } );
        await openBoard( page, fixture.boardId );
        const hero = fixture.layout.artboards.find(
            ( a ) => a.entityId === fixture.patterns.hero
        )!;
        const artboard = page.locator( `[data-wfd-artboard="${ hero.id }"]` );
        const show = ( zoom: number ) =>
            setViewport( page, {
                x: 40 - hero.x * zoom,
                y: 100 - hero.y * zoom,
                zoom,
            } );
        const frameHeight = () =>
            artboard
                .locator( '.wfd-artboard__frame' )
                .evaluate( ( element: HTMLElement ) =>
                    parseFloat( element.style.height )
                );
        // How far the last block's bottom edge is from the bottom of the
        // iframe that shows it, in content pixels.
        const cutOff = ( selector: string ) =>
            artboard
                .locator( selector )
                .evaluate( ( element: HTMLIFrameElement ) => {
                    const lines = Array.from(
                        element.contentDocument!.querySelectorAll( 'p' )
                    ).filter( ( p ) => p.textContent === 'Bottom line.' );
                    return lines.length
                        ? lines[ 0 ].getBoundingClientRect().bottom -
                              element.clientHeight
                        : Infinity;
                } );

        await show( 0.5 );
        await expect( artboard ).toHaveAttribute( 'data-wfd-tier', 'preview' );
        await expect.poll( frameHeight ).toBeGreaterThan( 3000 );
        const height = await frameHeight();
        expect( await cutOff( '.wfd-preview iframe' ) ).toBeLessThanOrEqual(
            0
        );

        await show( 0.15 );
        await expect( artboard ).toHaveAttribute( 'data-wfd-tier', 'snapshot' );
        await expect
            .poll( () => cutOff( '.wfd-snapshot__copy iframe' ) )
            .toBeLessThanOrEqual( 0 );
        expect( await frameHeight() ).toBe( height );

        await show( 0.5 );
        await enterEdit( page, hero.id );
        await expect(
            artboard.locator( 'iframe[name="editor-canvas"]' )
        ).toBeVisible();
        await page.waitForTimeout( 1000 );
        expect( Math.abs( ( await frameHeight() ) - height ) ).toBeLessThan(
            2
        );
    } );
} );
