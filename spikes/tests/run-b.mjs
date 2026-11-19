import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { open, spikeUrl, BASE } from './lib.mjs';

const cli = ( cmd ) => { try { return execSync( `docker exec wp-env-wordpress-for-designers-fededb01-cli-1 ${ cmd }`, { stdio: [ "ignore", "pipe", "ignore" ] } ).toString().trim(); } catch ( e ) { return ""; } };
const out = {};

// --- EntitiesSavedStates without EditorProvider.
cli( `wp post update 4 --post_title="Spike page"` );
cli( `wp post meta delete 4 _edit_lock` );
{
    const { browser, page, errors } = await open();
    await page.goto( spikeUrl( 'b' ) );
    await page.waitForSelector( '#wfd-b-loaded:has-text("loaded")' );
    await page.click( '#wfd-b-dirty' );
    await page.click( '#wfd-b-open' );
    await page.waitForSelector( '#wfd-b-panel .entities-saved-states__panel, #wfd-b-panel button' );
    await page.waitForTimeout( 500 );
    const panelText = await page.locator( '#wfd-b-panel' ).innerText();
    await page.screenshot( { path: 'spikes/evidence/b-saved-states.png' } );
    await page.locator( '#wfd-b-panel button', { hasText: /^Save$/ } ).first().click();
    await page.waitForTimeout( 2500 );
    const title = cli( `wp post get 4 --field=post_title` );
    const stillDirty = await page.evaluate( () => wp.data.select( 'core' ).hasEditsForEntityRecord( 'postType', 'page', 4 ) );
    out.entitiesSavedStates = {
        panelText: panelText.replace( /\s+/g, ' ' ).slice( 0, 300 ),
        listsThePage: /Spike title edited|Page/.test( panelText ),
        savedTitle: title,
        stillDirty,
        consoleErrors: [ ...errors ],
        pass: title === 'Spike title edited' && ! stillDirty && errors.length === 0,
    };
    await browser.close();
}

// --- PostLockedModal without EditorProvider, allowlist only.
cli( `wp post meta update 4 _edit_lock "${ Math.floor( Date.now() / 1000 ) }:2"` );
{
    const { browser, page, errors } = await open();
    await page.goto( spikeUrl( 'b' ) );
    await page.waitForSelector( '#wfd-b-loaded:has-text("loaded")' );
    await page.waitForTimeout( 3000 );
    const serverSaysLockedBy = await page.evaluate( () => window.wfdSpike.lockedByUser );
    const modalShown = await page.locator( '.editor-post-locked-modal' ).count();
    const editorState = await page.evaluate( () => {
        const s = wp.data.select( 'core/editor' );
        return {
            currentPostId: s.getCurrentPostId(),
            isPostLocked: s.isPostLocked(),
            postLockUtils: s.getEditorSettings().postLockUtils ?? null,
        };
    } );
    out.postLockedModalAllowlistOnly = {
        serverSaysLockedBy,
        modalShown,
        editorState,
        consoleErrors: [ ...errors ],
        pass: modalShown === 1,
    };
    await page.screenshot( { path: 'spikes/evidence/b-locked-allowlist-only.png' } );

    // --- Diagnostic only, OUTSIDE the allowlist: feed the editor store by hand.
    await page.evaluate( () => {
        const d = wp.data.dispatch( 'core/editor' );
        d.setEditedPost( 'page', 4 );
        d.updateEditorSettings( { postLockUtils: { nonce: 'x', unlockNonce: 'y', ajaxUrl: '/wp-admin/admin-ajax.php' } } );
        d.updatePostLock( { isLocked: true, user: { name: 'second', avatar: '' } } );
    } );
    await page.waitForTimeout( 1000 );
    const shownAfter = await page.locator( '.editor-post-locked-modal' ).count();
    const links = shownAfter
        ? await page.locator( '.editor-post-locked-modal a' ).evaluateAll( ( as ) => as.map( ( a ) => a.textContent.trim() + ' -> ' + a.getAttribute( 'href' ) ) )
        : [];
    await page.screenshot( { path: 'spikes/evidence/b-locked-with-editor-store.png' } );
    out.postLockedModalWithEditorStoreActions = { modalShown: shownAfter, links, consoleErrors: [ ...errors ] };
    await browser.close();
}
cli( `wp post meta delete 4 _edit_lock` );
cli( `wp post update 4 --post_title="Spike page"` );

// --- Does the modal take a lock when the page is free? (allowlist only)
{
    const { browser, page } = await open();
    await page.goto( spikeUrl( 'b' ) );
    await page.waitForSelector( '#wfd-b-loaded:has-text("loaded")' );
    await page.waitForTimeout( 2000 );
    let lock = '';
    try {
        lock = cli( `wp post meta get 4 _edit_lock` );
    } catch ( e ) {
        lock = '';
    }
    out.lockTakenWhenFree = { editLockMeta: lock, pass: lock !== '' };
    await browser.close();
}

writeFileSync( 'spikes/evidence/b.json', JSON.stringify( out, null, 2 ) );
console.log( JSON.stringify( out, null, 2 ) );
