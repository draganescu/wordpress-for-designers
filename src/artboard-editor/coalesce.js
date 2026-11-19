/**
 * Keeps typing in one undo step.
 *
 * The block editor decides whether a change continues the previous one (the
 * same attribute of the same block) with a record of the last block action
 * that is shared by every block editor on the page. On the board, Previews
 * that show the edited entity update between two keystrokes and overwrite
 * that record, so the Live editor reports every keystroke as a change of its
 * own. This makes the same decision from the Live editor's own blocks.
 */

/**
 * The block attributes that differ between two block lists.
 *
 * @param {Array} before Blocks before the change.
 * @param {Array} after  Blocks after the change.
 * @return {Array|null} Entries as "clientId:attribute", or null when the
 *                      structure changed.
 */
function changedAttributes( before, after ) {
    if ( before === after ) {
        return [];
    }
    if (
        ! Array.isArray( before ) ||
        ! Array.isArray( after ) ||
        before.length !== after.length
    ) {
        return null;
    }
    const changed = [];
    for ( let index = 0; index < after.length; index++ ) {
        const a = before[ index ];
        const b = after[ index ];
        if ( a === b ) {
            continue;
        }
        if ( a.clientId !== b.clientId || a.name !== b.name ) {
            return null;
        }
        if ( a.attributes !== b.attributes ) {
            const keys = new Set( [
                ...Object.keys( a.attributes ),
                ...Object.keys( b.attributes ),
            ] );
            for ( const key of keys ) {
                if ( a.attributes[ key ] !== b.attributes[ key ] ) {
                    changed.push( `${ b.clientId }:${ key }` );
                }
            }
        }
        const inner = changedAttributes( a.innerBlocks, b.innerBlocks );
        if ( inner === null ) {
            return null;
        }
        changed.push( ...inner );
    }
    return changed;
}

/**
 * Wraps the entity's change handlers.
 *
 * @param {Function} onInput  Receives changes that continue the last one.
 * @param {Function} onChange Receives changes that start an undo step.
 * @return {Object} `onInput` and `onChange` for BlockEditorProvider, and
 *                  `sync` to call with the blocks the editor shows.
 */
export function coalesceTyping( onInput, onChange ) {
    let lastBlocks = null;
    let lastSignature = null;

    const signatureOf = ( blocks ) => {
        const changed = changedAttributes( lastBlocks, blocks );
        return changed && changed.length === 1 ? changed[ 0 ] : null;
    };

    return {
        sync( blocks ) {
            if ( blocks !== lastBlocks ) {
                lastBlocks = blocks;
                lastSignature = null;
            }
        },
        onInput( blocks, options ) {
            lastSignature = signatureOf( blocks );
            lastBlocks = blocks;
            return onInput( blocks, options );
        },
        onChange( blocks, options ) {
            if ( blocks === lastBlocks ) {
                // An explicit undo level with no change of its own.
                lastSignature = null;
                return onChange( blocks, options );
            }
            const signature = signatureOf( blocks );
            const continues = signature !== null && signature === lastSignature;
            lastSignature = signature;
            lastBlocks = blocks;
            return continues
                ? onInput( blocks, options )
                : onChange( blocks, options );
        },
    };
}
