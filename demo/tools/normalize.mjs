/**
 * Rewrites the demo's block markup the way the block editor would save it, so
 * that no block opens with "Attempt recovery". It parses each file in the
 * editor of a running site, rebuilds every block the editor finds invalid from
 * its attributes and inner blocks, and writes the result back.
 *
 * Run from the repository root with the demo site up:
 * node demo/tools/normalize.mjs [--check]
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname( fileURLToPath( import.meta.url ) );
const demo = join( here, '..' );
const site = process.env.WFD_DEMO_URL || 'http://localhost:8900';
const check = process.argv.includes( '--check' );

function htmlFiles( dir ) {
    return readdirSync( dir ).flatMap( ( name ) => {
        const path = join( dir, name );
        if ( statSync( path ).isDirectory() ) {
            return htmlFiles( path );
        }
        return name.endsWith( '.html' ) ? [ path ] : [];
    } );
}

const files = [
    ...htmlFiles( join( demo, 'plugin/wfd-demo/content' ) ),
    ...htmlFiles( join( demo, 'theme/morrow/templates' ) ),
    ...htmlFiles( join( demo, 'theme/morrow/parts' ) ),
];

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto( `${ site }/wp-login.php` );
await page.fill( '#user_login', 'admin' );
await page.fill( '#user_pass', 'password' );
await page.click( '#wp-submit' );
await page.goto( `${ site }/wp-admin/post-new.php?post_type=page` );
await page.waitForFunction(
    () => window.wp?.blocks?.getBlockTypes().length > 50
);

let changed = 0;
let rebuilt = 0;
for ( const file of files ) {
    const before = readFileSync( file, 'utf8' );
    const result = await page.evaluate( ( markup ) => {
        const { parse, serialize, createBlock } = window.wp.blocks;
        const names = [];
        const fix = ( block ) => {
            const inner = block.innerBlocks.map( fix );
            if ( block.isValid ) {
                return { ...block, innerBlocks: inner };
            }
            names.push( block.name );
            return createBlock( block.name, block.attributes, inner );
        };
        const blocks = parse( markup ).map( fix );
        const after = serialize( blocks );
        const stillInvalid = [];
        const walk = ( block ) => {
            if ( ! block.isValid ) {
                stillInvalid.push( block.name );
            }
            block.innerBlocks.forEach( walk );
        };
        parse( after ).forEach( walk );
        return { after, names, stillInvalid };
    }, before );

    const after = result.after + '\n';
    const name = relative( demo, file );
    if ( result.stillInvalid.length ) {
        process.stdout.write(
            `STILL INVALID ${ name }: ${ result.stillInvalid.join( ', ' ) }\n`
        );
        process.exitCode = 1;
    }
    if ( after !== before ) {
        changed++;
        rebuilt += result.names.length;
        process.stdout.write(
            `${ check ? 'differs' : 'rewrote' } ${ name } (${
                result.names.length
            } rebuilt)\n`
        );
        if ( ! check ) {
            writeFileSync( file, after );
        } else {
            process.exitCode = 1;
        }
    }
}
await browser.close();
process.stdout.write(
    `${ files.length } files, ${ changed } changed, ${ rebuilt } blocks rebuilt\n`
);
