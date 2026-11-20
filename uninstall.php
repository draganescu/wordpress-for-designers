<?php
/**
 * Uninstall: deletes every board, and the unsaved changes kept for browsers
 * (D57). Site content is untouched.
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

// Every user's kept changes, on this site (includes/preview.php).
delete_metadata( 'user', 0, $GLOBALS['wpdb']->get_blog_prefix() . 'wfd_preview', '', true );
