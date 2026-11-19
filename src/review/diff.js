/**
 * Which blocks changed between the saved and the edited content of an item,
 * as the lines of the Review drawer. The wording of what changed is one of
 * three fixed words (spec/open-questions.md, OQ-16).
 */
import { __, sprintf } from '@wordpress/i18n';
import { getBlockType } from '@wordpress/blocks';

const MAX_LINES = 5;

const WORDS = {
    added: __( 'added', 'wordpress-for-designers' ),
    removed: __( 'removed', 'wordpress-for-designers' ),
    changed: __( 'changed', 'wordpress-for-designers' ),
};

function own( block ) {
    return block.name + JSON.stringify( block.attributes ?? {} );
}

function signature( block ) {
    return (
        own( block ) +
        '[' +
        ( block.innerBlocks ?? [] ).map( signature ).join( ',' ) +
        ']'
    );
}

/**
 * @param {Array} before Blocks as saved.
 * @param {Array} after  Blocks as edited.
 * @param {Array} out    Receives [ blockName, word ] pairs.
 */
function compare( before, after, out ) {
    const left = before.map( signature );
    const right = after.map( signature );
    // Longest common subsequence: blocks that did not change.
    const table = Array.from( { length: left.length + 1 }, () =>
        new Array( right.length + 1 ).fill( 0 )
    );
    for ( let i = left.length - 1; i >= 0; i-- ) {
        for ( let j = right.length - 1; j >= 0; j-- ) {
            table[ i ][ j ] =
                left[ i ] === right[ j ]
                    ? table[ i + 1 ][ j + 1 ] + 1
                    : Math.max( table[ i + 1 ][ j ], table[ i ][ j + 1 ] );
        }
    }
    const removed = [];
    const added = [];
    let i = 0;
    let j = 0;
    while ( i < left.length || j < right.length ) {
        if ( i < left.length && j < right.length && left[ i ] === right[ j ] ) {
            i++;
            j++;
        } else if (
            j < right.length &&
            ( i === left.length || table[ i ][ j + 1 ] >= table[ i + 1 ][ j ] )
        ) {
            added.push( after[ j++ ] );
        } else {
            removed.push( before[ i++ ] );
        }
    }
    // A removed and an added block of the same type are one changed block.
    for ( const block of added ) {
        const index = removed.findIndex( ( item ) => item.name === block.name );
        if ( index === -1 ) {
            out.push( [ block.name, 'added' ] );
            continue;
        }
        const [ previous ] = removed.splice( index, 1 );
        if ( own( previous ) === own( block ) ) {
            // The block itself is the same; the change is inside it.
            compare( previous.innerBlocks ?? [], block.innerBlocks ?? [], out );
        } else {
            out.push( [ block.name, 'changed' ] );
        }
    }
    for ( const block of removed ) {
        out.push( [ block.name, 'removed' ] );
    }
}

/**
 * @param {Array} before Blocks as saved.
 * @param {Array} after  Blocks as edited.
 * @return {Object} `lines` (at most five) and `moreCount`.
 */
export function changeLines( before, after ) {
    const changes = [];
    compare( before ?? [], after ?? [], changes );
    const lines = changes.map( ( [ name, word ] ) =>
        sprintf(
            /* translators: 1: block title, for example "Paragraph". 2: what changed, for example "added". */
            __( '%1$s: %2$s', 'wordpress-for-designers' ),
            getBlockType( name )?.title ?? name,
            WORDS[ word ]
        )
    );
    return {
        lines: lines.slice( 0, MAX_LINES ),
        moreCount: Math.max( 0, lines.length - MAX_LINES ),
    };
}
