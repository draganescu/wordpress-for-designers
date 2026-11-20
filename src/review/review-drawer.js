/**
 * The Review drawer (spec/screens/Review.md, ReviewEmpty.md, ReviewError.md,
 * decision D24). Presentational: the host supplies the items and callbacks.
 */
import { __ } from '@wordpress/i18n';
import { useRef, useState } from '@wordpress/element';
import { CheckboxControl } from '@wordpress/components';
import {
    AlertDialog,
    Button,
    Card,
    Drawer,
    EmptyState,
    Notice,
    Stack,
    Text,
} from '@wordpress/ui';
import { WeakText } from '../shell/primitives';
import {
    artboardsLine,
    discardLabel,
    discardTitle,
    moreLine,
    saveErrorMessage,
    saveLabel,
    secondLine,
} from './format';

/**
 * One changed item: checkbox, name, second line, its own "Discard" (D48)
 * and change lines.
 *
 * @param {Object}     props
 * @param {Object}     props.item      The item.
 * @param {() => void} props.onToggle  Called when the checkbox changes.
 * @param {() => void} props.onDiscard Called when "Discard" is used.
 * @param {boolean}    props.isSaving  Whether a save is in flight.
 */
function ReviewItem( { item, onToggle, onDiscard, isSaving } ) {
    const lines = item.lines ?? [];
    const hasMore = item.moreCount > 0;
    const hasArtboards = item.artboardCount !== undefined;
    return (
        <Card.Root className="wfd-review__item">
            <Card.Header>
                <Stack
                    direction="row"
                    align="flex-start"
                    justify="space-between"
                    gap="md"
                >
                    <CheckboxControl
                        label={ item.name }
                        help={ secondLine( item ) }
                        checked={ item.isChecked }
                        onChange={ onToggle }
                    />
                    <Button
                        className="wfd-review__discard"
                        variant="minimal"
                        tone="neutral"
                        size="compact"
                        aria-label={ discardLabel( item.name ) }
                        disabled={ isSaving }
                        onClick={ onDiscard }
                    >
                        { __( 'Discard', 'wordpress-for-designers' ) }
                    </Button>
                </Stack>
            </Card.Header>
            <Card.Content>
                <Stack direction="column" gap="md">
                    { item.hasError && (
                        <Notice.Root intent="error">
                            <Notice.Description>
                                { saveErrorMessage( item.name ) }
                            </Notice.Description>
                        </Notice.Root>
                    ) }
                    <Stack
                        direction="column"
                        gap="sm"
                        className="wfd-review__lines"
                        render={ <ul /> }
                    >
                        { lines.map( ( line, index ) => (
                            <Text
                                key={ index }
                                variant="body-md"
                                render={ <li /> }
                            >
                                { line }
                            </Text>
                        ) ) }
                        { hasMore && (
                            <WeakText render={ <li /> }>
                                { moreLine( item.moreCount ) }
                            </WeakText>
                        ) }
                        { hasArtboards && (
                            <WeakText render={ <li /> }>
                                { artboardsLine( item.artboardCount ) }
                            </WeakText>
                        ) }
                    </Stack>
                </Stack>
            </Card.Content>
        </Card.Root>
    );
}

/**
 * The Review drawer.
 *
 * @param {Object}                props
 * @param {boolean}               props.isOpen        Whether the drawer is open.
 * @param {() => void}            props.onClose       Called by "Keep editing" and close.
 * @param {Object[]}              props.items         The changed items.
 * @param {(key: string) => void} props.onToggleItem  Called with an item key.
 * @param {(key: string) => void} props.onDiscardItem Called with an item key after that item's discard confirmation.
 * @param {() => void}            props.onSave        Called by the primary button.
 * @param {() => void}            props.onDiscardAll  Called after the discard confirmation.
 * @param {boolean}               props.isSaving      Whether a save is in flight.
 */
export function ReviewDrawer( {
    isOpen,
    onClose,
    items = [],
    onToggleItem,
    onDiscardItem,
    onSave,
    onDiscardAll,
    isSaving = false,
} ) {
    const isEmpty = items.length === 0;
    const checkedCount = items.filter( ( item ) => item.isChecked ).length;
    const hasFailed = items.some( ( item ) => item.hasError );
    const hasNew = items.some( ( item ) => item.isNew );

    // One confirmation serves every item's "Discard" (D48). It lives here,
    // not in the item, because the item is gone once it is discarded: focus
    // then goes to the close button instead of being lost, and back to the
    // item's button after Cancel.
    const [ pending, setPending ] = useState( null );
    const [ isConfirming, setIsConfirming ] = useState( false );
    const closeButton = useRef( null );
    // Said by a confirmation only when something in it cannot be undone:
    // an unsaved new template or part leaving the board. Reverting saved
    // items is a step of the content history.
    const cannotBeUndone = __(
        "This can't be undone.",
        'wordpress-for-designers'
    );

    return (
        <Drawer.Root
            open={ isOpen }
            onOpenChange={ ( open ) => {
                if ( ! open ) {
                    onClose?.();
                }
            } }
            swipeDirection="right"
        >
            <Drawer.Popup size="large" className="wfd-review">
                <Drawer.Header>
                    <Drawer.Title>
                        { __( 'Review changes', 'wordpress-for-designers' ) }
                    </Drawer.Title>
                    <Drawer.CloseIconButton ref={ closeButton } />
                </Drawer.Header>
                <Drawer.Content>
                    { isEmpty ? (
                        <EmptyState.Root className="wfd-review__empty">
                            <EmptyState.Title>
                                { __(
                                    'No changes to review',
                                    'wordpress-for-designers'
                                ) }
                            </EmptyState.Title>
                            <EmptyState.Description>
                                { __(
                                    'Edits to pages, templates, parts, patterns and styles appear here before they reach the site.',
                                    'wordpress-for-designers'
                                ) }
                            </EmptyState.Description>
                        </EmptyState.Root>
                    ) : (
                        <Stack direction="column" gap="lg">
                            <Drawer.Description>
                                { __(
                                    'Nothing reaches the site until you save. Artboard positions on the board save on their own.',
                                    'wordpress-for-designers'
                                ) }
                            </Drawer.Description>
                            { items.map( ( item ) => (
                                <ReviewItem
                                    key={ item.key }
                                    item={ item }
                                    onToggle={ () =>
                                        onToggleItem?.( item.key )
                                    }
                                    onDiscard={ () => {
                                        setPending( item );
                                        setIsConfirming( true );
                                    } }
                                    isSaving={ isSaving }
                                />
                            ) ) }
                        </Stack>
                    ) }
                </Drawer.Content>
                <AlertDialog.Root
                    open={ isConfirming }
                    onOpenChange={ setIsConfirming }
                    onConfirm={ () => onDiscardItem?.( pending.key ) }
                >
                    <AlertDialog.Popup
                        intent={ pending?.isNew ? 'irreversible' : 'default' }
                        title={ discardTitle( pending?.name ?? '' ) }
                        description={
                            pending?.isNew ? cannotBeUndone : undefined
                        }
                        cancelButtonText={ __(
                            'Cancel',
                            'wordpress-for-designers'
                        ) }
                        confirmButtonText={ __(
                            'Discard',
                            'wordpress-for-designers'
                        ) }
                        finalFocus={ () =>
                            items.some( ( item ) => item.key === pending?.key )
                                ? true
                                : closeButton.current
                        }
                    />
                </AlertDialog.Root>
                { ! isEmpty && (
                    <Drawer.Footer>
                        <AlertDialog.Root onConfirm={ onDiscardAll }>
                            <AlertDialog.Trigger
                                render={
                                    <Button
                                        variant="minimal"
                                        tone="neutral"
                                        disabled={ isSaving }
                                    />
                                }
                            >
                                { __(
                                    'Discard all',
                                    'wordpress-for-designers'
                                ) }
                            </AlertDialog.Trigger>
                            <AlertDialog.Popup
                                intent={ hasNew ? 'irreversible' : 'default' }
                                title={ __(
                                    'Discard all changes?',
                                    'wordpress-for-designers'
                                ) }
                                description={
                                    hasNew ? cannotBeUndone : undefined
                                }
                                cancelButtonText={ __(
                                    'Cancel',
                                    'wordpress-for-designers'
                                ) }
                                confirmButtonText={ __(
                                    'Discard',
                                    'wordpress-for-designers'
                                ) }
                            />
                        </AlertDialog.Root>
                        <Button variant="outline" onClick={ onClose }>
                            { __( 'Keep editing', 'wordpress-for-designers' ) }
                        </Button>
                        <Button
                            variant="solid"
                            disabled={ isSaving }
                            onClick={ onSave }
                        >
                            { saveLabel( checkedCount, hasFailed ) }
                        </Button>
                    </Drawer.Footer>
                ) }
            </Drawer.Popup>
        </Drawer.Root>
    );
}
