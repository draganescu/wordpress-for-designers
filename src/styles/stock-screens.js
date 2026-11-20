/**
 * What the plugin knows about WordPress's stock styles screens, the
 * `GlobalStylesUI` of `@wordpress/global-styles-ui`: where they are rendered
 * and what shows when one throws, their paths, and three things the package has but does not export (its
 * element list, what makes a variation a whole one, and when the Background
 * screen is offered). When WordPress exports one of these, or changes a
 * path, this is the only file to change.
 */
import { __, sprintf } from '@wordpress/i18n';
import { ErrorBoundary } from '@wordpress/editor';
import {
    areGlobalStylesEqual,
    getSetting,
} from '@wordpress/global-styles-engine';
import { GlobalStylesUI } from '@wordpress/global-styles-ui';
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

/**
 * A stock styles screen and the screens under it. The stock package uses
 * private functions of the block editor WordPress ships; if a screen throws,
 * WordPress's own error notice takes its place and nothing else is lost
 * (decision D60). The key drops the notice when another screen is opened.
 *
 * @param {Object}   props
 * @param {string}   props.path           The screen's path.
 * @param {Function} props.onLeave        Called when the stock navigation leaves the screen and the ones under it, as its own Back control does.
 * @param {Object}   props.value          The user's global styles.
 * @param {Object}   props.baseValue      The theme's global styles.
 * @param {Function} props.onChange       Called with the user's styles as changed.
 * @param {Object}   props.serverSettings Block editor settings from the server.
 */
export function StockScreen( {
    path,
    onLeave,
    value,
    baseValue,
    onChange,
    serverSettings,
} ) {
    return (
        <ErrorBoundary key={ path }>
            <GlobalStylesUI
                value={ value }
                baseValue={ baseValue }
                onChange={ onChange }
                path={ path }
                onPathChange={
                    onLeave &&
                    ( ( next ) => {
                        if (
                            next !== path &&
                            ! next.startsWith( path + '/' )
                        ) {
                            onLeave();
                        }
                    } )
                }
                serverCSS={ serverSettings.styles }
                serverSettings={ serverSettings }
            />
        </ErrorBoundary>
    );
}

/**
 * The path of a block's stock screen.
 *
 * @param {string} name The block's name.
 * @return {string} The path.
 */
export function blockPath( name ) {
    return '/blocks/' + encodeURIComponent( name );
}

/**
 * The paths of the stock screens for site-wide styles (decision D52).
 * `background` is left out when the theme allows no site background, which
 * is when the stock styles menu leaves it out (`useHasBackgroundPanel` of
 * the block editor, not exported).
 *
 * @param {Object} merged Merged global styles.
 * @return {Object} Paths by screen.
 */
export function siteScreens( merged ) {
    const screens = {
        colors: '/colors',
        typography: '/typography',
        layout: '/layout',
        shadows: '/shadows',
    };
    if (
        getSetting( merged, 'background.backgroundImage' ) ||
        getSetting( merged, 'background.backgroundSize' )
    ) {
        screens.background = '/background';
    }
    return screens;
}

/**
 * The elements WordPress styles for the whole site (decision D53), in the
 * groups and order of the stock "Blocks & Elements" list and with the titles
 * of their stock screens, so a row and the screen it opens read the same.
 *
 * Mirrors `ELEMENT_GROUPS` in `src/screen-block-list.tsx` and `ELEMENTS` in
 * `src/screen-element.tsx` of `@wordpress/global-styles-ui` 2.0.0, the
 * release `package.json` pins: change the two together. The icons are those
 * of `ELEMENT_ICONS` in release 2.2.0's list; the pinned release's list
 * shows none.
 *
 * @return {Array} Groups as { title, elements: [ { name, path, title, icon } ] }.
 */
export function elementGroups() {
    const item = ( name, title, icon ) => ( {
        name,
        path: '/blocks/elements/' + name,
        title,
        icon,
    } );
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
                    __( 'Input', 'wordpress-for-designers' ),
                    formInput
                ),
                item(
                    'select',
                    __( 'Select', 'wordpress-for-designers' ),
                    formSelect
                ),
                item(
                    'button',
                    __( 'Button (element)', 'wordpress-for-designers' ),
                    button
                ),
            ],
        },
    ];
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
 * which the stock screens list as a palette or a typeset and not as a style
 * variation. Mirrors `isVariationWithProperties` in `src/utils.ts` of
 * `@wordpress/global-styles-ui`, as `src/style-variations-container.tsx`
 * uses it.
 *
 * @param {Object} variation A variation from the theme.
 * @return {boolean} True for a colour-only or type-only preset.
 */
export function isPartialVariation( variation ) {
    return [ [ 'color' ], [ 'typography', 'spacing' ] ].some( ( keys ) =>
        areGlobalStylesEqual( onlyUnder( variation, keys ), variation )
    );
}
