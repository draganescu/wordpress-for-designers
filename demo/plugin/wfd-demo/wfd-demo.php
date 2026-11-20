<?php
/**
 * Plugin Name: WordPress for Designers demo content
 * Description: Morrow Coffee Roasters, the demo site of WordPress for Designers: a coffee post type and a command that seeds pages, posts, coffees, patterns, media and boards. Not part of the plugin.
 * Version: 1.0.0
 * Requires at least: 7.2
 * Requires PHP: 7.4
 * License: GPL-2.0-or-later
 *
 * @package wfd-demo
 */

defined( 'ABSPATH' ) || exit;

define( 'WFD_DEMO_DIR', __DIR__ );

// The address every content file uses for the site and its media. The seed
// replaces it with the address of the site being seeded.
define( 'WFD_DEMO_HOST', 'https://morrow.test/' );

// A synced pattern is referred to in content as this number plus its position
// in the manifest, starting at 1.
define( 'WFD_DEMO_REF', 900000 );

add_action(
    'init',
    function () {
        register_post_type(
            'coffee',
            array(
                'labels'       => array(
                    'name'          => 'Coffees',
                    'singular_name' => 'Coffee',
                    'add_new_item'  => 'Add coffee',
                    'edit_item'     => 'Edit coffee',
                ),
                'public'       => true,
                'has_archive'  => 'coffees',
                'rewrite'      => array( 'slug' => 'coffees' ),
                'menu_icon'    => 'dashicons-coffee',
                'show_in_rest' => true,
                'supports'     => array( 'title', 'editor', 'excerpt', 'thumbnail', 'custom-fields' ),
            )
        );

        foreach ( array( 'morrow_origin', 'morrow_process', 'morrow_notes', 'morrow_price', 'morrow_roast' ) as $key ) {
            register_post_meta(
                'coffee',
                $key,
                array(
                    'type'         => 'string',
                    'single'       => true,
                    'show_in_rest' => true,
                    'default'      => '',
                )
            );
        }
    }
);

if ( defined( 'WP_CLI' ) && WP_CLI ) {
    require_once __DIR__ . '/seed.php';
    WP_CLI::add_command( 'wfd-demo', 'WFD_Demo_Command' );
}
