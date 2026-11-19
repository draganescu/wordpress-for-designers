/**
 * The board needs room (D48). Below the smallest supported width the board
 * is replaced by a message and nothing of it can be used; with room again it
 * comes back as it was.
 */
import {
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { chevronLeft, chevronRight } from '@wordpress/icons';
import { EmptyState, Icon } from '@wordpress/ui';
import { MIN_BOARD_WIDTH } from './constants';

const QUERY = `(min-width: ${ MIN_BOARD_WIDTH }px)`;
const KEY_EVENTS = [ 'keydown', 'keypress', 'keyup' ];

function useHasRoom() {
    const [ hasRoom, setHasRoom ] = useState(
        () => window.matchMedia( QUERY ).matches
    );
    useEffect( () => {
        const list = window.matchMedia( QUERY );
        const update = () => setHasRoom( list.matches );
        update();
        list.addEventListener( 'change', update );
        return () => list.removeEventListener( 'change', update );
    }, [] );
    return hasRoom;
}

/**
 * A window squeezing three artboards, then given room. Decoration only.
 */
function Squeeze() {
    return (
        <div className="wfd-squeeze" aria-hidden="true">
            <Icon
                icon={ chevronLeft }
                size={ 32 }
                className="wfd-squeeze__arrow"
            />
            <div className="wfd-squeeze__window">
                <span className="wfd-squeeze__artboard" />
                <span className="wfd-squeeze__artboard" />
                <span className="wfd-squeeze__artboard" />
            </div>
            <Icon
                icon={ chevronRight }
                size={ 32 }
                className="wfd-squeeze__arrow"
            />
        </div>
    );
}

/**
 * The message. It is shown as a modal dialog element so that the browser
 * itself makes everything else on the page inert, the overlays that the
 * components portal into the body included.
 */
export function NeedsSpace() {
    const ref = useRef();
    useLayoutEffect( () => {
        const dialog = ref.current;
        // Only room takes the message away. Esc is refused, and if the
        // browser closes the dialog anyway it is shown again.
        const refuse = ( event ) => event.preventDefault();
        const reopen = () => {
            if ( dialog.isConnected && ! dialog.open ) {
                dialog.showModal();
            }
        };
        dialog.showModal();
        dialog.addEventListener( 'cancel', refuse );
        dialog.addEventListener( 'close', reopen );
        return () => {
            dialog.removeEventListener( 'cancel', refuse );
            dialog.removeEventListener( 'close', reopen );
            dialog.close();
        };
    }, [] );
    useEffect( () => {
        // The board listens for keys on the document. They stop here; the
        // browser's own shortcuts are left alone, except Esc, which would
        // close the dialog.
        const stop = ( event ) => {
            event.stopPropagation();
            if ( event.key === 'Escape' ) {
                event.preventDefault();
            }
        };
        KEY_EVENTS.forEach( ( type ) =>
            window.addEventListener( type, stop, true )
        );
        return () =>
            KEY_EVENTS.forEach( ( type ) =>
                window.removeEventListener( type, stop, true )
            );
    }, [] );
    return (
        <dialog
            ref={ ref }
            className="wfd-needs-space"
            aria-labelledby="wfd-needs-space-title"
            aria-describedby="wfd-needs-space-text"
            data-wfd-region="needs-space"
        >
            <EmptyState.Root>
                <EmptyState.Visual>
                    <Squeeze />
                </EmptyState.Visual>
                <EmptyState.Title id="wfd-needs-space-title">
                    { __(
                        'Designing needs more space',
                        'wordpress-for-designers'
                    ) }
                </EmptyState.Title>
                <EmptyState.Description id="wfd-needs-space-text">
                    { __(
                        'A board needs a wide window to lay out your designs. Make this one wider, turn your tablet sideways or move to a bigger screen, and your board will be right here.',
                        'wordpress-for-designers'
                    ) }
                </EmptyState.Description>
            </EmptyState.Root>
        </dialog>
    );
}

/**
 * Shows the board only while the window has room for it. A board that was
 * already open stays mounted behind the message, so nothing unsaved is lost
 * when a window is made narrow for a moment; a board opened without room is
 * not started until there is room.
 *
 * @param {Object}  props
 * @param {Element} props.children The board.
 */
export function SpaceGate( { children } ) {
    const hasRoom = useHasRoom();
    const [ hasStarted, setHasStarted ] = useState( hasRoom );
    if ( hasRoom && ! hasStarted ) {
        setHasStarted( true );
    }
    return (
        <>
            { hasStarted && children }
            { ! hasRoom && <NeedsSpace /> }
        </>
    );
}
