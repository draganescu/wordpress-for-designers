<?php
/**
 * The Designer menu and the Boards screen.
 *
 * @package WordPressForDesigners
 */

defined( 'ABSPATH' ) || exit;

/**
 * Adds "Designer" with "Boards" and "Add board".
 */
function wfd_admin_menu() {
    add_menu_page(
        __( 'Boards', 'wordpress-for-designers' ),
        __( 'Designer', 'wordpress-for-designers' ),
        WFD_CAPABILITY,
        WFD_BOARDS_PAGE,
        'wfd_render_boards_screen',
        'dashicons-art',
        59
    );
    add_submenu_page(
        WFD_BOARDS_PAGE,
        __( 'Boards', 'wordpress-for-designers' ),
        __( 'Boards', 'wordpress-for-designers' ),
        WFD_CAPABILITY,
        WFD_BOARDS_PAGE,
        'wfd_render_boards_screen'
    );
    add_submenu_page(
        WFD_BOARDS_PAGE,
        __( 'Add board', 'wordpress-for-designers' ),
        __( 'Add board', 'wordpress-for-designers' ),
        WFD_CAPABILITY,
        WFD_ADD_BOARD_PAGE,
        'wfd_render_boards_screen'
    );
}
add_action( 'admin_menu', 'wfd_admin_menu' );

/**
 * Prints the mount point of the Boards screen.
 */
function wfd_render_boards_screen() {
    echo '<div id="wfd-boards-root"></div>';
}

/**
 * Loads the Boards screen app on its two pages.
 *
 * @param string $hook The current admin page.
 */
function wfd_enqueue_boards_screen( $hook ) {
    $pages = array(
        'toplevel_page_' . WFD_BOARDS_PAGE     => false,
        'designer_page_' . WFD_ADD_BOARD_PAGE => true,
    );
    $screen = get_current_screen();
    $create = null;
    if ( isset( $pages[ $hook ] ) ) {
        $create = $pages[ $hook ];
    } elseif ( $screen && false !== strpos( $screen->id, WFD_ADD_BOARD_PAGE ) ) {
        $create = true;
    }
    if ( null === $create ) {
        return;
    }
    wfd_enqueue_entry(
        'boards',
        array_merge(
            wfd_base_config(),
            array( 'createOnLoad' => $create )
        )
    );
}
add_action( 'admin_enqueue_scripts', 'wfd_enqueue_boards_screen' );
