/**
 * Block registration and the block editor settings from the server, loaded
 * once and shared by every editor and preview on the board.
 */
import { registerCoreBlocks } from '@wordpress/block-library';

let isRegistered = false;

export function bootEditor() {
    if ( ! isRegistered ) {
        isRegistered = true;
        registerCoreBlocks();
    }
}

export const serverSettings = window.wfdConfig?.editorSettings ?? {};
