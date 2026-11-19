/**
 * Turns the performance suite's results into a Markdown report, compares
 * them with another build's when given one, and checks them against the
 * budgets.
 *
 *     node tools/perf-report.mjs --head head.jsonl [--base base.jsonl]
 *         [--budgets tests/perf/budgets.json] [--strict]
 *
 * A results file has one JSON line per measurement: name, value, unit. A
 * name measured several times is reported as its median. Exits with 1 when
 * a budget is exceeded or, with --strict, when a budgeted indicator was not
 * measured.
 */
import fs from 'node:fs';

const args = process.argv.slice( 2 );
const option = ( name ) =>
    args.includes( name ) ? args[ args.indexOf( name ) + 1 ] : undefined;
const headFile = option( '--head' );
const baseFile = option( '--base' );
const budgetsFile = option( '--budgets' );
const isStrict = args.includes( '--strict' );

if ( ! headFile || ! fs.existsSync( headFile ) ) {
    process.stderr.write( 'Give the results to report with --head.\n' );
    process.exit( 1 );
}

/**
 * Reads a results file into a map of name to its measurements.
 *
 * @param {string} file Path of the file.
 * @return {Map} Name to `{ unit, values, list }`, in the order first seen.
 */
function read( file ) {
    const results = new Map();
    for ( const line of fs.readFileSync( file, 'utf8' ).split( '\n' ) ) {
        if ( ! line.trim() ) {
            continue;
        }
        const { name, value, unit, list } = JSON.parse( line );
        if ( ! results.has( name ) ) {
            results.set( name, { unit, values: [], list } );
        }
        results.get( name ).values.push( value );
    }
    return results;
}

function median( values ) {
    const sorted = [ ...values ].sort( ( a, b ) => a - b );
    const middle = Math.floor( sorted.length / 2 );
    return sorted.length % 2
        ? sorted[ middle ]
        : ( sorted[ middle - 1 ] + sorted[ middle ] ) / 2;
}

function format( value, unit ) {
    if ( value === undefined ) {
        return '';
    }
    if ( unit === 'bytes' ) {
        const size = Math.abs( value );
        if ( size >= 1024 * 1024 ) {
            return `${ ( value / 1024 / 1024 ).toFixed( 1 ) } MB`;
        }
        return size >= 1024
            ? `${ ( value / 1024 ).toFixed( 1 ) } kB`
            : `${ Math.round( value ) } B`;
    }
    if ( unit === 'ms' ) {
        return Math.abs( value ) >= 1000
            ? `${ ( value / 1000 ).toFixed( 2 ) } s`
            : `${ Math.round( value ) } ms`;
    }
    return Math.round( value ).toLocaleString( 'en-US' );
}

// How much a figure of each unit must move before the report points at it.
const NOTABLE = { count: 0.02, bytes: 0.05, ms: 0.1 };

const head = read( headFile );
const base = baseFile && fs.existsSync( baseFile ) ? read( baseFile ) : null;
const budgets = budgetsFile
    ? JSON.parse( fs.readFileSync( budgetsFile, 'utf8' ) )
    : {};

const rows = [];
const overBudget = [];
for ( const [ name, { unit, values, list } ] of head ) {
    const value = median( values );
    const row = { name, unit, value, list, runs: values.length };
    const before = base?.get( name );
    if ( before ) {
        row.base = median( before.values );
        row.baseList = before.list;
        const change = row.base ? ( value - row.base ) / row.base : 0;
        row.change = change;
        // A timing has to leave the range the other build was seen in.
        const isOutside =
            unit !== 'ms' ||
            value > Math.max( ...before.values ) ||
            value < Math.min( ...before.values );
        row.isNotable =
            ( row.base === 0
                ? value !== 0
                : Math.abs( change ) >= NOTABLE[ unit ] ) && isOutside;
    }
    if ( name in budgets ) {
        row.budget = budgets[ name ];
        if ( value > row.budget ) {
            overBudget.push( row );
        }
    }
    rows.push( row );
}
const unmeasured = Object.keys( budgets ).filter(
    ( name ) => ! head.has( name )
);

const changeOf = ( row ) => {
    if ( row.change === undefined ) {
        return '';
    }
    if ( row.base === 0 ) {
        return row.value === 0 ? '0%' : 'was 0';
    }
    const percent = row.change * 100;
    return `${ percent > 0 ? '+' : '' }${ percent.toFixed( 1 ) }%`;
};
const table = ( list ) => {
    const lines = base
        ? [
              '| Indicator | Base | Head | Change | Budget |',
              '|---|--:|--:|--:|--:|',
          ]
        : [ '| Indicator | Value | Budget |', '|---|--:|--:|' ];
    for ( const row of list ) {
        const budget =
            row.budget === undefined ? '' : format( row.budget, row.unit );
        const value =
            format( row.value, row.unit ) +
            ( row.budget !== undefined && row.value > row.budget ? ' ❌' : '' );
        lines.push(
            base
                ? `| \`${ row.name }\` | ${ format( row.base, row.unit ) } | ${ value } | ${ changeOf( row ) } | ${ budget } |`
                : `| \`${ row.name }\` | ${ value } | ${ budget } |`
        );
    }
    return lines.join( '\n' );
};

const out = [ '## Performance', '' ];
if ( overBudget.length || ( isStrict && unmeasured.length ) ) {
    out.push( '### Over budget', '' );
    if ( overBudget.length ) {
        out.push( table( overBudget ), '' );
    }
    if ( isStrict && unmeasured.length ) {
        out.push(
            'Budgeted but not measured: ' +
                unmeasured.map( ( name ) => `\`${ name }\`` ).join( ', ' ) +
                '.',
            ''
        );
    }
    out.push(
        'A budget is the most an indicator may be, in `tests/perf/budgets.json`. If the rise is meant, raise the budget in the same pull request.',
        ''
    );
} else if ( Object.keys( budgets ).length ) {
    out.push( 'Every budget is met.', '' );
}

if ( base ) {
    const notable = rows.filter( ( row ) => row.isNotable );
    out.push( '### Changes worth a look', '' );
    out.push(
        notable.length
            ? table( notable )
            : 'Nothing moved by more than run-to-run variation.',
        ''
    );
    for ( const row of rows ) {
        if ( row.list && row.baseList ) {
            const added = row.list.filter(
                ( item ) => ! row.baseList.includes( item )
            );
            const removed = row.baseList.filter(
                ( item ) => ! row.list.includes( item )
            );
            if ( added.length || removed.length ) {
                out.push(
                    `\`${ row.name }\`: ` +
                        [
                            added.length && `added ${ added.join( ', ' ) }`,
                            removed.length &&
                                `removed ${ removed.join( ', ' ) }`,
                        ]
                            .filter( Boolean )
                            .join( '; ' ) +
                        '.',
                    ''
                );
            }
        }
    }
}

out.push(
    '<details><summary>Every indicator</summary>',
    '',
    table( rows ),
    '',
    'Timings are the median of the runs made, on a main thread slowed to stand for an older laptop. `@2x` is device pixel ratio 2. What each indicator means is in `docs/performance.md`.',
    '',
    '</details>',
    ''
);
process.stdout.write( out.join( '\n' ) );

if ( overBudget.length || ( isStrict && unmeasured.length ) ) {
    process.exit( 1 );
}
