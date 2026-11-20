/**
 * The block toolbar of the header and the arrow that hides it (D50). It does
 * what the collapsible block toolbar of WordPress's own editor header does
 * in "Top toolbar" mode; that component is not exported.
 */
import { useEffect, useState } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import {
    BlockToolbar,
    store as blockEditorStore,
} from '@wordpress/block-editor';
import { next, previous } from '@wordpress/icons';
import { IconButton } from '@wordpress/ui';

export function CollapsibleBlockToolbar() {
    const selectionStart = useSelect(
        ( select ) => select( blockEditorStore ).getBlockSelectionStart(),
        []
    );
    const [ isCollapsed, setCollapsed ] = useState( true );
    // Each newly selected block shows the toolbar again.
    useEffect( () => {
        if ( selectionStart ) {
            setCollapsed( false );
        }
    }, [ selectionStart ] );
    return (
        <>
            <div
                className={
                    'wfd-block-tools' +
                    ( isCollapsed || ! selectionStart ? ' is-collapsed' : '' )
                }
            >
                <BlockToolbar hideDragHandle />
            </div>
            { /* Hidden by the style sheet while the selected block has no toolbar. */ }
            <IconButton
                className="wfd-block-tools__toggle"
                icon={ isCollapsed ? next : previous }
                label={
                    isCollapsed
                        ? __( 'Show block tools', 'wordpress-for-designers' )
                        : __( 'Hide block tools', 'wordpress-for-designers' )
                }
                variant="minimal"
                tone="neutral"
                size="compact"
                onClick={ () => setCollapsed( ! isCollapsed ) }
                data-wfd-control="H14"
            />
        </>
    );
}
