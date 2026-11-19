<?php
/**
 * Plugin Name: WFD Diag OQ-2 (throwaway)
 * Description: Milestone 0 proofs. Not part of the plugin.
 */

add_action(
    'admin_menu',
    function () {
        add_menu_page( 'WFD Diag 2', 'WFD Diag 2', 'edit_theme_options', 'wfd-diag2', 'wfd_diag2_render' );
    }
);

function wfd_diag2_render() {
    echo '<div id="wfd-spike-root"></div>';
}

add_action(
    'admin_enqueue_scripts',
    function ( $hook ) {
        if ( 'toplevel_page_wfd-diag2' !== $hook ) {
            return;
        }
        $asset    = include __DIR__ . '/build/index.asset.php';
        $context  = new WP_Block_Editor_Context( array( 'name' => 'core/edit-site' ) );
        $settings = get_block_editor_settings( array(), $context );
        $page_id  = isset( $_GET['post'] ) ? (int) $_GET['post'] : 0;
        $lock     = $page_id ? wp_check_post_lock( $page_id ) : false;

        wp_enqueue_script( 'wfd-diag2', plugins_url( 'build/index.js', __FILE__ ), $asset['dependencies'], $asset['version'], true );
        wp_add_inline_script(
            'wfd-diag2',
            'window.wfdSpike = ' . wp_json_encode(
                array(
                    'settings'     => $settings,
                    'postId'       => $page_id,
                    'lockedByUser' => $lock,
                    'lockInfo'     => $page_id ? wfd_diag2_lock_info( $page_id ) : null,
                    'boardUrl'     => admin_url( 'admin.php?page=wfd-diag2' ),
                    'userId'       => get_current_user_id(),
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

/**
 * DIAGNOSTIC: what edit-form-blocks.php computes for postLock / postLockUtils,
 * but without taking the lock.
 */
function wfd_diag2_user_details( $user_id ) {
    $user    = get_userdata( $user_id );
    $details = array(
        'id'   => (int) $user_id,
        'name' => $user ? $user->display_name : '',
    );
    if ( get_option( 'show_avatars' ) ) {
        $details['avatar'] = get_avatar_url( $user_id, array( 'size' => 128 ) );
    }
    return $details;
}

function wfd_diag2_lock_info( $post_id ) {
    if ( ! function_exists( 'wp_check_post_lock' ) ) {
        require_once ABSPATH . 'wp-admin/includes/post.php';
    }
    $holder = wp_check_post_lock( $post_id );
    return array(
        'postLock'      => $holder
            ? array(
                'isLocked' => true,
                'user'     => wfd_diag2_user_details( $holder ),
            )
            : array( 'isLocked' => false ),
        'postLockUtils' => array(
            'nonce'       => wp_create_nonce( 'lock-post_' . $post_id ),
            'unlockNonce' => wp_create_nonce( 'update-post_' . $post_id ),
            'ajaxUrl'     => admin_url( 'admin-ajax.php' ),
        ),
        'raw'           => get_post_meta( $post_id, '_edit_lock', true ),
    );
}

add_action(
    'rest_api_init',
    function () {
        $perm = function ( $request ) {
            return current_user_can( 'edit_theme_options' ) && current_user_can( 'edit_post', (int) $request['id'] );
        };
        // Probe: are the lock functions loaded in a REST request without a require?
        register_rest_route(
            'wfd-diag2/v1',
            '/probe',
            array(
                'methods'             => 'GET',
                'permission_callback' => function () {
                    return current_user_can( 'edit_theme_options' );
                },
                'callback'            => function () {
                    return rest_ensure_response(
                        array(
                            'wp_check_post_lock_exists' => function_exists( 'wp_check_post_lock' ),
                            'wp_set_post_lock_exists'   => function_exists( 'wp_set_post_lock' ),
                        )
                    );
                },
            )
        );
        register_rest_route(
            'wfd-diag2/v1',
            '/lock/(?P<id>\\d+)',
            array(
                array(
                    'methods'             => 'GET',
                    'permission_callback' => $perm,
                    'callback'            => function ( $request ) {
                        return rest_ensure_response( wfd_diag2_lock_info( (int) $request['id'] ) );
                    },
                ),
                array(
                    'methods'             => 'POST',
                    'permission_callback' => $perm,
                    'callback'            => function ( $request ) {
                        $id = (int) $request['id'];
                        require_once ABSPATH . 'wp-admin/includes/post.php';
                        $holder = wp_check_post_lock( $id );
                        if ( $holder && ! $request['takeover'] ) {
                            return rest_ensure_response(
                                array(
                                    'held' => false,
                                    'user' => wfd_diag2_user_details( $holder ),
                                )
                            );
                        }
                        $lock = wp_set_post_lock( $id );
                        return rest_ensure_response(
                            array(
                                'held'   => true,
                                'active' => implode( ':', $lock ),
                            )
                        );
                    },
                ),
                array(
                    'methods'             => 'DELETE',
                    'permission_callback' => $perm,
                    'callback'            => function ( $request ) {
                        $id = (int) $request['id'];
                        require_once ABSPATH . 'wp-admin/includes/post.php';
                        // Release only when nobody else holds it (same effect as wp_ajax_wp_remove_post_lock).
                        if ( wp_check_post_lock( $id ) ) {
                            return rest_ensure_response( array( 'released' => false ) );
                        }
                        $raw = get_post_meta( $id, '_edit_lock', true );
                        $own = $raw && (int) explode( ':', $raw )[1] === get_current_user_id();
                        if ( $own ) {
                            delete_post_meta( $id, '_edit_lock' );
                        }
                        return rest_ensure_response( array( 'released' => (bool) $own ) );
                    },
                ),
            )
        );
        // Variant: lock state as a field on the page entity (read through core-data).
        register_rest_field(
            'page',
            'wfd_diag2_lock',
            array(
                'get_callback'    => function ( $post, $field, $request ) {
                    if ( 'edit' !== $request['context'] ) {
                        return null;
                    }
                    require_once ABSPATH . 'wp-admin/includes/post.php';
                    $holder = wp_check_post_lock( $post['id'] );
                    return $holder ? wfd_diag2_user_details( $holder ) : null;
                },
                'update_callback' => function ( $value, $post ) {
                    require_once ABSPATH . 'wp-admin/includes/post.php';
                    if ( 'take' === $value ) {
                        wp_set_post_lock( $post->ID );
                    }
                    return true;
                },
                'schema'          => array(
                    'type'    => array( 'object', 'string', 'null' ),
                    'context' => array( 'edit' ),
                ),
            )
        );
    }
);

/**
 * DIAGNOSTIC: can a public filter send the stock "Take over" link back to the board?
 * Only active when the referring page carries wfdreturn=1.
 */
add_filter(
    'get_edit_post_link',
    function ( $link, $post_id ) {
        if ( empty( $_GET['get-post-lock'] ) ) {
            return $link;
        }
        $ref = wp_get_referer();
        if ( $ref && false !== strpos( $ref, 'page=wfd-diag2' ) && false !== strpos( $ref, 'wfdreturn=1' ) ) {
            return $ref;
        }
        return $link;
    },
    10,
    2
);
