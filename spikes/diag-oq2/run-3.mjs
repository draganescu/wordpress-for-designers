// Option without PostLockedModal: plugin REST route + api-fetch + own dialog.
import { open, spikeUrl, BASE, POST } from './lib.mjs';
import { cli, lockMeta, clearLock, age, modalInfo, watch, save, DIR } from './util.mjs';

const st = ( page ) => page.evaluate( () => ( { ...window.wfdLockState, url: location.pathname + location.search } ) );
const waitStatus = ( page, status, timeout = 15000 ) =>
    page.waitForFunction( ( s ) => window.wfdLockState?.status === s, status, { timeout } ).then( () => true ).catch( () => false );
const dlg = ( page ) =>
    page.evaluate( () => {
        const m = document.querySelector( '.wfd-d-modal' );
        return m ? { shown: true, title: m.querySelector( 'h1' )?.textContent, body: m.querySelector( 'p' )?.textContent, buttons: Array.from( m.querySelectorAll( 'button' ) ).map( ( b ) => b.textContent || b.getAttribute( 'aria-label' ) ) } : { shown: false };
    } );
const D = spikeUrl( 'd', '&refresh=3000' );

clearLock();
// 1-4: take, refresh, release on leaving edit, release on leaving the page.
{
    const { browser, page } = await open();
    const logs = watch( page );
    await page.goto( D );
    await page.waitForSelector( '#wfd-d-enter' );
    const metaBefore = lockMeta();
    const t0 = Date.now();
    await page.click( '#wfd-d-enter' );
    await waitStatus( page, 'held' );
    const msToHeld = Date.now() - t0;
    const metaTaken = lockMeta();
    await page.waitForTimeout( 7000 );
    const metaRefreshed = lockMeta();
    const t1 = Date.now();
    await page.click( '#wfd-d-leave' );
    await page.waitForFunction( () => ( window.wfdLockLog || [] ).some( ( l ) => l.op === 'release' ) );
    const msToRelease = Date.now() - t1;
    const metaAfterLeaveEdit = lockMeta();
    await page.click( '#wfd-d-enter' );
    await waitStatus( page, 'held' );
    const metaRetaken = lockMeta();
    await page.goto( BASE + '/wp-admin/index.php' );
    await page.waitForTimeout( 1000 );
    const metaAfterLeavePage = lockMeta();
    save( 'D1_take_refresh_release', {
        metaBefore,
        enterEdit: { status: 'held', msToHeld, meta: metaTaken },
        after7sAt3sRefresh: { meta: metaRefreshed, advancedSeconds: Number( metaRefreshed.split( ':' )[ 0 ] ) - Number( metaTaken.split( ':' )[ 0 ] ) },
        leaveEdit: { msToRelease, meta: metaAfterLeaveEdit, released: metaAfterLeaveEdit === '' },
        reEnter: { meta: metaRetaken },
        navigateAway_pagehideKeepalive: { meta: metaAfterLeavePage, released: metaAfterLeavePage === '' },
        requests: logs.requests.filter( ( r ) => /wfd-diag2/.test( r ) ),
        errors: logs.errors,
    } );
    await browser.close();
}

// 5: two users, both on the board.
clearLock();
{
    const s = await open( 'second' );
    const a = await open( 'admin' );
    const alogs = watch( a.page );
    const slogs = watch( s.page );
    await s.page.goto( D );
    await s.page.click( '#wfd-d-enter' );
    await waitStatus( s.page, 'held' );
    const metaSecond = lockMeta();

    await a.page.goto( D );
    await a.page.click( '#wfd-d-enter' );
    await waitStatus( a.page, 'blocked' );
    const adminBlocked = { state: await st( a.page ), dialog: await dlg( a.page ), meta: lockMeta() };
    await a.page.screenshot( { path: DIR + 'D-blocked.png' } );
    await a.page.click( '#wfd-d-stay' );
    await a.page.waitForTimeout( 300 );
    const afterStay = { state: await st( a.page ), dialog: await dlg( a.page ), statusText: await a.page.locator( '#wfd-d-status' ).innerText(), meta: lockMeta() };
    // re-enter and take over
    await a.page.click( '#wfd-d-leave' );
    await a.page.click( '#wfd-d-enter' );
    await a.page.waitForSelector( '#wfd-d-takeover' );
    const t0 = Date.now();
    await a.page.click( '#wfd-d-takeover' );
    await waitStatus( a.page, 'held' );
    const afterTakeover = { state: await st( a.page ), dialog: await dlg( a.page ), meta: lockMeta(), ms: Date.now() - t0 };
    // second detects within its refresh interval (3 s here)
    const t1 = Date.now();
    await waitStatus( s.page, 'blocked', 10000 );
    const secondDetected = { ms: Date.now() - t1, state: await st( s.page ), dialog: await dlg( s.page ), meta: lockMeta() };
    await s.page.screenshot( { path: DIR + 'D-taken-over.png' } );
    // second leaves edit after losing the lock: must not release admin's lock
    await s.page.keyboard.press( 'Escape' );
    await s.page.click( '#wfd-d-leave' );
    await s.page.waitForTimeout( 800 );
    const metaAfterLoserLeaves = lockMeta();
    save( 'D2_twoUsers', {
        secondHolds: metaSecond,
        adminEntersEdit: adminBlocked,
        adminKeepsReadOnly: afterStay,
        adminTakesOver: afterTakeover,
        secondDetectsTakeover: secondDetected,
        metaAfterLoserLeavesEdit: metaAfterLoserLeaves,
        adminErrors: alogs.errors,
        secondErrors: slogs.errors,
    } );

    // 6: interop with the real core editor. admin still holds through the plugin route.
    await s.page.goto( `${ BASE }/wp-admin/post.php?post=${ POST }&action=edit` );
    await s.page.waitForSelector( '.editor-post-locked-modal', { timeout: 30000 } ).catch( () => {} );
    const coreSees = await modalInfo( s.page );
    await Promise.all( [
        s.page.waitForNavigation( { waitUntil: 'domcontentloaded' } ),
        s.page.locator( '.editor-post-locked-modal a', { hasText: 'Take over' } ).click(),
    ] );
    const t2 = Date.now();
    const detected = await waitStatus( a.page, 'blocked', 10000 );
    save( 'D3_interopWithCoreEditor', {
        coreEditorForSecondShows: { shown: coreSees.shown, title: coreSees.title },
        afterCoreTakeover: { meta: lockMeta(), boardDetected: detected, ms: Date.now() - t2, state: await st( a.page ), dialog: await dlg( a.page ) },
    } );
    await s.browser.close();
    await a.browser.close();
}

// 7: register_rest_field variant read and written through core-data.
clearLock();
{
    const { browser, page } = await open();
    const logs = watch( page );
    await page.goto( spikeUrl( 'b', '&modal=0' ) );
    await page.waitForSelector( '#wfd-b-loaded:has-text("loaded")' );
    const fieldFree = await page.evaluate( ( id ) => wp.data.select( 'core' ).getEntityRecord( 'postType', 'page', id ).wfd_diag2_lock, POST );
    const modifiedBefore = cli( `wp post get ${ POST } --field=post_modified` );
    const revsBefore = cli( `wp post list --post_type=revision --post_parent=${ POST } --format=count` );
    await page.waitForTimeout( 1100 );
    logs.requests.length = 0;
    await page.evaluate( ( id ) => wp.data.dispatch( 'core' ).saveEntityRecord( 'postType', 'page', { id, wfd_diag2_lock: 'take' } ), POST );
    const meta = lockMeta();
    const modifiedAfter = cli( `wp post get ${ POST } --field=post_modified` );
    const revsAfter = cli( `wp post list --post_type=revision --post_parent=${ POST } --format=count` );
    // stale read: lock set by someone else is not seen until the record is refetched
    cli( `wp post meta update ${ POST } _edit_lock ${ Math.floor( Date.now() / 1000 ) }:2` );
    await page.waitForTimeout( 500 );
    const cached = await page.evaluate( ( id ) => wp.data.select( 'core' ).getEntityRecord( 'postType', 'page', id ).wfd_diag2_lock, POST );
    const anon = await ( await fetch( `${ BASE }/?rest_route=/wp/v2/pages/${ POST }` ) ).json();
    save( 'D4_restFieldVariant', {
        fieldWhenFree: fieldFree,
        saveEntityRecordTake: { requests: logs.requests, meta, postModifiedBefore: modifiedBefore, postModifiedAfter: modifiedAfter, postModifiedChanged: modifiedBefore !== modifiedAfter, revisionsBefore: revsBefore, revisionsAfter: revsAfter },
        afterOtherUserLocks_cachedRecordStillSays: cached,
        fieldInAnonymousViewResponse: 'wfd_diag2_lock' in anon ? anon.wfd_diag2_lock : '(absent)',
        errors: logs.errors,
    } );
    await browser.close();
}
clearLock();
