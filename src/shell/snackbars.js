/**
 * WordPress's snackbar notices, at the bottom left of the canvas area above
 * the keyboard shortcuts control (D118). Blocks report through them: a file
 * that could not be uploaded, for one.
 */
import { useSelect, useDispatch } from '@wordpress/data';
import { store as noticesStore } from '@wordpress/notices';
import { SnackbarList } from '@wordpress/components';

export function Snackbars() {
    const notices = useSelect(
        ( select ) =>
            select( noticesStore )
                .getNotices()
                .filter( ( notice ) => notice.type === 'snackbar' ),
        []
    );
    const { removeNotice } = useDispatch( noticesStore );
    if ( ! notices.length ) {
        return null;
    }
    return (
        <SnackbarList
            className="wfd-snackbars"
            notices={ notices }
            onRemove={ removeNotice }
        />
    );
}
