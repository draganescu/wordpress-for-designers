<?php
/**
 * The board app page: a hidden admin page printed without wp-admin's menu or
 * toolbar.
 *
 * @package WordPressForDesigners
 */

defined( 'ABSPATH' ) || exit;

/**
 * Registers the page without a menu entry.
 */
function wfd_register_board_page() {
    add_submenu_page( '', __( 'Board', 'wordpress-for-designers' ), '', WFD_CAPABILITY, WFD_BOARD_PAGE, '__return_null' );
}
add_action( 'admin_menu', 'wfd_register_board_page' );

/**
 * Prints the app and stops before wp-admin draws its own chrome.
 */
function wfd_print_board_page() {
    if ( ! current_user_can( WFD_CAPABILITY ) ) {
        wp_die( esc_html__( 'Sorry, you are not allowed to access this page.', 'wordpress-for-designers' ), 403 );
    }

    $board_id = isset( $_GET['board'] ) ? absint( $_GET['board'] ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
    $board    = $board_id ? get_post( $board_id ) : null;
    if ( ! $board || WFD_POST_TYPE !== $board->post_type || 'publish' !== $board->post_status ) {
        wp_die( esc_html__( 'This board does not exist.', 'wordpress-for-designers' ), 404 );
    }

    $settings = wfd_bootstrap_editor();

    wfd_enqueue_entry(
        'board',
        array_merge(
            wfd_base_config(),
            array(
                'boardId'        => $board->ID,
                'editorSettings' => $settings,
                'theme'          => get_stylesheet(),
                'homeUrl'        => home_url( '/' ),
                'preview'        => wfd_preview_config(),
            )
        )
    );

    add_filter(
        'admin_body_class',
        function ( $classes ) {
            return $classes . ' wfd-board-page';
        }
    );

    iframe_header( esc_html( $board->post_title ) );
    echo '<div id="wfd-board-root"></div>';
    iframe_footer();
    exit;
}
add_action( 'load-admin_page_' . WFD_BOARD_PAGE, 'wfd_print_board_page' );
