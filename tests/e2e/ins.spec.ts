import path from 'path';
import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import type { Page } from '@playwright/test';
import {
    resetFixture,
    openBoard,
    enterEdit,
    editorFrame,
    artboardOf,
    type Fixture,
} from './utils';

const openInserter = async ( page: Page, tab?: string ) => {
    await page
        .locator( '[data-wfd-region="header"]' )
        .getByRole( 'button', { name: 'Block inserter', exact: true } )
        .click();
    const panel = page.locator( '.wfd-inserter' );
    await expect( panel ).toBeVisible();
    if ( tab ) {
        await panel.getByRole( 'tab', { name: tab } ).click();
    }
    return panel;
};

const dropOnEmptyBoard = async (
    page: Page,
    row: ReturnType< Page[ 'locator' ] >
) => {
    const canvas = page.locator( '[data-wfd-region="canvas"]' );
    const box = ( await canvas.boundingBox() )!;
    const target = { x: box.width - 260, y: box.height - 180 };
    await row.scrollIntoViewIfNeeded();
    const start = ( await row.boundingBox() )!;
    await page.mouse.move( start.x + 30, start.y + start.height / 2 );
    await page.mouse.down();
    await page.mouse.move( start.x + 60, start.y + start.height / 2 + 6, {
        steps: 3,
    } );
    await page.mouse.move( box.x + target.x - 30, box.y + target.y - 20, {
        steps: 6,
    } );
    await page.mouse.move( box.x + target.x, box.y + target.y, { steps: 3 } );
    return { box, target };
};

const dragOntoBlock = async (
    page: Page,
    row: ReturnType< Page[ 'locator' ] >,
    block: ReturnType< ReturnType< Page[ 'frameLocator' ] >[ 'locator' ] >
) => {
    await row.scrollIntoViewIfNeeded();
    const start = ( await row.boundingBox() )!;
    const end = ( await block.boundingBox() )!;
    const x = end.x + end.width / 2;
    const y = end.y + end.height - 2;
    await page.mouse.move( start.x + 30, start.y + start.height / 2 );
    await page.mouse.down();
    await page.mouse.move( start.x + 60, start.y + start.height / 2 + 6, {
        steps: 3,
    } );
    await page.mouse.move( x - 20, y - 6, { steps: 6 } );
    await page.mouse.move( x, y, { steps: 4 } );
    // The editor's drop zone answers on a throttle.
    await page.waitForTimeout( 400 );
    await page.mouse.move( x + 1, y, { steps: 2 } );
    await page.mouse.up();
};

const overlapsAnother = ( page: Page, id: string ) =>
    page.evaluate( ( own ) => {
        const box = ( element: Element ) =>
            element
                .querySelector( '.wfd-artboard__frame' )!
                .getBoundingClientRect();
        const all = [ ...document.querySelectorAll( '[data-wfd-artboard]' ) ];
        const mine = box(
            all.find(
                ( element ) =>
                    element.getAttribute( 'data-wfd-artboard' ) === own
            )!
        );
        return all
            .filter(
                ( element ) =>
                    element.getAttribute( 'data-wfd-artboard' ) !== own
            )
            .map( box )
            .some(
                ( other ) =>
                    mine.left < other.right &&
                    other.left < mine.right &&
                    mine.top < other.bottom &&
                    other.top < mine.bottom
            );
    }, id );

test.describe( 'INS', () => {
    let fixture: Fixture;
    test.beforeEach( async ( { page, requestUtils } ) => {
        fixture = await resetFixture( requestUtils );
        await requestUtils.uploadMedia(
            path.join( __dirname, 'assets', 'wfd-sample.png' )
        );
        await openBoard( page, fixture.boardId );
    } );

    test( 'AC-INS-01 Blocks tab lists allowed blocks by category; clicking one inserts it at the insertion point of the artboard in edit', async ( {
        page,
    } ) => {
        const header = artboardOf( fixture, 'template-part' );
        await enterEdit( page, header.id );
        const frame = editorFrame( page, header.id );
        await frame.locator( 'p', { hasText: 'Fixture header text' } ).click();
        const panel = await openInserter( page, 'Blocks' );
        const blocks = panel.getByRole( 'tabpanel' );

        // One group per block category, each with its count.
        const groups = blocks.locator( 'section, [data-wfd-group]' );
        await expect
            .poll( async () =>
                ( await blocks.getByRole( 'heading' ).allInnerTexts() ).map(
                    ( h ) => h.toLowerCase()
                )
            )
            .toEqual( expect.arrayContaining( [ 'text', 'media', 'design' ] ) );
        await expect.poll( () => groups.count() ).toBeGreaterThan( 2 );
        const firstCount = Number(
            await blocks
                .locator( '.wfd-group-heading__suffix' )
                .first()
                .innerText()
        );
        expect( firstCount ).toBeGreaterThan( 0 );

        // Only blocks allowed at the insertion point: child-only blocks are not.
        await expect(
            blocks.getByRole( 'button', { name: 'Heading', exact: true } )
        ).toBeVisible();
        await expect(
            blocks.getByRole( 'button', { name: 'List item', exact: true } )
        ).toHaveCount( 0 );
        await expect(
            blocks.getByRole( 'button', { name: 'Column', exact: true } )
        ).toHaveCount( 0 );
        await expect( panel ).toContainText(
            'Click to insert at the cursor in Header.'
        );

        // Click inserts after the selected paragraph, inside the Group.
        await blocks
            .getByRole( 'button', { name: 'Heading', exact: true } )
            .click();
        const group = frame.locator( '.wp-block-group' ).first();
        await expect( group.locator( ':scope > *' ) ).toHaveCount( 2 );
        await expect( group.locator( ':scope > *' ).nth( 0 ) ).toHaveText(
            'Fixture header text'
        );
        await expect( group.locator( ':scope > *' ).nth( 1 ) ).toHaveAttribute(
            'data-type',
            'core/heading'
        );
    } );

    test( 'AC-INS-02 Patterns tab groups user patterns under "Yours" and others by source, each with the correct usage line', async ( {
        page,
        requestUtils,
    } ) => {
        // A user pattern that is not on the board, used in two templates.
        const loose = await requestUtils.rest< { id: number } >( {
            method: 'POST',
            path: '/wp/v2/blocks',
            data: {
                title: 'Loose',
                status: 'publish',
                content:
                    '<!-- wp:paragraph --><p>Loose</p><!-- /wp:paragraph -->',
            },
        } );
        const unused = await requestUtils.rest< { id: number } >( {
            method: 'POST',
            path: '/wp/v2/blocks',
            data: {
                title: 'Unused',
                status: 'publish',
                content:
                    '<!-- wp:paragraph --><p>Unused</p><!-- /wp:paragraph -->',
            },
        } );
        expect( unused.id ).toBeGreaterThan( 0 );
        for ( const slug of [ 'wfd-one', 'wfd-two' ] ) {
            await requestUtils.rest( {
                method: 'POST',
                path: '/wp/v2/templates',
                data: {
                    slug,
                    title: slug,
                    content: `<!-- wp:block {"ref":${ loose.id }} /-->`,
                },
            } );
        }
        await page.reload();
        await page.locator( '[data-wfd-artboard]' ).first().waitFor();
        const panel = await openInserter( page, 'Patterns' );
        const list = panel.getByRole( 'tabpanel' );
        const headings = await list.getByRole( 'heading' ).allInnerTexts();
        // The New rows come first (D60).
        expect( headings[ 0 ].toLowerCase() ).toBe( 'new' );
        expect( headings[ 1 ].toLowerCase() ).toBe( 'yours' );
        expect( headings[ 2 ].toLowerCase() ).toBe(
            'theme: twenty twenty-five'
        );
        expect( headings ).toHaveLength( 3 );

        const row = ( name: string ) =>
            list.locator( '.wfd-row', {
                has: page.locator( '.wfd-row__name', {
                    hasText: new RegExp( `^${ name }$` ),
                } ),
            } );
        await expect( row( 'Hero' ) ).toContainText( 'On this board' );
        await expect( row( 'Sign-off' ) ).toContainText( 'On this board' );
        await expect( row( 'Loose' ) ).toContainText( 'Used in 2 templates' );
        await expect( row( 'Unused' ) ).toContainText( 'Not used yet' );
        // Theme patterns sit in the theme's group, after "Yours".
        const groups = list.locator( 'section' );
        await expect( groups.nth( 1 ).locator( '.wfd-row' ) ).toHaveCount( 4 );
        expect(
            await groups.nth( 2 ).locator( '.wfd-row' ).count()
        ).toBeGreaterThan( 5 );
        await expect(
            groups.nth( 1 ).locator( '.wfd-group-heading__suffix' )
        ).toHaveText( '4' );
        await expect( panel ).toContainText(
            'Click or drag to the board to open it as an artboard.'
        );
    } );

    test( 'AC-INS-03 With no artboard in edit the inserter has no Blocks tab: its tabs are Pages, Patterns, Templates and Media, and Pages is selected. Entering edit brings the Blocks tab back and takes the Pages tab away', async ( {
        page,
    } ) => {
        const panel = await openInserter( page );
        const tabs = panel.getByRole( 'tab' );
        await expect( tabs ).toHaveText( [
            'Pages',
            'Patterns',
            'Templates',
            'Media',
        ] );
        await expect(
            panel.getByRole( 'tab', { name: 'Pages' } )
        ).toHaveAttribute( 'aria-selected', 'true' );
        await expect( panel ).not.toContainText(
            'Edit an artboard to insert blocks.'
        );
        await expect(
            panel.getByRole( 'button', { name: 'Paragraph', exact: true } )
        ).toHaveCount( 0 );
        // A block name is not a search result either.
        await panel.getByRole( 'searchbox' ).fill( 'Shortcode' );
        await expect( panel ).toContainText( 'No results' );
        await panel.getByRole( 'searchbox' ).fill( '' );

        // In edit the Blocks tab is there, and it goes again on leaving.
        const header = artboardOf( fixture, 'template-part' );
        await page
            .locator( '[data-wfd-region="header"]' )
            .getByRole( 'button', { name: 'Close block inserter' } )
            .click();
        await enterEdit( page, header.id );
        const editing = await openInserter( page );
        await expect( editing.getByRole( 'tab' ) ).toHaveText( [
            'Blocks',
            'Patterns',
            'Templates',
            'Media',
        ] );
        await page
            .locator( '[data-wfd-region="header"]' )
            .getByRole( 'button', { name: 'Back to the board' } )
            .click();
        await expect( editing.getByRole( 'tab' ) ).toHaveText( [
            'Pages',
            'Patterns',
            'Templates',
            'Media',
        ] );
    } );

    test( 'AC-INS-04 With no artboard in edit, dragging a pattern, template or part to empty board shows the drop target and opens it as a Desktop artboard at the drop point; clicking one opens it as a Desktop artboard in view that covers no other artboard', async ( {
        page,
        requestUtils,
    } ) => {
        const panel = await openInserter( page, 'Patterns' );
        const viewport = () =>
            page.evaluate( () => ( window as any ).wfdTest.viewport.get() );
        const drag = async (
            row: ReturnType< Page[ 'locator' ] >,
            label: string,
            kind: string
        ) => {
            const before = await page.locator( '[data-wfd-artboard]' ).count();
            const { box, target } = await dropOnEmptyBoard( page, row );
            const outline = page.locator( '[data-wfd-placement]' );
            await expect( outline ).toBeVisible();
            await expect( outline ).toContainText( label );
            await expect( outline ).toContainText(
                'Drop to open as an artboard'
            );
            await page.mouse.up();
            await expect( outline ).toHaveCount( 0 );
            await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount(
                before + 1
            );
            const added = page.locator( '[data-wfd-artboard]' ).last();
            await expect( added ).toHaveAttribute( 'data-wfd-kind', kind );
            await expect( added ).toHaveAttribute(
                'data-wfd-device',
                'desktop'
            );
            // Selected, not in edit, at the drop point.
            await expect( added ).toHaveClass( /is-selected/ );
            await expect(
                page.locator( '[data-wfd-tier="live"]' )
            ).toHaveCount( 0 );
            const view = await viewport();
            const frame = ( await added
                .locator( '.wfd-artboard__frame' )
                .boundingBox() )!;
            expect( frame.x - box.x ).toBeCloseTo( target.x, -1 );
            expect( frame.y - box.y ).toBeCloseTo( target.y, -1 );
            expect( view.zoom ).toBeGreaterThan( 0 );
            return added;
        };

        // A theme pattern is copied to a new draft user pattern first.
        const themeRow = panel
            .getByRole( 'tabpanel' )
            .locator( 'section' )
            .nth( 2 )
            .locator( '.wfd-row' )
            .first();
        const themeName = await themeRow
            .locator( '.wfd-row__name' )
            .innerText();
        await drag( themeRow, `${ themeName } · Pattern · Desktop`, 'pattern' );
        await expect
            .poll( async () => {
                const list = await requestUtils.rest< any[] >( {
                    path: '/wp/v2/blocks',
                    params: { status: 'draft', per_page: 100, context: 'edit' },
                } );
                return list.filter( ( item ) => item.title.raw === themeName )
                    .length;
            } )
            .toBe( 1 );

        // A template that is not on the board.
        await panel.getByRole( 'tab', { name: 'Templates' } ).click();
        const templates = panel.getByRole( 'tabpanel' );
        const pagesRow = templates.locator( '.wfd-row', {
            has: page.locator( '.wfd-row__name', { hasText: /^Pages$/ } ),
        } );
        await expect( pagesRow ).toContainText( 'Not on this board' );
        // Move the board so the next drop lands on empty board again.
        await page.evaluate( () =>
            ( window as any ).wfdTest.viewport.panBy( 0, -260 )
        );
        await page.waitForTimeout( 300 );
        await drag( pagesRow, 'Pages · Template · Desktop', 'template' );
        await expect( pagesRow ).toContainText( 'On this board' );

        // A template part.
        const footerRow = templates.locator( '.wfd-row', {
            has: page.locator( '.wfd-row__name', { hasText: /^Footer$/ } ),
        } );
        await page.evaluate( () =>
            ( window as any ).wfdTest.viewport.panBy( 0, -260 )
        );
        await page.waitForTimeout( 300 );
        await drag(
            footerRow.first(),
            'Footer · Template part · Desktop',
            'template-part'
        );

        // A click opens the row's item too: selected, not in edit, in view
        // and covering nothing.
        const click = async (
            row: ReturnType< Page[ 'locator' ] >,
            kind: string
        ) => {
            const before = await page.locator( '[data-wfd-artboard]' ).count();
            await row.click();
            await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount(
                before + 1
            );
            const added = page.locator( '[data-wfd-artboard]' ).last();
            await expect( added ).toHaveAttribute( 'data-wfd-kind', kind );
            await expect( added ).toHaveAttribute(
                'data-wfd-device',
                'desktop'
            );
            await expect( added ).toHaveClass( /is-selected/ );
            await expect(
                page.locator( '[data-wfd-tier="live"]' )
            ).toHaveCount( 0 );
            await page.waitForTimeout( 300 );
            const id = ( await added.getAttribute( 'data-wfd-artboard' ) )!;
            expect( await overlapsAnother( page, id ) ).toBe( false );
            await expect(
                added.locator( '.wfd-artboard__frame' )
            ).toBeInViewport();
        };
        await click( footerRow.first(), 'template-part' );
        await click( pagesRow, 'template' );
        await panel.getByRole( 'tab', { name: 'Patterns' } ).click();
        await click(
            panel.getByRole( 'tabpanel' ).locator( '.wfd-row', {
                has: page.locator( '.wfd-row__name', { hasText: /^Hero$/ } ),
            } ),
            'pattern'
        );
    } );

    test( 'AC-INS-05 Clicking a pattern inserts its blocks into the artboard in edit; dragging one onto the artboard in edit inserts its blocks where it is dropped; dragging one to empty board while in edit adds nothing', async ( {
        page,
    } ) => {
        const sign = artboardOf( fixture, 'pattern', 'desktop', 1 );
        await enterEdit( page, sign.id );
        const frame = editorFrame( page, sign.id );
        await frame.locator( 'p', { hasText: 'Until Sunday.' } ).click();
        const panel = await openInserter( page, 'Patterns' );
        const list = panel.getByRole( 'tabpanel' );
        // A theme pattern: its blocks are inserted.
        const themeRow = list
            .locator( 'section' )
            .nth( 1 )
            .locator( '.wfd-row' )
            .first();
        const before = await frame.locator( '.is-root-container > *' ).count();
        await themeRow.click();
        await expect
            .poll( () => frame.locator( '.is-root-container > *' ).count() )
            .toBeGreaterThan( before );
        // A user pattern (synced) is inserted by reference and shows its blocks.
        await list
            .locator( '.wfd-row', {
                has: page.locator( '.wfd-row__name', { hasText: /^Hero$/ } ),
            } )
            .click();
        await expect( frame.locator( '[data-type="core/block"]' ) ).toHaveCount(
            1
        );
        await expect(
            frame.locator( '[data-type="core/block"]' )
        ).toContainText( 'Hero paragraph.' );
        await expect( panel ).toContainText(
            'Click or drag to insert into Sign-off.'
        );

        // Dragged onto the artboard in edit, it goes in where it is dropped.
        const heroRow = list.locator( '.wfd-row', {
            has: page.locator( '.wfd-row__name', { hasText: /^Hero$/ } ),
        } );
        await dragOntoBlock(
            page,
            heroRow,
            frame.locator( 'p', { hasText: 'Until Sunday.' } )
        );
        await expect( frame.locator( '[data-type="core/block"]' ) ).toHaveCount(
            2
        );
        await expect(
            frame.locator(
                'p:has-text("Until Sunday.") + [data-type="core/block"]'
            )
        ).toHaveCount( 1 );

        // Dragged to empty board while in edit: no drop target, nothing added.
        const boards = await page.locator( '[data-wfd-artboard]' ).count();
        await dropOnEmptyBoard( page, heroRow );
        await expect( page.locator( '[data-wfd-placement]' ) ).toHaveCount( 0 );
        await page.mouse.up();
        await page.waitForTimeout( 300 );
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount(
            boards
        );
        await expect( frame.locator( '[data-type="core/block"]' ) ).toHaveCount(
            2
        );
        await expect( page.locator( '[data-wfd-tier="live"]' ) ).toHaveCount(
            1
        );
    } );

    test( 'AC-INS-06 No inserter row contains a rendered preview or iframe', async ( {
        page,
    } ) => {
        // All four tabs are there while an artboard is in edit.
        await enterEdit( page, artboardOf( fixture, 'template-part' ).id );
        const panel = await openInserter( page );
        for ( const tab of [ 'Blocks', 'Patterns', 'Templates', 'Media' ] ) {
            await panel.getByRole( 'tab', { name: tab } ).click();
            await expect( panel.locator( '.wfd-row' ).first() ).toBeVisible();
            await expect(
                panel.locator(
                    'iframe, img, picture, video, canvas, .block-editor-block-preview__container'
                )
            ).toHaveCount( 0 );
            // Rows hold an icon and text only.
            const tall = await panel
                .locator( '.wfd-row' )
                .evaluateAll(
                    ( rows ) =>
                        rows.filter(
                            ( row ) => row.getBoundingClientRect().height > 80
                        ).length
                );
            expect( tall ).toBe( 0 );
        }
    } );

    test( 'AC-INS-07 With an artboard in edit, clicking a template part row inserts a Template Part block and clicking a template row does nothing', async ( {
        page,
    } ) => {
        const sign = artboardOf( fixture, 'pattern', 'desktop', 1 );
        await enterEdit( page, sign.id );
        const frame = editorFrame( page, sign.id );
        await frame.locator( 'p', { hasText: 'Until Sunday.' } ).click();
        const panel = await openInserter( page, 'Templates' );
        const list = panel.getByRole( 'tabpanel' );
        const headings = await list.getByRole( 'heading' ).allInnerTexts();
        expect( headings.map( ( h ) => h.toLowerCase() ) ).toEqual( [
            'templates',
            'template parts',
        ] );
        await expect( panel ).toContainText(
            'Click or drag a template part to insert it into Sign-off.'
        );
        const count = () => frame.locator( '.is-root-container > *' ).count();
        const before = await count();

        // A template row: nothing happens.
        await list
            .locator( '.wfd-row', {
                has: page.locator( '.wfd-row__name', { hasText: /^Pages$/ } ),
            } )
            .click( { force: true } );
        await page.waitForTimeout( 300 );
        expect( await count() ).toBe( before );
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 9 );

        // A template part row inserts a Template Part block for it.
        await list
            .locator( '.wfd-row', {
                has: page.locator( '.wfd-row__name', { hasText: /^Footer$/ } ),
            } )
            .first()
            .click();
        const part = frame.locator( '[data-type="core/template-part"]' );
        await expect( part ).toHaveCount( 1 );
        await expect( part ).toContainText( 'Twenty Twenty-Five' );
        expect( await count() ).toBe( before + 1 );
    } );

    test( 'AC-INS-08 Media tab lists images with dimensions; with an artboard in edit clicking one inserts an Image block for it and dragging one onto the artboard inserts an Image block where it is dropped; Upload adds a file and lists it', async ( {
        page,
    } ) => {
        const sign = artboardOf( fixture, 'pattern', 'desktop', 1 );
        await enterEdit( page, sign.id );
        const frame = editorFrame( page, sign.id );
        await frame.locator( 'p', { hasText: 'Until Sunday.' } ).click();
        const panel = await openInserter( page, 'Media' );
        const list = panel.getByRole( 'tabpanel' );
        await expect( list.getByRole( 'heading' ) ).toHaveText( /images/i );
        const row = list.locator( '.wfd-row', { hasText: 'wfd-sample' } );
        await expect( row ).toHaveCount( 1 );
        await expect( row ).toContainText( '40 × 30' );
        await expect( list.locator( '.wfd-group-heading__suffix' ) ).toHaveText(
            '1'
        );
        await expect( panel ).toContainText(
            'Click or drag to insert as an Image block in Sign-off.'
        );

        await row.click();
        const image = frame.locator( '[data-type="core/image"] img' );
        await expect( image ).toHaveCount( 1 );
        await expect( image ).toHaveAttribute( 'src', /wfd-sample/ );

        await dragOntoBlock(
            page,
            row,
            frame.locator( 'p', { hasText: 'Until Sunday.' } )
        );
        await expect( image ).toHaveCount( 2 );
        await expect( page.locator( '[data-wfd-kind="media"]' ) ).toHaveCount(
            0
        );

        // Upload through the media library.
        await list.getByRole( 'button', { name: 'Upload' } ).click();
        const modal = page.locator( '.media-modal' );
        await expect( modal ).toBeVisible();
        await modal.getByRole( 'tab', { name: 'Upload files' } ).click();
        await modal
            .locator( 'input[type="file"]' )
            .setInputFiles(
                path.join( __dirname, 'assets', 'wfd-upload.png' )
            );
        const select = modal.getByRole( 'button', {
            name: 'Select',
            exact: true,
        } );
        await expect( select ).toBeEnabled( { timeout: 20000 } );
        await select.click();
        await expect( modal ).toBeHidden();
        const uploaded = list.locator( '.wfd-row', { hasText: 'wfd-upload' } );
        await expect( uploaded ).toHaveCount( 1 );
        await expect( uploaded ).toContainText( '64 × 48' );
        await expect( list.locator( '.wfd-group-heading__suffix' ) ).toHaveText(
            '2'
        );
    } );

    test( 'AC-INS-09 Search filters all tabs', async ( { page } ) => {
        // All four tabs are there while an artboard is in edit.
        await enterEdit( page, artboardOf( fixture, 'template-part' ).id );
        const panel = await openInserter( page );
        const search = panel.getByRole( 'searchbox' );
        await expect( search ).toHaveAttribute( 'placeholder', 'Search' );
        const rows = panel.getByRole( 'tabpanel' ).locator( '.wfd-row' );
        const names = () => rows.locator( '.wfd-row__name' ).allInnerTexts();

        await search.fill( 'head' );
        // The tab strip stays.
        await expect( panel.getByRole( 'tab' ) ).toHaveText( [
            'Blocks',
            'Patterns',
            'Templates',
            'Media',
        ] );
        for ( const tab of [ 'Blocks', 'Patterns', 'Templates' ] ) {
            await panel.getByRole( 'tab', { name: tab } ).click();
            await expect( rows.first() ).toBeVisible();
            for ( const name of await names() ) {
                expect( name.toLowerCase() ).toContain( 'head' );
            }
        }
        await panel.getByRole( 'tab', { name: 'Blocks' } ).click();
        expect( await names() ).toContain( 'Heading' );
        await panel.getByRole( 'tab', { name: 'Templates' } ).click();
        expect( await names() ).toContain( 'Header' );
        await panel.getByRole( 'tab', { name: 'Media' } ).click();
        await expect( rows ).toHaveCount( 0 );

        await search.fill( 'wfd-sam' );
        await expect( rows ).toHaveCount( 1 );
        await expect( rows.first() ).toContainText( 'wfd-sample' );
        await panel.getByRole( 'tab', { name: 'Blocks' } ).click();
        await expect( rows ).toHaveCount( 0 );

        await search.fill( '' );
        await expect.poll( () => rows.count() ).toBeGreaterThan( 10 );
    } );

    test( 'AC-INS-10 The Pages tab lists every page of the site that is not in the trash, each with "On this board" or "Not on this board"; clicking a page opens it as a Desktop artboard in view, and dragging one to empty board shows the drop target and opens it at the drop point; either way it is selected and not in edit', async ( {
        page,
        requestUtils,
    } ) => {
        const make = ( title: string, status: string ) =>
            requestUtils.rest< { id: number } >( {
                method: 'POST',
                path: '/wp/v2/pages',
                data: { title, status, content: '' },
            } );
        const colophon = await make( 'Colophon', 'publish' );
        await make( 'Zine', 'private' );
        const gone = await make( 'Gone', 'publish' );
        await requestUtils.rest( {
            method: 'DELETE',
            path: `/wp/v2/pages/${ gone.id }`,
        } );
        await page.reload();
        await page.locator( '[data-wfd-artboard]' ).first().waitFor();

        const panel = await openInserter( page );
        await expect(
            panel.getByRole( 'tab', { name: 'Pages' } )
        ).toHaveAttribute( 'aria-selected', 'true' );
        await expect( panel ).toContainText(
            'Click or drag to the board to open it as an artboard.'
        );
        const group = panel
            .getByRole( 'tabpanel' )
            .locator( '.wfd-inserter__group' )
            .nth( 1 );
        await expect( group.locator( '.wfd-group-heading' ) ).toHaveText(
            /Pages\s*4/
        );
        // By title; published, draft and private pages, not the trashed one.
        await expect( group.locator( '.wfd-row__name' ) ).toHaveText( [
            'About',
            'Become a member',
            'Colophon',
            'Zine',
        ] );
        await expect( group.locator( '.wfd-row__second-line' ) ).toHaveText( [
            'On this board',
            'On this board',
            'Not on this board',
            'Not on this board',
        ] );
        const rowOf = ( name: string ) =>
            group.locator( '.wfd-row', {
                has: page.locator( '.wfd-row__name', {
                    hasText: new RegExp( `^${ name }$` ),
                } ),
            } );

        // A click: in view, covering nothing, selected, not in edit.
        await rowOf( 'Colophon' ).click();
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 10 );
        const clicked = page.locator( '[data-wfd-artboard]' ).last();
        await expect( clicked ).toHaveAttribute( 'data-wfd-kind', 'page' );
        await expect( clicked ).toHaveAttribute( 'data-wfd-device', 'desktop' );
        await expect( clicked ).toHaveClass( /is-selected/ );
        await expect( clicked.locator( '.wfd-artboard__label' ) ).toHaveText(
            'Colophon · Page · Desktop'
        );
        await expect( page.locator( '[data-wfd-tier="live"]' ) ).toHaveCount(
            0
        );
        await page.waitForTimeout( 300 );
        const clickedId =
            ( await clicked.getAttribute( 'data-wfd-artboard' ) )!;
        expect( await overlapsAnother( page, clickedId ) ).toBe( false );
        await expect(
            clicked.locator( '.wfd-artboard__frame' )
        ).toBeInViewport();
        await expect( rowOf( 'Colophon' ) ).toContainText( 'On this board' );

        // A drag: the drop target, then the artboard at the drop point.
        await page.evaluate( () =>
            ( window as any ).wfdTest.viewport.panBy( 0, -1200 )
        );
        await page.waitForTimeout( 300 );
        const { box, target } = await dropOnEmptyBoard( page, rowOf( 'Zine' ) );
        const outline = page.locator( '[data-wfd-placement]' );
        await expect( outline ).toBeVisible();
        await expect( outline ).toContainText( 'Zine · Page · Desktop' );
        await expect( outline ).toContainText( 'Drop to open as an artboard' );
        await page.mouse.up();
        await expect( outline ).toHaveCount( 0 );
        await expect( page.locator( '[data-wfd-artboard]' ) ).toHaveCount( 11 );
        const dropped = page.locator( '[data-wfd-artboard]' ).last();
        await expect( dropped ).toHaveAttribute( 'data-wfd-kind', 'page' );
        await expect( dropped ).toHaveClass( /is-selected/ );
        await expect( page.locator( '[data-wfd-tier="live"]' ) ).toHaveCount(
            0
        );
        const frame = ( await dropped
            .locator( '.wfd-artboard__frame' )
            .boundingBox() )!;
        expect( Math.abs( frame.x - ( box.x + target.x ) ) ).toBeLessThan( 3 );
        expect( Math.abs( frame.y - ( box.y + target.y ) ) ).toBeLessThan( 3 );

        // Both are in the board's saved layout.
        await expect
            .poll(
                async () => {
                    const board = await requestUtils.rest< {
                        layout: { artboards: { entityId: unknown }[] };
                    } >( {
                        path: `/wp/v2/wfd-boards/${ fixture.boardId }`,
                        params: { context: 'edit' },
                    } );
                    return board.layout.artboards.filter(
                        ( a ) => a.entityId === colophon.id
                    ).length;
                },
                { timeout: 6000 }
            )
            .toBe( 1 );
    } );
} );
