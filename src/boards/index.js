/**
 * The Designer › Boards screen (spec/screens/Boards.md, BoardsEmpty.md).
 */
import {
    createRoot,
    useEffect,
    useMemo,
    useRef,
    useState,
} from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { addQueryArgs } from '@wordpress/url';
import { useDispatch } from '@wordpress/data';
import { store as coreStore, useEntityRecords } from '@wordpress/core-data';
import { Page } from '@wordpress/admin-ui';
import { DataViews, filterSortAndPaginate } from '@wordpress/dataviews';
import {
    Button,
    Dialog,
    EmptyState,
    InputControl,
    useEnableWpCompatOverlaySlot,
} from '@wordpress/ui';
import { ThemeProvider } from '@wordpress/theme';
import './style.scss';

const { boardUrl, createOnLoad } = window.wfdConfig;

const QUERY = { per_page: -1, status: 'publish', context: 'edit' };
const DEFAULT_VIEW = {
    type: 'grid',
    search: '',
    page: 1,
    perPage: 50,
    titleField: 'title',
    mediaField: 'placeholder',
    descriptionField: 'summary',
    fields: [],
    sort: { field: 'modified', direction: 'desc' },
};
const DEFAULT_LAYOUTS = { grid: {} };

/**
 * A date as relative time, for example "2 hours ago".
 *
 * @param {string} gmt An ISO date without zone, in GMT.
 * @return {string} The relative time in the document's language.
 */
function relativeTime( gmt ) {
    const seconds = ( new Date( gmt + 'Z' ).getTime() - Date.now() ) / 1000;
    const format = new Intl.RelativeTimeFormat(
        document.documentElement.lang || undefined,
        { numeric: 'auto' }
    );
    const steps = [
        [ 60, 'second' ],
        [ 60, 'minute' ],
        [ 24, 'hour' ],
        [ 7, 'day' ],
        [ 4.345, 'week' ],
        [ 12, 'month' ],
        [ Infinity, 'year' ],
    ];
    let value = seconds;
    for ( const [ size, unit ] of steps ) {
        if ( Math.abs( value ) < size ) {
            return format.format( Math.round( value ), unit );
        }
        value /= size;
    }
    return '';
}

function boardSummary( board ) {
    const count = board.layout?.artboards?.length ?? 0;
    return sprintf(
        /* translators: 1: number of artboards, for example "3 artboards". 2: relative time, for example "2 hours ago". */
        __( '%1$s · edited %2$s', 'wordpress-for-designers' ),
        sprintf(
            /* translators: %d: number of artboards. */
            _n(
                '%d artboard',
                '%d artboards',
                count,
                'wordpress-for-designers'
            ),
            count
        ),
        relativeTime( board.modified_gmt )
    );
}

const FIELDS = [
    {
        id: 'title',
        label: __( 'Name', 'wordpress-for-designers' ),
        getValue: ( { item } ) => item.title?.raw ?? '',
        enableGlobalSearch: true,
        enableHiding: false,
    },
    {
        id: 'placeholder',
        label: __( 'Board', 'wordpress-for-designers' ),
        render: () => <div className="wfd-boards__placeholder" />,
        enableSorting: false,
        enableHiding: false,
    },
    {
        id: 'summary',
        label: __( 'Details', 'wordpress-for-designers' ),
        getValue: ( { item } ) => boardSummary( item ),
        enableSorting: false,
        enableHiding: false,
    },
    {
        id: 'modified',
        label: __( 'Edited', 'wordpress-for-designers' ),
        getValue: ( { item } ) => item.modified_gmt,
        enableHiding: false,
    },
];

function BoardLink( { item, children, ...props } ) {
    return (
        <a href={ addQueryArgs( boardUrl, { board: item.id } ) } { ...props }>
            { children }
        </a>
    );
}

function useAddBoard() {
    const { saveEntityRecord } = useDispatch( coreStore );
    const [ isAdding, setIsAdding ] = useState( false );
    const addBoard = async () => {
        if ( isAdding ) {
            return;
        }
        setIsAdding( true );
        try {
            const board = await saveEntityRecord(
                'postType',
                'wfd_board',
                {
                    title: __( 'Untitled board', 'wordpress-for-designers' ),
                    status: 'publish',
                    layout: { version: 1, artboards: [] },
                },
                { throwOnError: true }
            );
            window.location.assign(
                addQueryArgs( boardUrl, { board: board.id } )
            );
        } catch {
            setIsAdding( false );
        }
    };
    return { addBoard, isAdding };
}

function RenameDialog( { board, onClose } ) {
    const { saveEntityRecord } = useDispatch( coreStore );
    const [ name, setName ] = useState( board.title?.raw ?? '' );
    const [ isSaving, setIsSaving ] = useState( false );
    const save = async ( event ) => {
        event.preventDefault();
        setIsSaving( true );
        try {
            await saveEntityRecord(
                'postType',
                'wfd_board',
                { id: board.id, title: name },
                { throwOnError: true }
            );
            onClose();
        } catch {
            setIsSaving( false );
        }
    };
    return (
        <Dialog.Root open onOpenChange={ ( open ) => ! open && onClose() }>
            <Dialog.Popup size="small">
                <form onSubmit={ save }>
                    <Dialog.Header>
                        <Dialog.Title>
                            { __( 'Rename', 'wordpress-for-designers' ) }
                        </Dialog.Title>
                    </Dialog.Header>
                    <Dialog.Content>
                        <InputControl
                            label={ __( 'Name', 'wordpress-for-designers' ) }
                            value={ name }
                            onChange={ ( event ) =>
                                setName( event.target.value )
                            }
                        />
                    </Dialog.Content>
                    <Dialog.Footer>
                        <Button
                            variant="outline"
                            onClick={ onClose }
                            disabled={ isSaving }
                        >
                            { __( 'Cancel', 'wordpress-for-designers' ) }
                        </Button>
                        <Button type="submit" disabled={ isSaving }>
                            { __( 'Save', 'wordpress-for-designers' ) }
                        </Button>
                    </Dialog.Footer>
                </form>
            </Dialog.Popup>
        </Dialog.Root>
    );
}

function Boards() {
    useEnableWpCompatOverlaySlot();
    const [ view, setView ] = useState( DEFAULT_VIEW );
    const { records, hasResolved } = useEntityRecords(
        'postType',
        'wfd_board',
        QUERY
    );
    const { deleteEntityRecord } = useDispatch( coreStore );
    const { addBoard, isAdding } = useAddBoard();
    const [ renaming, setRenaming ] = useState( null );

    const createdOnLoad = useRef( false );
    useEffect( () => {
        if ( createOnLoad && ! createdOnLoad.current ) {
            createdOnLoad.current = true;
            addBoard();
        }
    } );

    const boards = useMemo( () => records ?? [], [ records ] );
    const { data, paginationInfo } = useMemo(
        () => filterSortAndPaginate( boards, view, FIELDS ),
        [ boards, view ]
    );
    const actions = useMemo(
        () => [
            {
                id: 'rename',
                label: __( 'Rename', 'wordpress-for-designers' ),
                supportsBulk: false,
                callback: ( items ) => setRenaming( items[ 0 ] ),
            },
            {
                id: 'trash',
                label: __( 'Move to trash', 'wordpress-for-designers' ),
                supportsBulk: false,
                callback: ( items ) =>
                    Promise.all(
                        items.map( ( item ) =>
                            deleteEntityRecord(
                                'postType',
                                'wfd_board',
                                item.id
                            )
                        )
                    ),
            },
        ],
        [ deleteEntityRecord ]
    );

    const addButton = (
        <Button variant="outline" onClick={ addBoard } disabled={ isAdding }>
            { __( 'Add board', 'wordpress-for-designers' ) }
        </Button>
    );

    const isEmpty = hasResolved && boards.length === 0;

    return (
        <Page
            className="wfd-boards"
            title={ __( 'Boards', 'wordpress-for-designers' ) }
            actions={ isEmpty ? undefined : addButton }
        >
            { isEmpty ? (
                <EmptyState.Root className="wfd-boards__empty">
                    <EmptyState.Title>
                        { __( 'No boards yet', 'wordpress-for-designers' ) }
                    </EmptyState.Title>
                    <EmptyState.Description>
                        { __(
                            "A board is a canvas where you lay out this site's pages, templates, parts and patterns side by side.",
                            'wordpress-for-designers'
                        ) }
                    </EmptyState.Description>
                    <EmptyState.Actions>
                        <Button onClick={ addBoard } disabled={ isAdding }>
                            { __( 'Add board', 'wordpress-for-designers' ) }
                        </Button>
                    </EmptyState.Actions>
                </EmptyState.Root>
            ) : (
                <DataViews
                    data={ data }
                    fields={ FIELDS }
                    view={ view }
                    onChangeView={ setView }
                    actions={ actions }
                    paginationInfo={ paginationInfo }
                    defaultLayouts={ DEFAULT_LAYOUTS }
                    getItemId={ ( item ) => String( item.id ) }
                    isLoading={ ! hasResolved }
                    searchLabel={ __(
                        'Search boards',
                        'wordpress-for-designers'
                    ) }
                    isItemClickable={ () => true }
                    renderItemLink={ BoardLink }
                />
            ) }
            { renaming && (
                <RenameDialog
                    board={ renaming }
                    onClose={ () => setRenaming( null ) }
                />
            ) }
        </Page>
    );
}

const root = document.getElementById( 'wfd-boards-root' );
if ( root ) {
    createRoot( root ).render(
        <ThemeProvider>
            <Boards />
        </ThemeProvider>
    );
}
