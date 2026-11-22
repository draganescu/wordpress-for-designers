/**
 * Region: Header (H1 to H13).
 */
import { countRender } from './test-hooks';
import { __, _n, sprintf } from '@wordpress/i18n';
import {
    arrowLeft,
    chevronDown,
    close,
    comment,
    listView as listViewIcon,
    drawerLeft,
    drawerRight,
    grid,
    plus,
    redo as redoIcon,
    undo as undoIcon,
    wordpress,
} from '@wordpress/icons';
import {
    Badge,
    Button,
    ButtonLink,
    Icon,
    IconButton,
    Menu,
    Text,
    VisuallyHidden,
} from '@wordpress/ui';
import { BlockToolbarSlot } from '../chrome-slots';

const ZOOM_ITEMS = [
    [ 'in', __( 'Zoom in', 'wordpress-for-designers' ) ],
    [ 'out', __( 'Zoom out', 'wordpress-for-designers' ) ],
    [ '50', __( 'Zoom to 50%', 'wordpress-for-designers' ) ],
    [ '100', __( 'Zoom to 100%', 'wordpress-for-designers' ) ],
    [ 'fit-all', __( 'Fit all', 'wordpress-for-designers' ) ],
    [ 'fit-selection', __( 'Fit selection', 'wordpress-for-designers' ) ],
];

// G1: what the header chip reads while an agent is there
// (spec/agent/surface.md, Marks).
const AGENT_CHIP = {
    connected: __( 'Agent connected', 'wordpress-for-designers' ),
    working: __( 'Agent working', 'wordpress-for-designers' ),
    annotating: __( 'Annotating', 'wordpress-for-designers' ),
};

function reviewText( count ) {
    if ( ! count ) {
        return __( 'Review changes', 'wordpress-for-designers' );
    }
    return sprintf(
        /* translators: %d: number of changed items. */
        _n(
            'Review %d change',
            'Review %d changes',
            count,
            'wordpress-for-designers'
        ),
        count
    );
}

export function Header( {
    boardsUrl,
    boardName,
    liveName,
    isInserterOpen,
    onToggleInserter,
    undo,
    redo,
    isListViewOpen,
    isListViewDisabled,
    onToggleListView,
    onBack,
    zoomPercent,
    onZoom,
    canFitSelection,
    canTidy,
    onTidy,
    reviewCount,
    onReview,
    isLeftShown,
    onToggleLeft,
    isRightShown,
    onToggleRight,
    isNoteToolArmed,
    isNoteToolDisabled,
    onToggleNoteTool,
    agentChip = null,
} ) {
    countRender();
    return (
        <header className="wfd-header" data-wfd-region="header">
            <div className="wfd-header__start">
                <ButtonLink
                    className="wfd-header__boards"
                    href={ boardsUrl }
                    variant="unstyled"
                    aria-label={ __( 'All boards', 'wordpress-for-designers' ) }
                    data-wfd-control="H1"
                >
                    <Icon icon={ wordpress } size={ 32 } />
                </ButtonLink>
                <div className="wfd-header__tools">
                    <IconButton
                        icon={ isInserterOpen ? close : plus }
                        label={
                            isInserterOpen
                                ? __(
                                      'Close block inserter',
                                      'wordpress-for-designers'
                                  )
                                : __(
                                      'Block inserter',
                                      'wordpress-for-designers'
                                  )
                        }
                        variant="solid"
                        tone={ isInserterOpen ? 'neutral' : 'brand' }
                        size="compact"
                        aria-pressed={ isInserterOpen }
                        onClick={ onToggleInserter }
                        data-wfd-control="H2"
                    />
                    <IconButton
                        icon={ undoIcon }
                        label={ undo.label }
                        variant="minimal"
                        tone="neutral"
                        size="compact"
                        disabled={ undo.disabled }
                        onClick={ undo.onClick }
                        data-wfd-control="H3"
                    />
                    <IconButton
                        icon={ redoIcon }
                        label={ redo.label }
                        variant="minimal"
                        tone="neutral"
                        size="compact"
                        disabled={ redo.disabled }
                        onClick={ redo.onClick }
                        data-wfd-control="H4"
                    />
                    <IconButton
                        icon={ listViewIcon }
                        label={ __( 'List view', 'wordpress-for-designers' ) }
                        variant="minimal"
                        tone="neutral"
                        size="compact"
                        aria-pressed={ isListViewOpen }
                        disabled={ isListViewDisabled }
                        onClick={ onToggleListView }
                        data-wfd-control="H5"
                    />
                    <IconButton
                        icon={ drawerLeft }
                        label={
                            isLeftShown
                                ? __(
                                      'Hide left panel',
                                      'wordpress-for-designers'
                                  )
                                : __(
                                      'Show left panel',
                                      'wordpress-for-designers'
                                  )
                        }
                        variant="minimal"
                        tone="neutral"
                        size="compact"
                        aria-pressed={ isLeftShown }
                        onClick={ onToggleLeft }
                        data-wfd-control="H10"
                    />
                    <IconButton
                        icon={ comment }
                        label={ __( 'Add note', 'wordpress-for-designers' ) }
                        variant="minimal"
                        tone="neutral"
                        size="compact"
                        aria-pressed={ isNoteToolArmed }
                        disabled={ isNoteToolDisabled }
                        onClick={ onToggleNoteTool }
                        data-wfd-control="H13"
                    />
                    { liveName && (
                        <div
                            className="wfd-header__toolbar"
                            data-wfd-control="H6"
                        >
                            <BlockToolbarSlot />
                        </div>
                    ) }
                </div>
            </div>
            <div className="wfd-header__document" data-wfd-control="H7">
                { liveName && (
                    <IconButton
                        icon={ arrowLeft }
                        label={ __(
                            'Back to the board',
                            'wordpress-for-designers'
                        ) }
                        variant="minimal"
                        tone="neutral"
                        size="compact"
                        onClick={ onBack }
                    />
                ) }
                <Text variant="body-md" className="wfd-header__document-name">
                    { liveName || boardName }
                </Text>
            </div>
            <div className="wfd-header__end">
                { AGENT_CHIP[ agentChip ] && (
                    <Badge
                        className="wfd-header__agent"
                        data-wfd-agent={ agentChip }
                    >
                        { AGENT_CHIP[ agentChip ] }
                    </Badge>
                ) }
                <IconButton
                    icon={ grid }
                    label={ __( 'Tidy up', 'wordpress-for-designers' ) }
                    variant="minimal"
                    tone="neutral"
                    size="compact"
                    disabled={ ! canTidy }
                    onClick={ onTidy }
                    data-wfd-control="H12"
                />
                <Menu.Root>
                    <Menu.Trigger
                        render={
                            <Button
                                variant="minimal"
                                tone="neutral"
                                size="compact"
                                data-wfd-control="H8"
                            />
                        }
                    >
                        { /* The label, read before the visible percentage. */ }
                        <VisuallyHidden>
                            { __( 'Zoom', 'wordpress-for-designers' ) }
                        </VisuallyHidden>
                        <span className="wfd-header__zoom-value">
                            { sprintf(
                                /* translators: %d: zoom percentage. */
                                __( '%d%%', 'wordpress-for-designers' ),
                                zoomPercent
                            ) }
                        </span>
                        <Icon icon={ chevronDown } />
                    </Menu.Trigger>
                    <Menu.Popup>
                        { ZOOM_ITEMS.map( ( [ id, label ] ) => (
                            <Menu.Item
                                key={ id }
                                disabled={
                                    id === 'fit-selection' && ! canFitSelection
                                }
                                onClick={ () => onZoom( id ) }
                            >
                                <Menu.ItemLabel>{ label }</Menu.ItemLabel>
                            </Menu.Item>
                        ) ) }
                    </Menu.Popup>
                </Menu.Root>
                <IconButton
                    icon={ drawerRight }
                    label={
                        isRightShown
                            ? __(
                                  'Hide right panel',
                                  'wordpress-for-designers'
                              )
                            : __(
                                  'Show right panel',
                                  'wordpress-for-designers'
                              )
                    }
                    variant="minimal"
                    tone="neutral"
                    size="compact"
                    aria-pressed={ isRightShown }
                    onClick={ onToggleRight }
                    data-wfd-control="H11"
                />
                <Button
                    variant="solid"
                    tone="brand"
                    disabled={ ! reviewCount }
                    onClick={ onReview }
                    data-wfd-control="H9"
                >
                    { reviewText( reviewCount ) }
                </Button>
            </div>
        </header>
    );
}
