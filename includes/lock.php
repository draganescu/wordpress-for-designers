<?php
/**
 * The lock route: check, take, refresh and release the WordPress post lock of
 * a page or pattern (spec/data-model.md, Locks; decision D31).
 *
 * @package WordPressForDesigners
 */

defined( 'ABSPATH' ) || exit;

/**
 * Whether the current user may lock a post from the board.
 *
 * @param WP_REST_Request $request The request.
 * @return bool
 */
function wfd_lock_permission( $request ) {
    $post = get_post( (int) $request['id'] );
    return $post
        && in_array( $post->post_type, array( 'page', 'wp_block' ), true )
        && current_user_can( WFD_CAPABILITY )
        && current_user_can( 'edit_post', $post->ID );
}

/**
 * Takes or refreshes the lock, unless another user holds it.
 *
 * @param WP_REST_Request $request The request.
 * @return WP_REST_Response
 */
function wfd_lock_take( $request ) {
    require_once ABSPATH . 'wp-admin/includes/post.php';
    $id     = (int) $request['id'];
    $holder = wp_check_post_lock( $id );
    if ( $holder && ! $request['takeover'] ) {
        $user = get_userdata( $holder );
        return rest_ensure_response(
            array(
                'held' => false,
                'user' => array(
                    'id'   => (int) $holder,
                    'name' => $user ? $user->display_name : '',
                ),
            )
        );
    }
    wp_set_post_lock( $id );
    return rest_ensure_response( array( 'held' => true ) );
}

/**
 * Releases the lock if the current user holds it.
 *
 * @param WP_REST_Request $request The request.
 * @return WP_REST_Response
 */
function wfd_lock_release( $request ) {
    require_once ABSPATH . 'wp-admin/includes/post.php';
    $id   = (int) $request['id'];
    $lock = explode( ':', (string) get_post_meta( $id, '_edit_lock', true ) );
    $own  = isset( $lock[1] ) && (int) $lock[1] === get_current_user_id();
    if ( $own ) {
        delete_post_meta( $id, '_edit_lock' );
    }
    return rest_ensure_response( array( 'released' => $own ) );
}

/**
 * Registers wfd/v1/lock/{id}.
 */
function wfd_register_lock_route() {
    register_rest_route(
        'wfd/v1',
        '/lock/(?P<id>\d+)',
        array(
            array(
                'methods'             => 'POST',
                'permission_callback' => 'wfd_lock_permission',
                'callback'            => 'wfd_lock_take',
                'args'                => array(
                    'takeover' => array(
                        'type'    => 'boolean',
                        'default' => false,
                    ),
                ),
            ),
            array(
                'methods'             => 'DELETE',
                'permission_callback' => 'wfd_lock_permission',
                'callback'            => 'wfd_lock_release',
            ),
        )
    );
}
add_action( 'rest_api_init', 'wfd_register_lock_route' );
