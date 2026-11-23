/**
 * Spike (a): for every block of every fixture artboard, the path read from
 * the Preview's document, and from its Snapshot, equals the block's path in
 * the Live editor's tree (spec/agent/surface.md, Block paths).
 *
 *   node spikes/agent/tests/run-a.mjs
 */
import {
    open,
    resetFixture,
    openBoard,
    boardAtRest,
    bringIntoView,
    setViewport,
    enterEdit,
    tierOf,
    save,
} from './lib.mjs';

/**
 * Paths read from what is drawn, exactly as surface.md words it: a block is
 * an element with a `data-block` attribute, its inner blocks are the
 * `data-block` elements whose nearest `data-block` ancestor it is, in
 * document order.
 */
const readDocument = ( iframe ) => {
    const doc = iframe.contentDocument;
    const paths = new Map();
    const counts = new Map();
    const out = [];
    for ( const el of doc.querySelectorAll( '[data-block]' ) ) {
        const parent = el.parentElement?.closest( '[data-block]' ) ?? null;
        const index = counts.get( parent ) ?? 0;
        counts.set( parent, index + 1 );
        const path = parent ? [ ...paths.get( parent ), index ] : [ index ];
        paths.set( el, path );
        out.push( path.join( '.' ) + ' ' + el.getAttribute( 'data-type' ) );
    }
    return out;
};

/** Waits until a document's block list has stopped changing. */
async function stableDocument( page, selector, quiet = 1500 ) {
    let last = null;
    let since = Date.now();
    const deadline = Date.now() + 30000;
    while ( Date.now() < deadline ) {
        const now = await page
            .locator( selector )
            .first()
            .evaluate( readDocument )
            .catch( () => null );
        const key = JSON.stringify( now );
        if ( key !== last ) {
            last = key;
            since = Date.now();
        } else if ( now && now.length && Date.now() - since >= quiet ) {
            return now;
        }
        await page.waitForTimeout( 150 );
    }
    return JSON.parse( last );
}

/**
 * The Live editor's own tree, from its core/block-editor store, read two
 * ways. "literal" is surface.md's wording: `getBlocks()` and `innerBlocks`
 * under each block. "perBlock" asks `getBlocks( clientId )` for each block's
 * inner blocks, which is how the store gives the inner blocks of a block
 * that controls them (a template part, a page's Content, a synced pattern).
 */
const readLive = ( how ) => {
    const select = window.wfdTest.editorBridge.current.registry.select(
        'core/block-editor'
    );
    const out = [];
    const walk = ( blocks, prefix ) =>
        blocks.forEach( ( block, index ) => {
            const path = [ ...prefix, index ];
            out.push( path.join( '.' ) + ' ' + block.name );
            walk(
                how === 'literal'
                    ? block.innerBlocks
                    : select.getBlocks( block.clientId ),
                path
            );
        } );
    walk( select.getBlocks(), [] );
    return out;
};

async function stableLive( page, how, quiet = 1500 ) {
    let last = null;
    let since = Date.now();
    const deadline = Date.now() + 30000;
    while ( Date.now() < deadline ) {
        const now = await page.evaluate( readLive, how ).catch( () => null );
        const key = JSON.stringify( now );
        if ( key !== last ) {
            last = key;
            since = Date.now();
        } else if ( now && now.length && Date.now() - since >= quiet ) {
            return now;
        }
        await page.waitForTimeout( 150 );
    }
    return JSON.parse( last );
}

const diff = ( a, b ) => ( {
    onlyInFirst: a.filter( ( x ) => ! b.includes( x ) ),
    onlyInSecond: b.filter( ( x ) => ! a.includes( x ) ),
} );
const same = ( a, b ) => JSON.stringify( a ) === JSON.stringify( b );

const { browser, page, errors } = await open();
const fixture = await resetFixture( page );
await openBoard( page, fixture.boardId );
await boardAtRest( page );

const artboards = fixture.layout.artboards;
const rows = [];

// 1. The board opens fitted, below 20%: every artboard is a Snapshot that
//    was rendered once and frozen without ever having been a Preview.
const firstSnapshots = {};
for ( const a of artboards ) {
    const tier = await tierOf( page, a.id );
    firstSnapshots[ a.id ] = {
        tier,
        blocks:
            tier === 'snapshot'
                ? await stableDocument(
                      page,
                      `[data-wfd-artboard="${ a.id }"] iframe`
                  )
                : null,
    };
}

// 2. Each artboard as a Preview, then in edit.
for ( const a of artboards ) {
    await bringIntoView( page, a, 0.3 );
    await page
        .locator( `[data-wfd-artboard="${ a.id }"][data-wfd-tier="preview"]` )
        .waitFor( { timeout: 30000 } );
    const preview = await stableDocument(
        page,
        `[data-wfd-artboard="${ a.id }"] iframe`
    );
    await enterEdit( page, a.id );
    const live = await stableLive( page, 'perBlock' );
    const literal = await stableLive( page, 'literal', 300 );
    const liveDocument = await stableDocument(
        page,
        `[data-wfd-artboard="${ a.id }"] iframe[name="editor-canvas"]`
    );
    await page.keyboard.press( 'Escape' );
    await page.keyboard.press( 'Escape' );
    await page.locator( '[data-wfd-tier="live"]' ).waitFor( { state: 'detached' } );
    rows.push( { artboard: a, preview, live, literal, liveDocument } );
}

// 3. Back below 20%: each Snapshot is now the frozen copy of a render that
//    was shown as a Preview (or of a warm editor's).
await page.locator( '[data-wfd-region="canvas"]' ).focus();
await page.keyboard.press( 'Shift+Digit1' );
await page.waitForTimeout( 500 );
const zoom = ( await page.evaluate( () => window.wfdTest.viewport.get() ) ).zoom;
if ( zoom >= 0.2 ) {
    await setViewport( page, { x: 40, y: 60, zoom: 0.12 } );
}
await boardAtRest( page );

const results = [];
for ( const row of rows ) {
    const id = row.artboard.id;
    const tier = await tierOf( page, id );
    const snapshot = await stableDocument(
        page,
        `[data-wfd-artboard="${ id }"] iframe`
    );
    const first = firstSnapshots[ id ];
    results.push( {
        artboard: `${ row.artboard.kind } ${ row.artboard.entityId } ${ row.artboard.device }`,
        id,
        liveBlocks: row.live.length,
        literalBlocks: row.literal.length,
        literalEqualsPreview: same( row.literal, row.preview ),
        previewBlocks: row.preview.length,
        previewEqualsLive: same( row.preview, row.live ),
        liveDocumentEqualsLive: same( row.liveDocument, row.live ),
        firstSnapshotTier: first.tier,
        firstSnapshotEqualsLive: first.blocks ? same( first.blocks, row.live ) : null,
        laterSnapshotTier: tier,
        laterSnapshotEqualsLive: snapshot ? same( snapshot, row.live ) : null,
        previewVsLive: diff( row.preview, row.live ),
        firstSnapshotVsLive: first.blocks ? diff( first.blocks, row.live ) : null,
        laterSnapshotVsLive: snapshot ? diff( snapshot, row.live ) : null,
        liveDocumentVsLive: diff( row.liveDocument, row.live ),
        live: row.live,
    } );
}

const pass = results.every(
    ( r ) =>
        r.previewEqualsLive &&
        r.firstSnapshotEqualsLive === true &&
        r.laterSnapshotEqualsLive === true
);
// Weaker: every block of the editor's tree has an element at the same path
// with the same name in each document, which may also hold other elements.
const everyLiveBlockFound = results.every(
    ( r ) =>
        r.previewVsLive.onlyInSecond.length === 0 &&
        r.firstSnapshotVsLive.onlyInSecond.length === 0 &&
        r.laterSnapshotVsLive.onlyInSecond.length === 0
);
save( 'a.json', { pass, everyLiveBlockFound, zoomForSnapshots: zoom, errors, results } );
for ( const r of results ) {
    console.log(
        [
            r.artboard.padEnd( 44 ),
            `live ${ String( r.liveBlocks ).padStart( 3 ) } (literal ${ String( r.literalBlocks ).padStart( 3 ) })`,
            `doc ${ String( r.previewBlocks ).padStart( 3 ) }`,
            `preview ${ r.previewEqualsLive }`,
            `snapshot(first) ${ r.firstSnapshotEqualsLive }`,
            `${ r.laterSnapshotTier }(later) ${ r.laterSnapshotEqualsLive }`,
            `docOnly ${ r.previewVsLive.onlyInFirst.length } liveOnly ${ r.previewVsLive.onlyInSecond.length }`,
            `liveDoc ${ r.liveDocumentEqualsLive }`,
        ].join( '  ' )
    );
}
console.log( 'console errors:', errors.length, 'PASS:', pass, 'every live block found in the documents:', everyLiveBlockFound );
await browser.close();
process.exit( pass ? 0 : 1 );
