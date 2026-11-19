/**
 * The Styles panel (spec/screens/README.md, region "Right panel, Styles",
 * S1 to S6, and the Blocks and History tabs). Presentational: props in,
 * callbacks out.
 */
import { useId, useState } from '@wordpress/element';
import { __, _n, sprintf, isRTL } from '@wordpress/i18n';
import {
    ColorIndicator,
    ColorPalette,
    SearchControl,
} from '@wordpress/components';
import { BlockIcon } from '@wordpress/block-editor';
import {
    background,
    chevronDown,
    chevronLeft,
    chevronRight,
    shadow,
} from '@wordpress/icons';
import {
    Button,
    Icon,
    Menu,
    Popover,
    Stack,
    Tabs,
    VisuallyHidden,
} from '@wordpress/ui';
import {
    GroupHeading,
    PanelHeader,
    Row,
    RowGroup,
    WeakText,
} from '../shell/primitives';

const NO_COLORS = [];

/**
 * S2: the variation menu.
 *
 * @param {Object}      props
 * @param {Array}       props.variations      Theme style variations.
 * @param {string|null} props.activeVariation Title of the active variation.
 * @param {Function}    props.onPickVariation Called with a variation title.
 */
function VariationMenu( { variations, activeVariation, onPickVariation } ) {
    const label = activeVariation
        ? sprintf(
              /* translators: %s: name of a theme style variation. */
              __( 'Variation: %s', 'wordpress-for-designers' ),
              activeVariation
          )
        : __( 'Variation: Default', 'wordpress-for-designers' );

    return (
        <Menu.Root>
            <Menu.Trigger
                render={ <Button variant="outline" tone="neutral" /> }
            >
                { label }
                <Button.Icon icon={ chevronDown } />
            </Menu.Trigger>
            <Menu.Popup>
                <Menu.RadioGroup
                    value={ activeVariation ?? '' }
                    onValueChange={ ( title ) => onPickVariation?.( title ) }
                >
                    { variations.map( ( { title } ) => (
                        <Menu.RadioItem
                            key={ title }
                            value={ title }
                            closeOnClick
                        >
                            <Menu.ItemLabel>{ title }</Menu.ItemLabel>
                        </Menu.RadioItem>
                    ) ) }
                </Menu.RadioGroup>
            </Menu.Popup>
        </Menu.Root>
    );
}

/**
 * S4: one colour row. Its picker popover is rendered by the Tokens tab, after
 * the list, so the list holds only rows.
 *
 * @param {Object}   props
 * @param {Object}   props.token        { slug, name, color, uses }.
 * @param {boolean}  props.isSelected   Whether this token is selected.
 * @param {boolean}  props.isPickerOpen Whether the picker popover is open.
 * @param {Function} props.onToggle     Called when the row is clicked.
 * @param {Function} props.onAnchor     Receives the swatch element.
 */
function ColorRow( { token, isSelected, isPickerOpen, onToggle, onAnchor } ) {
    return (
        <Row
            icon={
                <span
                    ref={ isPickerOpen ? onAnchor : undefined }
                    className="wfd-styles__swatch"
                >
                    <ColorIndicator colorValue={ token.color } />
                </span>
            }
            name={ token.name }
            suffix={
                <span className="wfd-styles__suffix">
                    <span className="wfd-styles__hex">{ token.color }</span>
                    <span className="wfd-styles__uses">{ token.uses }</span>
                </span>
            }
            isSelected={ isSelected }
            aria-haspopup="dialog"
            aria-expanded={ isPickerOpen }
            onClick={ onToggle }
        />
    );
}

/**
 * The picker popover of the colour row that is open.
 *
 * @param {Object}   props
 * @param {Object}   props.token         { slug, name, color }.
 * @param {Element}  props.anchor        The row's swatch.
 * @param {Function} props.onClose       Called when the popover is dismissed.
 * @param {Function} props.onChangeColor Called with ( slug, color ).
 */
function ColorPicker( { token, anchor, onClose, onChangeColor } ) {
    return (
        <Popover.Root
            open
            onOpenChange={ ( open ) => {
                if ( ! open ) {
                    onClose();
                }
            } }
        >
            <Popover.Popup
                positioner={
                    <Popover.Positioner anchor={ anchor } side="left" />
                }
            >
                <VisuallyHidden render={ <Popover.Title /> }>
                    { token.name }
                </VisuallyHidden>
                <ColorPalette
                    colors={ NO_COLORS }
                    value={ token.color }
                    clearable={ false }
                    onChange={ ( color ) =>
                        onChangeColor?.( token.slug, color )
                    }
                />
            </Popover.Popup>
        </Popover.Root>
    );
}

/**
 * "Edit" in a Tokens group heading (S4 to S6): opens the stock styles screen
 * of the group. It is named by its own text and the heading's.
 *
 * @param {Object}   props
 * @param {string}   props.headingId Id of the group's heading.
 * @param {Function} props.onClick   Called when it is used.
 */
function EditGroup( { headingId, onClick } ) {
    const id = useId();
    return (
        <Button
            id={ id }
            aria-labelledby={ id + ' ' + headingId }
            variant="minimal"
            size="small"
            onClick={ onClick }
        >
            { __( 'Edit', 'wordpress-for-designers' ) }
            <Button.Icon icon={ isRTL() ? chevronLeft : chevronRight } />
        </Button>
    );
}

/**
 * The Tokens tab: S4 to S8.
 *
 * @param {Object}      props
 * @param {Array}       props.colors        Colour tokens.
 * @param {Array}       props.typography    Typography tokens.
 * @param {Array}       props.spacing       Spacing presets.
 * @param {boolean}     props.hasBackground Whether the theme allows a site background.
 * @param {Object|null} props.selectedToken { type, slug } or null.
 * @param {Function}    props.onSelectToken Called with a token or null.
 * @param {Function}    props.onChangeColor Called with ( slug, color ).
 * @param {Function}    props.onAddColor    Called by "Add color".
 * @param {string|null} props.openScreen    Path of the open stock screen.
 * @param {Function}    props.onOpenScreen  Called with a stock screen's path.
 * @param {Function}    props.renderScreen  Renders the open stock screen.
 */
function TokensTab( {
    colors,
    typography,
    spacing,
    hasBackground,
    selectedToken,
    onSelectToken,
    onChangeColor,
    onAddColor,
    openScreen,
    onOpenScreen,
    renderScreen,
} ) {
    const [ pickerSlug, setPickerSlug ] = useState( null );
    const [ pickerAnchor, setPickerAnchor ] = useState( null );
    const headingId = useId();
    const pickerToken = colors.find( ( token ) => token.slug === pickerSlug );
    const usesLabel = __( 'Uses', 'wordpress-for-designers' );
    const isSelected = ( type, slug ) =>
        selectedToken?.type === type && selectedToken?.slug === slug;
    const open = ( path ) => {
        setPickerSlug( null );
        onOpenScreen?.( path );
    };
    const chevron = <Icon icon={ isRTL() ? chevronLeft : chevronRight } />;

    if ( openScreen ) {
        // S8: the stock screen, with its own Back control.
        return (
            <div className="wfd-styles__screen">
                { renderScreen?.( openScreen ) }
            </div>
        );
    }

    return (
        <>
            <section className="wfd-styles__section">
                <GroupHeading
                    id={ headingId + 'colors' }
                    suffix={ usesLabel }
                    action={
                        <EditGroup
                            headingId={ headingId + 'colors' }
                            onClick={ () => open( '/colors' ) }
                        />
                    }
                >
                    { __( 'Colors', 'wordpress-for-designers' ) }
                </GroupHeading>
                <RowGroup>
                    { colors.map( ( token ) => {
                        const selected = isSelected( 'color', token.slug );
                        return (
                            <ColorRow
                                key={ token.slug }
                                token={ token }
                                isSelected={ selected }
                                isPickerOpen={ pickerSlug === token.slug }
                                onToggle={ () => {
                                    if ( selected ) {
                                        setPickerSlug( null );
                                        onSelectToken?.( null );
                                    } else {
                                        setPickerSlug( token.slug );
                                        onSelectToken?.( {
                                            type: 'color',
                                            slug: token.slug,
                                        } );
                                    }
                                } }
                                onAnchor={ setPickerAnchor }
                            />
                        );
                    } ) }
                </RowGroup>
                { pickerToken && pickerAnchor && (
                    <ColorPicker
                        key={ pickerToken.slug }
                        token={ pickerToken }
                        anchor={ pickerAnchor }
                        onClose={ () =>
                            setPickerSlug( ( current ) =>
                                current === pickerToken.slug ? null : current
                            )
                        }
                        onChangeColor={ onChangeColor }
                    />
                ) }
                <div className="wfd-styles__add">
                    <Button
                        variant="minimal"
                        onClick={ () => {
                            // The new colour is selected and its picker opens.
                            const slug = onAddColor?.();
                            if ( slug ) {
                                setPickerSlug( slug );
                                onSelectToken?.( { type: 'color', slug } );
                            }
                        } }
                    >
                        { __( 'Add color', 'wordpress-for-designers' ) }
                    </Button>
                </div>
            </section>
            <section className="wfd-styles__section">
                <GroupHeading
                    id={ headingId + 'typography' }
                    suffix={ usesLabel }
                    action={
                        <EditGroup
                            headingId={ headingId + 'typography' }
                            onClick={ () => open( '/typography' ) }
                        />
                    }
                >
                    { __( 'Typography', 'wordpress-for-designers' ) }
                </GroupHeading>
                <RowGroup>
                    { typography.map( ( token ) => {
                        const selected = isSelected( 'typography', token.slug );
                        return (
                            <Row
                                key={ token.slug }
                                icon={
                                    <span
                                        className="wfd-styles__type-sample"
                                        style={ {
                                            fontFamily: token.fontFamilyCss,
                                        } }
                                        aria-hidden="true"
                                    >
                                        { __(
                                            'Aa',
                                            'wordpress-for-designers'
                                        ) }
                                    </span>
                                }
                                name={ token.name }
                                secondLine={ sprintf(
                                    /* translators: 1: font family name, 2: font size, 3: line height. */
                                    __(
                                        '%1$s · %2$s / %3$s',
                                        'wordpress-for-designers'
                                    ),
                                    token.family,
                                    token.size,
                                    token.lineHeight
                                ) }
                                suffix={ token.uses }
                                isSelected={ selected }
                                onClick={ () =>
                                    onSelectToken?.(
                                        selected
                                            ? null
                                            : {
                                                  type: 'typography',
                                                  slug: token.slug,
                                              }
                                    )
                                }
                            />
                        );
                    } ) }
                </RowGroup>
            </section>
            <section className="wfd-styles__section">
                <GroupHeading
                    id={ headingId + 'spacing' }
                    action={
                        <EditGroup
                            headingId={ headingId + 'spacing' }
                            onClick={ () => open( '/layout' ) }
                        />
                    }
                >
                    { __( 'Spacing', 'wordpress-for-designers' ) }
                </GroupHeading>
                <Stack
                    className="wfd-styles__spacing"
                    direction="row"
                    align="flex-end"
                    gap="sm"
                    wrap="wrap"
                >
                    { spacing.map( ( { slug, px } ) => (
                        <Stack
                            key={ slug }
                            direction="column"
                            align="center"
                            gap="sm"
                        >
                            <span
                                className="wfd-styles__spacing-square"
                                style={ { width: px, height: px } }
                                aria-hidden="true"
                            />
                            <WeakText>{ px }</WeakText>
                        </Stack>
                    ) ) }
                </Stack>
            </section>
            <section className="wfd-styles__section">
                <RowGroup>
                    { hasBackground && (
                        <Row
                            icon={ background }
                            name={ __(
                                'Background',
                                'wordpress-for-designers'
                            ) }
                            suffix={ chevron }
                            onClick={ () => open( '/background' ) }
                        />
                    ) }
                    <Row
                        icon={ shadow }
                        name={ __( 'Shadows', 'wordpress-for-designers' ) }
                        suffix={ chevron }
                        onClick={ () => open( '/shadows' ) }
                    />
                </RowGroup>
            </section>
        </>
    );
}

/**
 * The Blocks tab: search, block rows, or one block's styles with a back
 * control.
 *
 * @param {Object}      props
 * @param {string}      props.blockQuery         The search text.
 * @param {Function}    props.onBlockQueryChange Called with the search text.
 * @param {Array}       props.blocks             { name, title, icon, changes }.
 * @param {string|null} props.openBlock          Name of the open block.
 * @param {Function}    props.onOpenBlock        Called with a name or null.
 * @param {Function}    props.renderBlockStyles  Renders the open block's styles.
 */
function BlocksTab( {
    blockQuery,
    onBlockQueryChange,
    blocks,
    openBlock,
    onOpenBlock,
    renderBlockStyles,
} ) {
    if ( openBlock ) {
        const open = blocks.find( ( { name } ) => name === openBlock );
        return (
            <div className="wfd-styles__block">
                <div className="wfd-styles__block-back">
                    <Button
                        variant="minimal"
                        tone="neutral"
                        onClick={ () => onOpenBlock?.( null ) }
                    >
                        <Button.Icon
                            icon={ isRTL() ? chevronRight : chevronLeft }
                        />
                        { open?.title ?? openBlock }
                    </Button>
                </div>
                <div className="wfd-styles__block-styles">
                    { renderBlockStyles?.( openBlock ) }
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="wfd-styles__search">
                <SearchControl
                    label={ __( 'Search blocks', 'wordpress-for-designers' ) }
                    placeholder={ __(
                        'Search blocks',
                        'wordpress-for-designers'
                    ) }
                    value={ blockQuery }
                    onChange={ onBlockQueryChange }
                />
            </div>
            <RowGroup>
                { blocks.map( ( { name, title, icon, changes } ) => (
                    <Row
                        key={ name }
                        icon={ <BlockIcon icon={ icon } /> }
                        name={ title }
                        suffix={
                            <span className="wfd-styles__suffix">
                                { changes > 0 && (
                                    <span className="wfd-styles__changes">
                                        { sprintf(
                                            /* translators: %d: number of changed style properties. */
                                            _n(
                                                '%d change',
                                                '%d changes',
                                                changes,
                                                'wordpress-for-designers'
                                            ),
                                            changes
                                        ) }
                                    </span>
                                ) }
                                <Icon
                                    icon={
                                        isRTL() ? chevronLeft : chevronRight
                                    }
                                />
                            </span>
                        }
                        onClick={ () => onOpenBlock?.( name ) }
                    />
                ) ) }
            </RowGroup>
            <WeakText className="wfd-styles__help" render={ <p /> }>
                { __(
                    'Each block opens the same styles panel the Site Editor uses.',
                    'wordpress-for-designers'
                ) }
            </WeakText>
        </>
    );
}

/**
 * First line of a History row.
 *
 * @param {Object} row { kind, date }.
 * @return {string} The row name.
 */
function historyName( row ) {
    if ( row.kind === 'unsaved' ) {
        return __( 'Unsaved', 'wordpress-for-designers' );
    }
    if ( row.kind === 'theme' ) {
        return __( 'Theme default', 'wordpress-for-designers' );
    }
    return row.date;
}

/**
 * Second line of a History row: author and the names of what changed.
 *
 * @param {Object} row { author, changes }.
 * @return {string|undefined} The second line.
 */
function historySecondLine( row ) {
    const changes = ( row.changes ?? [] ).reduce(
        ( list, change ) =>
            list
                ? sprintf(
                      /* translators: 1: names of changed styles so far, 2: the next name. */
                      __( '%1$s, %2$s', 'wordpress-for-designers' ),
                      list,
                      change
                  )
                : change,
        ''
    );
    if ( row.author && changes ) {
        return sprintf(
            /* translators: 1: author name, 2: list of changed styles. */
            __( '%1$s · %2$s', 'wordpress-for-designers' ),
            row.author,
            changes
        );
    }
    return row.author || changes || undefined;
}

/**
 * The History tab.
 *
 * @param {Object}   props
 * @param {Array}    props.historyRows       Rows, newest first.
 * @param {*}        props.selectedHistoryId Id of the previewed row.
 * @param {Function} props.onSelectHistory   Called with a row id.
 * @param {Function} props.onRestore         Called by "Restore".
 * @param {Function} props.onStopPreviewing  Called by "Stop previewing".
 */
function HistoryTab( {
    historyRows,
    selectedHistoryId,
    onSelectHistory,
    onRestore,
    onStopPreviewing,
} ) {
    const hasSelection =
        selectedHistoryId !== null && selectedHistoryId !== undefined;

    return (
        <>
            <RowGroup className="wfd-rows wfd-styles__history">
                { historyRows.map( ( row ) => (
                    <Row
                        key={ row.id }
                        name={ historyName( row ) }
                        secondLine={ historySecondLine( row ) }
                        isSelected={ row.id === selectedHistoryId }
                        onClick={ () => onSelectHistory?.( row.id ) }
                    />
                ) ) }
            </RowGroup>
            <Stack
                className="wfd-styles__history-actions"
                direction="row"
                gap="sm"
            >
                <Button
                    variant="solid"
                    disabled={ ! hasSelection }
                    onClick={ onRestore }
                >
                    { __( 'Restore', 'wordpress-for-designers' ) }
                </Button>
                <Button
                    variant="outline"
                    disabled={ ! hasSelection }
                    onClick={ onStopPreviewing }
                >
                    { __( 'Stop previewing', 'wordpress-for-designers' ) }
                </Button>
            </Stack>
        </>
    );
}

/**
 * The Styles panel.
 *
 * @param {Object}      props
 * @param {Array}       props.variations         [{ title }]; S2 is hidden when empty.
 * @param {string|null} props.activeVariation    Title, or null for the default.
 * @param {Function}    props.onPickVariation    Called with a title.
 * @param {string}      props.tab                'tokens', 'blocks' or 'history'.
 * @param {Function}    props.onTabChange        Called with a tab.
 * @param {Array}       props.colors             [{ slug, name, color, uses }].
 * @param {Array}       props.typography         [{ slug, name, family, size, lineHeight, uses, fontFamilyCss }].
 * @param {Array}       props.spacing            [{ slug, px }].
 * @param {boolean}     props.hasBackground      Whether the theme allows a site background.
 * @param {string|null} props.openScreen         Path of the stock screen open in Tokens.
 * @param {Function}    props.onOpenScreen       Called with a stock screen's path.
 * @param {Function}    props.renderScreen       Renders the open stock screen.
 * @param {Object|null} props.selectedToken      { type, slug } or null.
 * @param {Function}    props.onSelectToken      Called with a token or null.
 * @param {Function}    props.onChangeColor      Called with ( slug, color ).
 * @param {Function}    props.onAddColor         Called by "Add color".
 * @param {string}      props.blockQuery         Search text of the Blocks tab.
 * @param {Function}    props.onBlockQueryChange Called with the search text.
 * @param {Array}       props.blocks             [{ name, title, icon, changes }].
 * @param {string|null} props.openBlock          Name of the open block.
 * @param {Function}    props.onOpenBlock        Called with a name or null.
 * @param {Function}    props.renderBlockStyles  Renders the open block's styles.
 * @param {Array}       props.historyRows        [{ id, kind, date, author, changes }].
 * @param {*}           props.selectedHistoryId  Id of the previewed row.
 * @param {Function}    props.onSelectHistory    Called with a row id.
 * @param {Function}    props.onRestore          Called by "Restore".
 * @param {Function}    props.onStopPreviewing   Called by "Stop previewing".
 */
export function StylesPanel( {
    variations = [],
    activeVariation = null,
    onPickVariation,
    tab = 'tokens',
    onTabChange,
    colors = [],
    typography = [],
    spacing = [],
    hasBackground = true,
    openScreen = null,
    onOpenScreen,
    renderScreen,
    selectedToken = null,
    onSelectToken,
    onChangeColor,
    onAddColor,
    blockQuery = '',
    onBlockQueryChange,
    blocks = [],
    openBlock = null,
    onOpenBlock,
    renderBlockStyles,
    historyRows = [],
    selectedHistoryId = null,
    onSelectHistory,
    onRestore,
    onStopPreviewing,
} ) {
    return (
        <div className="wfd-styles">
            <PanelHeader
                title={ __( 'Styles', 'wordpress-for-designers' ) }
                variant="heading-lg"
            >
                { variations.length > 0 && (
                    <VariationMenu
                        variations={ variations }
                        activeVariation={ activeVariation }
                        onPickVariation={ onPickVariation }
                    />
                ) }
            </PanelHeader>
            <Tabs.Root
                value={ tab }
                onValueChange={ ( value ) => onTabChange?.( value ) }
            >
                <Tabs.List className="wfd-styles__tabs">
                    <Tabs.Tab value="tokens">
                        { __( 'Tokens', 'wordpress-for-designers' ) }
                    </Tabs.Tab>
                    <Tabs.Tab value="blocks">
                        { __( 'Blocks', 'wordpress-for-designers' ) }
                    </Tabs.Tab>
                    <Tabs.Tab value="history">
                        { __( 'History', 'wordpress-for-designers' ) }
                    </Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel value="tokens">
                    <TokensTab
                        colors={ colors }
                        typography={ typography }
                        spacing={ spacing }
                        hasBackground={ hasBackground }
                        openScreen={ openScreen }
                        onOpenScreen={ onOpenScreen }
                        renderScreen={ renderScreen }
                        selectedToken={ selectedToken }
                        onSelectToken={ onSelectToken }
                        onChangeColor={ onChangeColor }
                        onAddColor={ onAddColor }
                    />
                </Tabs.Panel>
                <Tabs.Panel value="blocks">
                    <BlocksTab
                        blockQuery={ blockQuery }
                        onBlockQueryChange={ onBlockQueryChange }
                        blocks={ blocks }
                        openBlock={ openBlock }
                        onOpenBlock={ onOpenBlock }
                        renderBlockStyles={ renderBlockStyles }
                    />
                </Tabs.Panel>
                <Tabs.Panel value="history">
                    <HistoryTab
                        historyRows={ historyRows }
                        selectedHistoryId={ selectedHistoryId }
                        onSelectHistory={ onSelectHistory }
                        onRestore={ onRestore }
                        onStopPreviewing={ onStopPreviewing }
                    />
                </Tabs.Panel>
            </Tabs.Root>
        </div>
    );
}
