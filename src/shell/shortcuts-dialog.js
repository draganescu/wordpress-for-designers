/**
 * The keyboard shortcuts control (A5) and its dialog
 * (spec/screens/ShortcutsDialog.md, D42).
 */
import { __ } from '@wordpress/i18n';
import { useRef, useState } from '@wordpress/element';
import { isAppleOS } from '@wordpress/keycodes';
import { keyboard } from '@wordpress/icons';
import { Badge, Dialog, IconButton, Text } from '@wordpress/ui';

/**
 * Whether a key event is the shortcut that opens and closes the dialog:
 * Ctrl + Option + H on a Mac, Shift + Alt + H elsewhere.
 *
 * @param {KeyboardEvent} event The event.
 * @return {boolean} Whether it is.
 */
export function isShortcutsDialogEvent( event ) {
    if ( event.code !== 'KeyH' || ! event.altKey || event.metaKey ) {
        return false;
    }
    return isAppleOS()
        ? event.ctrlKey && ! event.shiftKey
        : event.shiftKey && ! event.ctrlKey;
}

function groups() {
    const isApple = isAppleOS();
    const mod = isApple ? '⌘' : __( 'Ctrl', 'wordpress-for-designers' );
    const shift = __( 'Shift', 'wordpress-for-designers' );
    const esc = __( 'Esc', 'wordpress-for-designers' );
    const arrows = __( 'Arrow keys', 'wordpress-for-designers' );
    return [
        {
            id: 'board',
            title: __( 'On the board', 'wordpress-for-designers' ),
            rows: [
                [
                    __( 'Pan', 'wordpress-for-designers' ),
                    [
                        __( 'Space', 'wordpress-for-designers' ),
                        __( 'drag', 'wordpress-for-designers' ),
                    ],
                ],
                [
                    __( 'Zoom', 'wordpress-for-designers' ),
                    [ mod, __( 'scroll', 'wordpress-for-designers' ) ],
                ],
                [ __( 'Zoom in', 'wordpress-for-designers' ), [ mod, '+' ] ],
                [ __( 'Zoom out', 'wordpress-for-designers' ), [ mod, '-' ] ],
                [
                    __( 'Fit all artboards', 'wordpress-for-designers' ),
                    [ shift, '1' ],
                ],
                [
                    __(
                        'Fit the selected artboards',
                        'wordpress-for-designers'
                    ),
                    [ shift, '2' ],
                ],
                [
                    __(
                        'Hide or show both side panels',
                        'wordpress-for-designers'
                    ),
                    [ mod, '\\' ],
                ],
                [
                    __( 'Select the next artboard', 'wordpress-for-designers' ),
                    [ __( 'Tab', 'wordpress-for-designers' ) ],
                ],
                [
                    __(
                        'Select the previous artboard',
                        'wordpress-for-designers'
                    ),
                    [ shift, __( 'Tab', 'wordpress-for-designers' ) ],
                ],
                [
                    __(
                        'Edit the selected artboard',
                        'wordpress-for-designers'
                    ),
                    [ __( 'Enter', 'wordpress-for-designers' ) ],
                ],
                [
                    __(
                        'Move the selected artboards',
                        'wordpress-for-designers'
                    ),
                    [ arrows ],
                ],
                [
                    __(
                        'Move the selected artboards further',
                        'wordpress-for-designers'
                    ),
                    [ shift, arrows ],
                ],
                [
                    __(
                        'Remove the selected artboards',
                        'wordpress-for-designers'
                    ),
                    [
                        isApple
                            ? __( 'Delete', 'wordpress-for-designers' )
                            : __( 'Backspace', 'wordpress-for-designers' ),
                    ],
                ],
                [ __( 'Undo', 'wordpress-for-designers' ), [ mod, 'Z' ] ],
                [
                    __( 'Redo', 'wordpress-for-designers' ),
                    [ mod, shift, 'Z' ],
                ],
                [
                    __( 'Clear the selection', 'wordpress-for-designers' ),
                    [ esc ],
                ],
                [
                    __( 'Keyboard shortcuts', 'wordpress-for-designers' ),
                    isApple
                        ? [
                              __( 'Ctrl', 'wordpress-for-designers' ),
                              __( 'Option', 'wordpress-for-designers' ),
                              'H',
                          ]
                        : [
                              shift,
                              __( 'Alt', 'wordpress-for-designers' ),
                              'H',
                          ],
                ],
            ],
        },
        {
            id: 'edit',
            title: __( 'While editing an artboard', 'wordpress-for-designers' ),
            rows: [
                [
                    __( 'Back to the board', 'wordpress-for-designers' ),
                    [ esc ],
                ],
            ],
            note: __(
                "The block editor's shortcuts work as usual.",
                'wordpress-for-designers'
            ),
        },
    ];
}

/**
 * The control floating at the bottom left of the canvas area (A5).
 *
 * @param {Object}   props
 * @param {Function} props.onClick Opens the dialog.
 */
export function ShortcutsButton( { onClick } ) {
    return (
        <div className="wfd-shortcuts-button">
            <IconButton
                icon={ keyboard }
                label={ __( 'Keyboard shortcuts', 'wordpress-for-designers' ) }
                variant="minimal"
                tone="neutral"
                size="compact"
                onClick={ onClick }
                data-wfd-control="A5"
            />
        </div>
    );
}

/**
 * What has focus, looked for inside the editor's iframe as well.
 *
 * @param {Document} doc The shell's document.
 * @return {Element} The element.
 */
function focusedElement( doc ) {
    let element = doc.activeElement;
    while (
        element?.tagName === 'IFRAME' &&
        element.contentDocument?.activeElement
    ) {
        element = element.contentDocument.activeElement;
    }
    return element;
}

/**
 * @param {Object}   props
 * @param {Document} props.ownerDocument The shell's document.
 * @param {Function} props.onClose       Closes the dialog.
 */
export function ShortcutsDialog( { ownerDocument, onClose } ) {
    // Closing puts focus back where it was, the caret of a block included.
    const [ opener ] = useState( () => focusedElement( ownerDocument ) );
    const finalFocus = useRef( opener );
    return (
        <Dialog.Root open onOpenChange={ ( open ) => ! open && onClose() }>
            <Dialog.Popup
                size="medium"
                finalFocus={ finalFocus }
                data-wfd-shortcuts-dialog=""
            >
                <Dialog.Header>
                    <Dialog.Title>
                        { __(
                            'Keyboard shortcuts',
                            'wordpress-for-designers'
                        ) }
                    </Dialog.Title>
                    <Dialog.CloseIconButton
                        label={ __( 'Close', 'wordpress-for-designers' ) }
                    />
                </Dialog.Header>
                <Dialog.Content>
                    { groups().map( ( group ) => (
                        <section
                            key={ group.id }
                            className="wfd-shortcuts__group"
                        >
                            <Text variant="heading-sm" render={ <h3 /> }>
                                { group.title }
                            </Text>
                            <ul className="wfd-shortcuts__list">
                                { group.rows.map( ( [ action, keys ] ) => (
                                    <li
                                        key={ action }
                                        className="wfd-shortcuts__row"
                                        data-wfd-shortcut-row=""
                                    >
                                        <Text variant="body-md">
                                            { action }
                                        </Text>
                                        <span className="wfd-shortcuts__keys">
                                            { keys.map( ( key, index ) => (
                                                <span
                                                    key={ key }
                                                    className="wfd-shortcuts__key"
                                                >
                                                    { index > 0 && (
                                                        <Text variant="body-sm">
                                                            +
                                                        </Text>
                                                    ) }
                                                    <Badge intent="none">
                                                        { key }
                                                    </Badge>
                                                </span>
                                            ) ) }
                                        </span>
                                    </li>
                                ) ) }
                            </ul>
                            { group.note && (
                                <Text
                                    variant="body-sm"
                                    className="wfd-shortcuts__note"
                                    render={ <p /> }
                                >
                                    { group.note }
                                </Text>
                            ) }
                        </section>
                    ) ) }
                </Dialog.Content>
            </Dialog.Popup>
        </Dialog.Root>
    );
}
