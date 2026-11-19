/**
 * Kinds and devices (spec/data-model.md).
 */
import { __ } from '@wordpress/i18n';
import { page, layout, header, symbol, image } from '@wordpress/icons';

// The narrowest window a board is shown in: an iPad Air in landscape (D49).
export const MIN_BOARD_WIDTH = 1180;

export const KIND_ORDER = [
    'page',
    'template',
    'template-part',
    'pattern',
    'media',
];

export const KINDS = {
    page: {
        label: __( 'Page', 'wordpress-for-designers' ),
        group: __( 'Pages', 'wordpress-for-designers' ),
        icon: page,
        postType: 'page',
    },
    template: {
        label: __( 'Template', 'wordpress-for-designers' ),
        group: __( 'Templates', 'wordpress-for-designers' ),
        icon: layout,
        postType: 'wp_template',
    },
    'template-part': {
        label: __( 'Template part', 'wordpress-for-designers' ),
        group: __( 'Template parts', 'wordpress-for-designers' ),
        icon: header,
        postType: 'wp_template_part',
    },
    pattern: {
        label: __( 'Pattern', 'wordpress-for-designers' ),
        group: __( 'Patterns', 'wordpress-for-designers' ),
        icon: symbol,
        postType: 'wp_block',
    },
    // An image from the media library placed on the board as an object: it
    // has no device and cannot be edited.
    media: {
        label: __( 'Media', 'wordpress-for-designers' ),
        group: __( 'Media', 'wordpress-for-designers' ),
        icon: image,
        postType: 'attachment',
    },
};

/**
 * Widest a media object is drawn on the board, in board units.
 */
export const MAX_MEDIA_WIDTH = 1440;

/**
 * The size of a media object for an image of the given pixel size: its own
 * width up to the maximum, and the height that keeps its proportions.
 *
 * @param {number} width  Image width in pixels.
 * @param {number} height Image height in pixels.
 * @return {Object} `width` and `height` in board units.
 */
export function mediaSize( width, height ) {
    if ( ! ( width > 0 ) || ! ( height > 0 ) ) {
        return { width: 600, height: 400 };
    }
    const shown = Math.min( width, MAX_MEDIA_WIDTH );
    return { width: shown, height: Math.round( ( height * shown ) / width ) };
}

export const DEVICE_ORDER = [ 'desktop', 'tablet', 'mobile' ];

export const DEVICES = {
    desktop: { label: __( 'Desktop', 'wordpress-for-designers' ) },
    tablet: { label: __( 'Tablet', 'wordpress-for-designers' ) },
    mobile: { label: __( 'Mobile', 'wordpress-for-designers' ) },
};

/**
 * Render widths on a theme with default breakpoints.
 */
export const DEFAULT_WIDTHS = { desktop: 1440, tablet: 780, mobile: 360 };
