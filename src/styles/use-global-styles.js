/**
 * The site's global styles on the board: one merge and one generate per
 * change, shared by every mounted artboard (constraint C14).
 *
 * Inputs: the theme's base styles, the user's `globalStyles` record as edited
 * and, only while a History revision is previewed, that revision in place of
 * the user record.
 */
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from '@wordpress/element';
import { useDispatch, useRegistry, useSelect } from '@wordpress/data';
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
// How long a wait for a compile may last, in ms: the one safety limit of
// spec/agent/tools.md, Settling.
const COMPILE_LIMIT = 10000;

/**
 * A copy of a tree of styles or of settings without the keys whose value
 * is undefined. A stock control that is reset leaves such a key. Merged
 * with the theme's, the key would take the theme's value away, and the
 * styles engine throws on one in the styles when it compiles.
 *
 * @param {*} value A tree of styles or of settings, or a value in one.
 * @return {*} The same, with those keys left out.
 */
function withoutUndefined( value ) {
    if ( Array.isArray( value ) ) {
        return value.map( withoutUndefined );
    }
    if ( value === null || typeof value !== 'object' ) {
        return value;
    }
    return Object.fromEntries(
        Object.entries( value )
            .filter( ( [ , item ] ) => item !== undefined )
            .map( ( [ key, item ] ) => [ key, withoutUndefined( item ) ] )
    );
}

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
    const registry = useRegistry();
    const [ preview, setPreview ] = useState( null );

    const recordSettings = record?.settings;
    const recordStyles = record?.styles;
    const user = useMemo(
        () => ( {
            settings: withoutUndefined( recordSettings ?? {} ),
            styles: withoutUndefined( recordStyles ?? {} ),
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
    // For whoever waits on a change (spec/agent/tools.md, Settling): the
    // user record each stylesheet was compiled from, and the one whose
    // stylesheet the mounted artboards have been given.
    const raw = useRef();
    raw.current = { settings: recordSettings, styles: recordStyles };
    const report = useRef( {
        css: null,
        compiledFrom: null,
        handedFrom: null,
        waiters: new Set(),
    } ).current;
    const tellWaiters = useCallback(
        () => [ ...report.waiters ].forEach( ( waiter ) => waiter() ),
        [ report ]
    );
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
                // The styles the theme and the user give a block's style
                // variations are in the one stylesheet too. WordPress's
                // editor makes them for each block as it is drawn, from
                // styles the plugin's editors are not given.
                styleOptions: { variationStyles: true },
            } );
            const css = JSON.stringify( styles );
            report.compiledFrom = raw.current;
            if ( css === report.css ) {
                // The same stylesheet: there is nothing new to hand over.
                report.handedFrom = raw.current;
                tellWaiters();
            }
            report.css = css;
            setOutput( ( last ) =>
                last?.css === css
                    ? last
                    : { styles, css, version: ( last?.version ?? 1 ) + 1 }
            );
        } );
        return () => window.cancelAnimationFrame( frame );
    }, [ merged, serverSettings ] );

    // A new stylesheet has been rendered into every mounted artboard by the
    // time this runs: children are committed before their parent's effects.
    useEffect( () => {
        if ( output ) {
            report.handedFrom = report.compiledFrom;
            tellWaiters();
        }
    }, [ output, report, tellWaiters ] );
    // While a History revision is previewed a change to the user's styles
    // compiles nothing.
    useEffect( () => {
        if ( preview ) {
            report.handedFrom = raw.current;
            tellWaiters();
        }
    }, [ preview, recordSettings, recordStyles, report, tellWaiters ] );

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

    // The user's styles as the store holds them now, which a render that
    // has not happened yet does not show.
    const readRecord = () =>
        id
            ? registry
                  .select( coreStore )
                  .getEditedEntityRecord( 'root', 'globalStyles', id )
            : null;

    // The same without the keys that have no value, as `user` is.
    const readUser = () => ( {
        settings: withoutUndefined( readRecord()?.settings ?? {} ),
        styles: withoutUndefined( readRecord()?.styles ?? {} ),
    } );

    return {
        id,
        isReady,
        readUser,
        // The theme's and the user's styles together, as the store holds
        // them now.
        readMerged: () => mergeGlobalStyles( base ?? EMPTY, readUser() ),
        // Resolves once the stylesheet compiled from the styles the store
        // holds now has been given to the mounted artboards; rejects when
        // that takes longer than the safety limit.
        whenCompiled: () =>
            new Promise( ( resolve, reject ) => {
                const isDone = () =>
                    !! report.handedFrom &&
                    report.handedFrom.settings === readRecord()?.settings &&
                    report.handedFrom.styles === readRecord()?.styles;
                let timer = null;
                const check = () => {
                    if ( isDone() ) {
                        window.clearTimeout( timer );
                        report.waiters.delete( check );
                        resolve();
                    }
                };
                timer = window.setTimeout( () => {
                    report.waiters.delete( check );
                    reject( new Error( 'The styles did not compile.' ) );
                }, COMPILE_LIMIT );
                report.waiters.add( check );
                check();
            } ),
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
