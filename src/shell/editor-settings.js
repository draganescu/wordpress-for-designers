/**
 * Block registration and the block editor settings from the server, loaded
 * once and shared by every editor and preview on the board.
 */
import { registerCoreBlocks } from '@wordpress/block-library';
import { uploadMedia } from '@wordpress/media-utils';
import { dispatch } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import { MEDIA_QUERY } from '../inserter/use-inserter-data';

let isRegistered = false;

export function bootEditor() {
    if ( ! isRegistered ) {
        isRegistered = true;
        registerCoreBlocks();
    }
}

const fromServer = window.wfdConfig?.editorSettings ?? {};

/**
 * Uploads files as wp-admin's editors do. Blocks look for this setting to
 * offer "Upload" and "Media Library" in their placeholders and to take
 * dropped files (D117). When the files are in the media library, the list of
 * the inserter's Media tab is read again.
 *
 * @param {Object}   options              What `uploadMedia` takes.
 * @param {Function} options.onError      Called with the error's message.
 * @param {Function} options.onFileChange Called as each file is uploaded.
 */
function mediaUpload( { onError, onFileChange, ...options } ) {
    uploadMedia( {
        wpAllowedMimeTypes: fromServer.allowedMimeTypes,
        maxUploadFileSize: fromServer.maxUploadFileSize,
        ...options,
        onFileChange: ( files ) => {
            onFileChange?.( files );
            // A file still on its way has a blob address and no id.
            if ( files.length && files.every( ( file ) => file?.id ) ) {
                dispatch( coreStore ).invalidateResolution(
                    'getEntityRecords',
                    [ 'postType', 'attachment', MEDIA_QUERY ]
                );
            }
        },
        onError: ( { message } ) => onError?.( message ),
    } );
}

export const serverSettings = window.wfdConfig?.canUpload
    ? { ...fromServer, mediaUpload }
    : fromServer;
