/**
 * Kinds and devices (spec/data-model.md).
 */
import { __ } from '@wordpress/i18n';
import { page, layout, header, symbol, image, globe } from '@wordpress/icons';

export const KIND_ORDER = [
    'page',
    'template',
    'template-part',
    'pattern',
    'media',
    'browser',
];

/**
 * What an artboard of blocks is: it is edited in an editor, drawn through
 * the tiers, at a device width, as tall as its content. `layout` lists the
 * fields of its entry in the saved layout, as `includes/post-type.php` checks
 * them.
 */
const OF_BLOCKS = {
    edit: 'editor',
    isTiered: true,
    isBoardOnly: false,
    isResized: false,
    layout: [ 'id', 'kind', 'entityId', 'device', 'x', 'y', 'height' ],
};

/**
 * Each kind: its words and icon, and the facts the rest of the app asks
 * about instead of naming a kind.
 *
 * - `postType`: the entity it refers to, or null when it has none.
 * - `edit`: how it is put in edit: 'editor', 'browse' (D55) or null.
 * - `isTiered`: whether the tier scheduler draws it.
 * - `isBoardOnly`: whether removing it only ever takes it off the board.
 * - `isResized`: whether its height is set by hand, not measured (D56).
 * - `layout`: the fields saved for it; it has a device when `device` is one.
 * - `isNamed`: whether it is named on its artboard's label (D62).
 */
export const KINDS = {
    page: {
        label: __( 'Page', 'wordpress-for-designers' ),
        group: __( 'Pages', 'wordpress-for-designers' ),
        icon: page,
        postType: 'page',
        ...OF_BLOCKS,
        isNamed: true,
    },
    template: {
        label: __( 'Template', 'wordpress-for-designers' ),
        group: __( 'Templates', 'wordpress-for-designers' ),
        icon: layout,
        postType: 'wp_template',
        ...OF_BLOCKS,
    },
    'template-part': {
        label: __( 'Template part', 'wordpress-for-designers' ),
        group: __( 'Template parts', 'wordpress-for-designers' ),
        icon: header,
        postType: 'wp_template_part',
        ...OF_BLOCKS,
    },
    pattern: {
        label: __( 'Pattern', 'wordpress-for-designers' ),
        group: __( 'Patterns', 'wordpress-for-designers' ),
        icon: symbol,
        postType: 'wp_block',
        ...OF_BLOCKS,
        isNamed: true,
    },
    // An image from the media library placed on the board as an object: it
    // has no device and cannot be edited.
    media: {
        label: __( 'Media', 'wordpress-for-designers' ),
        group: __( 'Media', 'wordpress-for-designers' ),
        icon: image,
        postType: 'attachment',
        edit: null,
        isTiered: false,
        isBoardOnly: true,
        isResized: false,
        layout: [ 'id', 'kind', 'entityId', 'x', 'y', 'width', 'height' ],
    },
    // A window onto the site's front end (D55): it has a device and an
    // address, and no entity.
    browser: {
        label: __( 'Browser', 'wordpress-for-designers' ),
        group: __( 'Browsers', 'wordpress-for-designers' ),
        icon: globe,
        postType: null,
        edit: 'browse',
        isTiered: false,
        isBoardOnly: true,
        isResized: true,
        layout: [ 'id', 'kind', 'path', 'device', 'x', 'y', 'height', 'shows' ],
    },
};

/**
 * Whether an artboard is drawn at a device width.
 *
 * @param {Object} artboard The artboard.
 * @return {boolean} False for one with a width of its own.
 */
export const hasDevice = ( artboard ) =>
    KINDS[ artboard.kind ].layout.includes( 'device' );

/**
 * Lowest a browser's window can be resized to, in board units (D56).
 */
export const MIN_BROWSER_HEIGHT = 200;

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

/**
 * The attributes the end-to-end tests read on rulers and guides
 * (spec/acceptance.md, "Rulers and guides").
 */
export const ATTR = {
    ruler: 'data-wfd-ruler',
    zero: 'data-wfd-zero',
    step: 'data-wfd-step',
    span: 'data-wfd-span',
    marks: 'data-wfd-marks',
    guide: 'data-wfd-guide',
    axis: 'data-wfd-axis',
    at: 'data-wfd-at',
    owner: 'data-wfd-owner',
    device: 'data-wfd-device',
    selected: 'data-wfd-selected',
    guideChip: 'data-wfd-guide-chip',
    view: 'data-wfd-view',
};
