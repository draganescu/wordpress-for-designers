/**
 * Spike (c): `updateBlockAttributes`, `insertBlocks`, `removeBlocks` and
 * `moveBlockToPosition`, dispatched on the Live editor's registry from
 * outside the editor, change the artboard, appear in Review and undo as one
 * step each.
 *
 *   node spikes/agent/tests/run-c.mjs
 */
import { open, resetFixture, openBoard, boardAtRest, bringIntoView, enterEdit, save } from './lib.mjs';

const { browser, page, errors } = await open();
const fixture = await resetFixture( page );
await openBoard( page, fixture.boardId );
await boardAtRest( page );

// The Header template part: a Group holding one Paragraph. It is also shown
// by the Header (Mobile) artboard, which stays a Preview.
const [ header, headerMobile ] = fixture.layout.artboards.filter(
    ( a ) => String( a.entityId ).endsWith( '//header' )
);
await bringIntoView( page, header, 0.4 );
await enterEdit( page, header.id );
await page.waitForTimeout( 1500 );

/** What the board shows, read from outside the editor. */
const state = ( ids ) => {
    const registry = window.wfdTest.editorBridge.current.registry;
    const select = registry.select( 'core/block-editor' );
    const text = ( id, selector ) =>
        [
            ...document
                .querySelector( `[data-wfd-artboard="${ id }"] ${ selector }` )
                .contentDocument.querySelectorAll( '[data-block]' ),
        ]
            .filter( ( el ) => ! el.querySelector( '[data-block]' ) )
            .map( ( el ) => String( el.getAttribute( 'data-type' ) ).replace( 'core/', '' ) + ':' + el.textContent.trim() )
            .join( ' | ' );
    const review = document.querySelector( '[data-wfd-control="H9"]' );
    const undo = document.querySelector( '[data-wfd-control="H3"]' );
    return {
        markup: window.wp.blocks.serialize( select.getBlocks() ),
        liveCanvas: text( ids.live, 'iframe[name="editor-canvas"]' ),
        mobilePreview: text( ids.mobile, 'iframe' ),
        mobileTier: document.querySelector( `[data-wfd-artboard="${ ids.mobile }"]` ).getAttribute( 'data-wfd-tier' ),
        review: review.textContent.trim(),
        reviewDisabled: review.disabled || review.getAttribute( 'aria-disabled' ) === 'true',
        undoDisabled: undo.disabled || undo.getAttribute( 'aria-disabled' ) === 'true',
        hasUndo: window.wp.data.select( 'core' ).hasUndo(),
        dirty: window.wp.data
            .select( 'core' )
            .__experimentalGetDirtyEntityRecords()
            .map( ( r ) => `${ r.name }/${ r.key }` ),
    };
};
const ids = { live: header.id, mobile: headerMobile.id };
const read = async () => {
    await page.waitForTimeout( 700 );
    return page.evaluate( state, ids );
};

/** The four actions, each dispatched from the page, outside the editor. */
const actions = {
    updateBlockAttributes: () => {
        const registry = window.wfdTest.editorBridge.current.registry;
        const select = registry.select( 'core/block-editor' );
        const group = select.getBlocks()[ 0 ];
        registry
            .dispatch( 'core/block-editor' )
            .updateBlockAttributes( select.getBlocks( group.clientId )[ 0 ].clientId, {
                content: 'Changed from outside',
            } );
    },
    insertBlocks: () => {
        const registry = window.wfdTest.editorBridge.current.registry;
        const select = registry.select( 'core/block-editor' );
        const group = select.getBlocks()[ 0 ];
        registry
            .dispatch( 'core/block-editor' )
            .insertBlocks(
                window.wp.blocks.parse(
                    '<!-- wp:heading --><h2 class="wp-block-heading">Inserted from outside</h2><!-- /wp:heading -->'
                ),
                1,
                group.clientId,
                false
            );
    },
    moveBlockToPosition: () => {
        const registry = window.wfdTest.editorBridge.current.registry;
        const select = registry.select( 'core/block-editor' );
        const group = select.getBlocks()[ 0 ];
        const last = select.getBlocks( group.clientId ).at( -1 );
        // Out of the Group, to the top of the artboard.
        registry
            .dispatch( 'core/block-editor' )
            .moveBlockToPosition( last.clientId, group.clientId, '', 0 );
    },
    removeBlocks: () => {
        const registry = window.wfdTest.editorBridge.current.registry;
        const select = registry.select( 'core/block-editor' );
        const group = select.getBlocks().find( ( b ) => b.name === 'core/group' );
        registry
            .dispatch( 'core/block-editor' )
            .removeBlocks( [ select.getBlocks( group.clientId )[ 0 ].clientId ], false );
    },
};

const undo = () => page.locator( '[data-wfd-control="H3"]' ).click();
const tooltipOfUndo = async () => {
    await page.locator( '[data-wfd-control="H3"]' ).hover();
    await page.waitForTimeout( 600 );
    return page.locator( '[role="tooltip"]' ).first().textContent().catch( () => null );
};

const initial = await read();
const result = { initial, alone: {}, chain: [], errors };

// 1. Each action alone, then one Undo. `moveBlockToPosition` and
//    `removeBlocks` are tried on the fixture's own blocks where they can be.
for ( const name of [ 'updateBlockAttributes', 'insertBlocks', 'removeBlocks' ] ) {
    await page.evaluate( actions[ name ] );
    const after = await read();
    const tooltip = await tooltipOfUndo();
    await undo();
    const undone = await read();
    result.alone[ name ] = {
        changedTree: after.markup !== initial.markup,
        changedLiveCanvas: after.liveCanvas !== initial.liveCanvas,
        changedMobilePreview: after.mobilePreview !== initial.mobilePreview,
        review: after.review,
        dirty: after.dirty,
        undoTooltip: tooltip,
        oneUndoRestoresTree: undone.markup === initial.markup,
        oneUndoRestoresCanvas: undone.liveCanvas === initial.liveCanvas,
        oneUndoRestoresPreview: undone.mobilePreview === initial.mobilePreview,
        reviewAfterUndo: undone.review,
        reviewDisabledAfterUndo: undone.reviewDisabled,
        dirtyAfterUndo: undone.dirty,
        after,
    };
}

// 2. All four in a row, then Undo four times: each Undo takes back exactly
//    one action.
const steps = [ initial ];
for ( const name of [ 'updateBlockAttributes', 'insertBlocks', 'moveBlockToPosition', 'removeBlocks' ] ) {
    await page.evaluate( actions[ name ] );
    const after = await read();
    result.chain.push( {
        action: name,
        changedTree: after.markup !== steps.at( -1 ).markup,
        changedLiveCanvas: after.liveCanvas !== steps.at( -1 ).liveCanvas,
        changedMobilePreview: after.mobilePreview !== steps.at( -1 ).mobilePreview,
        review: after.review,
        dirty: after.dirty,
        liveCanvas: after.liveCanvas,
        mobilePreview: after.mobilePreview,
    } );
    steps.push( after );
}
// Review: the drawer lists the item.
await page.locator( '[data-wfd-control="H9"]' ).click();
await page.waitForTimeout( 800 );
result.reviewDrawer = ( await page.locator( '[role="dialog"]' ).first().innerText() ).replace( /\s+/g, ' ' ).slice( 0, 400 );
await page.keyboard.press( 'Escape' );
await page.waitForTimeout( 500 );

result.undoChain = [];
for ( let i = steps.length - 2; i >= 0; i-- ) {
    await undo();
    const now = await read();
    result.undoChain.push( {
        undoes: result.chain[ i ].action,
        treeIsAsBeforeThatAction: now.markup === steps[ i ].markup,
        canvasIsAsBeforeThatAction: now.liveCanvas === steps[ i ].liveCanvas,
        previewIsAsBeforeThatAction: now.mobilePreview === steps[ i ].mobilePreview,
        review: now.review,
    } );
}
const end = await read();
result.end = { review: end.review, reviewDisabled: end.reviewDisabled, undoDisabled: end.undoDisabled, dirty: end.dirty };

// 3. Observation: the same attribute of the same block changed twice in a row.
await page.evaluate( actions.updateBlockAttributes );
await page.waitForTimeout( 700 );
await page.evaluate( () => {
    const registry = window.wfdTest.editorBridge.current.registry;
    const select = registry.select( 'core/block-editor' );
    const group = select.getBlocks()[ 0 ];
    registry
        .dispatch( 'core/block-editor' )
        .updateBlockAttributes( select.getBlocks( group.clientId )[ 0 ].clientId, { content: 'Changed a second time' } );
} );
const twice = await read();
await undo();
const twiceUndoOnce = await read();
result.sameAttributeTwice = {
    afterBoth: twice.liveCanvas,
    afterOneUndo: twiceUndoOnce.liveCanvas,
    oneUndoTookBackBoth: twiceUndoOnce.markup === initial.markup,
};
if ( ! result.sameAttributeTwice.oneUndoTookBackBoth ) {
    await undo();
    result.sameAttributeTwice.afterTwoUndos = ( await read() ).liveCanvas;
}

const aloneOk = Object.values( result.alone ).every(
    ( r ) =>
        r.changedTree && r.changedLiveCanvas && r.changedMobilePreview &&
        /Review 1 change/.test( r.review ) &&
        r.oneUndoRestoresTree && r.oneUndoRestoresCanvas && r.oneUndoRestoresPreview &&
        r.dirtyAfterUndo.length === 0
);
const chainOk =
    result.chain.every( ( r ) => r.changedTree && r.changedLiveCanvas && r.changedMobilePreview && /Review 1 change/.test( r.review ) ) &&
    result.undoChain.every( ( r ) => r.treeIsAsBeforeThatAction && r.canvasIsAsBeforeThatAction && r.previewIsAsBeforeThatAction ) &&
    result.end.dirty.length === 0;
result.pass = aloneOk && chainOk && errors.length === 0;
save( 'c.json', result );
const brief = JSON.parse( JSON.stringify( result ) );
for ( const r of Object.values( brief.alone ) ) {
    delete r.after;
}
delete brief.initial.markup;
console.log( JSON.stringify( brief, null, 1 ) );
await browser.close();
process.exit( result.pass ? 0 : 1 );
