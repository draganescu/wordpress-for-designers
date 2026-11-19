/**
 * Notes on the board (D46): the note itself, its settings in the right panel
 * and the helpers the canvas uses for it.
 */
import { __ } from '@wordpress/i18n';
import {
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
} from '@wordpress/element';
import { useResizeObserver } from '@wordpress/compose';
import { ColorPalette } from '@wordpress/components';
import { Button, Stack, Text } from '@wordpress/ui';
import { WeakText } from './primitives';

/**
 * Width of every note, in board units.
 */
export const NOTE_WIDTH = 240;

/**
 * Height used for a note until it has been measured.
 */
const NOTE_MIN_HEIGHT = 48;

export const NOTE_COLORS = [
    { id: 'yellow', name: __( 'Yellow', 'wordpress-for-designers' ) },
    { id: 'green', name: __( 'Green', 'wordpress-for-designers' ) },
    { id: 'blue', name: __( 'Blue', 'wordpress-for-designers' ) },
    { id: 'pink', name: __( 'Pink', 'wordpress-for-designers' ) },
];

/**
 * The rectangle of a note in board units.
 *
 * @param {Object} note The note.
 * @return {Object} The rectangle.
 */
export function noteRect( note ) {
    return {
        x: note.x,
        y: note.y,
        width: NOTE_WIDTH,
        height: note.height || NOTE_MIN_HEIGHT,
    };
}

/**
 * How a note is named in the left panel: its first line.
 *
 * @param {Object} note The note.
 * @return {string} The name.
 */
export function noteName( note ) {
    const first = note.text
        .split( '\n' )
        .map( ( line ) => line.trim() )
        .find( Boolean );
    return first || __( 'Empty note', 'wordpress-for-designers' );
}

/**
 * The colour each note colour is drawn in, read from the design system's
 * surfaces through probe elements.
 *
 * @return {Object} Colour values by note colour.
 */
function useNoteColorValues() {
    return useMemo( () => {
        const values = {};
        NOTE_COLORS.forEach( ( { id } ) => {
            const probe = document.createElement( 'span' );
            probe.className = `wfd-note-probe is-${ id }`;
            document.body.appendChild( probe );
            values[ id ] = window.getComputedStyle( probe ).backgroundColor;
            probe.remove();
        } );
        return values;
    }, [] );
}

/**
 * One note on the board.
 *
 * @param {Object}   props
 * @param {Object}   props.note       The note.
 * @param {boolean}  props.isSelected Whether it is selected.
 * @param {boolean}  props.isEditing  Whether its text is being edited.
 * @param {Function} props.onText     Called with the text as it is typed.
 * @param {Function} props.onEndEdit  Ends editing; called with true when the
 *                                    board should take focus.
 * @param {Function} props.onHeight   Called with the measured height.
 */
export function Note( {
    note,
    isSelected,
    isEditing,
    onText,
    onEndEdit,
    onHeight,
} ) {
    const [ resizeListener, size ] = useResizeObserver();
    const field = useRef();
    const reportHeight = useRef( onHeight );
    reportHeight.current = onHeight;
    useEffect( () => {
        if ( size.height ) {
            reportHeight.current( size.height );
        }
    }, [ size.height ] );
    useEffect( () => {
        if ( isEditing ) {
            const element = field.current;
            element?.focus( { preventScroll: true } );
            element?.setSelectionRange(
                element.value.length,
                element.value.length
            );
        }
    }, [ isEditing ] );
    // The field grows with its text.
    useLayoutEffect( () => {
        const element = field.current;
        if ( element ) {
            element.style.height = 'auto';
            element.style.height = element.scrollHeight + 'px';
        }
    }, [ isEditing, note.text ] );
    const classes = [ 'wfd-note', `is-${ note.color }` ];
    if ( isSelected ) {
        classes.push( 'is-selected' );
    }
    return (
        <div
            className={ classes.join( ' ' ) }
            style={ { left: note.x, top: note.y, width: NOTE_WIDTH } }
            data-wfd-note={ note.id }
            data-wfd-color={ note.color }
        >
            { resizeListener }
            { isEditing ? (
                <textarea
                    ref={ field }
                    className="wfd-note__field"
                    value={ note.text }
                    rows={ 1 }
                    placeholder={ __(
                        'Write a note',
                        'wordpress-for-designers'
                    ) }
                    aria-label={ __( 'Note', 'wordpress-for-designers' ) }
                    onChange={ ( event ) => onText( event.target.value ) }
                    onKeyDown={ ( event ) => {
                        if ( event.key === 'Escape' ) {
                            event.preventDefault();
                            event.stopPropagation();
                            onEndEdit( true );
                        }
                    } }
                    onBlur={ () => {
                        // Not when the window itself loses focus.
                        if ( field.current?.ownerDocument.hasFocus() ) {
                            onEndEdit( false );
                        }
                    } }
                />
            ) : (
                <Text variant="body-md" className="wfd-note__text">
                    { note.text }
                </Text>
            ) }
        </div>
    );
}

/**
 * The right panel with one note selected.
 *
 * @param {Object}   props
 * @param {Object}   props.note          The note.
 * @param {Function} props.onColorChange Called with the colour id.
 * @param {Function} props.onRemove      Takes the note off the board.
 */
export function NoteSettings( { note, onColorChange, onRemove } ) {
    const values = useNoteColorValues();
    const colors = NOTE_COLORS.map( ( { id, name } ) => ( {
        name,
        color: values[ id ],
    } ) );
    return (
        <div className="wfd-artboard-settings" data-wfd-panel="note">
            <Text variant="heading-md" render={ <h2 /> }>
                { __( 'Note', 'wordpress-for-designers' ) }
            </Text>
            <Stack direction="column" gap="sm" className="wfd-note-colors">
                <Text variant="heading-sm" render={ <h3 /> }>
                    { __( 'Color', 'wordpress-for-designers' ) }
                </Text>
                <ColorPalette
                    colors={ colors }
                    value={ values[ note.color ] }
                    disableCustomColors
                    clearable={ false }
                    onChange={ ( value ) => {
                        const picked = NOTE_COLORS.find(
                            ( { id } ) => values[ id ] === value
                        );
                        if ( picked ) {
                            onColorChange( picked.id );
                        }
                    } }
                />
            </Stack>
            <Stack
                className="wfd-artboard-settings__actions"
                direction="row"
                gap="md"
            >
                <Button variant="outline" tone="brand" onClick={ onRemove }>
                    { __( 'Remove from board', 'wordpress-for-designers' ) }
                </Button>
            </Stack>
            <WeakText className="wfd-artboard-settings__hint">
                { __(
                    'Enter or double-click edits. Delete removes it from the board.',
                    'wordpress-for-designers'
                ) }
            </WeakText>
        </div>
    );
}
