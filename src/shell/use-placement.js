/**
 * Creating artboards: arm a kind from a New row of the inserter, then click
 * the board to place it (decisions D11 and D63, spec/data-model.md "Creating
 * entities").
 */
import { __ } from '@wordpress/i18n';
import { useCallback, useEffect, useMemo, useState } from '@wordpress/element';
import { useDispatch, useRegistry, useSelect } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import { store as boardStore } from '../board-store';

/**
 * Height of an artboard before its content has been measured.
 */
export const NEW_ARTBOARD_HEIGHT = 900;

const TEMPLATE_QUERY = { per_page: -1 };

/**
 * Template purposes offered as new, with the slug each creates.
 */
const PURPOSES = [
    { slug: 'archive', label: __( 'Archive', 'wordpress-for-designers' ) },
    {
        slug: 'search',
        label: __( 'Search results', 'wordpress-for-designers' ),
    },
    { slug: '404', label: __( 'Page: 404', 'wordpress-for-designers' ) },
    {
        slug: 'singular',
        label: __( 'Single item', 'wordpress-for-designers' ),
    },
    { slug: null, label: __( 'Custom', 'wordpress-for-designers' ) },
];

/**
 * Templates a new page starts on, first one the theme has: blank, then the
 * page template without a title.
 */
const NEW_PAGE_TEMPLATES = [ 'blank', 'page-no-title' ];
const EMPTY_PARAGRAPH =
    '<!-- wp:paragraph -->\n<p></p>\n<!-- /wp:paragraph -->';

const NAMES = {
    page: __( 'Untitled page', 'wordpress-for-designers' ),
    pattern: __( 'Untitled pattern', 'wordpress-for-designers' ),
    template: __( 'Untitled template', 'wordpress-for-designers' ),
    'template-part': __( 'Untitled part', 'wordpress-for-designers' ),
    // A browser is named by its address, and starts on the homepage (D55).
    browser: '/',
};

const NEW_GROUP = __( 'New', 'wordpress-for-designers' );

/**
 * The rows of the inserter that create an artboard (L12, D63), in the order
 * they are listed: the inserter tab and the group each is in, its name, and
 * the `choice` that `arm` takes.
 */
export const NEW_ROWS = [
    {
        key: 'page',
        tab: 'pages',
        group: NEW_GROUP,
        name: __( 'New page', 'wordpress-for-designers' ),
        choice: { kind: 'page' },
    },
    {
        key: 'browser',
        tab: 'pages',
        group: NEW_GROUP,
        name: __( 'New browser', 'wordpress-for-designers' ),
        choice: { kind: 'browser' },
    },
    {
        key: 'pattern',
        tab: 'patterns',
        group: NEW_GROUP,
        name: __( 'New pattern', 'wordpress-for-designers' ),
        choice: { kind: 'pattern' },
    },
    ...PURPOSES.map( ( purpose ) => ( {
        key: 'template:' + ( purpose.slug ?? 'custom' ),
        tab: 'templates',
        group: __( 'New template for', 'wordpress-for-designers' ),
        name: purpose.label,
        choice: { kind: 'template', purpose },
    } ) ),
    {
        key: 'template-part',
        tab: 'templates',
        group: NEW_GROUP,
        name: __( 'New template part', 'wordpress-for-designers' ),
        choice: { kind: 'template-part' },
    },
];

function partBlock( part, tagName ) {
    return `<!-- wp:template-part ${ JSON.stringify( {
        slug: part.slug,
        theme: part.theme,
        tagName,
    } ) } /-->`;
}

/**
 * A new template: the theme's Header part, one empty paragraph, the theme's
 * Footer part. Without those parts, the paragraph alone.
 *
 * @param {Array} parts Template part records.
 * @return {string} Block markup.
 */
export function newTemplateContent( parts ) {
    const find = ( area ) =>
        parts.find( ( part ) => part.area === area && part.slug === area ) ||
        parts.find( ( part ) => part.area === area );
    const header = find( 'header' );
    const footer = find( 'footer' );
    return [
        header && partBlock( header, 'header' ),
        EMPTY_PARAGRAPH,
        footer && partBlock( footer, 'footer' ),
    ]
        .filter( Boolean )
        .join( '\n\n' );
}

function uniqueSlug( slug, taken ) {
    let candidate = slug;
    let n = 2;
    while ( taken.has( candidate ) ) {
        candidate = `${ slug }-${ n++ }`;
    }
    return candidate;
}

/**
 * @param {Object}   options
 * @param {string}   options.theme     The active theme's stylesheet.
 * @param {Function} options.enterEdit Enters edit on an artboard.
 * @return {Object} The New rows on offer, the armed placement and its
 *                  actions.
 */
export function usePlacement( { theme, enterEdit } ) {
    const registry = useRegistry();
    const [ placement, setPlacement ] = useState( null );
    const { templates, onBoard } = useSelect( ( select ) => {
        return {
            templates:
                select( coreStore ).getEntityRecords(
                    'postType',
                    'wp_template',
                    TEMPLATE_QUERY
                ) ?? null,
            onBoard: select( boardStore ).getArtboards(),
        };
    }, [] );
    const { saveEntityRecord, editEntityRecord } = useDispatch( coreStore );
    const { addArtboard, selectArtboard } = useDispatch( boardStore );

    // A purpose whose template is on the site, or on this board and not
    // saved yet, is not offered as new.
    const newRows = useMemo( () => {
        const taken = new Set( [
            ...( templates ?? [] ).map( ( template ) => template.slug ),
            ...onBoard
                .filter( ( a ) => a.kind === 'template' && a.draft )
                .map( ( a ) => a.draft.slug ),
        ] );
        return NEW_ROWS.filter(
            ( { choice } ) =>
                ! choice.purpose || ! taken.has( choice.purpose.slug )
        );
    }, [ templates, onBoard ] );

    const arm = useCallback( ( choice ) => {
        let name = NAMES[ choice.kind ];
        if ( choice.kind === 'template' && choice.purpose.slug ) {
            name = choice.purpose.label;
        }
        setPlacement( { ...choice, name } );
    }, [] );

    const cancel = useCallback( () => setPlacement( null ), [] );

    useEffect( () => {
        if ( ! placement ) {
            return;
        }
        const onKeyDown = ( event ) => {
            if ( event.key === 'Escape' ) {
                event.preventDefault();
                event.stopPropagation();
                setPlacement( null );
            }
        };
        document.addEventListener( 'keydown', onKeyDown, true );
        return () => document.removeEventListener( 'keydown', onKeyDown, true );
    }, [ placement ] );

    /**
     * Places the armed artboard with its top-left corner at a board point.
     *
     * @param {Object} point The point in board units.
     */
    const place = useCallback(
        async ( point ) => {
            if ( ! placement ) {
                return;
            }
            const chosen = placement;
            setPlacement( null );
            if ( chosen.kind === 'browser' ) {
                // Selected, not browsing (D55).
                const browser = {
                    id: window.crypto.randomUUID(),
                    kind: 'browser',
                    path: '/',
                    device: 'desktop',
                    x: Math.round( point.x ),
                    y: Math.round( point.y ),
                    height: NEW_ARTBOARD_HEIGHT,
                    shows: 'unsaved',
                };
                addArtboard( browser );
                selectArtboard( browser.id );
                return;
            }
            const artboard = {
                id: window.crypto.randomUUID(),
                kind: chosen.kind,
                device: 'desktop',
                x: Math.round( point.x ),
                y: Math.round( point.y ),
                height: NEW_ARTBOARD_HEIGHT,
            };
            const coreSelect = registry.select( coreStore );
            const taken = ( postType ) =>
                new Set( [
                    ...(
                        coreSelect.getEntityRecords(
                            'postType',
                            postType,
                            TEMPLATE_QUERY
                        ) ?? []
                    ).map( ( record ) => record.slug ),
                    ...registry
                        .select( boardStore )
                        .getArtboards()
                        .filter( ( a ) => a.draft )
                        .map( ( a ) => a.draft.slug ),
                ] );

            if ( chosen.kind === 'page' || chosen.kind === 'pattern' ) {
                const fields = {
                    title: chosen.name,
                    status: 'draft',
                    content: '',
                };
                if ( chosen.kind === 'page' ) {
                    // A new page starts on the theme's blank template, or
                    // its title-less page template, when it has one.
                    const all =
                        ( await registry
                            .resolveSelect( coreStore )
                            .getEntityRecords(
                                'postType',
                                'wp_template',
                                TEMPLATE_QUERY
                            ) ) ?? [];
                    const start = NEW_PAGE_TEMPLATES.find( ( slug ) =>
                        all.some(
                            ( template ) =>
                                template.slug === slug && template.is_custom
                        )
                    );
                    if ( start ) {
                        fields.template = start;
                    }
                }
                const record = await saveEntityRecord(
                    'postType',
                    chosen.kind === 'page' ? 'page' : 'wp_block',
                    fields,
                    { throwOnError: true }
                );
                artboard.entityId = record.id;
            } else {
                // A new template or part exists only in this session until
                // its first save from Review.
                const isTemplate = chosen.kind === 'template';
                const postType = isTemplate
                    ? 'wp_template'
                    : 'wp_template_part';
                let slug;
                if ( ! isTemplate ) {
                    slug = uniqueSlug( 'untitled-part', taken( postType ) );
                } else if ( chosen.purpose.slug ) {
                    slug = chosen.purpose.slug;
                } else {
                    slug = uniqueSlug(
                        'wp-custom-template-untitled-template',
                        taken( postType )
                    );
                }
                const parts =
                    ( await registry
                        .resolveSelect( coreStore )
                        .getEntityRecords(
                            'postType',
                            'wp_template_part',
                            TEMPLATE_QUERY
                        ) ) ?? [];
                const edits = {
                    slug,
                    title: chosen.name,
                    status: 'publish',
                    content: isTemplate ? newTemplateContent( parts ) : '',
                };
                if ( ! isTemplate ) {
                    edits.area = 'uncategorized';
                }
                artboard.entityId = `${ theme }//${ slug }`;
                artboard.draft = {
                    slug,
                    title: chosen.name,
                    postType,
                    purpose: chosen.purpose?.slug ?? null,
                };
                // Nothing is saved under this id yet, so there is nothing to
                // fetch: mark the record as resolved before anything asks.
                const args = [ 'postType', postType, artboard.entityId ];
                const core = registry.dispatch( coreStore );
                for ( const selector of [
                    'getEntityRecord',
                    'getEditedEntityRecord',
                ] ) {
                    core.startResolution( selector, args );
                    core.finishResolution( selector, args );
                }
                editEntityRecord(
                    'postType',
                    postType,
                    artboard.entityId,
                    edits,
                    { undoIgnore: true }
                );
            }
            addArtboard( artboard );
            enterEdit( artboard.id );
        },
        [
            placement,
            registry,
            theme,
            saveEntityRecord,
            editEntityRecord,
            addArtboard,
            selectArtboard,
            enterEdit,
        ]
    );

    return { newRows, placement, arm, cancel, place };
}
