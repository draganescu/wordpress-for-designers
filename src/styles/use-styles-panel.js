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
import { useGlobalStylesRevisions } from '@wordpress/global-styles-ui';
import { getCurrentThemeGlobalStylesVariations } from '../adapter/experimental';
import {
    StockScreen,
    blockPath,
    elementGroups,
    isPartialVariation,
    siteScreens,
} from './stock-screens';

const STYLE_SUPPORTS = [
    'color',
    'typography',
    'spacing',
    'dimensions',
    'shadow',
    'border',
];
const NONE = [];

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
    // The stock screens open in the Blocks and Tokens tabs, as their paths.
    const [ openBlock, setOpenBlock ] = useState( null );
    const [ openScreen, setOpenScreen ] = useState( null );
    const allVariations = useSelect(
        ( select ) => getCurrentThemeGlobalStylesVariations( select ) ?? NONE,
        []
    );
    // The theme's whole-site variations, each a combination of colours and
    // type. Left out, as in the stock styles screens: block style
    // variations, and the colour-only and type-only presets (the stock
    // Colors and Typography screens list those as palettes and typesets).
    // A title is listed once. Each is given the settings and the styles it
    // leaves out, empty, as the user's styles have them: the menu tells
    // which one the styles are by comparing the two (D54).
    const variations = useMemo( () => {
        const seen = new Set();
        return allVariations
            .filter( ( variation ) => {
                if (
                    variation.blockTypes ||
                    isPartialVariation( variation ) ||
                    seen.has( variation.title )
                ) {
                    return false;
                }
                seen.add( variation.title );
                return true;
            } )
            .map( ( variation ) => ( {
                ...variation,
                settings: variation.settings ?? {},
                styles: variation.styles ?? {},
            } ) );
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

    // The rows of the Blocks tab in their groups, the elements' first (D53).
    // A row is known by the path of its stock screen.
    const blockGroups = useMemo( () => {
        const needle = blockQuery.trim().toLowerCase();
        const matches = ( ...texts ) =>
            ! needle || texts.join( ' ' ).toLowerCase().includes( needle );
        const groups = elementGroups().map( ( group ) => ( {
            title: group.title,
            // An element is found by title, name or group title.
            rows: group.elements
                .filter( ( element ) =>
                    matches( element.title, element.name, group.title )
                )
                .map( ( { name, path, title, icon } ) => ( {
                    path,
                    title,
                    icon,
                    changes: countLeaves( user.styles?.elements?.[ name ] ),
                } ) ),
        } ) );
        groups.push( {
            title: __( 'Blocks', 'wordpress-for-designers' ),
            rows: getBlockTypes()
                .filter(
                    ( type ) =>
                        type.supports &&
                        Object.keys( type.supports ).some( ( key ) =>
                            STYLE_SUPPORTS.some( ( support ) =>
                                key.toLowerCase().endsWith( support )
                            )
                        ) &&
                        matches( type.title )
                )
                .map( ( type ) => ( {
                    path: blockPath( type.name ),
                    title: type.title,
                    icon: type.icon,
                    changes: countLeaves( user.styles?.blocks?.[ type.name ] ),
                } ) ),
        } );
        return groups.filter( ( group ) => group.rows.length );
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

    // What the menu says the styles are (D54): exactly a variation, the
    // theme's own (no user styles at all) or, failing both, custom.
    const { activeVariation, isCustom } = useMemo( () => {
        const title =
            variations.find( ( variation ) =>
                areGlobalStylesEqual( user, variation )
            )?.title ?? null;
        return {
            activeVariation: title,
            isCustom: ! title && countLeaves( user ) > 0,
        };
    }, [ user, variations ] );

    // A stock screen has its own Back control: `onLeave` is called when it
    // goes back past the screen.
    const stockScreen = ( path, onLeave ) => (
        <StockScreen
            path={ path }
            onLeave={ onLeave }
            value={ user }
            baseValue={ base }
            onChange={ update }
            serverSettings={ serverSettings }
        />
    );
    const blockStylesFor = ( name, onLeave ) =>
        stockScreen( blockPath( name ), onLeave );

    return {
        blockStylesFor,
        panelProps: {
            variations,
            activeVariation,
            isCustom,
            onPickVariation: ( title ) => {
                if ( title === null ) {
                    // "Default": the theme's own styles.
                    update( { settings: {}, styles: {} } );
                    return;
                }
                const variation = variations.find(
                    ( item ) => item.title === title
                );
                if ( variation ) {
                    update( variation );
                }
            },
            tab,
            onTabChange: setTab,
            colors,
            typography,
            spacing,
            screens: siteScreens( merged ),
            openScreen,
            onOpenScreen: setOpenScreen,
            renderScreen: ( path ) =>
                stockScreen( path, () => setOpenScreen( null ) ),
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
            blockGroups,
            openBlock,
            onOpenBlock: setOpenBlock,
            renderBlockStyles: ( path ) =>
                stockScreen( path, () => setOpenBlock( null ) ),
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
