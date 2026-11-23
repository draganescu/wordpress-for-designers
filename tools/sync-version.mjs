/**
 * Keeps the versions of the plugin and its adapters in step with
 * package.json.
 *
 * Usage:
 *   node tools/sync-version.mjs                 Writes the version of
 *                                               package.json into the plugin
 *                                               header, WFD_VERSION and each
 *                                               adapter's header and readme.
 *   node tools/sync-version.mjs --stage         The same, then stages the
 *                                               files it wrote (npm version).
 *   node tools/sync-version.mjs --check [tag]   Exits 1 unless all of them
 *                                               match, and match the tag
 *                                               (v1.2.3) when one is given.
 *
 * An adapter is a folder under adapters/ with a plugin/ folder. Its version is
 * the main plugin's version it was built with, so each release ships them
 * together.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PLUGIN_FILE = 'wordpress-for-designers.php';
const ADAPTERS_DIR = 'adapters';
const HEADER = /^( \* Version:\s+)(\S+)()$/m;
const CONSTANT = /(define\( 'WFD_VERSION', ')([^']+)(' \);)/;
const PLUGIN_NAME = /^ \* Plugin Name:/m;
const STABLE_TAG = /^(Stable tag:\s*)(\S+)()$/m;

/**
 * Every place a version is written, as { file, label, pattern }. Each pattern
 * has three groups: what comes before the version, the version, and what
 * comes after it.
 */
function versionFields() {
    const fields = [
        {
            file: PLUGIN_FILE,
            label: 'Version header',
            pattern: HEADER,
        },
        { file: PLUGIN_FILE, label: 'WFD_VERSION', pattern: CONSTANT },
    ];

    if ( ! existsSync( ADAPTERS_DIR ) ) {
        return fields;
    }

    for ( const adapter of readdirSync( ADAPTERS_DIR ).sort() ) {
        const pluginDir = join( ADAPTERS_DIR, adapter, 'plugin' );
        if ( ! existsSync( pluginDir ) ) {
            continue;
        }
        for ( const name of readdirSync( pluginDir ).sort() ) {
            const file = join( pluginDir, name );
            if ( name.endsWith( '.php' ) ) {
                if ( PLUGIN_NAME.test( readFileSync( file, 'utf8' ) ) ) {
                    fields.push( {
                        file,
                        label: `${ file } Version header`,
                        pattern: HEADER,
                    } );
                }
            } else if ( name === 'readme.txt' ) {
                fields.push( {
                    file,
                    label: `${ file } Stable tag`,
                    pattern: STABLE_TAG,
                } );
            }
        }
    }

    return fields;
}

const { version } = JSON.parse( readFileSync( 'package.json', 'utf8' ) );
const fields = versionFields();
const contents = new Map();

for ( const field of fields ) {
    if ( ! contents.has( field.file ) ) {
        contents.set( field.file, readFileSync( field.file, 'utf8' ) );
    }
    const match = contents.get( field.file ).match( field.pattern );
    if ( ! match ) {
        process.stderr.write( `${ field.label }: not found.\n` );
        process.exit( 1 );
    }
    field.value = match[ 2 ];
}

const [ , , mode, tag ] = process.argv;

if ( mode === '--check' ) {
    const found = { 'package.json': version };
    for ( const field of fields ) {
        found[ field.label ] = field.value;
    }
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
    for ( const field of fields ) {
        contents.set(
            field.file,
            contents
                .get( field.file )
                .replace( field.pattern, `$1${ version }$3` )
        );
    }
    for ( const [ file, text ] of contents ) {
        writeFileSync( file, text );
        process.stdout.write( `${ file } set to ${ version }\n` );
    }
    if ( mode === '--stage' ) {
        execFileSync( 'git', [ 'add', '--', ...contents.keys() ], {
            stdio: 'inherit',
        } );
    }
}
