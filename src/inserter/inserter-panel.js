/**
 * The inserter in the left panel (spec/screens/README.md, L7 to L12): search,
 * tabs of names and usage lines, the New rows that create artboards (D60),
 * and a hint. Presentational: the host supplies the lists and receives the
 * clicks and drags. Rows never contain a rendered preview (C17).
 */
import { useRef, useState, flushSync } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { SearchControl } from '@wordpress/components';
import { BlockIcon } from '@wordpress/block-editor';
import { Button, EmptyState, Icon, Stack, Tabs, Text } from '@wordpress/ui';
import { image, plus } from '@wordpress/icons';
import { GroupHeading, RowGroup, Row } from '../shell/primitives';
import { KINDS } from '../shell/constants';

/**
 * The dataTransfer type that carries a dragged inserter item as JSON.
 */
export const DRAG_DATA_TYPE = 'application/x-wfd-item';

const TABS = [
    { value: 'blocks', label: __( 'Blocks', 'wordpress-for-designers' ) },
    { value: 'pages', label: __( 'Pages', 'wordpress-for-designers' ) },
    { value: 'patterns', label: __( 'Patterns', 'wordpress-for-designers' ) },
    {
        value: 'templates',
        label: __( 'Templates', 'wordpress-for-designers' ),
    },
    { value: 'media', label: __( 'Media', 'wordpress-for-designers' ) },
];

function matches( text, needle ) {
    return String( text ?? '' )
        .toLowerCase()
        .includes( needle );
}

function filterGroups( groups, needle, key ) {
    return ( groups ?? [] )
        .map( ( group ) => ( {
            ...group,
            items: ( group.items ?? [] ).filter( ( item ) =>
                matches( item[ key ], needle )
            ),
        } ) )
        .filter( ( group ) => group.items.length > 0 );
}

/**
 * The rows that create a new artboard (L12), by the group they are in. Each
 * has the `choice` the host arms placement with.
 *
 * @param {Array} purposes Template purposes still on offer, as { slug, label }.
 * @return {Object} `page`, `pattern`, `purposes` and `templatePart` rows.
 */
export function getNewRows( purposes ) {
    return {
        page: [
            {
                key: 'page',
                name: __( 'New page', 'wordpress-for-designers' ),
                choice: { kind: 'page' },
            },
        ],
        pattern: [
            {
                key: 'pattern',
                name: __( 'New pattern', 'wordpress-for-designers' ),
                choice: { kind: 'pattern' },
            },
        ],
        purposes: ( purposes ?? [] ).map( ( purpose ) => ( {
            key: 'template:' + ( purpose.slug ?? 'custom' ),
            name: purpose.label,
            choice: { kind: 'template', purpose },
        } ) ),
        templatePart: [
            {
                key: 'template-part',
                name: __( 'New template part', 'wordpress-for-designers' ),
                choice: { kind: 'template-part' },
            },
        ],
    };
}

/**
 * Filters the inserter lists by a search query: a case-insensitive match on
 * the visible name of each item. Groups left with no items are dropped. An
 * empty or whitespace-only query keeps every item.
 *
 * @param {Object} lists               The unfiltered lists.
 * @param {Array}  lists.blocks        Block groups.
 * @param {Array}  lists.pages         Pages.
 * @param {Array}  lists.patterns      Pattern groups.
 * @param {Array}  lists.templates     Templates.
 * @param {Array}  lists.templateParts Template parts.
 * @param {Array}  lists.media         Images.
 * @param {Object} lists.newRows       New rows from getNewRows, if shown.
 * @param {string} query               The search query.
 * @return {Object} The filtered lists, with `total`, the number of items left
 *                  across all tabs.
 */
export function filterInserterItems(
    { blocks, pages, patterns, templates, templateParts, media, newRows },
    query
) {
    const needle = String( query ?? '' )
        .trim()
        .toLowerCase();
    const named = ( items ) =>
        ( items ?? [] ).filter( ( item ) => matches( item.name, needle ) );
    const filtered = {
        blocks: filterGroups( blocks, needle, 'title' ),
        pages: named( pages ),
        newRows: {
            page: named( newRows?.page ),
            pattern: named( newRows?.pattern ),
            purposes: named( newRows?.purposes ),
            templatePart: named( newRows?.templatePart ),
        },
        patterns: filterGroups( patterns, needle, 'name' ),
        templates: ( templates ?? [] ).filter( ( item ) =>
            matches( item.name, needle )
        ),
        templateParts: ( templateParts ?? [] ).filter( ( item ) =>
            matches( item.name, needle )
        ),
        media: ( media ?? [] ).filter( ( item ) =>
            matches( item.filename, needle )
        ),
    };
    const countGroups = ( groups ) =>
        groups.reduce( ( sum, group ) => sum + group.items.length, 0 );
    filtered.total =
        countGroups( filtered.blocks ) +
        filtered.pages.length +
        Object.values( filtered.newRows ).reduce(
            ( sum, rows ) => sum + rows.length,
            0
        ) +
        countGroups( filtered.patterns ) +
        filtered.templates.length +
        filtered.templateParts.length +
        filtered.media.length;
    return filtered;
}

/**
 * The second line of a pattern row (spec/screens/Library.md).
 *
 * A pattern used in exactly one place returns undefined: the spec gives two
 * wordings for that case and no rule to choose between them.
 *
 * @param {Object}   pattern
 * @param {boolean}  pattern.isOnBoard Whether the pattern is an artboard here.
 * @param {string[]} pattern.usedIn    Names of the templates and parts using it.
 * @return {string|undefined} The usage line.
 */
export function getPatternUsageLine( { isOnBoard, usedIn } ) {
    if ( isOnBoard ) {
        return __( 'On this board', 'wordpress-for-designers' );
    }
    const count = usedIn?.length ?? 0;
    if ( count === 0 ) {
        return __( 'Not used yet', 'wordpress-for-designers' );
    }
    if ( count === 1 ) {
        return undefined;
    }
    return sprintf(
        /* translators: %d: number of templates that use the pattern. */
        _n(
            'Used in %d template',
            'Used in %d templates',
            count,
            'wordpress-for-designers'
        ),
        count
    );
}

function getPatternGroupTitle( { source, themeName } ) {
    if ( source === 'user' ) {
        return __( 'Yours', 'wordpress-for-designers' );
    }
    if ( source === 'theme' ) {
        return sprintf(
            /* translators: %s: theme name. */
            __( 'Theme: %s', 'wordpress-for-designers' ),
            themeName
        );
    }
    return undefined;
}

function getBoardLine( isOnBoard ) {
    return isOnBoard
        ? __( 'On this board', 'wordpress-for-designers' )
        : __( 'Not on this board', 'wordpress-for-designers' );
}

function getHint( tab, liveArtboardName ) {
    const isEditing = liveArtboardName !== null;
    switch ( tab ) {
        case 'blocks':
            return isEditing
                ? sprintf(
                      /* translators: %s: name of the artboard in edit. */
                      __(
                          'Click to insert at the cursor in %s.',
                          'wordpress-for-designers'
                      ),
                      liveArtboardName
                  )
                : __(
                      'Edit an artboard to insert blocks.',
                      'wordpress-for-designers'
                  );
        case 'pages':
            return isEditing
                ? undefined
                : __(
                      'Click or drag to the board to open it as an artboard.',
                      'wordpress-for-designers'
                  );
        case 'patterns':
            return isEditing
                ? sprintf(
                      /* translators: %s: name of the artboard in edit. */
                      __(
                          'Click or drag to insert into %s.',
                          'wordpress-for-designers'
                      ),
                      liveArtboardName
                  )
                : __(
                      'Click or drag to the board to open it as an artboard.',
                      'wordpress-for-designers'
                  );
        case 'templates':
            return isEditing
                ? sprintf(
                      /* translators: %s: name of the artboard in edit. */
                      __(
                          'Click or drag a template part to insert it into %s.',
                          'wordpress-for-designers'
                      ),
                      liveArtboardName
                  )
                : __(
                      'Click or drag to the board to open it as an artboard.',
                      'wordpress-for-designers'
                  );
        case 'media':
            return isEditing
                ? sprintf(
                      /* translators: %s: name of the artboard in edit. */
                      __(
                          'Click or drag to insert as an Image block in %s.',
                          'wordpress-for-designers'
                      ),
                      liveArtboardName
                  )
                : __(
                      'Click or drag to the board to place it there.',
                      'wordpress-for-designers'
                  );
        default:
            return undefined;
    }
}

function Group( { title, count, children, ...props } ) {
    return (
        <section className="wfd-inserter__group" { ...props }>
            <GroupHeading suffix={ count }>{ title }</GroupHeading>
            <RowGroup>{ children }</RowGroup>
        </section>
    );
}

/**
 * The inserter panel.
 *
 * @param {Object}                                props
 * @param {string}                                props.query            The search query.
 * @param {(query: string) => void}               props.onQueryChange    Called with the new query.
 * @param {string}                                props.tab              'blocks', 'pages', 'patterns', 'templates' or 'media'.
 * @param {(tab: string) => void}                 props.onTabChange      Called with the new tab.
 * @param {string|null}                           props.liveArtboardName Name of the artboard in edit, or null.
 * @param {Array}                                 props.blocks           [ { category: { slug, title }, items: [ { name, title, icon } ] } ].
 * @param {Array}                                 props.pages            [ { id, name, isOnBoard } ].
 * @param {Array}                                 props.purposes         Template purposes offered as new: [ { slug, label } ].
 * @param {Array}                                 props.patterns         [ { source: 'user' } or { source: 'theme', themeName }, with items: [ { id, name, isOnBoard, usedIn } ] ].
 * @param {Array}                                 props.templates        [ { id, name, isOnBoard } ].
 * @param {Array}                                 props.templateParts    [ { id, name, isOnBoard } ].
 * @param {Array}                                 props.media            [ { id, filename, width, height } ].
 * @param {(item: Object) => void}                props.onItemClick      Called with { type, id }; type is 'block', 'page', 'pattern', 'template', 'template-part' or 'media'.
 * @param {(choice: Object) => void}              props.onNewClick       Called with { kind } and, for a template, its purpose, when a New row is clicked.
 * @param {(item: Object, event: Object) => void} props.onItemDragStart  Called with { type, id, name } and the event.
 * @param {(event: Object) => void}               props.onItemDragEnd    Called with the event.
 * @param {(button: Element) => Element}          props.renderUpload     Receives the "Upload" button element, returns what to render.
 */
export function InserterPanel( {
    query = '',
    onQueryChange,
    tab = 'blocks',
    onTabChange,
    liveArtboardName = null,
    blocks,
    pages,
    purposes,
    patterns,
    templates,
    templateParts,
    media,
    onItemClick,
    onNewClick,
    onItemDragStart,
    onItemDragEnd,
    renderUpload,
} ) {
    const chipRef = useRef( null );
    const [ chip, setChip ] = useState( null );

    const isEditing = liveArtboardName !== null;
    // Blocks go only into an artboard in edit, so with none in edit their
    // tab is not shown and they do not count as search results. Pages and
    // the New rows go only onto the board, so in edit they are the ones left
    // out (D33, D60).
    const tabs = TABS.filter(
        ( { value } ) => value !== ( isEditing ? 'pages' : 'blocks' )
    );
    const activeTab = tabs.some( ( { value } ) => value === tab )
        ? tab
        : tabs[ 0 ].value;
    const filtered = filterInserterItems(
        {
            blocks: isEditing ? blocks : [],
            pages: isEditing ? [] : pages,
            newRows: isEditing ? null : getNewRows( purposes ),
            patterns,
            templates,
            templateParts,
            media,
        },
        query
    );
    const trimmedQuery = query.trim();
    const isEmpty = trimmedQuery !== '' && filtered.total === 0;

    const click = ( type, id ) => () => {
        if ( onItemClick ) {
            onItemClick( { type, id } );
        }
    };

    const dragProps = ( item, icon ) => ( {
        draggable: true,
        onDragStart: ( event ) => {
            // The chip must show this item before the browser snapshots it.
            flushSync( () => setChip( { icon, name: item.name } ) );
            event.dataTransfer.effectAllowed = 'copy';
            event.dataTransfer.setData(
                DRAG_DATA_TYPE,
                JSON.stringify( item )
            );
            if ( chipRef.current ) {
                event.dataTransfer.setDragImage( chipRef.current, 0, 0 );
            }
            if ( onItemDragStart ) {
                onItemDragStart( item, event );
            }
        },
        onDragEnd: ( event ) => {
            if ( onItemDragEnd ) {
                onItemDragEnd( event );
            }
        },
    } );

    const emptyState = (
        <EmptyState.Root className="wfd-inserter__empty">
            <EmptyState.Title>
                { __( 'No results', 'wordpress-for-designers' ) }
            </EmptyState.Title>
            <EmptyState.Description>
                { sprintf(
                    /* translators: %s: the search query. */
                    __(
                        'Nothing in blocks, patterns, templates or media matches "%s".',
                        'wordpress-for-designers'
                    ),
                    trimmedQuery
                ) }
            </EmptyState.Description>
        </EmptyState.Root>
    );

    const uploadButton = (
        <Button variant="outline">
            { __( 'Upload', 'wordpress-for-designers' ) }
        </Button>
    );

    // The rows that create (L12): a group whose heading has no count.
    const newGroup = ( rows, title ) =>
        rows.length > 0 && (
            <Group title={ title } data-wfd-group="new">
                { rows.map( ( row ) => (
                    <Row
                        key={ row.key }
                        icon={ plus }
                        name={ row.name }
                        data-wfd-new={ row.key }
                        onClick={ () => {
                            if ( onNewClick ) {
                                onNewClick( row.choice );
                            }
                        } }
                    />
                ) ) }
            </Group>
        );
    const newTitle = __( 'New', 'wordpress-for-designers' );

    const panels = {
        pages: (
            <>
                { newGroup( filtered.newRows.page, newTitle ) }
                { filtered.pages.length > 0 && (
                    <Group
                        title={ KINDS.page.group }
                        count={ filtered.pages.length }
                    >
                        { filtered.pages.map( ( item ) => (
                            <Row
                                key={ item.id }
                                icon={ KINDS.page.icon }
                                name={ item.name }
                                secondLine={ getBoardLine( item.isOnBoard ) }
                                onClick={ click( 'page', item.id ) }
                                { ...dragProps(
                                    {
                                        type: 'page',
                                        id: item.id,
                                        name: item.name,
                                    },
                                    KINDS.page.icon
                                ) }
                            />
                        ) ) }
                    </Group>
                ) }
            </>
        ),
        blocks: filtered.blocks.map( ( group ) => (
            <Group
                key={ group.category.slug }
                title={ group.category.title }
                count={ group.items.length }
            >
                { group.items.map( ( item ) => (
                    <Row
                        key={ item.name }
                        icon={ <BlockIcon icon={ item.icon } /> }
                        name={ item.title }
                        onClick={ click( 'block', item.name ) }
                    />
                ) ) }
            </Group>
        ) ),
        patterns: (
            <>
                { newGroup( filtered.newRows.pattern, newTitle ) }
                { filtered.patterns.map( ( group ) => {
                    const title = getPatternGroupTitle( group );
                    if ( title === undefined ) {
                        return null;
                    }
                    return (
                        <Group
                            key={
                                group.source === 'theme'
                                    ? 'theme:' + group.themeName
                                    : group.source
                            }
                            title={ title }
                            count={ group.items.length }
                        >
                            { group.items.map( ( item ) => (
                                <Row
                                    key={ item.id }
                                    icon={ KINDS.pattern.icon }
                                    name={ item.name }
                                    secondLine={ getPatternUsageLine( item ) }
                                    onClick={ click( 'pattern', item.id ) }
                                    { ...dragProps(
                                        {
                                            type: 'pattern',
                                            id: item.id,
                                            name: item.name,
                                        },
                                        KINDS.pattern.icon
                                    ) }
                                />
                            ) ) }
                        </Group>
                    );
                } ) }
            </>
        ),
        templates: (
            <>
                { newGroup(
                    filtered.newRows.purposes,
                    __( 'New template for', 'wordpress-for-designers' )
                ) }
                { newGroup( filtered.newRows.templatePart, newTitle ) }
                { filtered.templates.length > 0 && (
                    <Group
                        title={ KINDS.template.group }
                        count={ filtered.templates.length }
                    >
                        { filtered.templates.map( ( item ) => (
                            <Row
                                key={ item.id }
                                icon={ KINDS.template.icon }
                                name={ item.name }
                                secondLine={ getBoardLine( item.isOnBoard ) }
                                onClick={ click( 'template', item.id ) }
                                { ...dragProps(
                                    {
                                        type: 'template',
                                        id: item.id,
                                        name: item.name,
                                    },
                                    KINDS.template.icon
                                ) }
                            />
                        ) ) }
                    </Group>
                ) }
                { filtered.templateParts.length > 0 && (
                    <Group
                        title={ KINDS[ 'template-part' ].group }
                        count={ filtered.templateParts.length }
                    >
                        { filtered.templateParts.map( ( item ) => (
                            <Row
                                key={ item.id }
                                icon={ KINDS[ 'template-part' ].icon }
                                name={ item.name }
                                secondLine={ getBoardLine( item.isOnBoard ) }
                                onClick={ click( 'template-part', item.id ) }
                                { ...dragProps(
                                    {
                                        type: 'template-part',
                                        id: item.id,
                                        name: item.name,
                                    },
                                    KINDS[ 'template-part' ].icon
                                ) }
                            />
                        ) ) }
                    </Group>
                ) }
            </>
        ),
        media: (
            <>
                { filtered.media.length > 0 && (
                    <Group
                        title={ __( 'Images', 'wordpress-for-designers' ) }
                        count={ filtered.media.length }
                    >
                        { filtered.media.map( ( item ) => (
                            <Row
                                key={ item.id }
                                icon={ image }
                                name={ item.filename }
                                secondLine={ sprintf(
                                    /* translators: 1: image width in pixels. 2: image height in pixels. */
                                    __(
                                        '%1$d × %2$d',
                                        'wordpress-for-designers'
                                    ),
                                    item.width,
                                    item.height
                                ) }
                                onClick={ click( 'media', item.id ) }
                                { ...dragProps(
                                    {
                                        type: 'media',
                                        id: item.id,
                                        name: item.filename,
                                    },
                                    image
                                ) }
                            />
                        ) ) }
                    </Group>
                ) }
                <div className="wfd-inserter__upload">
                    { renderUpload
                        ? renderUpload( uploadButton )
                        : uploadButton }
                </div>
            </>
        ),
    };

    const hint = isEmpty ? undefined : getHint( activeTab, liveArtboardName );

    return (
        <div className="wfd-inserter">
            <div className="wfd-inserter__search">
                <SearchControl
                    label={ __( 'Search', 'wordpress-for-designers' ) }
                    placeholder={ __( 'Search', 'wordpress-for-designers' ) }
                    value={ query }
                    onChange={ ( value ) => {
                        if ( onQueryChange ) {
                            onQueryChange( value );
                        }
                    } }
                />
            </div>
            <Tabs.Root
                className="wfd-inserter__tabs"
                value={ activeTab }
                onValueChange={ ( value ) => {
                    if ( onTabChange ) {
                        onTabChange( value );
                    }
                } }
            >
                <div className="wfd-inserter__tab-strip">
                    <Tabs.List variant="minimal">
                        { tabs.map( ( { value, label } ) => (
                            <Tabs.Tab key={ value } value={ value }>
                                { label }
                            </Tabs.Tab>
                        ) ) }
                    </Tabs.List>
                </div>
                { tabs.map( ( { value } ) => (
                    <Tabs.Panel
                        key={ value }
                        value={ value }
                        className="wfd-inserter__panel"
                    >
                        { isEmpty ? emptyState : panels[ value ] }
                    </Tabs.Panel>
                ) ) }
            </Tabs.Root>
            { hint && (
                <Text
                    variant="body-md"
                    className="wfd-inserter__hint"
                    render={ <p /> }
                >
                    { hint }
                </Text>
            ) }
            <div
                ref={ chipRef }
                className="wfd-inserter__drag-chip"
                aria-hidden="true"
            >
                { chip && (
                    <Stack direction="row" align="center" gap="sm">
                        <Icon icon={ chip.icon } />
                        <Text variant="body-md">{ chip.name }</Text>
                    </Stack>
                ) }
            </div>
        </div>
    );
}
