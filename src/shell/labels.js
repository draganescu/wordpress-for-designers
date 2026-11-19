/**
 * Label strings shared by the canvas, the header and the panels.
 */
import { __, _n, sprintf } from '@wordpress/i18n';
import { DEVICES, KINDS } from './constants';

/**
 * "{Name} · {Kind} · {Device}" (A1).
 *
 * @param {Object} artboard The artboard with its name.
 * @return {string} The label.
 */
export function artboardLabel( artboard ) {
    if ( artboard.kind === 'media' ) {
        // A media object has no device.
        return liveLabel( artboard );
    }
    return sprintf(
        /* translators: 1: artboard name. 2: kind, for example "Template". 3: device, for example "Desktop". */
        __( '%1$s · %2$s · %3$s', 'wordpress-for-designers' ),
        artboard.name,
        KINDS[ artboard.kind ].label,
        DEVICES[ artboard.device ].label
    );
}

/**
 * "{Name} · {Kind}" (A2 and the document bar).
 *
 * @param {Object} artboard The artboard with its name.
 * @return {string} The label.
 */
export function liveLabel( artboard ) {
    return sprintf(
        /* translators: 1: artboard name. 2: kind, for example "Template". */
        __( '%1$s · %2$s', 'wordpress-for-designers' ),
        artboard.name,
        KINDS[ artboard.kind ].label
    );
}

/**
 * "{n} uses", for the artboard label on the Styles screen.
 *
 * @param {number} count Number of uses.
 * @return {string} The text.
 */
export function usesText( count ) {
    return sprintf(
        /* translators: %d: number of uses of a token. */
        _n( '%d use', '%d uses', count, 'wordpress-for-designers' ),
        count
    );
}

/**
 * The description under an entity's name (E5).
 *
 * @param {Object} artboard         The artboard.
 * @param {Object} info             What is known about its entity.
 * @param {string} info.description The template's own description.
 * @param {number} info.usedBy      Number of templates using a part or pattern.
 * @param {number} info.width       Pixel width of an image.
 * @param {number} info.height      Pixel height of an image.
 * @return {string} The description.
 */
export function entityDescription( artboard, info = {} ) {
    switch ( artboard.kind ) {
        case 'browser':
            return __(
                'The site as visitors see it.',
                'wordpress-for-designers'
            );
        case 'media':
            return info.width && info.height
                ? sprintf(
                      /* translators: 1: image width in pixels. 2: image height in pixels. */
                      __( '%1$d × %2$d', 'wordpress-for-designers' ),
                      info.width,
                      info.height
                  )
                : '';
        case 'page':
            return __( 'Page.', 'wordpress-for-designers' );
        case 'template':
            return info.description
                ? sprintf(
                      /* translators: %s: the template's description, a full sentence. */
                      __( 'Template. %s', 'wordpress-for-designers' ),
                      info.description
                  )
                : __( 'Template.', 'wordpress-for-designers' );
        case 'template-part':
            return sprintf(
                /* translators: %d: number of templates. */
                _n(
                    'Template part. Used by %d template.',
                    'Template part. Used by %d templates.',
                    info.usedBy ?? 0,
                    'wordpress-for-designers'
                ),
                info.usedBy ?? 0
            );
        default:
            return sprintf(
                /* translators: %d: number of templates. */
                _n(
                    'Pattern. Used in %d template.',
                    'Pattern. Used in %d templates.',
                    info.usedBy ?? 0,
                    'wordpress-for-designers'
                ),
                info.usedBy ?? 0
            );
    }
}
