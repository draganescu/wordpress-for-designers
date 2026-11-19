/**
 * A view of the data registry that cannot write to core-data.
 *
 * Previews and warm editors render the same blocks as the Live editor,
 * including Template Part and synced Pattern blocks that keep their inner
 * blocks in step with the entity. Left alone, each of them answers an edit
 * made in the Live editor with an edit of its own, which splits the undo
 * history into one step per keystroke. Only the Live editor may write.
 */
import { useMemo, useRef } from '@wordpress/element';
import { RegistryProvider, useRegistry } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import { counters } from './test-hooks';

const NOTHING = new Proxy(
    {},
    {
        get: ( target, action ) => () => {
            counters.droppedWrites[ action ] =
                ( counters.droppedWrites[ action ] || 0 ) + 1;
            return Promise.resolve();
        },
    }
);

/**
 * @param {Object}  props
 * @param {boolean} props.isReadOnly Whether writes to core-data are dropped.
 * @param {Element} props.children   The preview or editor.
 */
export function GuardedRegistry( { isReadOnly, children } ) {
    const registry = useRegistry();
    const readOnly = useRef( isReadOnly );
    readOnly.current = isReadOnly;
    const guarded = useMemo( () => {
        const view = Object.create( registry );
        view.dispatch = ( store ) => {
            const name = typeof store === 'string' ? store : store?.name;
            return readOnly.current && name === coreStore.name
                ? NOTHING
                : registry.dispatch( store );
        };
        return view;
    }, [ registry ] );
    return <RegistryProvider value={ guarded }>{ children }</RegistryProvider>;
}
