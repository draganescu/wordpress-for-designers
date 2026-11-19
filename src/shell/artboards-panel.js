/**
 * Region: Left panel, artboards by kind (L1 to L4), and the list view panel
 * (L5, L6).
 */
import { __ } from '@wordpress/i18n';
import { closeSmall } from '@wordpress/icons';
import { IconButton } from '@wordpress/ui';
import { ListViewSlot } from '../chrome-slots';
import { DEVICES, DEVICE_ORDER, KINDS, KIND_ORDER } from './constants';
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

export function ArtboardsPanel( {
    artboards,
    selectedId,
    onSelect,
    onEdit,
    addMenu,
} ) {
    const groups = groupArtboards( artboards );
    return (
        <div className="wfd-artboards-panel" data-wfd-panel="artboards">
            <PanelHeader title={ __( 'Artboards', 'wordpress-for-designers' ) }>
                { addMenu }
            </PanelHeader>
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
                                isSelected={ artboard.id === selectedId }
                                data-wfd-row={ artboard.id }
                                onClick={ () => onSelect( artboard.id ) }
                                onDoubleClick={ () => onEdit( artboard.id ) }
                                onKeyDown={ ( event ) => {
                                    // A media object cannot be edited: the
                                    // key is left to the row's own click.
                                    if (
                                        event.key === 'Enter' &&
                                        artboard.kind !== 'media'
                                    ) {
                                        event.preventDefault();
                                        onEdit( artboard.id );
                                    }
                                } }
                            />
                        ) ) }
                    </RowGroup>
                </section>
            ) ) }
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
