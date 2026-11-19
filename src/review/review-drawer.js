/**
 * The Review drawer (spec/screens/Review.md, ReviewEmpty.md, ReviewError.md,
 * decision D24). Presentational: the host supplies the items and callbacks.
 */
import { __ } from '@wordpress/i18n';
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
    moreLine,
    saveErrorMessage,
    saveLabel,
    secondLine,
} from './format';

/**
 * One changed item: checkbox, name, second line and change lines.
 *
 * @param {Object}     props
 * @param {Object}     props.item     The item.
 * @param {() => void} props.onToggle Called when the checkbox changes.
 */
function ReviewItem( { item, onToggle } ) {
    const lines = item.lines ?? [];
    const hasMore = item.moreCount > 0;
    const hasArtboards = item.artboardCount !== undefined;
    return (
        <Card.Root className="wfd-review__item">
            <Card.Header>
                <CheckboxControl
                    label={ item.name }
                    help={ secondLine( item ) }
                    checked={ item.isChecked }
                    onChange={ onToggle }
                />
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
 * @param {boolean}               props.isOpen       Whether the drawer is open.
 * @param {() => void}            props.onClose      Called by "Keep editing" and close.
 * @param {Object[]}              props.items        The changed items.
 * @param {(key: string) => void} props.onToggleItem Called with an item key.
 * @param {() => void}            props.onSave       Called by the primary button.
 * @param {() => void}            props.onDiscardAll Called after the discard confirmation.
 * @param {boolean}               props.isSaving     Whether a save is in flight.
 */
export function ReviewDrawer( {
    isOpen,
    onClose,
    items = [],
    onToggleItem,
    onSave,
    onDiscardAll,
    isSaving = false,
} ) {
    const isEmpty = items.length === 0;
    const checkedCount = items.filter( ( item ) => item.isChecked ).length;
    const hasFailed = items.some( ( item ) => item.hasError );

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
                    <Drawer.CloseIconButton />
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
                                />
                            ) ) }
                        </Stack>
                    ) }
                </Drawer.Content>
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
                                intent="irreversible"
                                title={ __(
                                    'Discard all changes?',
                                    'wordpress-for-designers'
                                ) }
                                description={ __(
                                    "This can't be undone.",
                                    'wordpress-for-designers'
                                ) }
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
