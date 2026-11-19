/**
 * Connects the Styles panel to the global styles: tokens, block list,
 * history and the variation menu (spec/architecture.md, Styles).
 */
import { __, sprintf } from '@wordpress/i18n';
import { useMemo, useState } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { getBlockTypes } from '@wordpress/blocks';
import {
    areGlobalStylesEqual,
    getGlobalStylesChanges,
    getSetting,
    getStyle,
    setSetting,
} from '@wordpress/global-styles-engine';
import {
    GlobalStylesUI,
    useGlobalStylesRevisions,
} from '@wordpress/global-styles-ui';
import {
    button,
    caption,
    formInput,
    formSelect,
    heading,
    headingLevel1,
    headingLevel2,
    headingLevel3,
    headingLevel4,
    headingLevel5,
    headingLevel6,
    link,
} from '@wordpress/icons';
import { getCurrentThemeGlobalStylesVariations } from '../adapter/experimental';

const STYLE_SUPPORTS = [
    'color',
    'typography',
    'spacing',
    'dimensions',
    'shadow',
    'border',
];
const NONE = [];
// An element's row in the Blocks tab is named with this before its name.
const ELEMENT = 'elements/';

/**
 * The elements WordPress styles for the whole site, in the groups, order,
 * titles and icons of its own "Blocks & Elements" list (decision D51).
 *
 * @return {Array} Groups as { title, elements: [ { name, title, icon } ] }.
 */
function elementGroups() {
    const item = ( name, title, icon ) => ( { name, title, icon } );
    return [
        {
            title: __( 'Elements', 'wordpress-for-designers' ),
            elements: [
                item( 'link', __( 'Link', 'wordpress-for-designers' ), link ),
                item(
                    'caption',
                    __( 'Caption', 'wordpress-for-designers' ),
                    caption
                ),
                item(
                    'cite',
                    __( 'Citation', 'wordpress-for-designers' ),
                    caption
                ),
            ],
        },
        {
            title: __( 'Headings', 'wordpress-for-designers' ),
            elements: [
                item(
                    'heading',
                    __( 'All headings', 'wordpress-for-designers' ),
                    heading
                ),
                ...[
                    headingLevel1,
                    headingLevel2,
                    headingLevel3,
                    headingLevel4,
                    headingLevel5,
                    headingLevel6,
                ].map( ( icon, index ) =>
                    item(
                        'h' + ( index + 1 ),
                        sprintf(
                            /* translators: %d: heading level, 1 to 6. */
                            __( 'Heading %d', 'wordpress-for-designers' ),
                            index + 1
                        ),
                        icon
                    )
                ),
            ],
        },
        {
            title: __( 'Form controls', 'wordpress-for-designers' ),
            elements: [
                item(
                    'textInput',
                    __( 'Form input', 'wordpress-for-designers' ),
                    formInput
                ),
                item(
                    'select',
                    __( 'Form select', 'wordpress-for-designers' ),
                    formSelect
                ),
                item(
                    'button',
                    __( 'Form button', 'wordpress-for-designers' ),
                    button
                ),
            ],
        },
    ];
}

function list( value ) {
    return Array.isArray( value ) ? value : NONE;
}

/**
 * Presets of one kind from the theme and from the user.
 *
 * @param {Object} merged Merged global styles.
 * @param {string} path   The settings path.
 * @return {Array} Presets as { origin, ...preset }.
 */
function presets( merged, path ) {
    const value = getSetting( merged, path ) ?? {};
    if ( Array.isArray( value ) ) {
        return value.map( ( preset ) => ( { origin: 'theme', ...preset } ) );
    }
    return [ 'theme', 'custom' ].flatMap( ( origin ) =>
        list( value[ origin ] ).map( ( preset ) => ( { origin, ...preset } ) )
    );
}

function countLeaves( value ) {
    if ( value === null || value === undefined ) {
        return 0;
    }
    if ( typeof value !== 'object' ) {
        return 1;
    }
    return Object.values( value ).reduce(
        ( total, item ) => total + countLeaves( item ),
        0
    );
}

/**
 * The part of a styles object that sits under one of the given keys, at any
 * depth.
 *
 * @param {Object} value Settings and styles.
 * @param {Array}  keys  The keys to keep.
 * @return {Object} What is under those keys, in place.
 */
function onlyUnder( value, keys ) {
    const kept = {};
    Object.keys( value ?? {} ).forEach( ( key ) => {
        if ( keys.includes( key ) ) {
            kept[ key ] = value[ key ];
        } else if ( value[ key ] && typeof value[ key ] === 'object' ) {
            const inner = onlyUnder( value[ key ], keys );
            if ( Object.keys( inner ).length ) {
                kept[ key ] = inner;
            }
        }
    } );
    return kept;
}

/**
 * Whether a theme variation is a preset of one kind only, colours or type,
 * which WordPress lists as a palette or a typeset and not as a style
 * variation.
 *
 * @param {Object} variation A variation from the theme.
 * @return {boolean} True for a colour-only or type-only preset.
 */
function isPartial( variation ) {
    const whole = {
        settings: variation.settings ?? {},
        styles: variation.styles ?? {},
    };
    const size = countLeaves( whole );
    return [ [ 'color' ], [ 'typography', 'spacing' ] ].some(
        ( keys ) => countLeaves( onlyUnder( whole, keys ) ) === size
    );
}

/**
 * The px a CSS length resolves to, measured in the page.
 *
 * @param {string} size A CSS length.
 * @return {number} Pixels, rounded.
 */
function toPx( size ) {
    const probe = document.createElement( 'div' );
    probe.style.cssText = 'position:absolute;visibility:hidden;height:0;';
    probe.style.width = size;
    document.body.appendChild( probe );
    const width = probe.getBoundingClientRect().width;
    probe.remove();
    return Math.round( width );
}

function formatDate( value ) {
    const date = new Date( value );
    const locale = document.documentElement.lang || undefined;
    return {
        date: new Intl.DateTimeFormat( locale, {
            day: 'numeric',
            month: 'short',
        } ).format( date ),
        time: new Intl.DateTimeFormat( locale, {
            hour: '2-digit',
            minute: '2-digit',
        } ).format( date ),
    };
}

/**
 * @param {Object}   options
 * @param {Object}   options.styles         What useGlobalStyles returns.
 * @param {Object}   options.serverSettings Block editor settings from the server.
 * @param {Function} options.usesOf         Gives a token's use count.
 * @return {Object} Props for StylesPanel, and `preview` for the banner.
 */
export function useStylesPanel( { styles, serverSettings, usesOf } ) {
    const { base, user, merged, update, preview, setPreview, hasEdits } =
        styles;
    const [ tab, setTab ] = useState( 'tokens' );
    const [ blockQuery, setBlockQuery ] = useState( '' );
    const [ openBlock, setOpenBlock ] = useState( null );
    // The stock styles screen open in the Tokens tab, as its path (D50).
    const [ openScreen, setOpenScreen ] = useState( null );
    const allVariations = useSelect(
        ( select ) => getCurrentThemeGlobalStylesVariations( select ) ?? NONE,
        []
    );
    // The theme's whole-site variations, each a combination of colours and
    // type. Left out, as in the stock styles screens: block style
    // variations, and the colour-only and type-only presets (the stock
    // Colors and Typography screens list those as palettes and typesets).
    // A title is listed once.
    const variations = useMemo( () => {
        const seen = new Set();
        return allVariations.filter( ( variation ) => {
            if (
                variation.blockTypes ||
                isPartial( variation ) ||
                seen.has( variation.title )
            ) {
                return false;
            }
            seen.add( variation.title );
            return true;
        } );
    }, [ allVariations ] );
    const { revisions } = useGlobalStylesRevisions();

    const colors = useMemo(
        () =>
            presets( merged, 'color.palette' ).map( ( color ) => ( {
                slug: color.slug,
                name: color.name,
                color: color.color,
                origin: color.origin,
                uses: usesOf( 'color', color.slug ),
            } ) ),
        [ merged, usesOf ]
    );

    const typography = useMemo( () => {
        const rootFamily = getStyle( merged, 'typography.fontFamily' );
        const rootSize = getStyle( merged, 'typography.fontSize' );
        const lineHeight = getStyle( merged, 'typography.lineHeight' ) ?? '';
        const families = presets( merged, 'typography.fontFamilies' );
        const familyOf = ( value ) => {
            const slug = String( value ?? '' ).match(
                /font-family[|-]+([a-z0-9-]+)/
            )?.[ 1 ];
            return families.find( ( family ) => family.slug === slug );
        };
        const body = familyOf( rootFamily );
        return [
            ...presets( merged, 'typography.fontSizes' ).map( ( size ) => ( {
                slug: size.slug,
                tokenType: 'font-size',
                name: size.name,
                family: body?.name ?? '',
                size: String( size.size ),
                lineHeight: String( lineHeight ),
                fontFamilyCss: body?.fontFamily,
                uses: usesOf( 'font-size', size.slug ),
            } ) ),
            ...families.map( ( family ) => ( {
                slug: `family:${ family.slug }`,
                tokenType: 'font-family',
                name: family.name,
                family: family.name,
                size: String( rootSize ?? '' ),
                lineHeight: String( lineHeight ),
                fontFamilyCss: family.fontFamily,
                uses: usesOf( 'font-family', family.slug ),
            } ) ),
        ];
    }, [ merged, usesOf ] );

    const spacing = useMemo(
        () =>
            presets( merged, 'spacing.spacingSizes' ).map( ( size ) => ( {
                slug: size.slug,
                px: toPx( size.size ),
            } ) ),
        [ merged ]
    );

    const blocks = useMemo( () => {
        const needle = blockQuery.trim().toLowerCase();
        // The elements first, found by title, name or group title.
        const elements = elementGroups().flatMap( ( group ) =>
            group.elements
                .filter(
                    ( element ) =>
                        ! needle ||
                        [ element.title, element.name, group.title ]
                            .join( ' ' )
                            .toLowerCase()
                            .includes( needle )
                )
                .map( ( element ) => ( {
                    name: ELEMENT + element.name,
                    title: element.title,
                    icon: element.icon,
                    group: group.title,
                    changes: countLeaves(
                        user.styles?.elements?.[ element.name ]
                    ),
                } ) )
        );
        const types = getBlockTypes()
            .filter(
                ( type ) =>
                    type.supports &&
                    Object.keys( type.supports ).some( ( key ) =>
                        STYLE_SUPPORTS.some( ( support ) =>
                            key.toLowerCase().endsWith( support )
                        )
                    )
            )
            .filter(
                ( type ) =>
                    ! needle || type.title.toLowerCase().includes( needle )
            )
            .map( ( type ) => ( {
                name: type.name,
                title: type.title,
                icon: type.icon,
                group: __( 'Blocks', 'wordpress-for-designers' ),
                changes: countLeaves( user.styles?.blocks?.[ type.name ] ),
            } ) );
        return [ ...elements, ...types ];
    }, [ blockQuery, user ] );

    const historyRows = useMemo( () => {
        const saved = list( revisions ).filter(
            ( revision ) =>
                revision.id !== 'unsaved' && revision.id !== 'parent'
        );
        const rows = saved.map( ( revision, index ) => {
            const { date, time } = formatDate( revision.modified );
            const previous = saved[ index + 1 ] ?? {};
            return {
                id: String( revision.id ),
                kind: 'revision',
                date: sprintf(
                    /* translators: 1: date. 2: time. */
                    __( '%1$s, %2$s', 'wordpress-for-designers' ),
                    date,
                    time
                ),
                author: revision.author?.name ?? '',
                changes: getGlobalStylesChanges( revision, previous, {
                    maxResults: 4,
                } ),
                config: {
                    settings: revision.settings ?? {},
                    styles: revision.styles ?? {},
                },
                banner: { date, time },
            };
        } );
        return [
            ...( hasEdits ? [ { id: 'unsaved', kind: 'unsaved' } ] : [] ),
            ...rows,
            {
                id: 'theme',
                kind: 'theme',
                config: { settings: {}, styles: {} },
            },
        ];
    }, [ revisions, hasEdits ] );

    const activeVariation =
        variations.find( ( variation ) =>
            areGlobalStylesEqual( user, variation )
        )?.title ?? null;

    const blockStylesFor = ( name ) => (
        <GlobalStylesUI
            value={ user }
            baseValue={ base }
            onChange={ update }
            path={ '/blocks/' + encodeURIComponent( name ) }
            serverCSS={ serverSettings.styles }
            serverSettings={ serverSettings }
        />
    );

    // An element's stock screen (D51). Leaving it returns to the list.
    const elementStylesFor = ( element ) => (
        <GlobalStylesUI
            value={ user }
            baseValue={ base }
            onChange={ update }
            path={ '/blocks/' + ELEMENT + element }
            onPathChange={ ( next ) => {
                if ( ! next.startsWith( '/blocks/' + ELEMENT ) ) {
                    setOpenBlock( null );
                }
            } }
            serverCSS={ serverSettings.styles }
            serverSettings={ serverSettings }
        />
    );
    // The stock screen has its own Back control; leaving the screen and the
    // ones under it returns to the tokens.
    const screenFor = ( path ) => (
        <GlobalStylesUI
            value={ user }
            baseValue={ base }
            onChange={ update }
            path={ path }
            onPathChange={ ( next ) => {
                if ( ! next.startsWith( path ) ) {
                    setOpenScreen( null );
                }
            } }
            serverCSS={ serverSettings.styles }
            serverSettings={ serverSettings }
        />
    );
    // The stock styles menu lists Background only when the theme allows a
    // background image.
    const hasBackground =
        !! getSetting( merged, 'background.backgroundImage' ) ||
        !! getSetting( merged, 'background.backgroundSize' );

    return {
        blockStylesFor,
        panelProps: {
            variations,
            activeVariation,
            onPickVariation: ( title ) => {
                const variation = variations.find(
                    ( item ) => item.title === title
                );
                if ( variation ) {
                    update( {
                        settings: variation.settings ?? {},
                        styles: variation.styles ?? {},
                    } );
                }
            },
            tab,
            onTabChange: setTab,
            colors,
            typography,
            spacing,
            hasBackground,
            openScreen,
            onOpenScreen: setOpenScreen,
            renderScreen: screenFor,
            onChangeColor: ( slug, value ) => {
                const token = colors.find( ( color ) => color.slug === slug );
                if ( ! token ) {
                    return;
                }
                const path = `color.palette.${ token.origin }`;
                const current = list( getSetting( merged, path ) );
                update(
                    setSetting(
                        user,
                        path,
                        current.map( ( color ) =>
                            color.slug === slug
                                ? { ...color, color: value }
                                : color
                        )
                    )
                );
            },
            onAddColor: () => {
                const custom = list(
                    getSetting( merged, 'color.palette.custom' )
                );
                const number = custom.length + 1;
                update(
                    setSetting( user, 'color.palette.custom', [
                        ...custom,
                        {
                            name: sprintf(
                                /* translators: %d: number of the new colour. */
                                __( 'Color %d', 'wordpress-for-designers' ),
                                number
                            ),
                            slug: `custom-color-${ number }`,
                            color: '#000000',
                        },
                    ] )
                );
                return `custom-color-${ number }`;
            },
            blockQuery,
            onBlockQueryChange: setBlockQuery,
            blocks,
            openBlock,
            onOpenBlock: setOpenBlock,
            renderBlockStyles: ( name ) =>
                name.startsWith( ELEMENT )
                    ? elementStylesFor( name.slice( ELEMENT.length ) )
                    : blockStylesFor( name ),
            historyRows,
            selectedHistoryId: preview?.id ?? null,
            onSelectHistory: ( id ) => {
                const row = historyRows.find( ( item ) => item.id === id );
                if ( ! row || row.kind === 'unsaved' ) {
                    setPreview( null );
                    return;
                }
                setPreview( {
                    id,
                    config: row.config,
                    banner: row.banner ?? null,
                    kind: row.kind,
                } );
            },
            onRestore: () => {
                if ( preview ) {
                    update( preview.config );
                    setPreview( null );
                }
            },
            onStopPreviewing: () => setPreview( null ),
        },
    };
}
