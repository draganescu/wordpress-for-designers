/**
 * The site's global styles on the board: one merge and one generate per
 * change, shared by every mounted artboard (constraint C14).
 *
 * Inputs: the theme's base styles, the user's `globalStyles` record as edited
 * and, only while a History revision is previewed, that revision in place of
 * the user record.
 */
import { useCallback, useEffect, useMemo, useState } from '@wordpress/element';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import { getBlockTypes } from '@wordpress/blocks';
import {
    generateGlobalStyles,
    getSetting,
    mergeGlobalStyles,
} from '@wordpress/global-styles-engine';
import {
    getCurrentGlobalStylesId,
    getCurrentThemeBaseGlobalStyles,
} from '../adapter/experimental';
import { counters } from '../shell/test-hooks';

const EMPTY = { settings: {}, styles: {} };
// How long the styles have to stay unchanged before frozen copies are
// renewed from them (decision D51): a dragged control changes them on every
// animation frame.
const SETTLE = 300;

/**
 * @param {Object} serverSettings Block editor settings from the server.
 * @return {Object} Styles state and actions.
 */
export function useGlobalStyles( serverSettings ) {
    const { id, base, record, hasEdits } = useSelect( ( select ) => {
        const core = select( coreStore );
        const stylesId = getCurrentGlobalStylesId( select );
        return {
            id: stylesId,
            base: getCurrentThemeBaseGlobalStyles( select ),
            record: stylesId
                ? core.getEditedEntityRecord( 'root', 'globalStyles', stylesId )
                : null,
            hasEdits: stylesId
                ? core.hasEditsForEntityRecord(
                      'root',
                      'globalStyles',
                      stylesId
                  )
                : false,
        };
    }, [] );
    const { editEntityRecord } = useDispatch( coreStore );
    const [ preview, setPreview ] = useState( null );

    const recordSettings = record?.settings;
    const recordStyles = record?.styles;
    const user = useMemo(
        () => ( {
            settings: recordSettings ?? {},
            styles: recordStyles ?? {},
        } ),
        [ recordSettings, recordStyles ]
    );
    const applied = preview?.config ?? user;
    const isReady = !! base && !! record;

    const merged = useMemo(
        () => ( isReady ? mergeGlobalStyles( base, applied ) : null ),
        [ isReady, base, applied ]
    );

    // One generation per change, at most one per animation frame while a
    // control is dragged. Each stylesheet handed out has a number; the
    // server's is 1. The number goes up only when the generated CSS differs
    // from the last: a save, or an edit that writes equal values, gives new
    // objects and the same CSS, and repaints nothing.
    const [ output, setOutput ] = useState( null );
    useEffect( () => {
        if ( ! merged ) {
            return;
        }
        const frame = window.requestAnimationFrame( () => {
            const blockGap = getSetting( merged, 'spacing.blockGap' );
            const hasBlockGapSupport =
                blockGap !== null && blockGap !== undefined;
            counters.styleGenerations++;
            const [ styles ] = generateGlobalStyles( merged, getBlockTypes(), {
                hasBlockGapSupport,
                hasFallbackGapSupport: ! hasBlockGapSupport,
                disableLayoutStyles: !! serverSettings.disableLayoutStyles,
            } );
            const css = JSON.stringify( styles );
            setOutput( ( last ) =>
                last?.css === css
                    ? last
                    : { styles, css, version: ( last?.version ?? 1 ) + 1 }
            );
        } );
        return () => window.cancelAnimationFrame( frame );
    }, [ merged, serverSettings ] );

    // The one settings object given to every preview and editor.
    const editorSettings = useMemo( () => {
        if ( ! output ) {
            return serverSettings;
        }
        return {
            ...serverSettings,
            styles: [
                ...( serverSettings.styles ?? [] ).filter(
                    ( style ) => ! style.isGlobalStyles
                ),
                ...output.styles,
            ],
        };
    }, [ serverSettings, output ] );

    // `settledVersion` is the number of the stylesheet that has stayed
    // unchanged for a moment.
    const version = output?.version ?? 1;
    const [ settledVersion, setSettledVersion ] = useState( version );
    useEffect( () => {
        const timer = setTimeout( () => setSettledVersion( version ), SETTLE );
        return () => clearTimeout( timer );
    }, [ version ] );

    const update = useCallback(
        ( next ) => {
            if ( ! id ) {
                return;
            }
            editEntityRecord( 'root', 'globalStyles', id, {
                settings: next.settings ?? {},
                styles: next.styles ?? {},
            } );
        },
        [ id, editEntityRecord ]
    );

    return {
        id,
        isReady,
        base: base ?? EMPTY,
        user,
        merged: merged ?? EMPTY,
        hasEdits,
        editorSettings,
        version,
        settledVersion,
        update,
        preview,
        setPreview,
    };
}
