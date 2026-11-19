<?php
/**
 * Uninstall: deletes every board. Site content is untouched.
 *
 * @package WordPressForDesigners
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

$wfd_boards = get_posts(
    array(
        'post_type'   => 'wfd_board',
        'post_status' => 'any, trash, auto-draft',
        'numberposts' => -1,
        'fields'      => 'ids',
    )
);

foreach ( $wfd_boards as $wfd_board ) {
    wp_delete_post( $wfd_board, true );
}
