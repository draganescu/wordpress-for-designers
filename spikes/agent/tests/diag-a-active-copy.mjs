/**
 * Spike (a), follow-up. In the index template in edit, a Query Loop draws one
 * copy of its inner blocks per post. Only one copy is the editor's own
 * blocks. This selects a block in the second post's copy and reads where the
 * editor's blocks then are in the document.
 *
 *   node spikes/agent/tests/diag-a-active-copy.mjs
 */
import { open, resetFixture, openBoard, boardAtRest, bringIntoView, enterEdit, save } from './lib.mjs';

const { browser, page, errors } = await open();
const fixture = await resetFixture( page );
await openBoard( page, fixture.boardId );
await boardAtRest( page );
const a = fixture.layout.artboards.find( ( x ) => String( x.entityId ).endsWith( '//index' ) );
await bringIntoView( page, a, 0.5 );
await enterEdit( page, a.id );
await page.waitForTimeout( 3000 );

const read = () => {
    const select = window.wfdTest.editorBridge.current.registry.select( 'core/block-editor' );
    const doc = document.querySelector( '[data-wfd-tier="live"] iframe[name="editor-canvas"]' ).contentDocument;
    const paths = new Map();
    const counts = new Map();
    const rows = [];
    for ( const el of doc.querySelectorAll( '[data-block]' ) ) {
        const parent = el.parentElement?.closest( '[data-block]' ) ?? null;
        const index = counts.get( parent ) ?? 0;
        counts.set( parent, index + 1 );
        const path = parent ? [ ...paths.get( parent ), index ] : [ index ];
        paths.set( el, path );
        rows.push( {
            path: path.join( '.' ),
            name: el.getAttribute( 'data-type' ),
            inStore: !! select.getBlockName( el.getAttribute( 'data-block' ) ),
        } );
    }
    const tree = [];
    const walk = ( blocks, prefix ) =>
        blocks.forEach( ( block, index ) => {
            const path = [ ...prefix, index ];
            tree.push( path.join( '.' ) + ' ' + block.name );
            walk( select.getBlocks( block.clientId ), path );
        } );
    walk( select.getBlocks(), [] );
    const inStore = rows.filter( ( r ) => r.inStore ).map( ( r ) => r.path + ' ' + r.name );
    return {
        documentBlocks: rows.length,
        notInStore: rows.filter( ( r ) => ! r.inStore ).map( ( r ) => r.path + ' ' + r.name ),
        treeBlocks: tree.length,
        storeBlocksAtTheirTreePath: inStore.filter( ( x ) => tree.includes( x ) ).length,
        storeBlocksAtAnotherPath: inStore.filter( ( x ) => ! tree.includes( x ) ),
        treeBlocksWithNoElement: tree.filter( ( x ) => ! inStore.includes( x ) ),
    };
};

const before = await page.evaluate( read );
// Click the title of the second post drawn by the Query Loop.
const frame = page.frameLocator( `[data-wfd-artboard="${ a.id }"] iframe[name="editor-canvas"]` );
const titles = frame.locator( '.wp-block-post-title' );
const count = await titles.count();
const visible = frame.locator( '.wp-block-post-title:visible' );
const visibleCount = await visible.count();
await visible.last().click();
await page.waitForTimeout( 1500 );
const after = await page.evaluate( read );
save( 'a-active-copy.json', { postTitlesDrawn: count, postTitlesVisible: visibleCount, before, after, errors } );
console.log( JSON.stringify( { postTitlesDrawn: count, postTitlesVisible: visibleCount, before, after, errors }, null, 1 ) );
await browser.close();
