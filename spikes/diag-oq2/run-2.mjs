// Side effects of feeding core/editor on the shared registry, and switching the current post.
import { open, spikeUrl, BASE, POST } from './lib.mjs';
import { cli, lockMeta, clearLock, setLock, age, hb, editorState, modalInfo, watch, save, feed, DIR } from './util.mjs';

const OTHER = Number( process.argv[ 2 ] );
const beforeUnloadProbe = ( page ) =>
    page.evaluate( () => {
        const e = new Event( 'beforeunload', { cancelable: true } );
        window.dispatchEvent( e );
        return { returnValue: e.returnValue, defaultPrevented: e.defaultPrevented };
    } );
const snapshot = ( page, id ) =>
    page.evaluate( ( id ) => {
        const e = wp.data.select( 'core/editor' );
        const c = wp.data.select( 'core' );
        return {
            editor: {
                currentPostId: e.getCurrentPostId(),
                isEditedPostDirty: e.getCurrentPostId() ? e.isEditedPostDirty() : null,
                isEditedPostAutosaveable: e.getCurrentPostId() ? e.isEditedPostAutosaveable() : null,
                isSavingPost: e.isSavingPost(),
                editedTitle: e.getCurrentPostId() ? e.getEditedPostAttribute( 'title' ) : null,
            },
            coreDirty: c.__experimentalGetDirtyEntityRecords().map( ( r ) => `${ r.name }:${ r.key }:${ r.title }` ),
            hasEdits: c.hasEditsForEntityRecord( 'postType', 'page', id ),
            notices: wp.data.select( 'core/notices' ).getNotices().map( ( n ) => `${ n.type }/${ n.status }: ${ n.content }` ),
        };
    }, id );

clearLock();
clearLock( OTHER );
cli( `wp post update ${ POST } --post_title="Diag page 2"` );
{
    const { browser, page } = await open();
    const logs = watch( page );
    await page.goto( spikeUrl( 'b', '&extras=1' ) );
    await page.waitForSelector( '#wfd-b-loaded:has-text("loaded")' );
    await page.click( '#wfd-b-dirty' );
    await page.waitForTimeout( 300 );
    const baseline = { state: await snapshot( page, POST ), beforeunload: await beforeUnloadProbe( page ) };
    logs.requests.length = 0;

    await feed( page, { post: true, utils: true } );
    await page.waitForTimeout( 1000 );
    const afterFeed = { state: await snapshot( page, POST ), beforeunload: await beforeUnloadProbe( page ) };
    // beforeunload probe above also ran the modal's release handler; note the meta.
    const requestsRightAfterFeed = [ ...logs.requests ];
    // Idle for 75 s: does anything autosave or save by itself?
    await page.waitForTimeout( 75000 );
    const requestsAfter75s = [ ...logs.requests ];
    const metaAfter75s = lockMeta();
    await page.click( '#wfd-b-open' );
    await page.waitForTimeout( 800 );
    const panelText = ( await page.locator( '#wfd-b-panel' ).innerText() ).replace( /\s+/g, ' ' ).slice( 0, 300 );
    save( 'E2_sideEffects', {
        mounted: [ 'PostLockedModal', 'UnsavedChangesWarning', 'EditorSnackbars', 'EntitiesSavedStates (on demand)' ],
        baselineBeforeAnyEditorAction: baseline,
        afterSetEditedPostAndUtils: afterFeed,
        requestsRightAfterFeed,
        requestsDuring75sIdleWithDirtyPage: requestsAfter75s,
        autosaveRequests: requestsAfter75s.filter( ( r ) => /autosaves/.test( r ) && /^POST/.test( r ) ).length,
        metaAfter75s,
        entitiesSavedStatesText: panelText,
        stateAfter75s: await snapshot( page, POST ),
        titleInDb: cli( `wp post get ${ POST } --field=post_title` ),
        errors: logs.errors,
        warnings: logs.warnings,
    } );
    await browser.close();
}

// ---------- Switching the current post between two pages.
clearLock();
clearLock( OTHER );
{
    const { browser, page } = await open();
    const logs = watch( page );
    await page.goto( spikeUrl( 'b' ) );
    await page.waitForSelector( '#wfd-b-loaded:has-text("loaded")' );
    await feed( page, { post: true, utils: true } );
    await hb( page );
    const a1 = { metaA: lockMeta(), metaB: lockMeta( OTHER ), state: await editorState( page ) };

    // Switch with setEditedPost alone (stale utils and stale activePostLock).
    await page.evaluate( ( id ) => wp.data.dispatch( 'core/editor' ).setEditedPost( 'page', id ), OTHER );
    await page.waitForTimeout( 500 );
    const stateRightAfterSwitch = await editorState( page );
    const tick = await hb( page );
    const a2 = {
        stateRightAfterSwitch,
        heartbeatSent: tick.sent.match( /data\[wp-refresh-post-lock\]\[[a-z_]+\]=[^&]*/g ),
        heartbeatReceived: tick.received[ 'wp-refresh-post-lock' ],
        metaA: lockMeta(),
        ageA: age( lockMeta() ),
        metaB: lockMeta( OTHER ),
        state: await editorState( page ),
    };
    // Leaving the page now: which lock does the stock beforeunload release, and with which nonce?
    const releaseReqs = [];
    page.on( 'request', ( r ) => {
        if ( ( r.postData() || '' ).includes( 'wp-remove-post-lock' ) ) {
            releaseReqs.push( r.postData().replace( /\r?\n/g, ' ' ).replace( /-+WebKitFormBoundary\w+/g, '|' ).slice( 0, 500 ) );
        }
    } );
    const releaseResponses = [];
    page.on( 'response', async ( r ) => {
        if ( ( r.request().postData() || '' ).includes( 'wp-remove-post-lock' ) ) {
            releaseResponses.push( r.status() );
        }
    } );
    await page.goto( BASE + '/wp-admin/index.php' );
    await page.waitForTimeout( 1000 );
    save( 'E2_switchPost_setEditedPostOnly', {
        afterFirstPost: a1,
        afterSwitch: a2,
        onLeave: {
            releaseRequestBodies: releaseReqs,
            releaseResponseStatus: releaseResponses,
            metaA: lockMeta(),
            ageA: age( lockMeta() ),
            metaB: lockMeta( OTHER ),
            ageB: age( lockMeta( OTHER ) ),
        },
        errors: logs.errors,
    } );
    await browser.close();
}

// ---------- Lock state leaks from post A to post B (postLock reducer is not keyed by post).
clearLock( OTHER );
setLock( 2 );
{
    const { browser, page } = await open();
    const logs = watch( page );
    await page.goto( spikeUrl( 'b' ) );
    await page.waitForSelector( '#wfd-b-loaded:has-text("loaded")' );
    await feed( page, { post: true, utils: true, lock: true } );
    await page.waitForTimeout( 500 );
    const onA = await modalInfo( page );
    await page.evaluate( ( id ) => wp.data.dispatch( 'core/editor' ).setEditedPost( 'page', id ), OTHER );
    await page.waitForTimeout( 800 );
    const onB = await modalInfo( page );
    const stateB = await editorState( page );
    // Clean switch: reset lock + utils for B, then set post.
    const utilsB = await page.evaluate( ( id ) => wp.apiFetch( { path: `/wfd-diag2/v1/lock/${ id }` } ), OTHER );
    await page.evaluate( ( { id, info } ) => {
        const d = wp.data.dispatch( 'core/editor' );
        d.updatePostLock( info.postLock );
        d.updateEditorSettings( { postLockUtils: info.postLockUtils } );
        d.setEditedPost( 'page', id );
    }, { id: OTHER, info: utilsB } );
    await page.waitForTimeout( 500 );
    const onBclean = await modalInfo( page );
    const tick = await hb( page );
    save( 'E2_lockStateLeakAcrossPosts', {
        postA_lockedBySecond_modal: { shown: onA.shown, title: onA.title },
        afterSetEditedPostToFreePostB: { modalShown: onB.shown, title: onB.title, links: onB.links, state: stateB },
        afterResettingLockAndUtilsForB: { modalShown: onBclean.shown, heartbeatReceived: tick.received[ 'wp-refresh-post-lock' ], metaB: lockMeta( OTHER ), state: await editorState( page ) },
        errors: logs.errors,
    } );
    await browser.close();
}
clearLock();
clearLock( OTHER );
