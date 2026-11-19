/**
 * The remove dialog (spec/screens/DeleteDialog.md, ResetDialog.md) and the
 * lock dialog (spec/screens/LockDialog.md).
 */
import { __, sprintf } from '@wordpress/i18n';
import { useState } from '@wordpress/element';
import { CheckboxControl } from '@wordpress/components';
import { AlertDialog, Dialog } from '@wordpress/ui';

const KIND_WORD = {
    template: __( 'template', 'wordpress-for-designers' ),
    'template-part': __( 'template part', 'wordpress-for-designers' ),
};

function removeTexts( artboard, isThemeItem ) {
    const { name, kind } = artboard;
    if ( isThemeItem ) {
        return {
            body: sprintf(
                /* translators: %s: name of a template or template part. */
                __(
                    "%s ships with the theme, so it can't be deleted. It stays on your site.",
                    'wordpress-for-designers'
                ),
                name
            ),
            checkbox: sprintf(
                /* translators: %s: name of a template or template part. */
                __(
                    "Also reset %s to the theme's version. Your changes to it are lost.",
                    'wordpress-for-designers'
                ),
                name
            ),
        };
    }
    if ( kind === 'page' ) {
        return {
            body: __(
                'The page stays on your site unless you also delete it.',
                'wordpress-for-designers'
            ),
            checkbox: sprintf(
                /* translators: %s: page name. */
                __(
                    'Also move the %s page to the trash.',
                    'wordpress-for-designers'
                ),
                name
            ),
        };
    }
    if ( kind === 'pattern' ) {
        return {
            body: __(
                'The pattern stays on your site unless you also delete it.',
                'wordpress-for-designers'
            ),
            checkbox: sprintf(
                /* translators: %s: pattern name. */
                __(
                    'Also delete the %s pattern from the site. It is removed everywhere it is used.',
                    'wordpress-for-designers'
                ),
                name
            ),
        };
    }
    return {
        body: sprintf(
            /* translators: %s: "template" or "template part". */
            __(
                'The %s stays on your site unless you also delete it.',
                'wordpress-for-designers'
            ),
            KIND_WORD[ kind ]
        ),
        checkbox: sprintf(
            /* translators: 1: name. 2: "template" or "template part". */
            __(
                'Also delete the %1$s %2$s from the site.',
                'wordpress-for-designers'
            ),
            name,
            KIND_WORD[ kind ]
        ),
    };
}

/**
 * @param {Object}   props
 * @param {Object}   props.artboard       The artboard with its name.
 * @param {boolean}  props.isDraft        Whether its entity has never been saved.
 * @param {boolean}  props.isBoardOnly    Whether it can only be taken off the board (a media object).
 * @param {boolean}  props.isThemeItem    Whether its entity ships with the theme.
 * @param {boolean}  props.hasUserChanges Whether a theme item has user changes.
 * @param {boolean}  props.defaultChecked Initial state of the checkbox.
 * @param {Function} props.onConfirm      Called with whether the box is checked.
 * @param {Function} props.onCancel       Closes the dialog.
 */
export function RemoveDialog( {
    artboard,
    isDraft = false,
    isBoardOnly = false,
    isThemeItem = false,
    hasUserChanges = true,
    defaultChecked = false,
    onConfirm,
    onCancel,
} ) {
    const [ isChecked, setIsChecked ] = useState( defaultChecked );
    const texts = removeTexts( artboard, isThemeItem );
    // A template or part that was never saved has nothing on the site.
    const isPlain = isDraft || isBoardOnly;
    const showCheckbox = ! isPlain && ( ! isThemeItem || hasUserChanges );
    return (
        <AlertDialog.Root
            open
            onOpenChange={ ( open ) => ! open && onCancel() }
            onConfirm={ () => onConfirm( showCheckbox && isChecked ) }
        >
            <AlertDialog.Popup
                intent={
                    showCheckbox && isChecked ? 'irreversible' : 'default'
                }
                title={ sprintf(
                    /* translators: %s: artboard name. */
                    __(
                        'Remove %s from this board?',
                        'wordpress-for-designers'
                    ),
                    artboard.name
                ) }
                description={ isPlain ? undefined : texts.body }
                confirmButtonText={ __( 'Remove', 'wordpress-for-designers' ) }
                cancelButtonText={ __( 'Cancel', 'wordpress-for-designers' ) }
            >
                { showCheckbox && (
                    <CheckboxControl
                        className="wfd-remove-dialog__checkbox"
                        label={ texts.checkbox }
                        checked={ isChecked }
                        onChange={ setIsChecked }
                    />
                ) }
            </AlertDialog.Popup>
        </AlertDialog.Root>
    );
}

/**
 * @param {Object}   props
 * @param {string}   props.state      'locked' (first state) or 'taken' (second).
 * @param {string}   props.userName   Display name of the user holding the lock.
 * @param {Function} props.onTakeOver Takes the lock and enters edit.
 * @param {Function} props.onClose    Closes the dialog.
 */
export function LockDialog( { state, userName, onTakeOver, onClose } ) {
    if ( state === 'taken' ) {
        return (
            <Dialog.Root open onOpenChange={ ( open ) => ! open && onClose() }>
                <Dialog.Popup size="small" data-wfd-lock-dialog="taken">
                    <Dialog.Header>
                        <Dialog.Title>
                            { __(
                                'Someone else has taken over this post',
                                'wordpress-for-designers'
                            ) }
                        </Dialog.Title>
                    </Dialog.Header>
                    <Dialog.Content>
                        <Dialog.Description>
                            { sprintf(
                                /* translators: %s: user name. */
                                __(
                                    '%s now has editing control of this post.',
                                    'wordpress-for-designers'
                                ),
                                userName
                            ) }
                        </Dialog.Description>
                    </Dialog.Content>
                    <Dialog.Footer>
                        <Dialog.Action>
                            { __( 'OK', 'wordpress-for-designers' ) }
                        </Dialog.Action>
                    </Dialog.Footer>
                </Dialog.Popup>
            </Dialog.Root>
        );
    }
    return (
        <AlertDialog.Root
            open
            onOpenChange={ ( open ) => ! open && onClose() }
            onConfirm={ onTakeOver }
        >
            <AlertDialog.Popup
                data-wfd-lock-dialog="locked"
                title={ __(
                    'This post is already being edited',
                    'wordpress-for-designers'
                ) }
                description={ sprintf(
                    /* translators: %s: user name. */
                    __(
                        '%s is currently working on this post, which means you cannot make changes, unless you take over.',
                        'wordpress-for-designers'
                    ),
                    userName
                ) }
                confirmButtonText={ __(
                    'Take over',
                    'wordpress-for-designers'
                ) }
                cancelButtonText={ __( 'Cancel', 'wordpress-for-designers' ) }
            />
        </AlertDialog.Root>
    );
}
