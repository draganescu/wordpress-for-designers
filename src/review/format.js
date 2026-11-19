/**
 * Strings of the Review drawer (spec/screens/Review.md, ReviewError.md).
 * Pure helpers: values in, translated text out.
 */
import { __, _n, sprintf } from '@wordpress/i18n';

/**
 * The second line of an item without the "New " prefix.
 *
 * @param {Object} item One item of the Review list.
 * @return {string} The line.
 */
function baseSecondLine( item ) {
    switch ( item.type ) {
        case 'styles':
            return sprintf(
                /* translators: %d: number of global styles changes. */
                __( 'Site-wide · %d changes', 'wordpress-for-designers' ),
                item.changeCount
            );
        case 'template-part':
            return sprintf(
                /* translators: %d: number of templates that use the template part. */
                __(
                    'Template part · used by %d templates',
                    'wordpress-for-designers'
                ),
                item.usedByCount
            );
        case 'template':
            return __( 'Template', 'wordpress-for-designers' );
        case 'page':
            return sprintf(
                /* translators: %s: the page's status, already worded. */
                __( 'Page · %s', 'wordpress-for-designers' ),
                item.status
            );
        case 'pattern':
            return sprintf(
                /* translators: %s: the pattern's status, already worded. */
                __( 'Pattern · %s', 'wordpress-for-designers' ),
                item.status
            );
        case 'site':
            return __( 'Site', 'wordpress-for-designers' );
        case 'navigation':
            return __( 'Navigation menu', 'wordpress-for-designers' );
        default:
            return '';
    }
}

/**
 * The second line of an item's card.
 *
 * @param {Object} item One item of the Review list.
 * @return {string} The line, prefixed "New " for a new item.
 */
export function secondLine( item ) {
    const line = baseSecondLine( item );
    if ( ! item.isNew || ! line ) {
        return line;
    }
    return sprintf(
        /* translators: %s: what the item is, for example "Page · draft". */
        __( 'New %s', 'wordpress-for-designers' ),
        line
    );
}

/**
 * The label of the primary button.
 *
 * @param {number}  checkedCount Number of checked items.
 * @param {boolean} hasFailed    Whether a listed item failed to save.
 * @return {string} "Save {n} changes" or "Retry {n} changes".
 */
export function saveLabel( checkedCount, hasFailed ) {
    if ( hasFailed ) {
        return sprintf(
            /* translators: %d: number of checked items. */
            _n(
                'Retry %d change',
                'Retry %d changes',
                checkedCount,
                'wordpress-for-designers'
            ),
            checkedCount
        );
    }
    return sprintf(
        /* translators: %d: number of checked items. */
        _n(
            'Save %d change',
            'Save %d changes',
            checkedCount,
            'wordpress-for-designers'
        ),
        checkedCount
    );
}

/**
 * The line that closes a list cut at five change lines.
 *
 * @param {number} n Number of change lines not shown.
 * @return {string} "and {n} more".
 */
export function moreLine( n ) {
    return sprintf(
        /* translators: %d: number of change lines not shown. */
        __( 'and %d more', 'wordpress-for-designers' ),
        n
    );
}

/**
 * The last line of the global styles card.
 *
 * @param {number} n Number of artboards that show the styles changes.
 * @return {string} "Shows on {n} artboards".
 */
export function artboardsLine( n ) {
    return sprintf(
        /* translators: %d: number of artboards. */
        __( 'Shows on %d artboards', 'wordpress-for-designers' ),
        n
    );
}

/**
 * The text of the Notice in a card whose save failed.
 *
 * @param {string} name The item name.
 * @return {string} The message.
 */
export function saveErrorMessage( name ) {
    return sprintf(
        /* translators: %s: name of the item that failed to save. */
        __(
            "Couldn't save %s. Check your connection and try again.",
            'wordpress-for-designers'
        ),
        name
    );
}
