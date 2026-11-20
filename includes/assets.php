<?php
/**
 * Script and style registration shared by the plugin's screens.
 *
 * @package WordPressForDesigners
 */

defined( 'ABSPATH' ) || exit;

/**
 * The URL of the board app for a board.
 *
 * @param int $board_id The board.
 * @return string
 */
function wfd_board_url( $board_id = 0 ) {
    $args = array( 'page' => WFD_BOARD_PAGE );
    if ( $board_id ) {
        $args['board'] = (int) $board_id;
    }
    return add_query_arg( $args, admin_url( 'admin.php' ) );
}

/**
 * Enqueues one built entry point with its style and translations.
 *
 * @param string $entry  The entry name under build/.
 * @param array  $config Data for the app, exposed as window.wfdConfig.
 */
function wfd_enqueue_entry( $entry, $config ) {
    $asset_file = WFD_DIR . 'build/' . $entry . '.asset.php';
    if ( ! file_exists( $asset_file ) ) {
        return;
    }
    $asset  = include $asset_file;
    $handle = 'wfd-' . $entry;

    wp_enqueue_script( $handle, plugins_url( 'build/' . $entry . '.js', WFD_FILE ), $asset['dependencies'], $asset['version'], true );
    wp_set_script_translations( $handle, 'wordpress-for-designers' );
    wp_add_inline_script( $handle, 'window.wfdConfig = ' . wp_json_encode( $config, JSON_HEX_TAG | JSON_UNESCAPED_SLASHES ) . ';', 'before' );

    $style_deps = array( 'wp-components', 'wp-theme' );
    if ( file_exists( WFD_DIR . 'build/style-' . $entry . '.css' ) ) {
        wp_enqueue_style( $handle, plugins_url( 'build/style-' . $entry . '.css', WFD_FILE ), $style_deps, $asset['version'] );
        wp_style_add_data( $handle, 'rtl', 'replace' );
    } else {
        foreach ( $style_deps as $dep ) {
            wp_enqueue_style( $dep );
        }
    }
}

/**
 * Data every screen of the plugin needs.
 *
 * @return array
 */
function wfd_base_config() {
    return array(
        'boardsUrl'   => add_query_arg( 'page', WFD_BOARDS_PAGE, admin_url( 'admin.php' ) ),
        'boardUrl'    => wfd_board_url(),
        'userId'      => get_current_user_id(),
        'isTestBuild' => defined( 'WFD_TEST_BUILD' ) && WFD_TEST_BUILD,
    );
}
