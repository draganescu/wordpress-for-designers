import fs from 'node:fs';
const dir = new URL( './results/', import.meta.url ).pathname;
const files = fs.readdirSync( dir ).filter( ( f ) => f.endsWith( '.json' ) && ( ! process.argv[ 2 ] || f.startsWith( process.argv[ 2 ] ) ) );
const rows = files.map( ( f ) => JSON.parse( fs.readFileSync( dir + f ) ) );
const names = [ '1-toolbar', '2-hit-typing', '3-link-popover', '4-slash-inserter', '5-add-block-button', '6-toolbar-menu', '7-inbetween', '8-selection', '9-drop-indicator', '10-image' ];
rows.sort( ( a, b ) => ( a.browser + a.mode + a.fix ).localeCompare( b.browser + b.mode + b.fix ) || a.zoom - b.zoom );
console.log( [ 'browser', 'mode', 'zoom', ...names.map( ( n ) => n.split( '-' )[ 0 ] ), 'innerW', 'mq1440', 'errs' ].join( '\t' ) );
for ( const r of rows ) {
    console.log( [ r.browser, r.mode + ( r.fix ? '+fix' : '' ), r.zoom, ...names.map( ( n ) => { const c = r.checks[ n ]; return ! c ? '-' : c.pass === null ? 'n/m' : c.pass ? 'ok' : 'FAIL'; } ), r.layout?.innerWidth, r.layout?.mqMin1440, r.errors?.length ].join( '\t' ) );
}
