/**
 * Region: Left panel, artboards by kind (L1 to L4), and the list view panel
 * (L5, L6).
 */
import { __ } from '@wordpress/i18n';
import { closeSmall, comment } from '@wordpress/icons';
import { IconButton } from '@wordpress/ui';
import { ListViewSlot } from '../chrome-slots';
import { DEVICES, DEVICE_ORDER, KINDS, KIND_ORDER } from './constants';
import { noteName } from './notes';
import {
    GroupHeading,
    PanelHeader,
    Row,
    RowGroup,
    WeakText,
} from './primitives';

/**
 * Artboards grouped by kind, in left-panel order: by name within a group,
 * then Desktop, Tablet, Mobile.
 *
 * @param {Array} artboards Artboards with names.
 * @return {Array} Groups as { kind, artboards }.
 */
export function groupArtboards( artboards ) {
    return KIND_ORDER.map( ( kind ) => ( {
        kind,
        artboards: artboards
            .filter( ( artboard ) => artboard.kind === kind )
            .sort(
                ( a, b ) =>
                    a.name.localeCompare( b.name ) ||
                    DEVICE_ORDER.indexOf( a.device ) -
                        DEVICE_ORDER.indexOf( b.device )
            ),
    } ) ).filter( ( group ) => group.artboards.length );
}

/**
 * Artboards in left-panel order, as one list.
 *
 * @param {Array} artboards Artboards with names.
 * @return {Array} The ordered artboards.
 */
export function orderedArtboards( artboards ) {
    return groupArtboards( artboards ).flatMap( ( group ) => group.artboards );
}

/**
 * Delete or Backspace on a row acts on the selection.
 *
 * @param {Function} onRemove Removes the selection.
 * @param {Function} onEdit   Edits the row's item, or nothing.
 * @return {Function} The key handler.
 */
const rowKeys = ( onRemove, onEdit ) => ( event ) => {
    if ( event.key === 'Delete' || event.key === 'Backspace' ) {
        event.preventDefault();
        onRemove();
        return;
    }
    if ( event.key === 'Enter' && onEdit ) {
        event.preventDefault();
        onEdit();
    }
};

// Shift + click selects a range of rows, not the text between them.
const keepTextSelection = ( event ) => {
    if ( event.shiftKey ) {
        event.preventDefault();
    }
};

export function ArtboardsPanel( {
    artboards,
    notes = [],
    selectedIds,
    onSelect,
    onEdit,
    onEditNote,
    onRemove,
} ) {
    const groups = groupArtboards( artboards );
    return (
        <div className="wfd-artboards-panel" data-wfd-panel="artboards">
            <PanelHeader
                title={ __( 'Artboards', 'wordpress-for-designers' ) }
            />
            { ! groups.length && (
                <WeakText className="wfd-artboards-panel__empty">
                    { __( 'No artboards yet.', 'wordpress-for-designers' ) }
                </WeakText>
            ) }
            { groups.map( ( group ) => (
                <section key={ group.kind } data-wfd-group={ group.kind }>
                    <GroupHeading suffix={ group.artboards.length }>
                        { KINDS[ group.kind ].group }
                    </GroupHeading>
                    <RowGroup>
                        { group.artboards.map( ( artboard ) => (
                            <Row
                                key={ artboard.id }
                                icon={ KINDS[ artboard.kind ].icon }
                                name={ artboard.name }
                                suffix={ DEVICES[ artboard.device ]?.label }
                                isSelected={ selectedIds.includes(
                                    artboard.id
                                ) }
                                data-wfd-row={ artboard.id }
                                onMouseDown={ keepTextSelection }
                                onClick={ ( event ) =>
                                    onSelect( artboard.id, event )
                                }
                                onDoubleClick={ () => onEdit( artboard.id ) }
                                // A media object cannot be edited: Enter is
                                // left to the row's own click.
                                onKeyDown={ rowKeys(
                                    onRemove,
                                    KINDS[ artboard.kind ].edit
                                        ? () => onEdit( artboard.id )
                                        : null
                                ) }
                            />
                        ) ) }
                    </RowGroup>
                </section>
            ) ) }
            { notes.length > 0 && (
                <section data-wfd-group="note">
                    <GroupHeading suffix={ notes.length }>
                        { __( 'Notes', 'wordpress-for-designers' ) }
                    </GroupHeading>
                    <RowGroup>
                        { notes.map( ( note ) => (
                            <Row
                                key={ note.id }
                                icon={ comment }
                                name={ noteName( note ) }
                                isSelected={ selectedIds.includes( note.id ) }
                                data-wfd-row={ note.id }
                                onMouseDown={ keepTextSelection }
                                onClick={ ( event ) =>
                                    onSelect( note.id, event )
                                }
                                onDoubleClick={ () => onEditNote( note.id ) }
                                onKeyDown={ rowKeys( onRemove, () =>
                                    onEditNote( note.id )
                                ) }
                            />
                        ) ) }
                    </RowGroup>
                </section>
            ) }
        </div>
    );
}

export function ListViewPanel( { onClose } ) {
    return (
        <div className="wfd-list-view-panel" data-wfd-panel="list-view">
            <PanelHeader title={ __( 'List view', 'wordpress-for-designers' ) }>
                <IconButton
                    icon={ closeSmall }
                    label={ __( 'Close list view', 'wordpress-for-designers' ) }
                    variant="minimal"
                    tone="neutral"
                    size="compact"
                    onClick={ onClose }
                />
            </PanelHeader>
            <ListViewSlot />
        </div>
    );
}
