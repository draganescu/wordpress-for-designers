// Option A: stock PostLockedModal fed through core/editor store actions.
import { open, spikeUrl, BASE, POST } from './lib.mjs';
import { cli, lockMeta, clearLock, setLock, age, hb, editorState, modalInfo, watch, save, feed, DIR } from './util.mjs';

const ready = async ( page, extra = '' ) => {
    await page.goto( spikeUrl( 'b', extra ) );
    await page.waitForSelector( '#wfd-b-loaded:has-text("loaded")' );
};

// ---------- E0: server probes
{
    clearLock();
    const { browser, page } = await open();
    await ready( page );
    const probe = await page.evaluate( () => wp.apiFetch( { path: '/wfd-diag2/v1/probe' } ) );
    // The stock heartbeat endpoint called directly, no heartbeat.js, no modal.
    const direct = await page.evaluate( async ( id ) => {
        const body = new URLSearchParams();
        body.append( 'action', 'heartbeat' );
        body.append( '_nonce', window.heartbeatSettings.nonce );
        body.append( 'data[wp-refresh-post-lock][post_id]', id );
        body.append( 'interval', '60' );
        body.append( 'has_focus', 'true' );
        body.append( 'screen_id', 'toplevel_page_wfd-diag2' );
        const r = await fetch( window.ajaxurl, { method: 'POST', body, credentials: 'same-origin' } );
        return { status: r.status, json: await r.json() };
    }, POST );
    const metaAfterDirect = lockMeta();
    // Stock release endpoint called directly at an arbitrary time (not beforeunload).
    const release = await page.evaluate( async ( { id, active } ) => {
        const body = new FormData();
        body.append( 'action', 'wp-remove-post-lock' );
        body.append( '_wpnonce', window.wfdSpike.lockInfo.postLockUtils.unlockNonce );
        body.append( 'post_ID', id );
        body.append( 'active_post_lock', active );
        const r = await fetch( window.ajaxurl, { method: 'POST', body, credentials: 'same-origin' } );
        return { status: r.status, text: await r.text() };
    }, { id: POST, active: metaAfterDirect } );
    const metaAfterRelease = lockMeta();
    save( 'E0_serverProbes', {
        restContextHasLockFunctions: probe,
        heartbeatDirectCall: { response: direct.json[ 'wp-refresh-post-lock' ], status: direct.status, metaAfter: metaAfterDirect },
        removePostLockDirectCall: { response: release, metaAfter: metaAfterRelease, ageSecondsAfter: age( metaAfterRelease ), seenBySecondAs: cli( `wp eval "var_dump( wp_check_post_lock( ${ POST } ) );" --user=2` ) },
        heartbeatDefaultIntervalSeconds: await page.evaluate( () => wp.heartbeat.interval() ),
    } );
    await browser.close();
}

// ---------- E1a: free page, only setEditedPost. Natural wait, no connectNow.
{
    clearLock();
    const { browser, page } = await open();
    const logs = watch( page );
    await ready( page );
    const before = await editorState( page );
    await feed( page, { post: true } );
    const t0 = Date.now();
    let meta = '';
    while ( ! meta && Date.now() - t0 < 80000 ) {
        await page.waitForTimeout( 1000 );
        meta = lockMeta();
    }
    const secondsUntilLock = meta ? Math.round( ( Date.now() - t0 ) / 1000 ) : null;
    await page.waitForTimeout( 500 );
    save( 'E1a_free_setEditedPostOnly_naturalHeartbeat', {
        actions: [ 'setEditedPost' ],
        stateBefore: before,
        secondsUntilLockTaken: secondsUntilLock,
        meta,
        stateAfter: await editorState( page ),
        modal: await modalInfo( page ),
        errors: logs.errors,
    } );

    // E1c: does unmounting release? does clearing the post release?
    const m0 = lockMeta();
    await page.evaluate( () => window.wfdSetModal( false ) );
    await page.waitForTimeout( 1500 );
    const m1 = lockMeta();
    const hbAfterUnmount = await hb( page );
    const m2 = lockMeta();
    await page.evaluate( () => wp.data.dispatch( 'core/editor' ).setEditedPost( null, null ) );
    await page.waitForTimeout( 1000 );
    const m3 = lockMeta();
    // remount, still no post: heartbeat payload?
    await page.evaluate( () => window.wfdSetModal( true ) );
    await page.waitForTimeout( 300 );
    const hbNoPost = await hb( page );
    const m4 = lockMeta();
    save( 'E1c_unmount_and_clear', {
        metaBefore: m0,
        afterUnmount: { meta: m1, changed: m1 !== m0 },
        heartbeatAfterUnmount: { sentLockData: /wp-refresh-post-lock/.test( hbAfterUnmount.sent ), meta: m2, changed: m2 !== m0 },
        afterSetEditedPostNull: { meta: m3, changed: m3 !== m0, state: await editorState( page ) },
        remountedWithNoPost: { sent: hbNoPost.sent.match( /data\[wp-refresh-post-lock\][^&]*&?[^&]*/g ), received: hbNoPost.received[ 'wp-refresh-post-lock' ] ?? null, meta: m4 },
        errors: logs.errors,
    } );
    await browser.close();
}

// ---------- E1a2: free page, setEditedPost + postLockUtils, connectNow, then leave page (beforeunload).
{
    clearLock();
    const { browser, page } = await open();
    const logs = watch( page );
    await ready( page );
    await feed( page, { post: true, utils: true } );
    const tick = await hb( page );
    const meta = lockMeta();
    const state = await editorState( page );
    await page.waitForTimeout( 2000 );
    await page.goto( BASE + '/wp-admin/index.php' );
    await page.waitForTimeout( 800 );
    const metaAfterLeave = lockMeta();
    save( 'E1a2_free_withUtils_then_navigateAway', {
        actions: [ 'setEditedPost', 'updateEditorSettings({postLockUtils})' ],
        heartbeatReceived: tick.received[ 'wp-refresh-post-lock' ],
        meta,
        state,
        metaAfterNavigatingAway: metaAfterLeave,
        ageSecondsAfter: age( metaAfterLeave ),
        seenBySecondAs: cli( `wp eval "var_dump( wp_check_post_lock( ${ POST } ) );" --user=2` ),
        errors: logs.errors,
    } );
    await browser.close();
}

// ---------- E1a3: free page, setEditedPost WITHOUT postLockUtils, then leave page.
{
    clearLock();
    const { browser, page } = await open();
    const logs = watch( page );
    await ready( page );
    await feed( page, { post: true } );
    await hb( page );
    const meta = lockMeta();
    await page.goto( BASE + '/wp-admin/index.php' );
    await page.waitForTimeout( 800 );
    save( 'E1a3_free_noUtils_then_navigateAway', {
        meta,
        metaAfterNavigatingAway: lockMeta(),
        released: lockMeta() !== meta,
        errors: logs.errors,
    } );
    await browser.close();
}

// ---------- E1b: "second" holds the lock through the real core editor.
{
    clearLock();
    const s = await open( 'second' );
    await s.page.goto( `${ BASE }/wp-admin/post.php?post=${ POST }&action=edit` );
    await s.page.waitForSelector( '.editor-styles-wrapper, iframe[name="editor-canvas"]', { timeout: 30000 } );
    const metaSecond = lockMeta();

    // i: setEditedPost only
    {
        const { browser, page } = await open();
        const logs = watch( page );
        await ready( page );
        await feed( page, { post: true } );
        await page.waitForTimeout( 500 );
        const before = await modalInfo( page );
        let tick = null;
        try {
            tick = await hb( page );
        } catch ( e ) {
            tick = { error: e.message };
        }
        await page.waitForTimeout( 500 );
        save( 'E1b_i_lockedBySecond_setEditedPostOnly', {
            metaHeldBySecond: metaSecond,
            modalBeforeHeartbeat: before,
            heartbeatReceived: tick.received?.[ 'wp-refresh-post-lock' ] ?? tick,
            modalAfterHeartbeat: await modalInfo( page ),
            appStillRendered: await page.locator( '#wfd-b' ).count(),
            metaAfter: lockMeta(),
            errors: logs.errors,
        } );
        await browser.close();
    }
    // ii: setEditedPost + utils, wait for heartbeat
    {
        const { browser, page } = await open();
        const logs = watch( page );
        await ready( page );
        await feed( page, { post: true, utils: true } );
        await page.waitForTimeout( 500 );
        const before = await modalInfo( page );
        const tick = await hb( page );
        save( 'E1b_ii_lockedBySecond_post_and_utils', {
            modalBeforeHeartbeat: before,
            heartbeatReceived: tick.received[ 'wp-refresh-post-lock' ],
            modalAfterHeartbeat: await modalInfo( page ),
            state: await editorState( page ),
            requestsAfterFeed: logs.requests,
            errors: logs.errors,
        } );
        await page.screenshot( { path: DIR + 'A-locked-via-heartbeat-only.png' } );
        await browser.close();
    }
    // iii: setEditedPost + utils + updatePostLock from PHP-provided state
    {
        const { browser, page } = await open();
        const logs = watch( page );
        await ready( page );
        const phpInfo = await page.evaluate( () => window.wfdSpike.lockInfo );
        await feed( page, { post: true, utils: true, lock: true } );
        await page.waitForTimeout( 800 );
        const modal = await modalInfo( page );
        await page.screenshot( { path: DIR + 'A-locked-initial.png' } );
        // Can the user reach anything behind the modal?
        let clickReached = true;
        try {
            await page.click( '#wfd-b-dirty', { timeout: 1500 } );
        } catch ( e ) {
            clickReached = false;
        }
        await page.keyboard.press( 'Escape' );
        await page.waitForTimeout( 300 );
        const afterEsc = ( await modalInfo( page ) ).shown;
        const tick = await hb( page );
        const metaAfterHb = lockMeta();
        // Follow "Take over".
        await Promise.all( [
            page.waitForNavigation( { waitUntil: 'domcontentloaded' } ),
            page.locator( '.editor-post-locked-modal a', { hasText: 'Take over' } ).click(),
        ] );
        await page.waitForTimeout( 1500 );
        const landed = page.url();
        const metaAfterTakeover = lockMeta();
        await page.screenshot( { path: DIR + 'A-after-take-over.png' } );
        // What does "second" (real core editor, heartbeat every 10 s) see?
        await s.page.waitForSelector( '.editor-post-locked-modal', { timeout: 40000 } ).catch( () => {} );
        const secondSees = await modalInfo( s.page );
        save( 'E1b_iii_lockedBySecond_post_utils_lock', {
            actions: [ 'setEditedPost', 'updateEditorSettings({postLockUtils})', 'updatePostLock(postLock)' ],
            phpProvided: { postLock: phpInfo.postLock, postLockUtilsKeys: Object.keys( phpInfo.postLockUtils ) },
            modal,
            underlyingButtonClickable: clickReached,
            modalStillShownAfterEscape: afterEsc,
            heartbeatWhileLockedSentLockData: /wp-refresh-post-lock/.test( tick.sent ),
            metaAfterHeartbeatWhileLocked: metaAfterHb,
            takeOverLandsOn: landed.replace( BASE, '' ),
            metaAfterTakeover,
            secondUserRealEditorThenSees: secondSees,
            errors: logs.errors,
        } );
        await browser.close();
    }
    await s.browser.close();

    // iv: "Exit editor"
    {
        setLock( 2 );
        const { browser, page } = await open();
        await ready( page );
        await feed( page, { post: true, utils: true, lock: true } );
        await page.waitForSelector( '.editor-post-locked-modal' );
        await Promise.all( [
            page.waitForNavigation( { waitUntil: 'domcontentloaded' } ),
            page.locator( '.editor-post-locked-modal a', { hasText: 'Exit editor' } ).click(),
        ] );
        save( 'E3_exitEditor', { landsOn: page.url().replace( BASE, '' ), metaAfter: lockMeta() } );
        await page.screenshot( { path: DIR + 'A-after-exit-editor.png' } );
        await browser.close();
    }
    // v: "Take over" with the get_edit_post_link filter keyed on the referer.
    {
        setLock( 2 );
        const { browser, page } = await open();
        await ready( page, '&wfdreturn=1' );
        await feed( page, { post: true, utils: true, lock: true } );
        await page.waitForSelector( '.editor-post-locked-modal' );
        await Promise.all( [
            page.waitForNavigation( { waitUntil: 'domcontentloaded' } ),
            page.locator( '.editor-post-locked-modal a', { hasText: 'Take over' } ).click(),
        ] );
        await page.waitForTimeout( 1000 );
        const lockInfoAfter = await page.evaluate( () => window.wfdSpike?.lockInfo?.postLock ?? null );
        save( 'E3_takeOver_with_get_edit_post_link_filter', {
            landsOn: page.url().replace( BASE, '' ),
            metaAfter: lockMeta(),
            lockInfoOnReturn: lockInfoAfter,
        } );
        await browser.close();
    }
}

// ---------- E1d: admin holds through the modal path; "second" takes over in the real editor.
{
    clearLock();
    const { browser, page } = await open();
    const logs = watch( page );
    await ready( page );
    await feed( page, { post: true, utils: true } );
    await hb( page );
    const metaAdmin = lockMeta();
    await page.click( '#wfd-b-dirty' );
    const refresh = await hb( page );
    const metaRefreshed = lockMeta();
    logs.requests.length = 0;

    const s = await open( 'second' );
    await s.page.goto( `${ BASE }/wp-admin/post.php?post=${ POST }&action=edit` );
    await s.page.waitForSelector( '.editor-post-locked-modal', { timeout: 30000 } );
    const secondModal = await modalInfo( s.page );
    await Promise.all( [
        s.page.waitForNavigation( { waitUntil: 'domcontentloaded' } ),
        s.page.locator( '.editor-post-locked-modal a', { hasText: 'Take over' } ).click(),
    ] );
    await s.page.waitForTimeout( 1500 );
    const metaAfterSecondTakeover = lockMeta();

    const tick = await hb( page );
    await page.waitForTimeout( 2500 );
    const modal = await modalInfo( page );
    await page.screenshot( { path: DIR + 'A-takeover-detected.png' } );
    save( 'E1d_takeoverDetected', {
        metaHeldByAdmin: metaAdmin,
        refreshByHeartbeat: { received: refresh.received[ 'wp-refresh-post-lock' ], meta: metaRefreshed },
        secondUserStockModal: { title: secondModal.title, links: secondModal.links },
        secondLandsOn: s.page.url().replace( BASE, '' ),
        metaAfterSecondTakeover,
        adminHeartbeatReceived: tick.received[ 'wp-refresh-post-lock' ],
        adminModal: modal,
        adminState: await editorState( page ),
        requestsAfterTakeover_autosaveCheck: logs.requests,
        titleInDb: cli( `wp post get ${ POST } --field=post_title` ),
        autosaveRevisions: cli( `wp post list --post_type=revision --post_parent=${ POST } --fields=ID,post_name,post_title,post_author --format=json` ),
        isDirtyStill: await page.evaluate( ( id ) => wp.data.select( 'core' ).hasEditsForEntityRecord( 'postType', 'page', id ), POST ),
        errors: logs.errors,
        warnings: logs.warnings,
    } );
    await s.browser.close();
    await browser.close();
}
clearLock();
