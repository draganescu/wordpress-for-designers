<?php
/**
 * Editor bootstrap: block editor settings, block definitions and block assets,
 * loaded once per page and shared by every editor on the board. Uses the same
 * public functions wp-admin's editors use.
 *
 * @package WordPressForDesigners
 */

defined( 'ABSPATH' ) || exit;

/**
 * Prepares everything the block editor parts need and returns the settings.
 *
 * @return array Block editor settings.
 */
function wfd_bootstrap_editor() {
    $context = new WP_Block_Editor_Context( array( 'name' => 'core/edit-site' ) );

    // A block editor screen, as wp-admin's editors mark their own.
    $screen = get_current_screen();
    if ( $screen ) {
        $screen->is_block_editor( true );
    }

    $settings = get_block_editor_settings(
        array(
            'siteUrl'                  => site_url(),
            'styles'                   => get_block_editor_theme_styles(),
            'defaultTemplateTypes'     => get_default_block_template_types(),
            'defaultTemplatePartAreas' => get_allowed_block_template_part_areas(),
            'supportsLayout'           => wp_theme_has_theme_json(),
            'supportsTemplatePartsMode' => ! wp_is_block_theme() && current_theme_supports( 'block-template-parts' ),
        ),
        $context
    );

    $theme = get_stylesheet();
    block_editor_rest_api_preload(
        array(
            '/wp/v2/types?context=view',
            '/wp/v2/types/page?context=edit',
            '/wp/v2/types/wp_template?context=edit',
            '/wp/v2/types/wp_template_part?context=edit',
            '/wp/v2/types/wp_block?context=edit',
            '/wp/v2/taxonomies?context=view',
            '/wp/v2/users/me',
            '/wp/v2/settings',
            '/wp/v2/themes?context=edit&status=active',
            '/wp/v2/global-styles/themes/' . $theme . '?context=view',
            '/wp/v2/global-styles/themes/' . $theme . '/variations?context=view',
            array( '/wp/v2/pages', 'OPTIONS' ),
            array( '/wp/v2/media', 'OPTIONS' ),
            array( '/wp/v2/templates', 'OPTIONS' ),
        ),
        $context
    );

    wp_add_inline_script(
        'wp-blocks',
        sprintf( 'wp.blocks.setCategories( %s );', wp_json_encode( get_block_categories( $context ), JSON_HEX_TAG | JSON_UNESCAPED_SLASHES ) ),
        'after'
    );
    wp_add_inline_script(
        'wp-blocks',
        'wp.blocks.unstable__bootstrapServerSideBlockDefinitions(' . wp_json_encode( get_block_editor_server_block_settings(), JSON_HEX_TAG | JSON_UNESCAPED_SLASHES ) . ');'
    );

    wp_enqueue_media();
    wp_enqueue_script( 'wp-format-library' );
    // Every canvas iframe loads the polyfill. Loading it with the page means
    // the iframes take it from the cache instead of each requesting it.
    wp_enqueue_script( 'wp-polyfill' );
    foreach ( array( 'wp-edit-blocks', 'wp-block-editor', 'wp-block-library', 'wp-editor', 'wp-format-library' ) as $style ) {
        wp_enqueue_style( $style );
    }

    // Plugins' block editor assets: their blocks, formats and styles.
    do_action( 'enqueue_block_editor_assets' );

    return $settings;
}
