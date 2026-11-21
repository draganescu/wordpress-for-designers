/**
 * What the plugin knows about WordPress's stock styles screens, the
 * `GlobalStylesUI` of `@wordpress/global-styles-ui`: where they are rendered
 * and what shows when one throws, their paths, and two things the package
 * has but does not export (what makes a variation a whole one, and when the
 * Background screen is offered). When WordPress exports
 * one of these, or changes a path, this is the only file to change.
 */
import { useEffect } from '@wordpress/element';
import { ErrorBoundary } from '@wordpress/editor';
import {
    areGlobalStylesEqual,
    getSetting,
} from '@wordpress/global-styles-engine';
import { GlobalStylesUI } from '@wordpress/global-styles-ui';

/**
 * Keeps a ref true while it is mounted. Drawn inside the error boundary next
 * to a stock screen, it is taken out with the screen when the screen throws,
 * and never put in when the screen throws at once.
 *
 * @param {Object} props
 * @param {Object} props.flag The ref.
 */
function Standing( { flag } ) {
    useEffect( () => {
        flag.current = true;
        return () => {
            flag.current = false;
        };
    }, [ flag ] );
    return null;
}

/**
 * A stock styles screen and the screens under it. The stock package uses
 * private functions of the block editor WordPress ships; if a screen throws,
 * WordPress's own error notice takes its place and nothing else is lost
 * (decision D60). The key drops the notice when another screen is opened.
 *
 * @param {Object}   props
 * @param {string}   props.path           The screen's path.
 * @param {Function} props.onLeave        Called when the stock navigation leaves the screen and the ones under it, as its own Back control does.
 * @param {Object}   props.standing       A ref the screen keeps true while it is drawn and has not thrown.
 * @param {Object}   props.value          The user's global styles.
 * @param {Object}   props.baseValue      The theme's global styles.
 * @param {Function} props.onChange       Called with the user's styles as changed.
 * @param {Object}   props.serverSettings Block editor settings from the server.
 */
export function StockScreen( {
    path,
    onLeave,
    standing,
    value,
    baseValue,
    onChange,
    serverSettings,
} ) {
    return (
        <ErrorBoundary key={ path }>
            { standing && <Standing flag={ standing } /> }
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
