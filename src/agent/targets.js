/**
 * Targets: what can be pointed at right now, each with its reference and its
 * rectangle in the window (spec/agent/surface.md, Targets). Reading targets
 * changes nothing on the board and mounts nothing.
 */
import { subscribe as subscribeToStores } from '@wordpress/data';
import { getBlockType } from '@wordpress/blocks';
import { frameOf } from '../artboard-frame/rects';
import { actions } from './board';
import { documentBlocks, plainText } from './blocks';
import { artboardRef, blockRef, noteRef, tokenRef } from './refs';

const CANVAS = '[data-wfd-region="canvas"]';
const PANEL = '[data-wfd-region="right"]';

const rectOf = ( box ) => ( {
    x: box.left,
    y: box.top,
    width: box.right - box.left,
    height: box.bottom - box.top,
} );

/**
 * The part of a box that is inside another, or null when none of it is.
 *
 * @param {Object} box    `left`, `top`, `right`, `bottom`.
 * @param {Object} inside The box to stay inside.
 * @return {Object|null} The clipped box.
 */
function clip( box, inside ) {
    const clipped = {
        left: Math.max( box.left, inside.left ),
        top: Math.max( box.top, inside.top ),
        right: Math.min( box.right, inside.right ),
        bottom: Math.min( box.bottom, inside.bottom ),
    };
    return clipped.right > clipped.left && clipped.bottom > clipped.top
        ? clipped
        : null;
}

/**
 * The targets of the blocks an artboard draws.
 *
 * @param {Object} artboard The artboard with its name.
 * @param {Object} area     The canvas area's box.
 * @param {string} where    What the artboard's blocks say they are on.
 * @return {Array} Targets.
 */
function blockTargets( artboard, area, where ) {
    const { frame, iframe, document: doc } = frameOf( artboard.id );
    if ( ! frame || ! doc ) {
        return [];
    }
    // A block's rectangle is clipped to its artboard's frame.
    const frameBox = frame.getBoundingClientRect();
    // The document is drawn scaled inside its iframe's box.
    const outer = iframe.getBoundingClientRect();
    const scale = iframe.offsetWidth ? outer.width / iframe.offsetWidth : 1;
    const found = [];
    for ( const { path, name, element } of documentBlocks( doc ) ) {
        const inner = element.getBoundingClientRect();
        const box = clip(
            {
                left: outer.left + inner.left * scale,
                top: outer.top + inner.top * scale,
                right: outer.left + inner.right * scale,
                bottom: outer.top + inner.bottom * scale,
            },
            frameBox
        );
        // Listed when some of what is left is inside the canvas area.
        if ( box && clip( box, area ) ) {
            found.push( {
                ref: blockRef( artboard.id, path ),
                kind: 'block',
                rect: rectOf( box ),
                label: getBlockType( name )?.title ?? name,
                where,
                text: plainText( element.textContent ),
            } );
        }
    }
    return found;
}

/**
 * @return {Array} One target for each thing that can be pointed at and is at
 *                 least partly inside the canvas area or the Styles panel.
 */
export function targets() {
    const area = document.querySelector( CANVAS )?.getBoundingClientRect();
    if ( ! area ) {
        return [];
    }
    const seam = actions();
    // Before the board has drawn there is nothing to point at.
    if ( ! seam ) {
        return [];
    }
    const board = seam.board();
    const artboards = [];
    const blocks = [];
    for ( const artboard of board.artboards ) {
        const { frame } = frameOf( artboard.id );
        const box = frame?.getBoundingClientRect();
        if ( ! box || ! clip( box, area ) ) {
            continue;
        }
        artboards.push( {
            ref: artboardRef( artboard.id ),
            kind: 'artboard',
            rect: rectOf( box ),
            label: artboard.name,
            where: seam.whereOf( artboard ),
            text: '',
        } );
        // Media objects and browsers draw no blocks.
        if ( artboard.kind !== 'media' && artboard.kind !== 'browser' ) {
            blocks.push(
                ...blockTargets(
                    artboard,
                    area,
                    seam.whereOfBlocks( artboard )
                )
            );
        }
    }
    const notes = [];
    for ( const note of board.notes ) {
        const element = document.querySelector(
            `[data-wfd-note="${ note.id }"]`
        );
        const box = element?.getBoundingClientRect();
        if ( box && clip( box, area ) ) {
            notes.push( {
                ref: noteRef( note.id ),
                kind: 'note',
                rect: rectOf( box ),
                label: seam.noteLabel,
                where: '',
                text: note.text.split( '\n' )[ 0 ],
            } );
        }
    }
    // The rows of the Tokens tab, while that tab is shown.
    const tokens = [];
    const rows = document.querySelectorAll( '[data-wfd-token]' );
    const panel = document.querySelector( PANEL )?.getBoundingClientRect();
    if ( rows.length ) {
        const styles = seam.styles();
        const lists = {
            color: styles.colors,
            'font-size': styles.fontSizes,
            'font-family': styles.fontFamilies,
        };
        for ( const row of rows ) {
            const [ kind, ...rest ] = row
                .getAttribute( 'data-wfd-token' )
                .split( ':' );
            const slug = rest.join( ':' );
            const token = lists[ kind ]?.find( ( item ) => item.slug === slug );
            const box = row.getBoundingClientRect();
            // Listed when some of the row is inside the Styles panel.
            if ( token && panel && clip( box, panel ) ) {
                tokens.push( {
                    ref: tokenRef( kind, slug ),
                    kind: 'token',
                    rect: rectOf( box ),
                    label: token.name,
                    where: seam.stylesLabel,
                    text: token.value,
                } );
            }
        }
    }
    return [ ...artboards, ...blocks, ...notes, ...tokens ];
}

const listeners = new Set();
let stop = null;

/**
 * Watches for what may change the targets, and calls the listeners at most
 * once per animation frame.
 *
 * @return {Function} Stops watching.
 */
function watch() {
    let frame = null;
    let later = null;
    const notify = () => {
        frame ??= window.requestAnimationFrame( () => {
            frame = null;
            listeners.forEach( ( listener ) => listener() );
        } );
    };
    // A store change is drawn a moment later, inside the artboards.
    const afterStores = () => {
        notify();
        window.clearTimeout( later );
        later = window.setTimeout( notify, 300 );
    };
    const observer = new window.MutationObserver( notify );
    observer.observe( document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
    } );
    const unsubscribe = subscribeToStores( afterStores );
    window.addEventListener( 'resize', notify );
    window.addEventListener( 'scroll', notify, true );
    return () => {
        observer.disconnect();
        unsubscribe();
        window.removeEventListener( 'resize', notify );
        window.removeEventListener( 'scroll', notify, true );
        window.cancelAnimationFrame( frame );
        window.clearTimeout( later );
    };
}

/**
 * @param {Function} listener Called when the result of `targets()` may have
 *                            changed.
 * @return {Function} Unsubscribes.
 */
export function subscribe( listener ) {
    listeners.add( listener );
    stop ??= watch();
    return () => {
        listeners.delete( listener );
        if ( ! listeners.size ) {
            stop?.();
            stop = null;
        }
    };
}
