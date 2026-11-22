import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import {
    resetFixture,
    openBoard,
    enterEdit,
    setViewport,
    viewportOf,
    tiersOf,
    boardAtRest,
    artboardOf,
    type Fixture,
} from '../../../tests/e2e/utils';
import { isRelay, listening } from '../../../tests/e2e/agent-utils';

const ADAPTER = path.join( __dirname, '..' );
const ROOT = path.join( ADAPTER, '..', '..' );
const MAIN = path.basename( ROOT );
const LAYER = '#wfd-studio-pick-layer';

/**
 * The runbook section, read from the spec so the check is against its text.
 */
const SECTION = fs
    .readFileSync( path.join( ADAPTER, 'spec/adapter.md' ), 'utf8' )
    .match( /```text\n(Annotations from Studio:[\s\S]*?)\n```/ )![ 1 ];

type Ran = { stdout: string; stderr: string; code: number };

/**
 * Runs a WP-CLI command in the adapter's test site.
 *
 * @param args The arguments after `wp`.
 */
function wp( args: string[] ): Promise< Ran > {
    return new Promise( ( resolve ) => {
        execFile(
            path.join( ROOT, 'node_modules/.bin/wp-env' ),
            [ 'run', 'cli', '--', 'wp', ...args ],
            { cwd: ADAPTER, maxBuffer: 16 * 1024 * 1024 },
            ( error, stdout, stderr ) =>
                resolve( {
                    stdout,
                    stderr,
                    code: error ? Number( ( error as any ).code ) || 1 : 0,
                } )
        );
    } );
}

/**
 * Runs one tool with `wp wfd call` and gives its result.
 *
 * @param tool  The tool.
 * @param flags The command's flags.
 */
async function call( tool: string, ...flags: string[] ) {
    const ran = await wp( [ 'wfd', 'call', tool, ...flags ] );
    const envelope = JSON.parse( ran.stdout );
    expect( envelope.ok, `${ tool }: ${ ran.stdout }` ).toBe( true );
    return envelope.result;
}

/**
 * Calls a tool through the page. The tests do this; the adapter never does.
 *
 * @param page The board page.
 * @param name The tool.
 */
const callTool = ( page: Page, name: string ) =>
    page.evaluate( async ( tool ) => {
        const agent = await ( window as any ).wfdAgent.ready();
        return ( await agent.call( tool, {} ) ).result;
    }, name );

type Pick = {
    selector: string | null;
    tag: string;
    classes: string[];
    text: string;
};

/**
 * The stand-in for Studio's inspector (spec/acceptance.md): the command
 * event, a capturing click listener that stops the event and takes its
 * target, and what it records of that element. Nothing else.
 *
 * @param page The page.
 */
async function standIn( page: Page ) {
    await page.evaluate( () => {
        const state = ( ( window as any ).standIn = {
            active: false,
            picks: [] as any[],
            command( active: boolean ) {
                state.active = active;
                window.dispatchEvent(
                    new CustomEvent( '__studio-inspector-command', {
                        detail: {
                            active,
                            tool: 'select',
                            notes: [],
                            editingId: null,
                        },
                    } )
                );
            },
        } );
        document.addEventListener(
            'click',
            ( event ) => {
                if ( ! state.active ) {
                    return;
                }
                event.preventDefault();
                event.stopImmediatePropagation();
                const element = event.target as HTMLElement;
                state.picks.push( {
                    selector: element.id
                        ? '#' + CSS.escape( element.id )
                        : null,
                    tag: element.tagName.toLowerCase(),
                    classes: [ ...element.classList ],
                    text: ( element.innerText ?? '' )
                        .replace( /\s+/g, ' ' )
                        .trim()
                        .slice( 0, 200 ),
                } );
            },
            true
        );
    } );
}

const command = ( page: Page, active: boolean ) =>
    page.evaluate( ( on ) => ( window as any ).standIn.command( on ), active );

/**
 * Turns Annotate on in the stand-in and waits for the layer.
 *
 * @param page The board page.
 */
async function annotate( page: Page ) {
    await standIn( page );
    await command( page, true );
    await page.locator( LAYER ).waitFor( { state: 'attached' } );
    await inStep( page );
}

const targetsOf = ( page: Page ): Promise< any[] > =>
    page.evaluate( async () =>
        ( await ( window as any ).wfdAgent.ready() ).targets()
    );

/**
 * How the layer's children differ from `targets()`, read in one go: an
 * empty string when each child has its target's reference, in order, and its
 * rectangle within a pixel.
 *
 * @param page The board page.
 */
const drift = ( page: Page ): Promise< string > =>
    page.evaluate( async ( layer ) => {
        const targets = ( await ( window as any ).wfdAgent.ready() ).targets();
        const children = [ ...document.querySelector( layer )!.children ];
        if ( children.length !== targets.length ) {
            return `${ children.length } children, ${ targets.length } targets`;
        }
        for ( const [ index, target ] of targets.entries() ) {
            const child = children[ index ];
            if ( child.id !== target.ref ) {
                return `child ${ index } is ${ child.id }, not ${ target.ref }`;
            }
            const box = child.getBoundingClientRect();
            for ( const side of [ 'x', 'y', 'width', 'height' ] as const ) {
                if ( Math.abs( box[ side ] - target.rect[ side ] ) > 1 ) {
                    return `${ target.ref } ${ side }: ${ box[ side ] }, not ${ target.rect[ side ] }`;
                }
            }
        }
        return '';
    }, LAYER );

const inStep = ( page: Page ) =>
    expect.poll( () => drift( page ), { timeout: 15000 } ).toBe( '' );

/**
 * Clicks the middle of a target and gives what the stand-in picked.
 *
 * @param page   The board page.
 * @param target The target.
 */
async function pickAt( page: Page, target: any ): Promise< Pick > {
    const before = await page.evaluate(
        () => ( window as any ).standIn.picks.length
    );
    await page.mouse.click(
        target.rect.x + target.rect.width / 2,
        target.rect.y + target.rect.height / 2
    );
    const picks: Pick[] = await page.evaluate(
        () => ( window as any ).standIn.picks
    );
    expect( picks.length ).toBe( before + 1 );
    return picks[ picks.length - 1 ];
}

/**
 * Opens the fixture board during an agent session, so `wp wfd call` reaches
 * it.
 *
 * @param page    The page.
 * @param boardId The board.
 */
async function openListening( page: Page, boardId: number ) {
    await wp( [ 'wfd', 'status' ] );
    const asked = listening( page );
    await openBoard( page, boardId );
    await asked;
    await boardAtRest( page );
}

/**
 * Brings an artboard to the top left of the canvas area at 50%, where it is
 * a Preview.
 *
 * @param page        The board page.
 * @param artboard    The artboard.
 * @param artboard.id
 * @param artboard.x
 * @param artboard.y
 */
async function bringClose(
    page: Page,
    artboard: { id: string; x: number; y: number }
) {
    await setViewport( page, {
        x: 40 - artboard.x * 0.5,
        y: 60 - artboard.y * 0.5,
        zoom: 0.5,
    } );
    await expect(
        page.locator( `[data-wfd-artboard="${ artboard.id }"]` )
    ).toHaveAttribute( 'data-wfd-tier', 'preview' );
    await boardAtRest( page );
}

/**
 * The target of the Heading the fixture's About page holds.
 *
 * @param page  The board page.
 * @param about The About artboard's id.
 */
async function headingOf( page: Page, about: string ) {
    let found: any;
    await expect
        .poll(
            async () => {
                found = ( await targetsOf( page ) ).find(
                    ( t ) =>
                        t.kind === 'block' &&
                        t.ref.startsWith( `wfd-ref-a_${ about }_b_` ) &&
                        t.label === 'Heading' &&
                        t.text === 'About'
                );
                return !! found;
            },
            { timeout: 15000 }
        )
        .toBe( true );
    return found;
}

test.describe( 'STUDIO', () => {
    let fixture: Fixture;

    test.beforeAll( async () => {
        await wp( [ 'plugin', 'activate', MAIN, 'plugin', 'wfd-studio' ] );
    } );

    test.beforeEach( async ( { requestUtils } ) => {
        fixture = await resetFixture( requestUtils );
    } );

    test( 'AC-STUDIO-01 With no wp wfd command run and Annotate never on, the board has no pick layer, does not request the agent chunk and sends nothing to wfd/v1/agent', async ( {
        page,
    } ) => {
        const requests: string[] = [];
        page.on( 'request', ( request ) => requests.push( request.url() ) );
        await openBoard( page, fixture.boardId );
        await boardAtRest( page );
        // Longer than the stub's wait between two looks for a session.
        await page.waitForTimeout( 11000 );

        // The adapter is there.
        expect(
            requests.some( ( url ) =>
                url.includes( '/wfd-studio/pick-layer.js' )
            )
        ).toBe( true );
        await expect( page.locator( LAYER ) ).toHaveCount( 0 );
        expect(
            requests.filter( ( url ) => /\/build\/agent\.js/.test( url ) )
        ).toEqual( [] );
        expect( requests.filter( isRelay ) ).toEqual( [] );
        await expect( page.locator( '[data-wfd-agent]' ) ).toHaveCount( 0 );
    } );

    test( 'AC-STUDIO-02 After a command with active: true the layer exists, G1 reads "Annotating", and the layer has one child per entry of targets(), with its ref as id', async ( {
        page,
    } ) => {
        await openBoard( page, fixture.boardId );
        await boardAtRest( page );
        await standIn( page );
        await command( page, true );

        const layer = page.locator( LAYER );
        await layer.waitFor( { state: 'attached' } );
        const chip = page.locator( '[data-wfd-agent]' );
        await expect( chip ).toHaveAttribute( 'data-wfd-agent', 'annotating' );
        await expect( chip ).toHaveText( 'Annotating' );
        await inStep( page );

        const targets = await targetsOf( page );
        expect( targets.length ).toBeGreaterThan( 9 );
        expect(
            await layer
                .locator( '> *' )
                .evaluateAll( ( els ) => els.map( ( el ) => el.id ) )
        ).toEqual( targets.map( ( t ) => t.ref ) );
        // The layer is the last child of the body and carries nothing of
        // Studio's own.
        expect(
            await layer.evaluate(
                ( el ) =>
                    el === document.body.lastElementChild &&
                    ! document.querySelector(
                        '#wfd-studio-pick-layer[data-studio-inspector], #wfd-studio-pick-layer [data-studio-inspector]'
                    ) &&
                    [ el, ...el.children ].every( ( node ) =>
                        node
                            .getAttributeNames()
                            .every( ( name ) =>
                                [ 'id', 'class', 'style' ].includes( name )
                            )
                    )
            )
        ).toBe( true );
    } );

    test( 'AC-STUDIO-03 A click on a Heading in a page artboard that is not in edit is picked as # plus a block reference, which blocks-get resolves to that core/heading', async ( {
        page,
    } ) => {
        const about = artboardOf( fixture, 'page' );
        await openListening( page, fixture.boardId );
        await bringClose( page, about );
        await annotate( page );

        const heading = await headingOf( page, about.id );
        const pick = await pickAt( page, heading );
        expect( pick.selector ).toBe( '#' + heading.ref );
        expect( pick.selector ).toMatch( /^#wfd-ref-a_[\w-]+_b_\d+(_\d+)*$/ );
        expect( ( await tiersOf( page ) )[ about.id ], 'not in edit' ).toBe(
            'preview'
        );

        const read = await call( 'blocks-get', `--ref=${ pick.selector }` );
        expect( read.artboard ).toBe( about.id );
        expect( read.blocks ).toHaveLength( 1 );
        expect( read.blocks[ 0 ] ).toMatchObject( {
            name: 'core/heading',
            text: 'About',
            ref: heading.ref,
        } );
    } );

    test( 'AC-STUDIO-04 The same click in the artboard in edit gives a reference that blocks-get resolves to the block clicked', async ( {
        page,
    } ) => {
        const about = artboardOf( fixture, 'page' );
        await openListening( page, fixture.boardId );
        await bringClose( page, about );
        await enterEdit( page, about.id );
        await boardAtRest( page );
        await annotate( page );

        const heading = await headingOf( page, about.id );
        const pick = await pickAt( page, heading );
        expect( pick.selector ).toBe( '#' + heading.ref );
        expect( ( await tiersOf( page ) )[ about.id ] ).toBe( 'live' );

        const read = await call( 'blocks-get', `--ref=${ pick.selector }` );
        expect( read.artboard ).toBe( about.id );
        expect( read.blocks ).toHaveLength( 1 );
        expect( read.blocks[ 0 ] ).toMatchObject( {
            name: 'core/heading',
            text: 'About',
        } );
    } );

    test( 'AC-STUDIO-05 A click on a Ghost artboard gives an artboard reference, on a note a note reference, and on a colour row of the Tokens tab a token reference that token-show-uses accepts', async ( {
        page,
        requestUtils,
    } ) => {
        const note = {
            id: '0c0ffee0-0000-4000-8000-000000000005',
            x: 3200,
            y: -500,
            text: 'Pick me\nsecond line',
            color: 'pink',
        };
        await requestUtils.rest( {
            method: 'POST',
            path: `/wp/v2/wfd-boards/${ fixture.boardId }`,
            data: { layout: { ...fixture.layout, notes: [ note ] } },
        } );
        await openListening( page, fixture.boardId );
        await annotate( page );

        // A note.
        const noteTarget = ( await targetsOf( page ) ).find(
            ( t ) => t.kind === 'note'
        );
        const notePick = await pickAt( page, noteTarget );
        expect( notePick.selector ).toBe( `#wfd-ref-n_${ note.id }` );
        expect( notePick.text ).toBe( 'Note · Pick me' );

        // A colour row of the Tokens tab.
        const token = ( await targetsOf( page ) ).find(
            ( t ) => t.ref === 'wfd-ref-t_color_base'
        );
        const tokenPick = await pickAt( page, token );
        expect( tokenPick.selector ).toBe( '#wfd-ref-t_color_base' );
        const uses = await call(
            'token-show-uses',
            `--ref=${ tokenPick.selector }`
        );
        expect( typeof uses.places ).toBe( 'number' );
        expect( Array.isArray( uses.artboards ) ).toBe( true );

        // A Ghost: the artboard is far out of view, then a pan that has not
        // ended brings it under the pointer before it is drawn.
        const index = artboardOf( fixture, 'template' );
        await setViewport( page, {
            x: 100 - ( index.x + 20000 ),
            y: 100 - ( index.y + 20000 ),
            zoom: 1,
        } );
        await expect
            .poll( async () => ( await tiersOf( page ) )[ index.id ] )
            .toBe( 'ghost' );
        await page.evaluate(
            ( [ x, y ] ) => {
                const viewport = ( window as any ).wfdTest.viewport;
                ( window as any ).panning = window.setInterval(
                    () => viewport.set( { x, y, zoom: 1 } ),
                    30
                );
            },
            [ 100 - index.x, 100 - index.y ]
        );
        let ghost: any;
        await expect
            .poll( async () => {
                ghost = ( await targetsOf( page ) ).find(
                    ( t ) => t.ref === `wfd-ref-a_${ index.id }`
                );
                return !! ghost;
            } )
            .toBe( true );
        await expect
            .poll( () =>
                page.evaluate(
                    ( id ) => !! document.getElementById( id ),
                    ghost.ref
                )
            )
            .toBe( true );
        expect(
            ( await targetsOf( page ) ).filter( ( t ) =>
                t.ref.startsWith( `wfd-ref-a_${ index.id }_b_` )
            )
        ).toEqual( [] );
        // The artboard is taller than the window: a point near its corner.
        const ghostPick = await pickAt( page, {
            rect: { x: ghost.rect.x, y: ghost.rect.y, width: 120, height: 120 },
        } );
        expect( ( await tiersOf( page ) )[ index.id ] ).toBe( 'ghost' );
        await page.evaluate( () =>
            window.clearInterval( ( window as any ).panning )
        );
        expect( ghostPick.selector ).toBe( `#wfd-ref-a_${ index.id }` );
    } );

    test( 'AC-STUDIO-06 A picked block has at most two classes, made from its label and its place, and its text starts with "{label} · {where}"', async ( {
        page,
    } ) => {
        const about = artboardOf( fixture, 'page' );
        await openBoard( page, fixture.boardId );
        await boardAtRest( page );
        await bringClose( page, about );
        await annotate( page );

        const heading = await headingOf( page, about.id );
        expect( heading.where ).toBe( 'About · Desktop' );
        const pick = await pickAt( page, heading );
        expect( pick.tag ).toBe( 'div' );
        expect( pick.classes ).toEqual( [ 'heading', 'about-desktop' ] );
        expect( pick.text ).toBe( 'Heading · About · Desktop · About' );

        // Every child: two classes at most, each of letters, digits and
        // single hyphens, and the text of its target.
        const targets = await targetsOf( page );
        const children = await page
            .locator( `${ LAYER } > *` )
            .evaluateAll( ( els ) =>
                els.map( ( el ) => ( {
                    id: el.id,
                    classes: [ ...el.classList ],
                    text: el.textContent,
                } ) )
            );
        for ( const child of children ) {
            const target = targets.find( ( t ) => t.ref === child.id );
            if ( ! target ) {
                continue;
            }
            expect( child.classes.length ).toBeLessThanOrEqual( 2 );
            for ( const name of child.classes ) {
                expect( name ).toMatch( /^[\p{Ll}\p{N}]+(-[\p{Ll}\p{N}]+)*$/u );
            }
            expect( child.text ).toBe(
                [ target.label, target.where, target.text ]
                    .filter( Boolean )
                    .join( ' · ' )
            );
        }
        // A note has no place: one class, and its label then its text.
        expect(
            children.filter( ( child ) => child.classes.length === 2 ).length
        ).toBeGreaterThan( 9 );
    } );

    test( "AC-STUDIO-07 A click on a header control of the board is picked as that control, with no reference: the layer does not cover the board's own interface", async ( {
        page,
    } ) => {
        await openBoard( page, fixture.boardId );
        await boardAtRest( page );
        await annotate( page );

        const control = page.locator( '[data-wfd-control="H12"]' );
        const box = ( await control.boundingBox() )!;
        const point = {
            x: box.x + box.width / 2,
            y: box.y + box.height / 2,
        };
        // What is under the pointer is the control, not the layer.
        expect(
            await page.evaluate( ( { x, y } ) => {
                const element = document.elementFromPoint( x, y )!;
                return {
                    control: !! element.closest( '[data-wfd-control="H12"]' ),
                    layer: !! element.closest( '#wfd-studio-pick-layer' ),
                };
            }, point )
        ).toEqual( { control: true, layer: false } );
        const pick = await pickAt( page, {
            rect: { ...box },
        } );
        expect( pick.selector ?? '' ).not.toContain( 'wfd-ref-' );
        expect( [ 'button', 'svg', 'path', 'span' ] ).toContain( pick.tag );
    } );

    test( 'AC-STUDIO-08 After the board is panned every child matches targets() again and one resize event was dispatched; when nothing changed, none is', async ( {
        page,
    } ) => {
        await openBoard( page, fixture.boardId );
        await boardAtRest( page );
        await annotate( page );
        await page.evaluate( () => {
            ( window as any ).resizes = 0;
            window.addEventListener(
                'resize',
                () => ( window as any ).resizes++
            );
        } );
        const resizes = () => page.evaluate( () => ( window as any ).resizes );
        const before = await page
            .locator( `${ LAYER } > *` )
            .first()
            .boundingBox();

        const viewport = await viewportOf( page );
        await setViewport( page, { ...viewport, x: viewport.x + 37 } );
        await inStep( page );
        const after = await page
            .locator( `${ LAYER } > *` )
            .first()
            .boundingBox();
        expect( Math.round( after!.x - before!.x ) ).toBe( 37 );
        await expect.poll( resizes ).toBe( 1 );
        // The resize it caused starts no other.
        await page.waitForTimeout( 1000 );
        expect( await resizes() ).toBe( 1 );
        expect( await drift( page ) ).toBe( '' );

        // Nothing changed: Studio repeats its command as its notes change.
        const children = await page
            .locator( `${ LAYER } > *` )
            .elementHandles();
        await command( page, true );
        await command( page, true );
        await page.waitForTimeout( 1000 );
        expect( await resizes() ).toBe( 1 );
        // The same elements, not a rebuilt layer.
        const now = await page.locator( `${ LAYER } > *` ).elementHandles();
        expect( now.length ).toBe( children.length );
        for ( const [ i, child ] of children.entries() ) {
            expect(
                await page.evaluate(
                    ( [ a, b ] ) => a === b,
                    [ child, now[ i ] ]
                )
            ).toBe( true );
        }
    } );

    test( 'AC-STUDIO-09 While the layer is on, clicking and dragging on it changes nothing on the board: the selection, the artboard in edit, the layout and Review are as they were', async ( {
        page,
    } ) => {
        const hero = artboardOf( fixture, 'pattern' );
        await openBoard( page, fixture.boardId );
        await boardAtRest( page );
        await annotate( page );
        const requests: string[] = [];
        page.on( 'request', ( request ) => requests.push( request.url() ) );

        const state = async () => {
            const board: any = await callTool( page, 'board-get' );
            return {
                selection: board.selection,
                edit: board.edit,
                zoom: board.zoom,
                artboards: board.artboards.map( ( a: any ) => ( {
                    id: a.id,
                    x: a.x,
                    y: a.y,
                    changed: a.changed,
                } ) ),
                notes: board.notes,
                review: await callTool( page, 'review-list' ),
                viewport: await viewportOf( page ),
            };
        };
        const before = await state();
        expect( before.selection ).toEqual( [] );
        expect( before.edit ).toBeNull();

        const target = ( await targetsOf( page ) ).find(
            ( t ) => t.ref === `wfd-ref-a_${ hero.id }`
        );
        const x = target.rect.x + target.rect.width / 2;
        const y = target.rect.y + target.rect.height / 2;
        // A click, which the inspector takes.
        await pickAt( page, target );
        // A drag across the board.
        await page.mouse.move( x, y );
        await page.mouse.down();
        for ( let step = 1; step <= 8; step++ ) {
            await page.mouse.move( x + step * 15, y + step * 10 );
        }
        await page.mouse.up();
        // Longer than the layout's autosave waits.
        await page.waitForTimeout( 3000 );

        expect( await state() ).toEqual( before );
        await expect(
            page.locator( '[data-wfd-control="H9"]' )
        ).toBeDisabled();
        // The adapter called no tool and saved nothing: the board was not
        // written to.
        expect(
            requests.filter( ( url ) => /wfd-boards/.test( url ) )
        ).toEqual( [] );
    } );

    test( 'AC-STUDIO-10 After a command with active: false the layer is gone and G1 no longer reads "Annotating"; with the main plugin deactivated the adapter adds nothing to any page and WordPress shows no notice or error', async ( {
        page,
    } ) => {
        await openBoard( page, fixture.boardId );
        await boardAtRest( page );
        await annotate( page );
        await expect( page.locator( '[data-wfd-agent]' ) ).toHaveText(
            'Annotating'
        );
        await command( page, false );
        await expect( page.locator( LAYER ) ).toHaveCount( 0 );
        await expect(
            page.locator( '[data-wfd-agent="annotating"]' )
        ).toHaveCount( 0 );
        await expect(
            page.getByText( 'Annotating', { exact: true } )
        ).toHaveCount( 0 );
        // On again and off again works the same way.
        await command( page, true );
        await page.locator( LAYER ).waitFor( { state: 'attached' } );
        await command( page, false );
        await expect( page.locator( LAYER ) ).toHaveCount( 0 );

        const logSize = async () =>
            Number(
                (
                    await wp( [
                        'eval',
                        '$f = WP_CONTENT_DIR . "/debug.log"; clearstatcache(); echo file_exists( $f ) ? filesize( $f ) : 0;',
                    ] )
                ).stdout.trim()
            );
        try {
            expect(
                ( await wp( [ 'plugin', 'deactivate', MAIN ] ) ).code
            ).toBe( 0 );
            const size = await logSize();
            const requests: string[] = [];
            page.on( 'request', ( request ) => requests.push( request.url() ) );
            const errors: string[] = [];
            page.on( 'console', ( message ) => {
                if ( message.type() === 'error' ) {
                    errors.push( message.text() );
                }
            } );
            page.on( 'pageerror', ( error ) => errors.push( String( error ) ) );
            for ( const url of [
                '/wp-admin/plugins.php',
                '/wp-admin/index.php',
                '/wp-admin/edit.php?post_type=page',
                '/',
            ] ) {
                const response = await page.goto( url );
                expect( response!.status(), url ).toBe( 200 );
                await expect( page.locator( LAYER ) ).toHaveCount( 0 );
                // Shown ones: the Plugins screen holds hidden notices of
                // its own, for what its scripts may report later.
                expect(
                    await page
                        .locator(
                            '.notice-error, .notice-warning, div.error, .wp-die-message'
                        )
                        .evaluateAll( ( els ) =>
                            els
                                .filter(
                                    ( el ) =>
                                        ( el as HTMLElement ).offsetParent !==
                                        null
                                )
                                .map( ( el ) => el.textContent!.trim() )
                        ),
                    url
                ).toEqual( [] );
                expect(
                    await page.locator( 'body' ).innerText(),
                    url
                ).not.toMatch(
                    /Fatal error|Warning:|Notice:|Deprecated:|critical error/
                );
            }
            // The adapter is active and listed, and that is all of it.
            await page.goto( '/wp-admin/plugins.php' );
            await expect(
                page.locator(
                    'tr.active[data-plugin="wfd-studio/wfd-studio.php"]'
                )
            ).toHaveCount( 1 );
            expect(
                requests.filter( ( url ) =>
                    /wfd-studio|pick-layer/.test( url )
                )
            ).toEqual( [] );
            expect( errors ).toEqual( [] );
            // WP-CLI loads the adapter too.
            const listed = await wp( [
                'plugin',
                'list',
                '--status=active',
                '--field=name',
            ] );
            expect( listed.code ).toBe( 0 );
            expect( listed.stdout ).toContain( 'wfd-studio' );
            expect( listed.stderr ).not.toMatch(
                /Warning|Notice|Fatal|Deprecated/
            );
            expect( await logSize() ).toBe( size );
        } finally {
            await wp( [ 'plugin', 'activate', MAIN ] );
        }
    } );

    test( "AC-STUDIO-11 wp wfd tools prints the runbook section of adapter.md, verbatim, after the main plugin's text and before # Tools", async () => {
        expect( SECTION.split( '\n' ) ).toHaveLength( 5 );
        const { stdout, code } = await wp( [ 'wfd', 'tools' ] );
        expect( code ).toBe( 0 );
        // The main plugin's text ends with this line.
        const last =
            'The answer is one JSON object: {"ok":true,"result":...} or {"ok":false,"error":{"code":"...","message":"..."}}.';
        expect( stdout ).toContain( `${ last }\n\n${ SECTION }\n\n# Tools\n` );
        expect(
            stdout.startsWith( '# Working on a WordPress for Designers board' )
        ).toBe( true );
        expect( stdout.split( 'Annotations from Studio:' ) ).toHaveLength( 2 );
    } );
} );
