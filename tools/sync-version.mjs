/**
 * Keeps the plugin's version in step with package.json.
 *
 * Usage:
 *   node tools/sync-version.mjs                 Writes the version of
 *                                               package.json into the plugin
 *                                               header and WFD_VERSION.
 *   node tools/sync-version.mjs --check [tag]   Exits 1 unless all three
 *                                               match, and match the tag
 *                                               (v1.2.3) when one is given.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const PLUGIN_FILE = 'wordpress-for-designers.php';
const HEADER = /^( \* Version:\s+)(\S+)$/m;
const CONSTANT = /(define\( 'WFD_VERSION', ')([^']+)(' \);)/;

const { version } = JSON.parse( readFileSync( 'package.json', 'utf8' ) );
const php = readFileSync( PLUGIN_FILE, 'utf8' );
const header = php.match( HEADER );
const constant = php.match( CONSTANT );

if ( ! header || ! constant ) {
    process.stderr.write(
        `${ PLUGIN_FILE }: the Version header or WFD_VERSION was not found.\n`
    );
    process.exit( 1 );
}

const [ , , mode, tag ] = process.argv;

if ( mode === '--check' ) {
    const found = {
        'package.json': version,
        'Version header': header[ 2 ],
        WFD_VERSION: constant[ 2 ],
    };
    if ( tag ) {
        found.tag = tag.replace( /^v/, '' );
    }
    if ( new Set( Object.values( found ) ).size > 1 ) {
        const lines = Object.entries( found ).map(
            ( [ name, value ] ) => `  ${ name }: ${ value }`
        );
        process.stderr.write(
            `Versions do not match:\n${ lines.join( '\n' ) }\n`
        );
        process.exit( 1 );
    }
    process.stdout.write( `Version ${ version }\n` );
} else {
    writeFileSync(
        PLUGIN_FILE,
        php
            .replace( HEADER, `$1${ version }` )
            .replace( CONSTANT, `$1${ version }$3` )
    );
    process.stdout.write( `${ PLUGIN_FILE } set to ${ version }\n` );
}
