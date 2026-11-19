/**
 * Slots in the shell for the block toolbar, the inspector and the list view.
 * Only the Live editor fills them (constraint C8).
 */
import { createSlotFill } from '@wordpress/components';

const toolbar = createSlotFill( 'wfd/block-toolbar' );
const inspector = createSlotFill( 'wfd/inspector' );
const listView = createSlotFill( 'wfd/list-view' );

export const BlockToolbarFill = toolbar.Fill;
export const InspectorFill = inspector.Fill;
export const ListViewFill = listView.Fill;

export function BlockToolbarSlot() {
    return <toolbar.Slot bubblesVirtually className="wfd-slot-toolbar" />;
}

export function InspectorSlot() {
    return <inspector.Slot bubblesVirtually className="wfd-slot-inspector" />;
}

export function ListViewSlot() {
    return <listView.Slot bubblesVirtually className="wfd-slot-list-view" />;
}
