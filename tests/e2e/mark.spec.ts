import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import type { Page } from '@playwright/test';
import {
    resetFixture,
    openBoard,
    enterEdit,
    editorFrame,
    setViewport,
    boardAtRest,
    artboardOf,
} from './utils';
import { wfd, php, callTool, isRelay, listening } from './agent-utils';

const chip = ( page: Page ) => page.locator( '[data-wfd-agent]' );
const review = ( page: Page ) => page.locator( '[data-wfd-control="H9"]' );
const frame = ( page: Page, id: string ) =>
    page.locator( `[data-wfd-artboard="${ id }"]` );
const label = ( page: Page, id: string ) =>
    frame( page, id ).locator( '.wfd-artboard__label' );

/**
 * The designer renames a page; the designer and the agent both change a
 * pattern; the agent alone changes a part.
 *
 * @param page         The page.
 * @param requestUtils The REST helper.
 */
async function threeAuthors( page: Page, requestUtils: any ) {
    const fixture = await resetFixture( requestUtils );
    await openBoard( page, fixture.boardId );
    await boardAtRest( page );
    const header = artboardOf( fixture, 'template-part' );
    const hero = artboardOf( fixture, 'pattern' );
    // The surface is loaded before anything changes.
    await callTool( page, 'board-get' );

    await page.evaluate(
        ( [ pageId, patternId ] ) => {
            const core = ( window as any ).wp.data.dispatch( 'core' );
            core.editEntityRecord( 'postType', 'page', pageId, {
                title: 'About, renamed',
            } );
            core.editEntityRecord( 'postType', 'wp_block', patternId, {
                content:
                    '<!-- wp:paragraph --><p>The designer.</p><!-- /wp:paragraph -->',
            } );
        },
        [ fixture.pages.about, fixture.patterns.hero ] as const
    );
    await callTool( page, 'blocks-insert', {
        artboard: hero.id,
        markup: '<!-- wp:paragraph --><p>The agent.</p><!-- /wp:paragraph -->',
    } );
    await callTool( page, 'block-update', {
        artboard: header.id,
        path: [ 0, 0 ],
        attributes: { content: 'Changed by the agent' },
    } );
    await callTool( page, 'edit-leave' );
    await expect( review( page ) ).toHaveText( 'Review 3 changes' );

    return { fixture, header, hero };
}

test.describe( 'MARK', () => {
    test( 'AC-MARK-01 G1 appears after a command, reads connected, working and annotating, and goes when the session ends', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        // An agent has used the site, and no session is active.
        await wfd( [ 'status' ] );
        await php( 'update_option( "wfd_agent_seen", time() - 500, false );' );
        const asked = listening( page );
        await openBoard( page, fixture.boardId );
        await asked;
        await page.waitForTimeout( 1500 );
        await expect( chip( page ) ).toHaveCount( 0 );

        // Within 15 seconds of a command.
        await wfd( [ 'status' ] );
        await expect( chip( page ) ).toHaveAttribute(
            'data-wfd-agent',
            'connected',
            { timeout: 15000 }
        );
        await expect( chip( page ) ).toHaveText( 'Agent connected' );
        // Just before Tidy up.
        expect(
            await chip( page ).evaluate( ( el ) =>
                el.nextElementSibling?.getAttribute( 'data-wfd-control' )
            )
        ).toBe( 'H12' );

        // While a call runs, and for one second after.
        const started = Date.now();
        await callTool( page, 'board-get' );
        await expect( chip( page ) ).toHaveAttribute(
            'data-wfd-agent',
            'working'
        );
        await expect( chip( page ) ).toHaveText( 'Agent working' );
        await expect( chip( page ) ).toHaveAttribute(
            'data-wfd-agent',
            'connected'
        );
        expect( Date.now() - started ).toBeGreaterThanOrEqual( 900 );
        expect( Date.now() - started ).toBeLessThan( 4000 );

        // While a harness collects annotations and no call runs.
        const annotate = ( isOn: boolean ) =>
            page.evaluate(
                async ( on ) =>
                    ( await ( window as any ).wfdAgent.ready() ).setAnnotating(
                        on
                    ),
                isOn
            );
        await annotate( true );
        await expect( chip( page ) ).toHaveAttribute(
            'data-wfd-agent',
            'annotating'
        );
        await expect( chip( page ) ).toHaveText( 'Annotating' );
        await callTool( page, 'board-get' );
        await expect( chip( page ) ).toHaveText( 'Agent working' );
        await expect( chip( page ) ).toHaveText( 'Annotating' );
        await annotate( false );
        await expect( chip( page ) ).toHaveText( 'Agent connected' );

        // After the poll that finds the session ended.
        await php( 'update_option( "wfd_agent_seen", time() - 500, false );' );
        await expect( chip( page ) ).toHaveCount( 0, { timeout: 15000 } );
    } );

    test( 'AC-MARK-02 The artboard a running call names ends in "· Agent working" with a dashed outline, for one second after, and no other does', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        await boardAtRest( page );
        const hero = artboardOf( fixture, 'pattern' );
        await expect( label( page, hero.id ) ).toHaveText(
            'Hero · Pattern · Desktop'
        );
        const started = Date.now();
        const moved = await callTool( page, 'artboard-update', {
            artboard: hero.id,
            x: hero.x + 10,
            y: hero.y,
        } );
        expect( moved.ok ).toBe( true );
        const working = page.locator( '[data-wfd-agent-working="true"]' );
        await expect( working ).toHaveCount( 1 );
        await expect( working ).toHaveAttribute( 'data-wfd-artboard', hero.id );
        await expect( label( page, hero.id ) ).toHaveText(
            'Hero · Pattern · Desktop · Agent working'
        );
        expect(
            await frame( page, hero.id ).evaluate( ( el ) => {
                const style = window.getComputedStyle( el, '::after' );
                return `${ style.outlineStyle } ${ style.pointerEvents }`;
            } )
        ).toBe( 'dashed none' );
        // It is not selected by it.
        await expect( frame( page, hero.id ) ).not.toHaveClass( /is-selected/ );
        // No other artboard has either.
        expect(
            await page
                .locator( '.wfd-artboard__label' )
                .filter( { hasText: 'Agent working' } )
                .count()
        ).toBe( 1 );

        await expect( working ).toHaveCount( 0 );
        expect( Date.now() - started ).toBeGreaterThanOrEqual( 900 );
        await expect( label( page, hero.id ) ).toHaveText(
            'Hero · Pattern · Desktop'
        );
        expect(
            await frame( page, hero.id ).evaluate(
                ( el ) => window.getComputedStyle( el, '::after' ).content
            )
        ).toBe( 'none' );
    } );

    test( 'AC-MARK-03 After the agent changes a block every artboard that shows the item reads "· Changed by agent"; the designer\'s typing gives none; it goes when the item is discarded', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        await boardAtRest( page );
        const header = artboardOf( fixture, 'template-part' );
        const mobile = artboardOf( fixture, 'template-part', 'mobile' );
        const hero = artboardOf( fixture, 'pattern' );
        const changed = page.locator( '[data-wfd-agent-changed="true"]' );

        const updated = await callTool( page, 'block-update', {
            artboard: header.id,
            path: [ 0, 0 ],
            attributes: { content: 'Changed by the agent' },
        } );
        expect( updated.ok ).toBe( true );
        // After the mark of work goes.
        await expect( label( page, mobile.id ) ).toHaveText(
            'Header · Template part · Mobile · Changed by agent'
        );
        await expect( label( page, header.id ) ).toContainText(
            'Header · Template part · Changed by agent'
        );
        await expect( changed ).toHaveCount( 2 );
        await callTool( page, 'edit-leave' );
        await expect( label( page, header.id ) ).toHaveText(
            'Header · Template part · Desktop · Changed by agent'
        );

        // The designer's own typing.
        await page.waitForTimeout( 1200 );
        await page.locator( '[data-wfd-region="canvas"]' ).focus();
        await page.keyboard.press( 'Shift+Digit1' );
        await enterEdit( page, hero.id );
        await editorFrame( page, hero.id ).locator( 'h2' ).click();
        await page.keyboard.type( ' typed' );
        await expect( review( page ) ).toHaveText( 'Review 2 changes' );
        await page.keyboard.press( 'Escape' );
        await page.keyboard.press( 'Escape' );
        await expect( page.locator( '[data-wfd-tier="live"]' ) ).toHaveCount(
            0
        );
        await expect( label( page, hero.id ) ).toHaveText(
            'Hero · Pattern · Desktop'
        );
        await expect( changed ).toHaveCount( 2 );

        // While the Review drawer is open its own "· Changed" shows.
        await review( page ).click();
        await expect( label( page, mobile.id ) ).toHaveText(
            'Header · Template part · Mobile · Changed'
        );
        await page.getByRole( 'button', { name: 'Keep editing' } ).click();
        await expect( label( page, mobile.id ) ).toHaveText(
            'Header · Template part · Mobile · Changed by agent'
        );

        // Discarded: the label goes.
        const discarded = await callTool( page, 'review-discard', {
            key: `postType/wp_template_part/${ header.entityId }`,
        } );
        expect( discarded.ok ).toBe( true );
        await expect( changed ).toHaveCount( 0 );
        await expect( label( page, mobile.id ) ).toHaveText(
            'Header · Template part · Mobile'
        );
        await expect( label( page, header.id ) ).toHaveText(
            'Header · Template part · Desktop'
        );
    } );

    test( 'AC-MARK-04 In Review an item only the agent changed has the badge "Agent", one both changed "Agent and you", and one only the designer changed none', async ( {
        page,
        requestUtils,
    } ) => {
        await threeAuthors( page, requestUtils );
        const listed = ( await callTool( page, 'review-list' ) ).result.items;
        // The cards.
        await review( page ).click();
        const cards = await page
            .locator( '.wfd-review__item' )
            .evaluateAll( ( items ) =>
                items.map( ( item ) => ( {
                    name: item.querySelector( 'label' )!.textContent,
                    badge:
                        item.querySelector( '.wfd-review__author' )
                            ?.textContent ?? null,
                    next:
                        item
                            .querySelector( '.wfd-review__author' )
                            ?.nextElementSibling?.classList.contains(
                                'wfd-review__discard'
                            ) ?? null,
                } ) )
            );
        const badges = Object.fromEntries(
            cards.map( ( card ) => [ card.name, card.badge ] )
        );
        expect( badges ).toEqual( {
            'About, renamed': null,
            Hero: 'Agent and you',
            Header: 'Agent',
        } );
        // The badge is before "Discard".
        expect(
            cards
                .filter( ( card ) => card.badge )
                .every( ( card ) => card.next )
        ).toBe( true );
        // review-list says the same as the cards.
        const words: Record< string, string | null > = {
            agent: 'Agent',
            both: 'Agent and you',
            you: null,
        };
        for ( const item of listed ) {
            expect( badges[ item.name ] ).toBe( words[ item.author ] );
        }
    } );

    test( 'AC-MARK-05 changed in board-get and author in review-list say the same as the marks', async ( {
        page,
        requestUtils,
    } ) => {
        const { fixture, header, hero } = await threeAuthors(
            page,
            requestUtils
        );
        const board = ( await callTool( page, 'board-get' ) ).result;
        const listed = ( await callTool( page, 'review-list' ) ).result.items;
        const authorOf = ( type: string ) =>
            listed.find( ( item: any ) => item.type === type ).author;
        expect( authorOf( 'page' ) ).toBe( 'you' );
        expect( authorOf( 'pattern' ) ).toBe( 'both' );
        expect( authorOf( 'template-part' ) ).toBe( 'agent' );

        // board-get says the same of each artboard as its mark.
        for ( const artboard of board.artboards ) {
            const marked =
                ( await frame( page, artboard.id ).getAttribute(
                    'data-wfd-agent-changed'
                ) ) === 'true';
            expect(
                [ 'agent', 'both' ].includes( artboard.changed ),
                artboard.name
            ).toBe( marked );
        }
        const changedOf = ( id: string ) =>
            board.artboards.find( ( a: any ) => a.id === id ).changed;
        expect( changedOf( header.id ) ).toBe( 'agent' );
        expect( changedOf( hero.id ) ).toBe( 'both' );
        expect(
            changedOf(
                fixture.layout.artboards.find(
                    ( a ) => a.entityId === fixture.pages.about
                )!.id
            )
        ).toBe( 'you' );
        expect(
            board.artboards.filter( ( a: any ) => a.changed === undefined )
        ).toHaveLength( 5 );

        // review-list says the same as the cards' badges.
        await review( page ).click();
        const words: Record< string, string | null > = {
            agent: 'Agent',
            both: 'Agent and you',
            you: null,
        };
        for ( const item of listed ) {
            const card = page.locator( '.wfd-review__item' ).filter( {
                has: page.locator( 'label', { hasText: item.name } ),
            } );
            const badge = card.locator( '.wfd-review__author' );
            if ( words[ item.author ] ) {
                await expect( badge ).toHaveText( words[ item.author ]! );
            } else {
                await expect( badge ).toHaveCount( 0 );
            }
        }
    } );

    test( 'AC-MARK-06 A tool called through the page, with no session, checks its input, records authorship and shows the marks, and sends nothing to the relay', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        const relayed: string[] = [];
        page.on( 'request', ( request ) => {
            if ( isRelay( request.url() ) ) {
                relayed.push( request.url() );
            }
        } );
        await openBoard( page, fixture.boardId );
        await boardAtRest( page );
        const header = artboardOf( fixture, 'template-part' );
        const mobile = artboardOf( fixture, 'template-part', 'mobile' );

        // The input is checked.
        expect(
            await callTool( page, 'block-update', {
                artboard: header.id,
                path: 'first',
                attributes: { content: 'x' },
            } )
        ).toEqual( {
            ok: false,
            error: {
                code: 'invalid_args',
                message: 'path must be an array.',
            },
        } );
        await expect( review( page ) ).toBeDisabled();

        // G2 while it runs and after, then G3.
        const updated = await callTool( page, 'block-update', {
            artboard: header.id,
            path: [ 0, 0 ],
            attributes: { content: 'From the page' },
        } );
        expect( updated.ok ).toBe( true );
        await expect( frame( page, header.id ) ).toHaveAttribute(
            'data-wfd-agent-working',
            'true'
        );
        await expect( label( page, header.id ) ).toContainText(
            'Agent working'
        );
        await expect( page.locator( '[data-wfd-agent]' ) ).toHaveText(
            'Agent working'
        );
        await expect( label( page, mobile.id ) ).toHaveText(
            'Header · Template part · Mobile · Changed by agent'
        );
        // With no session the chip goes with the work.
        await expect( page.locator( '[data-wfd-agent]' ) ).toHaveCount( 0 );

        // Authorship, and G4.
        const listed = ( await callTool( page, 'review-list' ) ).result.items;
        expect( listed ).toHaveLength( 1 );
        expect( listed[ 0 ].author ).toBe( 'agent' );
        await callTool( page, 'edit-leave' );
        await review( page ).click();
        await expect( page.locator( '.wfd-review__author' ) ).toHaveText(
            'Agent'
        );
        expect( relayed ).toEqual( [] );
    } );

    test( "AC-MARK-07 With marks showing, the Live artboard's canvas holds nothing of the plugin's that it did not hold before", async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await openBoard( page, fixture.boardId );
        await boardAtRest( page );
        const header = artboardOf( fixture, 'template-part' );
        await setViewport( page, {
            x: 40 - header.x * 0.5,
            y: 60 - header.y * 0.5,
            zoom: 0.5,
        } );
        await enterEdit( page, header.id );

        // Everything of the plugin's in the canvas document: elements,
        // attributes and style rules that name it.
        const ours = () =>
            page
                .locator(
                    `[data-wfd-artboard="${ header.id }"] iframe[name="editor-canvas"]`
                )
                .evaluate( ( el: HTMLIFrameElement ) => {
                    const doc = el.contentDocument!;
                    const found: string[] = [];
                    for ( const node of doc.querySelectorAll( '*' ) ) {
                        for ( const attribute of node.attributes ) {
                            if (
                                /wfd/i.test( attribute.name ) ||
                                ( attribute.name !== 'href' &&
                                    attribute.name !== 'src' &&
                                    /wfd/i.test( attribute.value ) )
                            ) {
                                found.push(
                                    `${ node.tagName } ${ attribute.name }=${ attribute.value }`
                                );
                            }
                        }
                    }
                    let rules = 0;
                    for ( const sheet of doc.styleSheets ) {
                        try {
                            for ( const rule of sheet.cssRules ) {
                                if ( /wfd/i.test( rule.cssText ) ) {
                                    rules++;
                                }
                            }
                        } catch {
                            // A sheet from elsewhere is not the plugin's.
                        }
                    }
                    return {
                        found: found.sort(),
                        rules,
                        elements: doc.querySelectorAll( '*' ).length,
                    };
                } );
        const before = await ours();

        // The agent works on the artboard in edit: G1, G2 and G3 show.
        const updated = await callTool( page, 'block-update', {
            artboard: header.id,
            path: [ 0, 0 ],
            attributes: { content: 'Same length text' },
        } );
        expect( updated.ok ).toBe( true );
        await expect( frame( page, header.id ) ).toHaveAttribute(
            'data-wfd-agent-working',
            'true'
        );
        const during = await ours();
        expect( during.found ).toEqual( before.found );
        expect( during.rules ).toBe( before.rules );
        expect( during.elements ).toBe( before.elements );

        await expect( label( page, header.id ) ).toContainText(
            'Changed by agent'
        );
        const after = await ours();
        expect( after.found ).toEqual( before.found );
        expect( after.rules ).toBe( before.rules );
        expect( after.elements ).toBe( before.elements );
        // The marks are outside the canvas.
        expect(
            await page
                .frameLocator(
                    `[data-wfd-artboard="${ header.id }"] iframe[name="editor-canvas"]`
                )
                .locator( 'body' )
                .innerText()
        ).not.toContain( 'agent' );
    } );
} );
