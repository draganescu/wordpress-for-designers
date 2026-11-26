<?php
/**
 * Uninstall: deletes every board, the unsaved changes kept for browsers
 * (D57), and the agent relay's options and cron event (D69). Site content is
 * untouched.
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

// The agent relay: when a way in was last used, and each way in by its
// label, every listener and call record, and the cleanup event
// (includes/agent.php).
$wfd_agent_options = $GLOBALS['wpdb']->get_col(
    $GLOBALS['wpdb']->prepare(
        "SELECT option_name FROM {$GLOBALS['wpdb']->options} WHERE option_name LIKE %s",
        $GLOBALS['wpdb']->esc_like( 'wfd_agent_' ) . '%'
    )
);
foreach ( $wfd_agent_options as $wfd_agent_option ) {
    delete_option( $wfd_agent_option );
}
wp_clear_scheduled_hook( 'wfd_agent_cleanup' );
