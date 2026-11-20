/**
 * Measures what the plugin ships: the size of each built script and style
 * sheet, as it is and gzipped, and the WordPress scripts each entry depends
 * on. Prints one JSON line per measurement, in the format of the
 * performance suite's results files.
 *
 *     node tools/perf-bundle.mjs [build folder] > artifacts/perf/bundle.jsonl
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const dir = path.resolve( process.argv[ 2 ] ?? 'build' );
if ( ! fs.existsSync( dir ) ) {
    process.stderr.write(
        `No build folder at ${ dir }. Run the build first.\n`
    );
    process.exit( 1 );
}

const print = ( line ) => process.stdout.write( JSON.stringify( line ) + '\n' );

for ( const file of fs.readdirSync( dir ).sort() ) {
    const full = path.join( dir, file );
    // Right-to-left sheets are the same size as their counterparts.
    if ( /\.(js|css)$/.test( file ) && ! file.endsWith( '-rtl.css' ) ) {
        const content = fs.readFileSync( full );
        print( {
            name: `bundle.${ file }`,
            value: content.length,
            unit: 'bytes',
        } );
        print( {
            name: `bundle.${ file }.gzip`,
            value: zlib.gzipSync( content, { level: 9 } ).length,
            unit: 'bytes',
        } );
    }
    if ( file.endsWith( '.asset.php' ) ) {
        const entry = file.replace( '.asset.php', '' );
        const source = fs.readFileSync( full, 'utf8' );
        const list = source.match( /'dependencies'\s*=>\s*array\(([^)]*)\)/ );
        const dependencies = list
            ? [ ...list[ 1 ].matchAll( /'([^']+)'/g ) ].map( ( m ) => m[ 1 ] )
            : [];
        print( {
            name: `bundle.${ entry }.dependencies`,
            value: dependencies.length,
            unit: 'count',
            list: dependencies,
        } );
    }
}
