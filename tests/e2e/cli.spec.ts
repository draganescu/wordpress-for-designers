import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import { resetFixture, openBoard, boardAtRest } from './utils';
import { wfd, php, listening } from './agent-utils';

const root = process.cwd();
const declarationsText = readFileSync(
    path.join( root, 'includes/agent-tools.json' ),
    'utf8'
);
const declarations = JSON.parse( declarationsText );

/**
 * The tool names of spec/agent/tools.md, in that file's order.
 */
function specTools(): string[] {
    const spec = readFileSync(
        path.join( root, 'spec/agent/tools.md' ),
        'utf8'
    );
    // The rows of each "Tool | Description | Same as" table.
    const names: string[] = [];
    let inTable = false;
    for ( const line of spec.split( '\n' ) ) {
        if ( line.startsWith( '| Tool | Description | Same as |' ) ) {
            inTable = true;
        } else if ( ! line.startsWith( '|' ) ) {
            inTable = false;
        } else if ( inTable ) {
            const name = line.match( /^\| `([a-z-]+)` \| / )?.[ 1 ];
            if ( name ) {
                names.push( name );
            }
        }
    }
    return names;
}

/**
 * The runbook of spec/agent/cli.md.
 */
function specRunbook(): string {
    const spec = readFileSync( path.join( root, 'spec/agent/cli.md' ), 'utf8' );
    const from = spec.indexOf( 'The runbook is this text' );
    const start = spec.indexOf( '```text\n', from ) + '```text\n'.length;
    return spec.slice( start, spec.indexOf( '\n```', start ) );
}

function toolList(): string {
    const lines = [ '# Tools' ];
    for ( const tool of declarations ) {
        lines.push( '', `## ${ tool.name }`, tool.description );
        const fields = Object.entries< any >( tool.input.properties );
        if ( ! fields.length ) {
            lines.push( 'Input: none' );
            continue;
        }
        lines.push( 'Input:' );
        for ( const [ field, schema ] of fields ) {
            const type = [].concat( schema.enum ?? schema.type ).join( ' | ' );
            lines.push(
                ( tool.input.required ?? [] ).includes( field )
                    ? `- ${ field } (${ type }, required)`
                    : `- ${ field } (${ type })`
            );
        }
    }
    return lines.join( '\n' );
}

test.describe( 'CLI', () => {
    test( "AC-CLI-01 tools --format=json prints the declarations: 21 tools in the order of tools.md, equal to the page's", async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        const ran = await wfd( [ 'tools', '--format=json' ] );
        expect( ran.code ).toBe( 0 );
        expect( ran.stdout.trim() ).toBe( declarationsText.trim() );
        expect( declarations ).toHaveLength( 21 );
        expect( declarations.map( ( tool: any ) => tool.name ) ).toEqual(
            specTools()
        );
        for ( const tool of declarations ) {
            expect( Object.keys( tool ) ).toEqual( [
                'name',
                'description',
                'input',
            ] );
            expect( tool.input.type ).toBe( 'object' );
            expect( tool.input.additionalProperties ).toBe( false );
        }
        await openBoard( page, fixture.boardId );
        const tools = await page.evaluate(
            async () => ( await ( window as any ).wfdAgent.ready() ).tools
        );
        expect( tools ).toEqual( declarations );
    } );

    test( 'AC-CLI-02 tools prints the runbook verbatim, filtered text, then the tool list', async ( {
        requestUtils,
    } ) => {
        await resetFixture( requestUtils );
        const plain = await wfd( [ 'tools' ] );
        expect( plain.code ).toBe( 0 );
        expect( plain.stdout.trimEnd() ).toBe(
            specRunbook() + '\n\n' + toolList()
        );

        await php(
            'update_option( "wfd_test_runbook", "An adapter\'s own section." );'
        );
        const filtered = await wfd( [ 'tools' ] );
        expect( filtered.stdout.trimEnd() ).toBe(
            specRunbook() +
                "\n\nAn adapter's own section." +
                '\n\n' +
                toolList()
        );
        await php( 'delete_option( "wfd_test_runbook" );' );
    } );

    test( 'AC-CLI-03 A call given with flags, with --input and with --ref has the same effect and prints the same result', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await wfd( [ 'status' ] );
        const asked = listening( page );
        await openBoard( page, fixture.boardId );
        await asked;
        await boardAtRest( page );
        const hero = fixture.layout.artboards.find(
            ( a ) => a.kind === 'pattern'
        )!;
        const place = () =>
            page.evaluate( ( id ) => {
                const { x, y, device } = ( window as any ).wp.data
                    .select( 'wfd/board' )
                    .getArtboard( id );
                return { x, y, device };
            }, hero.id );
        const back = () =>
            page.evaluate(
                ( [ id, x, y ] ) => {
                    const board = ( window as any ).wp.data.dispatch(
                        'wfd/board'
                    );
                    board.moveArtboard( id, x, y );
                    board.setArtboardDevice( id, 'desktop' );
                },
                [ hero.id, hero.x, hero.y ] as const
            );
        const ways = [
            [
                `--artboard=${ hero.id }`,
                '--x=4321',
                '--y=-123.5',
                '--device=tablet',
            ],
            [
                `--input=${ JSON.stringify( {
                    artboard: hero.id,
                    x: 4321,
                    y: -123.5,
                    device: 'tablet',
                } ) }`,
            ],
            [
                `--ref=wfd-ref-a_${ hero.id }`,
                '--x=4321',
                '--y=-123.5',
                '--device=tablet',
            ],
            // A flag is set on top of --input.
            [
                `--input=${ JSON.stringify( {
                    artboard: hero.id,
                    x: 1,
                    y: -123.5,
                    device: 'tablet',
                } ) }`,
                '--x=4321',
            ],
        ];
        const printed: string[] = [];
        for ( const flags of ways ) {
            const ran = await wfd( [ 'call', 'artboard-update', ...flags ] );
            expect( ran.code ).toBe( 0 );
            const { ok, result } = JSON.parse( ran.stdout );
            expect( ok ).toBe( true );
            expect( await place() ).toEqual( {
                x: 4321,
                y: -123.5,
                device: 'tablet',
            } );
            const { height, tier, ...rest } = result;
            printed.push( JSON.stringify( rest ) );
            await back();
            expect( await place() ).toEqual( {
                x: hero.x,
                y: hero.y,
                device: 'desktop',
            } );
        }
        expect( new Set( printed ).size ).toBe( 1 );

        // --ref goes to slug when the tool has no artboard field, and a
        // tool with neither refuses it.
        const none = await wfd( [
            'call',
            'board-get',
            `--ref=wfd-ref-a_${ hero.id }`,
        ] );
        expect( none.code ).toBe( 1 );
        expect( JSON.parse( none.stdout ).error.code ).toBe( 'invalid_args' );
    } );

    test( 'AC-CLI-04 An unknown tool fails with unknown_tool, also with no board open', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        const expected = {
            ok: false,
            error: {
                code: 'unknown_tool',
                message: 'There is no tool named nothing-here.',
            },
        };
        const none = await wfd( [ 'call', 'nothing-here' ] );
        expect( none.code ).toBe( 1 );
        expect( JSON.parse( none.stdout ) ).toEqual( expected );

        const asked = listening( page );
        await openBoard( page, fixture.boardId );
        await asked;
        const open = await wfd( [ 'call', 'nothing-here' ] );
        expect( open.code ).toBe( 1 );
        expect( JSON.parse( open.stdout ) ).toEqual( expected );
    } );

    test( 'AC-CLI-05 Input that breaks the schema fails with invalid_args naming the field, and changes nothing', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await wfd( [ 'status' ] );
        const asked = listening( page );
        await openBoard( page, fixture.boardId );
        await asked;
        await boardAtRest( page );
        // Heights and tiers settle by themselves; the rest must not change.
        const state = async () => {
            const { result } = JSON.parse(
                ( await wfd( [ 'call', 'board-get' ] ) ).stdout
            );
            return {
                ...result,
                artboards: result.artboards.map(
                    ( { height, tier, ...rest }: any ) => rest
                ),
            };
        };
        const before = await state();

        const cases: [ string[], string ][] = [
            [
                [ 'board-get', '--nope=1' ],
                'nope is not a field of board-get.',
            ],
            [ [ 'board-select' ], 'artboards is required.' ],
            [
                [ 'board-select', '--artboards=one' ],
                'artboards must be an array.',
            ],
            [
                [ 'board-select', '--artboards=[]' ],
                'artboards must have at least 1 item.',
            ],
            [
                [
                    'artboard-update',
                    `--artboard=${ fixture.layout.artboards[ 0 ].id }`,
                    '--device=phone',
                ],
                'device must be one of desktop, tablet, mobile.',
            ],
            [
                [ 'token-set', '--kind=color', '--slug=base', '--value=red' ],
                'value must match ^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$.',
            ],
            [
                [
                    'blocks-get',
                    `--artboard=${ fixture.layout.artboards[ 0 ].id }`,
                    '--depth=11',
                ],
                'depth must be 10 or less.',
            ],
        ];
        for ( const [ args, message ] of cases ) {
            const ran = await wfd( [ 'call', ...args ] );
            expect( ran.code ).toBe( 1 );
            expect( JSON.parse( ran.stdout ) ).toEqual( {
                ok: false,
                error: { code: 'invalid_args', message },
            } );
        }
        const after = await state();
        expect( after ).toEqual( before );
        await expect(
            page.locator( '[data-wfd-control="H9"]' )
        ).toBeDisabled();
    } );

    test( 'AC-CLI-06 batch runs in order; after a failure the rest are skipped and the exit code is 1', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        await wfd( [ 'status' ] );
        const asked = listening( page );
        await openBoard( page, fixture.boardId );
        await asked;

        const good = await wfd( [
            'batch',
            `--calls=${ JSON.stringify( [
                { tool: 'board-get', input: {} },
                { tool: 'board-get' },
            ] ) }`,
        ] );
        expect( good.code ).toBe( 0 );
        const all = JSON.parse( good.stdout );
        expect( all.ok ).toBe( true );
        expect( all.results ).toHaveLength( 2 );
        expect( all.results.every( ( r: any ) => r.ok ) ).toBe( true );

        // From standard input, the second of three fails.
        const bad = await wfd(
            [ 'batch' ],
            JSON.stringify( [
                { tool: 'board-get', input: {} },
                { tool: 'board-get', input: { nope: 1 } },
                { tool: 'board-get', input: {} },
            ] )
        );
        expect( bad.code ).toBe( 1 );
        const mixed = JSON.parse( bad.stdout );
        expect( mixed.ok ).toBe( false );
        expect( mixed.results ).toHaveLength( 3 );
        expect( mixed.results[ 0 ].ok ).toBe( true );
        expect( mixed.results[ 0 ].result.board.id ).toBe( fixture.boardId );
        expect( mixed.results[ 1 ].error.code ).toBe( 'invalid_args' );
        expect( mixed.results[ 2 ] ).toEqual( {
            ok: false,
            error: { code: 'skipped', message: 'An earlier call failed.' },
        } );
    } );

    test( 'AC-CLI-07 status, call and batch print one JSON document and nothing else', async ( {
        page,
        requestUtils,
    } ) => {
        const fixture = await resetFixture( requestUtils );
        const one = ( stdout: string ) => {
            expect( stdout.endsWith( '\n' ) ).toBe( true );
            const text = stdout.slice( 0, -1 );
            expect( text ).not.toContain( '\n' );
            expect( () => JSON.parse( text ) ).not.toThrow();
        };
        one( ( await wfd( [ 'status' ] ) ).stdout );
        one( ( await wfd( [ 'call', 'board-get' ] ) ).stdout );
        one( ( await wfd( [ 'batch', '--calls=[]' ] ) ).stdout );
        const asked = listening( page );
        await openBoard( page, fixture.boardId );
        await asked;
        one( ( await wfd( [ 'status' ] ) ).stdout );
        one( ( await wfd( [ 'call', 'board-get' ] ) ).stdout );
        one(
            (
                await wfd( [
                    'batch',
                    '--calls=[{"tool":"board-get","input":{}}]',
                ] )
            ).stdout
        );
        one( ( await wfd( [ 'call', 'board-get', '--nope=1' ] ) ).stdout );
    } );
} );
