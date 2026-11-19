<?php
/**
 * Plugin Name: WFD Spikes (throwaway)
 * Description: Milestone 0 proofs. Not part of the plugin.
 */

add_action(
    'admin_menu',
    function () {
        add_menu_page( 'WFD Spikes', 'WFD Spikes', 'edit_theme_options', 'wfd-spikes', 'wfd_spikes_render' );
    }
);

function wfd_spikes_render() {
    echo '<div id="wfd-spike-root"></div>';
}

add_action(
    'admin_enqueue_scripts',
    function ( $hook ) {
        if ( 'toplevel_page_wfd-spikes' !== $hook ) {
            return;
        }
        $asset    = include __DIR__ . '/build/index.asset.php';
        $context  = new WP_Block_Editor_Context( array( 'name' => 'core/edit-site' ) );
        $settings = get_block_editor_settings( array(), $context );
        $page_id  = isset( $_GET['post'] ) ? (int) $_GET['post'] : 0;
        $lock     = $page_id ? wp_check_post_lock( $page_id ) : false;

        wp_enqueue_script( 'wfd-spikes', plugins_url( 'build/index.js', __FILE__ ), $asset['dependencies'], $asset['version'], true );
        wp_add_inline_script(
            'wfd-spikes',
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

add_action(
    'rest_api_init',
    function () {
        $perm = function ( $request ) {
            return current_user_can( 'edit_theme_options' ) && current_user_can( 'edit_post', (int) $request['id'] );
        };
        $user = function ( $id ) {
            $u = get_userdata( $id );
            return array(
                'id'   => (int) $id,
                'name' => $u ? $u->display_name : '',
            );
        };
        register_rest_route(
            'wfd/v1',
            '/lock/(?P<id>\\d+)',
            array(
                array(
                    'methods'             => 'POST',
                    'permission_callback' => $perm,
                    'callback'            => function ( $request ) use ( $user ) {
                        require_once ABSPATH . 'wp-admin/includes/post.php';
                        $id     = (int) $request['id'];
                        $holder = wp_check_post_lock( $id );
                        if ( $holder && ! $request['takeover'] ) {
                            return rest_ensure_response(
                                array(
                                    'held' => false,
                                    'user' => $user( $holder ),
                                )
                            );
                        }
                        wp_set_post_lock( $id );
                        return rest_ensure_response( array( 'held' => true ) );
                    },
                ),
                array(
                    'methods'             => 'DELETE',
                    'permission_callback' => $perm,
                    'callback'            => function ( $request ) {
                        require_once ABSPATH . 'wp-admin/includes/post.php';
                        $id  = (int) $request['id'];
                        $raw = (string) get_post_meta( $id, '_edit_lock', true );
                        $own = $raw && ! wp_check_post_lock( $id ) && (int) explode( ':', $raw )[1] === get_current_user_id();
                        if ( $own ) {
                            delete_post_meta( $id, '_edit_lock' );
                        }
                        return rest_ensure_response( array( 'released' => (bool) $own ) );
                    },
                ),
            )
        );
    }
);
