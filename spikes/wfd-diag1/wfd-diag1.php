<?php
/**
 * Plugin Name: WFD Diag OQ-1 (throwaway)
 * Description: Milestone 0 proofs. Not part of the plugin.
 */

add_action(
    'admin_menu',
    function () {
        add_menu_page( 'WFD Diag 1', 'WFD Diag 1', 'edit_theme_options', 'wfd-diag1', 'wfd_diag1_render' );
    }
);

function wfd_diag1_render() {
    echo '<div id="wfd-spike-root"></div>';
}

add_action(
    'admin_enqueue_scripts',
    function ( $hook ) {
        if ( 'toplevel_page_wfd-diag1' !== $hook ) {
            return;
        }
        $asset    = include __DIR__ . '/build/index.asset.php';
        $context  = new WP_Block_Editor_Context( array( 'name' => 'core/edit-site' ) );
        $settings = get_block_editor_settings( array(), $context );
        $page_id  = isset( $_GET['post'] ) ? (int) $_GET['post'] : 0;
        $lock     = $page_id ? wp_check_post_lock( $page_id ) : false;

        wp_enqueue_script( 'wfd-diag1', plugins_url( 'build/index.js', __FILE__ ), $asset['dependencies'], $asset['version'], true );
        wp_add_inline_script(
            'wfd-diag1',
            'window.wfdSpike = ' . wp_json_encode(
                array(
                    'settings'     => $settings,
                    'postId'       => $page_id,
                    'lockedByUser' => $lock,
                )
            ) . ';',
            'before'
        );
        wp_enqueue_style( 'wp-edit-blocks' );
        wp_enqueue_style( 'wp-block-editor' );
        wp_enqueue_style( 'wp-components' );
        wp_enqueue_style( 'wp-editor' );
        wp_enqueue_style( 'wp-block-library' );
        wp_enqueue_script( 'heartbeat' );
        wp_enqueue_media();
        do_action( 'enqueue_block_editor_assets' );
    }
);
