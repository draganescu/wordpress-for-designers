/**
 * Spike (a), second run (D79): for every fixture artboard, and for one more
 * template that holds a Query Loop showing three posts, a synced pattern and
 * a Navigation block that points at a menu, the tree read from the Preview's
 * document, and from its Snapshot, equals the Live editor's tree read block
 * by block, with preview copies left out. Settles the rule that tells a
 * preview copy from a block using the document alone.
 *
 *   node spikes/agent/tests/run-a2.mjs
 */
import {
    open,
    resetFixture,
    openBoard,
    boardAtRest,
    bringIntoView,
    setViewport,
    tierOf,
    save,
} from './lib.mjs';

/**
 * Reads a document's blocks under each candidate rule. A rule says which
 * `data-block` elements are preview copies; the rest are blocks, a block's
 * inner blocks are the blocks whose nearest block ancestor it is, in
 * document order.
 */
const readDocument = ( iframe ) => {
    const doc = iframe.contentDocument;
    const LIVE = '.block-editor-block-preview__live-content';
    const rules = {
        // No rule: every data-block element is a block (the first run).
        none: () => false,
        // Inside an element WordPress's block preview marks as its content.
        liveContent: ( el ) => !! el.parentElement?.closest( LIVE ),
        // Inside an inert element of the document.
        inert: ( el ) => !! el.parentElement?.closest( '[inert]' ),
        // Inside a disabled element of the document.
        disabled: ( el ) => !! el.parentElement?.closest( '.components-disabled' ),
        // The rule settled on: not a block when it has no `data-type`, or
        // is inside an element the block preview marks as its content.
        settled: ( el ) =>
            ! el.hasAttribute( 'data-type' ) ||
            !! el.parentElement?.closest( LIVE ),
    };
    const elements = [ ...doc.querySelectorAll( '[data-block]' ) ];
    const out = { rootMarks: {}, rules: {}, copies: {} };
    // Marks on what is around every block, which would defeat a rule.
    const first = elements[ 0 ];
    out.rootMarks = {
        bodyInert: doc.body.hasAttribute( 'inert' ),
        htmlInert: doc.documentElement.hasAttribute( 'inert' ),
        firstBlockInsideInert: !! first?.parentElement?.closest( '[inert]' ),
        firstBlockInsideLiveContent: !! first?.parentElement?.closest( LIVE ),
        firstBlockInsideDisabled: !! first?.parentElement?.closest( '.components-disabled' ),
    };
    for ( const [ name, isCopy ] of Object.entries( rules ) ) {
        const paths = new Map();
        const counts = new Map();
        const list = [];
        const copies = [];
        for ( const el of elements ) {
            if ( isCopy( el ) ) {
                copies.push( el.getAttribute( 'data-type' ) );
                continue;
            }
            let parent = el.parentElement?.closest( '[data-block]' ) ?? null;
            while ( parent && ! paths.has( parent ) ) {
                parent = parent.parentElement?.closest( '[data-block]' ) ?? null;
            }
            const index = counts.get( parent ) ?? 0;
            counts.set( parent, index + 1 );
            const path = parent ? [ ...paths.get( parent ), index ] : [ index ];
            paths.set( el, path );
            list.push( path.join( '.' ) + ' ' + el.getAttribute( 'data-type' ) );
        }
        out.rules[ name ] = list;
        out.copies[ name ] = copies;
    }
    // What the copies sit in: the nearest marked ancestor of each copy.
    const holders = new Map();
    for ( const el of elements ) {
        const holder = el.parentElement?.closest( LIVE );
        if ( ! holder ) {
            continue;
        }
        const own = holder.hasAttribute( 'data-block' );
        const key = [
            holder.tagName.toLowerCase(),
            own ? 'block ' + holder.getAttribute( 'data-type' ) : 'not a block',
            holder.hasAttribute( 'inert' ) ? 'inert' : 'not inert',
            holder.classList.contains( 'components-disabled' ) ? 'disabled' : 'not disabled',
            doc.defaultView.getComputedStyle( holder ).display === 'none' ? 'hidden' : 'shown',
        ].join( ', ' );
        holders.set( key, ( holders.get( key ) ?? new Set() ).add( holder ) );
    }
    out.holders = Object.fromEntries(
        [ ...holders ].map( ( [ key, set ] ) => [ key, set.size ] )
    );
    // In edit a copy repeats the ids of the blocks it copies.
    // Elements with `data-block` and no block type.
    out.noType = elements
        .filter( ( el ) => ! el.hasAttribute( 'data-type' ) )
        .map( ( el ) => `${ el.tagName.toLowerCase() }.${ [ ...el.classList ].join( '.' ) } data-block="${ el.getAttribute( 'data-block' ) }" inside ${ el.parentElement?.closest( '[data-block]' )?.getAttribute( 'data-type' ) }${ el.parentElement?.closest( LIVE ) ? ' (in a copy)' : '' }` );
    const ids = elements.map( ( el ) => el.getAttribute( 'data-block' ) );
    out.repeatedIds = ids.length - new Set( ids ).size;
    return out;
};

/** Waits until a document's block list has stopped changing. */
async function stableDocument( page, selector, quiet = 1500 ) {
    let last = null;
    let since = Date.now();
    const deadline = Date.now() + 40000;
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
        } else if ( now && now.rules.none.length && Date.now() - since >= quiet ) {
            return now;
        }
        await page.waitForTimeout( 150 );
    }
    return JSON.parse( last );
}

/** The Live editor's tree, read block by block (D79). */
const readLive = () => {
    const select = window.wfdTest.editorBridge.current.registry.select(
        'core/block-editor'
    );
    const out = [];
    const walk = ( blocks, prefix ) =>
        blocks.forEach( ( block, index ) => {
            const path = [ ...prefix, index ];
            out.push( path.join( '.' ) + ' ' + block.name );
            walk( select.getBlocks( block.clientId ), path );
        } );
    walk( select.getBlocks(), [] );
    return out;
};

async function stableLive( page, quiet = 1500 ) {
    let last = null;
    let since = Date.now();
    const deadline = Date.now() + 40000;
    while ( Date.now() < deadline ) {
        const now = await page.evaluate( readLive ).catch( () => null );
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

async function enterEdit( page, id ) {
    const frame = page.locator(
        `[data-wfd-artboard="${ id }"] .wfd-artboard__frame`
    );
    const canvas = page.locator( '[data-wfd-region="canvas"]' );
    const c = await canvas.boundingBox();
    const f = await frame.boundingBox();
    const left = Math.max( c.x, f.x );
    const right = Math.min( c.x + c.width, f.x + f.width );
    // Near the top, on the header: not on a post a Query Loop draws.
    const top = Math.max( c.y, f.y );
    const bottom = Math.min( c.y + c.height, f.y + f.height );
    await page.mouse.dblclick( ( left + right ) / 2, top + Math.min( 12, ( bottom - top ) / 2 ) );
    await page
        .locator( `[data-wfd-artboard="${ id }"][data-wfd-tier="live"]` )
        .waitFor( { timeout: 8000 } )
        .catch( async ( e ) => {
            await page.screenshot( { path: process.env.SHOT ?? '/dev/null' } );
            console.log( 'tiers', await page.evaluate( () => [ ...document.querySelectorAll( '[data-wfd-artboard]' ) ].map( ( x ) => x.dataset.wfdTier ) ), 'active', await page.evaluate( () => document.activeElement?.outerHTML.slice( 0, 200 ) ) );
            throw e;
        } );
    await page
        .frameLocator(
            `[data-wfd-artboard="${ id }"] iframe[name="editor-canvas"]`
        )
        .locator( '.is-root-container' )
        .waitFor();
}

async function leaveEdit( page ) {
    for ( let i = 0; i < 6; i++ ) {
        if ( ! ( await page.locator( '[data-wfd-tier="live"]' ).count() ) ) {
            return;
        }
        await page.keyboard.press( 'Escape' );
        await page.waitForTimeout( 300 );
    }
    await page.locator( '[data-wfd-tier="live"]' ).waitFor( { state: 'detached' } );
}

const same = ( a, b ) => JSON.stringify( a ) === JSON.stringify( b );
const diff = ( a, b ) => ( {
    onlyInDocument: a.filter( ( x ) => ! b.includes( x ) ),
    onlyInTree: b.filter( ( x ) => ! a.includes( x ) ),
} );
const RULES = [ 'none', 'liveContent', 'inert', 'disabled', 'settled' ];

const { browser, page, errors } = await open();
const fixture = await resetFixture( page );
const nonce = (
    await ( await page.request.get( '/wp-admin/admin-ajax.php?action=rest-nonce' ) ).text()
).trim();
const seeded = await (
    await page.request.post( '/?rest_route=/wfd-spike/v1/seed-a2', {
        headers: { 'X-WP-Nonce': nonce },
        data: { board: fixture.boardId },
    } )
).json();
const artboards = seeded.layout.artboards;

await openBoard( page, fixture.boardId );
await page
    .locator( '[data-wfd-artboard]' )
    .nth( artboards.length - 1 )
    .waitFor( { state: 'attached' } );
await boardAtRest( page );

// 1. The board opens fitted, below 20%: every artboard is a Snapshot frozen
//    without ever having been a Preview.
const firstZoom = ( await page.evaluate( () => window.wfdTest.viewport.get() ) ).zoom;
const firstSnapshots = {};
for ( const a of artboards ) {
    const tier = await tierOf( page, a.id );
    firstSnapshots[ a.id ] = {
        tier,
        doc: await stableDocument( page, `[data-wfd-artboard="${ a.id }"] iframe` ),
    };
}

// 2. Each artboard as a Preview, then in edit.
const rows = [];
const only = process.env.ONLY;
for ( const a of artboards ) {
    if ( only && ! String( a.entityId ).includes( only ) ) {
        continue;
    }
    await bringIntoView( page, a, 0.3 );
    await page
        .locator( `[data-wfd-artboard="${ a.id }"][data-wfd-tier="preview"]` )
        .waitFor( { timeout: 30000 } );
    const preview = await stableDocument(
        page,
        `[data-wfd-artboard="${ a.id }"] iframe`
    );
    await enterEdit( page, a.id );
    const canvas = `[data-wfd-artboard="${ a.id }"] iframe[name="editor-canvas"]`;
    const tree = await stableLive( page );
    const live = [ { active: 'as entered', tree, doc: await stableDocument( page, canvas ) } ];

    // Where a Query Loop draws several posts, make each other post in turn
    // the one whose blocks are the editor's own, by clicking in its copy.
    const frame = page.frameLocator( canvas );
    const shownCopies = frame.locator(
        'li.block-editor-block-preview__live-content:visible'
    );
    const others = await shownCopies.count();
    for ( let i = 0; i < others; i++ ) {
        // After a click the copies shown are again all but the active one;
        // the i-th of them is a different post each time for i >= 1.
        const target = shownCopies.nth( Math.min( i, ( await shownCopies.count() ) - 1 ) );
        // The copy's own click handler: the pointer itself lands on the
        // Query Loop block at this zoom.
        await target.dispatchEvent( 'click' );
        await page.waitForTimeout( 800 );
        live.push( {
            active: `after click ${ i + 1 } in another post's copy`,
            tree: await stableLive( page ),
            doc: await stableDocument( page, canvas ),
        } );
    }

    // Select every block of the tree in turn: a selected block can draw
    // more around itself (an appender), and the trees must still be equal.
    const ids = await page.evaluate( () => {
        const select = window.wfdTest.editorBridge.current.registry.select( 'core/block-editor' );
        const out = [];
        const walk = ( blocks ) =>
            blocks.forEach( ( b ) => {
                out.push( b.clientId );
                walk( select.getBlocks( b.clientId ) );
            } );
        walk( select.getBlocks() );
        return out;
    } );
    const sweep = { selected: 0, equalSettled: 0, equalLiveContent: 0, noType: {}, unequal: [] };
    for ( const clientId of ids ) {
        await page.evaluate(
            ( id ) => window.wfdTest.editorBridge.current.registry.dispatch( 'core/block-editor' ).selectBlock( id ),
            clientId
        );
        await page.waitForTimeout( 150 );
        const doc = await page.locator( canvas ).first().evaluate( readDocument );
        const now = await page.evaluate( readLive );
        sweep.selected++;
        if ( same( doc.rules.settled, now ) ) {
            sweep.equalSettled++;
        } else {
            sweep.unequal.push( { clientId, ...diff( doc.rules.settled, now ) } );
        }
        if ( same( doc.rules.liveContent, now ) ) {
            sweep.equalLiveContent++;
        }
        for ( const key of doc.noType ) {
            sweep.noType[ key.replace( / data-block="[^"]*"/, '' ) ] = true;
        }
    }
    sweep.noType = Object.keys( sweep.noType );
    await page.evaluate( () =>
        window.wfdTest.editorBridge.current.registry.dispatch( 'core/block-editor' ).clearSelectedBlock()
    );
    await leaveEdit( page );
    rows.push( { artboard: a, preview, live, postCopiesShown: others, sweep } );
}

// 3. Back below 20%: each Snapshot is now the frozen copy of a render that
//    was shown as a Preview (the two edited last stay warm editors).
await page.locator( '[data-wfd-region="canvas"]' ).focus();
await page.keyboard.press( 'Shift+Digit1' );
await page.waitForTimeout( 500 );
let laterZoom = ( await page.evaluate( () => window.wfdTest.viewport.get() ) ).zoom;
if ( laterZoom >= 0.2 ) {
    laterZoom = 0.1;
    await setViewport( page, { x: 40, y: 60, zoom: laterZoom } );
}
await boardAtRest( page );

const results = [];
for ( const row of rows ) {
    const id = row.artboard.id;
    const laterTier = await tierOf( page, id );
    const later = await stableDocument( page, `[data-wfd-artboard="${ id }"] iframe` );
    const first = firstSnapshots[ id ];
    const tree = row.live[ 0 ].tree;
    const perRule = {};
    for ( const rule of RULES ) {
        perRule[ rule ] = {
            previewBlocks: row.preview.rules[ rule ].length,
            previewCopiesLeftOut: row.preview.copies[ rule ].length,
            previewEqualsTree: same( row.preview.rules[ rule ], tree ),
            firstSnapshotEqualsTree: same( first.doc.rules[ rule ], tree ),
            laterEqualsTree: same( later.rules[ rule ], tree ),
            liveDocumentEqualsTree: row.live.map( ( l ) =>
                same( l.doc.rules[ rule ], l.tree )
            ),
            liveCopiesLeftOut: row.live.map( ( l ) => l.doc.copies[ rule ].length ),
            liveDocumentVsTree: row.live.map( ( l ) => diff( l.doc.rules[ rule ], l.tree ) ),
            previewVsTree: diff( row.preview.rules[ rule ], tree ),
            firstSnapshotVsTree: diff( first.doc.rules[ rule ], tree ),
            laterVsTree: diff( later.rules[ rule ], tree ),
        };
    }
    results.push( {
        artboard: `${ row.artboard.kind } ${ row.artboard.entityId } ${ row.artboard.device }`,
        id,
        treeBlocks: tree.length,
        treeSameAfterEveryClick: row.live.every( ( l ) => same( l.tree, tree ) ),
        postCopiesShownInEdit: row.postCopiesShown,
        liveStates: row.live.map( ( l ) => l.active ),
        firstSnapshotTier: first.tier,
        laterTier,
        documentElements: {
            firstSnapshot: first.doc.rules.none.length,
            preview: row.preview.rules.none.length,
            live: row.live.map( ( l ) => l.doc.rules.none.length ),
            later: later.rules.none.length,
        },
        rootMarks: {
            firstSnapshot: first.doc.rootMarks,
            preview: row.preview.rootMarks,
            live: row.live[ 0 ].doc.rootMarks,
            later: later.rootMarks,
        },
        holders: {
            firstSnapshot: first.doc.holders,
            preview: row.preview.holders,
            live: row.live.map( ( l ) => l.doc.holders ),
            later: later.holders,
        },
        repeatedIds: {
            firstSnapshot: first.doc.repeatedIds,
            preview: row.preview.repeatedIds,
            live: row.live.map( ( l ) => l.doc.repeatedIds ),
            later: later.repeatedIds,
        },
        sweep: row.sweep,
        noType: {
            firstSnapshot: first.doc.noType,
            preview: row.preview.noType,
            live: row.live.map( ( l ) => l.doc.noType ),
            later: later.noType,
        },
        copyNames: {
            preview: row.preview.copies.liveContent,
        },
        perRule,
        tree,
    } );
}

const passes = ( rule ) =>
    results.every( ( r ) => {
        const p = r.perRule[ rule ];
        return (
            p.previewEqualsTree &&
            p.firstSnapshotEqualsTree &&
            p.laterEqualsTree &&
            p.liveDocumentEqualsTree.every( Boolean ) &&
            r.treeSameAfterEveryClick &&
            ( rule !== 'settled' || r.sweep.equalSettled === r.sweep.selected )
        );
    } );
const summary = Object.fromEntries( RULES.map( ( rule ) => [ rule, passes( rule ) ] ) );

save( 'a2.json', {
    summary,
    firstZoom,
    laterZoom,
    seeded: { ...seeded, layout: undefined },
    errors,
    results,
} );

for ( const r of results ) {
    console.log( r.artboard );
    console.log(
        `    tree ${ r.treeBlocks }  elements: snapshot ${ r.documentElements.firstSnapshot }, preview ${ r.documentElements.preview }, live ${ r.documentElements.live.join( '/' ) }, ${ r.laterTier } ${ r.documentElements.later }  tree same after clicks ${ r.treeSameAfterEveryClick }`
    );
    for ( const rule of RULES ) {
        const p = r.perRule[ rule ];
        if ( rule === 'settled' ) {
            console.log( `    sweep: ${ r.sweep.selected } selected, equal ${ r.sweep.equalSettled } (class rule alone ${ r.sweep.equalLiveContent }); no-type elements: ${ JSON.stringify( r.sweep.noType ) }` );
        }
        console.log(
            `    ${ rule.padEnd( 12 ) } copies ${ String( p.previewCopiesLeftOut ).padStart( 3 ) } (live ${ p.liveCopiesLeftOut.join( '/' ) })  snapshot ${ p.firstSnapshotEqualsTree }  preview ${ p.previewEqualsTree }  live ${ p.liveDocumentEqualsTree.join( '/' ) }  ${ r.laterTier }(later) ${ p.laterEqualsTree }`
        );
    }
}
console.log( 'rules that give equal trees everywhere:', JSON.stringify( summary ) );
console.log( 'console errors:', errors.length );
await browser.close();
process.exit( summary.settled ? 0 : 1 );
