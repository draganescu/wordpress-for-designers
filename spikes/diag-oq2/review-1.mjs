// Sceptical-review checks for OQ-2. Writes to the scratchpad, not to results.json.
import { writeFileSync } from 'node:fs';
import { open, BASE, POST } from './lib.mjs';
import { cli, lockMeta, clearLock, setLock, modalInfo, watch } from './util.mjs';

const OUT = process.argv[ 2 ];
const out = {};
const D = ( id ) => `${ BASE }/wp-admin/admin.php?page=wfd-diag2&post=${ id }&spike=d&refresh=3000`;
const st = ( page ) => page.evaluate( () => ( { ...window.wfdLockState } ) );
const waitStatus = ( page, status, timeout = 15000 ) =>
    page.waitForFunction( ( s ) => window.wfdLockState?.status === s, status, { timeout } ).then( () => true ).catch( () => false );
const restSave = ( page, id, title ) =>
    page.evaluate(
        ( { id, title } ) =>
            wp.apiFetch( { path: `/wp/v2/pages/${ id }`, method: 'POST', data: { title } } )
                .then( ( r ) => ( { ok: true, title: r.title.raw } ) )
                .catch( ( e ) => ( { ok: false, code: e.code, message: e.message } ) ),
        { id, title }
    );

// R1: does a core REST save respect another user's lock? (Option D claim, and the
// "loser can still save" risk for every option.)
clearLock();
{
    const a = await open( 'admin' );
    await a.page.goto( D( POST ) );
    await a.page.waitForSelector( '#wfd-d-enter' );
    const titleBefore = cli( `wp post get ${ POST } --field=post_title` );
    setLock( 2 );
    const metaHeld = lockMeta();
    const checkAsAdmin = cli( `wp eval 'require_once ABSPATH . "wp-admin/includes/post.php"; var_dump( wp_check_post_lock( ${ POST } ) );' --user=admin` );
    const res = await restSave( a.page, POST, 'Review R1 saved while locked by second' );
    const titleAfter = cli( `wp post get ${ POST } --field=post_title` );
    const metaAfter = lockMeta();
    await restSave( a.page, POST, titleBefore );
    out.R1_restSaveWhileLockedByOther = { metaHeld, checkAsAdmin, res, titleBefore, titleAfter, metaAfter, titleRestored: cli( `wp post get ${ POST } --field=post_title` ) };
    await a.browser.close();
}

// R2: reverse interop. 'second' is in the real core editor holding the lock;
// admin takes over from the route prototype; does the core editor notice?
clearLock();
{
    const s = await open( 'second' );
    const a = await open( 'admin' );
    const alogs = watch( a.page );
    await s.page.goto( `${ BASE }/wp-admin/post.php?post=${ POST }&action=edit` );
    await s.page.waitForFunction( () => window.wp?.data?.select( 'core/editor' )?.getCurrentPostId?.() );
    await s.page.waitForTimeout( 1500 );
    const metaCore = lockMeta();
    const coreModalBefore = await modalInfo( s.page );
    await a.page.goto( D( POST ) );
    await a.page.click( '#wfd-d-enter' );
    const blocked = await waitStatus( a.page, 'blocked' );
    const stateBlocked = await st( a.page );
    const metaWhileBlocked = lockMeta();
    await a.page.click( '#wfd-d-takeover' );
    const held = await waitStatus( a.page, 'held' );
    const metaAfterTakeover = lockMeta();
    const t0 = Date.now();
    const seen = await s.page.waitForSelector( '.editor-post-locked-modal', { timeout: 40000 } ).then( () => true ).catch( () => false );
    const ms = Date.now() - t0;
    const coreModalAfter = await modalInfo( s.page );
    // the board keeps refreshing: lock must still be admin's afterwards
    await a.page.waitForTimeout( 4000 );
    out.R2_coreHolds_boardTakesOver = {
        metaCore, coreModalBefore, blocked, stateBlocked, metaWhileBlocked, held, metaAfterTakeover,
        coreEditorNoticed: seen, msUntilCoreNoticed: ms,
        coreModalTitle: coreModalAfter.title, coreModalLinks: coreModalAfter.links,
        metaAfter4s: lockMeta(), boardStateAfter4s: await st( a.page ), boardErrors: alogs.errors,
    };
    // R3 (same sessions): loser of the lock saves through REST anyway.
    await s.browser.close();
    await a.page.click( '#wfd-d-leave' );
    await a.page.waitForTimeout( 600 );
    out.R2_metaAfterBoardLeavesEdit = lockMeta();
    await a.browser.close();
}

// R4: a pattern (wp_block) through the same route, two users.
clearLock();
{
    const id = cli( `wp post create --post_type=wp_block --post_status=publish --post_title=ReviewPattern --post_content='<!-- wp:paragraph --><p>x</p><!-- /wp:paragraph -->' --porcelain` );
    const a = await open( 'admin' );
    const s = await open( 'second' );
    await a.page.goto( D( id ) );
    await a.page.click( '#wfd-d-enter' );
    const held = await waitStatus( a.page, 'held' );
    const meta = lockMeta( id );
    await s.page.goto( D( id ) );
    await s.page.click( '#wfd-d-enter' );
    const blocked = await waitStatus( s.page, 'blocked' );
    const sState = await st( s.page );
    await a.page.click( '#wfd-d-leave' );
    await a.page.waitForTimeout( 600 );
    const metaAfterLeave = lockMeta( id );
    // R5: the blocked user never re-checks by itself (prototype behaviour).
    await s.page.waitForTimeout( 7000 );
    const sStateLater = await st( s.page );
    out.R4_pattern = { id, held, meta, secondBlocked: blocked, secondState: sState, metaAfterHolderLeaves: metaAfterLeave };
    out.R5_blockedUserAfterLockFreed_7s = sStateLater;
    await a.browser.close();
    await s.browser.close();
    cli( `wp post delete ${ id } --force` );
}

// R6: simultaneous enter by two users (check-then-set race in the route).
{
    const a = await open( 'admin' );
    const s = await open( 'second' );
    await a.page.goto( D( POST ) );
    await s.page.goto( D( POST ) );
    await a.page.waitForSelector( '#wfd-d-enter' );
    await s.page.waitForSelector( '#wfd-d-enter' );
    const rounds = [];
    for ( let i = 0; i < 8; i++ ) {
        clearLock();
        const call = ( page ) =>
            page.evaluate( ( id ) => wp.apiFetch( { path: `/wfd-diag2/v1/lock/${ id }`, method: 'POST', data: { takeover: false } } ).then( ( r ) => r.held ), POST );
        const [ ra, rs ] = await Promise.all( [ call( a.page ), call( s.page ) ] );
        rounds.push( { admin: ra, second: rs, meta: lockMeta() } );
    }
    out.R6_simultaneousTake = { rounds, bothHeld: rounds.filter( ( r ) => r.admin && r.second ).length };
    await a.browser.close();
    await s.browser.close();
}
clearLock();
writeFileSync( OUT, JSON.stringify( out, null, 2 ) );
console.log( JSON.stringify( out, null, 2 ) );
