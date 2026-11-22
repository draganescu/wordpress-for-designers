/**
 * The board actions the tools use that are the surface's own logic: what the
 * Tokens tab shows, reading the site again, opening and creating artboards
 * as the inserter does, a pattern's blocks, and waiting for the styles part
 * and the inserter's lists. They reach the shell's hooks only through the
 * seams of `src/shell/seams.js`, which `src/shell/app.js` fills after each
 * render. A seam is read again after each await, since the board may have
 * drawn in between.
 */
import { store as coreStore } from '@wordpress/core-data';
import { actionsSeam } from '../shell/seams';
import { store as boardStore } from '../board-store';
import { KINDS } from '../shell/constants';
import { rowsOnOffer } from '../shell/use-placement';
import { MEDIA_QUERY, USER_PATTERNS } from '../inserter/use-inserter-data';

/**
 * @return {Object} The seam onto the shell's hooks, as the last render left
 *                  it.
 */
const seam = () => actionsSeam.current;

/**
 * The styles part says when a change is compiled and in the artboards.
 *
 * @return {Promise<string>} 'done', or 'not-ready' when the compile did not
 *                           finish in time (D82).
 */
const whenCompiled = () =>
    seam()
        .whenStylesCompiled()
        .then(
            () => 'done',
            () => 'not-ready'
        );

/**
 * The inserter's lists are drawn from the stores a moment later.
 *
 * @param {Function} isListed Whether the item is listed yet.
 * @return {Promise<void>} Resolves once it is, or after two seconds.
 */
async function whenListed( isListed ) {
    for ( let tries = 0; tries < 40 && ! isListed(); tries++ ) {
        await new Promise( ( resolve ) => setTimeout( resolve, 50 ) );
    }
}

/**
 * The rows of the Tokens tab and what the variation menu shows.
 *
 * @return {Object} The variation, the variations, and the rows.
 */
function styles() {
    const panel = seam().stylesPanel().panelProps;
    const ofType = ( type ) =>
        panel.typography.filter( ( row ) => row.tokenType === type );
    let variation = 'Default';
    if ( panel.activeVariation ) {
        variation = panel.activeVariation;
    } else if ( panel.isCustom ) {
        variation = 'Custom';
    }
    return {
        variation,
        variations: panel.variations.map( ( item ) => item.title ),
        colors: panel.colors.map( ( row ) => ( {
            slug: row.slug,
            name: row.name,
            value: row.color,
            uses: row.uses,
        } ) ),
        fontSizes: ofType( 'font-size' ).map( ( row ) => ( {
            slug: row.slug,
            name: row.name,
            value: row.size,
            uses: row.uses,
        } ) ),
        fontFamilies: ofType( 'font-family' ).map( ( row ) => ( {
            slug: row.slug.replace( /^family:/, '' ),
            name: row.name,
            value: row.fontFamilyCss,
            uses: row.uses,
        } ) ),
        spacing: panel.spacing.map( ( row ) => ( {
            slug: row.slug,
            name: row.name,
            value: row.size,
        } ) ),
    };
}

/**
 * The picker of a colour row (S4).
 *
 * @param {string} slug  The colour.
 * @param {string} value Its new value.
 * @return {Promise<string>|string} 'done', 'unknown' for a colour that is
 *                                  not there, or 'not-ready' (D82).
 */
function setColor( slug, value ) {
    if ( ! seam().stylesPanel().panelProps.onChangeColor( slug, value ) ) {
        return 'unknown';
    }
    return whenCompiled();
}

/**
 * A stock styles screen (S8, D52, D53).
 *
 * @param {string}      kind     What the value is.
 * @param {string}      property The style's path.
 * @param {*}           value    The value.
 * @param {string|null} block    The block type, for a block's style.
 * @return {Promise<string>} 'done' or 'not-ready' (D82).
 */
function setStyleValue( kind, property, value, block ) {
    seam().stylesPanel().setValue( kind, property, value, block );
    return whenCompiled();
}

/**
 * The variation menu (S2, D54).
 *
 * @param {string} name A variation's title, or 'Default'.
 * @return {Promise<string>|string} 'done', 'unknown' for a variation that
 *                                  is not there, or 'not-ready' (D82).
 */
function pickVariation( name ) {
    const panel = seam().stylesPanel().panelProps;
    if (
        name !== 'Default' &&
        ! panel.variations.some( ( item ) => item.title === name )
    ) {
        return 'unknown';
    }
    panel.onPickVariation( name === 'Default' ? null : name );
    return whenCompiled();
}

/**
 * The blocks a pattern's inserter row inserts in edit (D39): by the name of
 * a registered pattern, or the id of a pattern of the site.
 *
 * @param {string} pattern The pattern's name or id.
 * @return {Promise<Array|null>} The blocks; null when the inserter lists no
 *                               such pattern.
 */
async function patternBlocks( pattern ) {
    const id = /^\d+$/.test( pattern )
        ? `user:${ pattern }`
        : `theme:${ pattern }`;
    const core = seam().registry.resolveSelect( coreStore );
    await Promise.all( [
        core.getBlockPatterns().catch( () => null ),
        core
            .getEntityRecords( 'postType', 'wp_block', USER_PATTERNS )
            .catch( () => null ),
    ] );
    await whenListed( () => seam().inserterData().lookup.patterns.has( id ) );
    if ( ! seam().inserterData().lookup.patterns.has( id ) ) {
        return null;
    }
    return seam().inserter().blocksFor( { type: 'pattern', id } );
}

/**
 * Reads every saved record again; unsaved changes stay on top.
 */
async function refresh() {
    const { registry } = seam();
    const core = registry.dispatch( coreStore );
    const onBoard = () => registry.select( boardStore ).getArtboards();
    const argsOf = ( artboard ) => [
        'postType',
        KINDS[ artboard.kind ].postType,
        artboard.entityId,
    ];
    registry.batch( () => {
        core.invalidateResolutionForStore();
        // A new template or part has nothing saved to read.
        for ( const artboard of onBoard().filter( ( a ) => a.draft ) ) {
            for ( const selector of [
                'getEntityRecord',
                'getEditedEntityRecord',
            ] ) {
                core.startResolution( selector, argsOf( artboard ) );
                core.finishResolution( selector, argsOf( artboard ) );
            }
        }
    } );
    const saved = onBoard().filter(
        ( a ) => KINDS[ a.kind ].postType && ! a.draft
    );
    await Promise.all(
        saved.map( ( artboard ) =>
            registry
                .resolveSelect( coreStore )
                .getEntityRecord( ...argsOf( artboard ) )
                .catch( () => null )
        )
    );
    // An artboard whose entity no longer exists leaves the board.
    const gone = saved.filter( ( artboard ) => {
        const error = registry
            .select( coreStore )
            .getResolutionError( 'getEntityRecord', argsOf( artboard ) );
        return ( error?.data?.status ?? error?.status ) === 404;
    } );
    const board = registry.dispatch( boardStore );
    if ( gone.length ) {
        board.removeArtboards( gone.map( ( artboard ) => artboard.id ) );
    }
    board.bumpSiteVersion();
}

/**
 * A click on an inserter row with no artboard in edit (D39).
 *
 * @param {string}        kind     The row's kind.
 * @param {number|string} entityId What it shows.
 * @return {Promise<string|null>} The new artboard's id, or null when the
 *                                item is not on the site.
 */
async function openExisting( kind, entityId ) {
    const core = seam().registry.resolveSelect( coreStore );
    const record = await core
        .getEntityRecord( 'postType', KINDS[ kind ].postType, entityId )
        .catch( () => null );
    if ( ! record || record.status === 'trash' ) {
        return null;
    }
    let id = entityId;
    if ( kind === 'pattern' ) {
        id = `user:${ entityId }`;
        await core
            .getEntityRecords( 'postType', 'wp_block', USER_PATTERNS )
            .catch( () => null );
        await whenListed( () =>
            seam().inserterData().lookup.patterns.has( id )
        );
    } else if ( kind === 'media' ) {
        await core
            .getEntityRecords( 'postType', 'attachment', MEDIA_QUERY )
            .catch( () => null );
        await whenListed( () => seam().inserterData().lookup.images.has( id ) );
    }
    return seam().inserter().openInSpace( { type: kind, id } );
}

/**
 * A New row of the inserter and the click that places it (D63).
 *
 * @param {string}      kind    The row's kind.
 * @param {string}      purpose A template's purpose.
 * @param {Object|null} point   Where to place it; by default, a free place
 *                              in view.
 * @return {Promise<string|null>} The new artboard's id, or null when the
 *                                row is not offered.
 */
async function createNew( kind, purpose, point ) {
    const { registry } = seam();
    const templates =
        ( await registry
            .resolveSelect( coreStore )
            .getEntityRecords( 'postType', 'wp_template', {
                per_page: -1,
            } )
            .catch( () => null ) ) ?? [];
    const row = rowsOnOffer(
        templates,
        registry.select( boardStore ).getArtboards()
    ).find(
        ( { choice } ) =>
            choice.kind === kind &&
            ( kind !== 'template' ||
                ( choice.purpose.slug ?? 'custom' ) === purpose )
    );
    if ( ! row ) {
        return null;
    }
    return seam().place( row.choice, point );
}

export const surfaceActions = {
    styles,
    setColor,
    setStyleValue,
    pickVariation,
    patternBlocks,
    refresh,
    openExisting,
    createNew,
};
