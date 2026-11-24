<?php
/**
 * Plugin Name:       WordPress for Designers
 * Description:       An infinite canvas of this site's pages, templates, template parts and patterns, rendered with real blocks.
 * Version:           0.4.1
 * Requires at least: 7.2
 * Requires PHP:      7.4
 * License:           GPL-2.0-or-later
 * Text Domain:       wordpress-for-designers
 *
 * @package WordPressForDesigners
 */

defined( 'ABSPATH' ) || exit;

define( 'WFD_VERSION', '0.4.1' );
define( 'WFD_FILE', __FILE__ );
define( 'WFD_DIR', plugin_dir_path( __FILE__ ) );
define( 'WFD_CAPABILITY', 'edit_theme_options' );
define( 'WFD_POST_TYPE', 'wfd_board' );
define( 'WFD_BOARDS_PAGE', 'wfd-boards' );
define( 'WFD_ADD_BOARD_PAGE', 'wfd-add-board' );
define( 'WFD_BOARD_PAGE', 'wfd-board' );

require_once WFD_DIR . 'includes/post-type.php';
require_once WFD_DIR . 'includes/assets.php';
require_once WFD_DIR . 'includes/bootstrap.php';
require_once WFD_DIR . 'includes/menu.php';
require_once WFD_DIR . 'includes/board-app.php';
require_once WFD_DIR . 'includes/lock.php';
require_once WFD_DIR . 'includes/preview.php';
require_once WFD_DIR . 'includes/agent.php';
