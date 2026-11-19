<?php
/**
 * Plugin Name: WFD Test Helpers
 * Description: Test-only helpers for the WordPress for Designers end-to-end tests. Never ship.
 *
 * @package WordPressForDesigners
 */

defined( 'ABSPATH' ) || exit;

if ( ! defined( 'WFD_TEST_BUILD' ) ) {
    define( 'WFD_TEST_BUILD', true );
}

/**
 * Makes sure the users the tests log in as exist.
 */
function wfd_test_users() {
    $users = array(
        'wfd_editor' => 'editor',
        'wfd_admin2' => 'administrator',
    );
    $ids   = array();
    foreach ( $users as $login => $role ) {
        $user = get_user_by( 'login', $login );
        if ( ! $user ) {
            $id = wp_insert_user(
                array(
                    'user_login'   => $login,
                    'user_pass'    => 'password',
                    'user_email'   => $login . '@example.test',
                    'role'         => $role,
                    'display_name' => 'wfd_admin2' === $login ? 'Second Admin' : 'An Editor',
                )
            );
        } else {
            $id = $user->ID;
        }
        $ids[ $login ] = (int) $id;
    }
    return $ids;
}

/**
 * Deletes everything the tests create.
 */
function wfd_test_wipe() {
    $types = array( 'wfd_board', 'page', 'wp_block', 'wp_template', 'wp_template_part', 'wp_global_styles', 'attachment', 'wp_navigation' );
    $posts = get_posts(
        array(
            'post_type'   => $types,
            'post_status' => 'any, trash, auto-draft',
            'numberposts' => -1,
            'fields'      => 'ids',
        )
    );
    foreach ( $posts as $id ) {
        wp_delete_post( $id, true );
    }
}

/**
 * Block markup used by the fixture pages and patterns.
 *
 * @param string $text Text to show.
 * @return string
 */
function wfd_test_content( $text ) {
    return '<!-- wp:heading --><h2 class="wp-block-heading">' . esc_html( $text ) . '</h2><!-- /wp:heading -->'
        . "\n\n" . '<!-- wp:paragraph {"backgroundColor":"accent-1","textColor":"contrast"} --><p class="has-contrast-color has-accent-1-background-color has-text-color has-background">' . esc_html( $text ) . ' paragraph.</p><!-- /wp:paragraph -->';
}

/**
 * Seeds the fixture described in spec/architecture.md.
 *
 * @param int $extra Number of extra page artboards, for tier tests.
 * @return array
 */
function wfd_test_seed( $extra = 0 ) {
    $about  = wp_insert_post(
        array(
            'post_type'    => 'page',
            'post_status'  => 'publish',
            'post_title'   => 'About',
            'post_content' => wfd_test_content( 'About' ),
        )
    );
    $member = wp_insert_post(
        array(
            'post_type'    => 'page',
            'post_status'  => 'draft',
            'post_title'   => 'Become a member',
            'post_content' => wfd_test_content( 'Become a member' ),
        )
    );
    $hero   = wp_insert_post(
        array(
            'post_type'    => 'wp_block',
            'post_status'  => 'publish',
            'post_title'   => 'Hero',
            'post_content' => wfd_test_content( 'Hero' ),
        )
    );
    $sign   = wp_insert_post(
        array(
            'post_type'    => 'wp_block',
            'post_status'  => 'publish',
            'post_title'   => 'Sign-off',
            'post_content' => '<!-- wp:paragraph --><p>Until Sunday.</p><!-- /wp:paragraph -->',
        )
    );
    $theme  = get_stylesheet();

    // A customised Header part with plain text the tests can edit.
    $header = wp_insert_post(
        array(
            'post_type'    => 'wp_template_part',
            'post_status'  => 'publish',
            'post_name'    => 'header',
            'post_title'   => 'Header',
            'post_content' => '<!-- wp:group {"layout":{"type":"constrained"}} --><div class="wp-block-group"><!-- wp:paragraph --><p>Fixture header text</p><!-- /wp:paragraph --></div><!-- /wp:group -->',
        )
    );
    wp_set_post_terms( $header, $theme, 'wp_theme' );
    wp_set_post_terms( $header, 'header', 'wp_template_part_area' );

    $specs = array(
        array( 'template', $theme . '//index', 'desktop', 0, 0, 2300 ),
        array( 'template-part', $theme . '//header', 'desktop', 1580, 0, 480 ),
        array( 'template-part', $theme . '//header', 'mobile', 1580, 800, 340 ),
        array( 'pattern', $hero, 'desktop', 1580, 1480, 750 ),
        array( 'pattern', $sign, 'desktop', 1580, 2560, 460 ),
        array( 'page', $about, 'desktop', 3140, 800, 2200 ),
        array( 'template', $theme . '//single', 'desktop', 0, 2680, 2400 ),
        array( 'template-part', $theme . '//footer', 'desktop', 3140, 0, 480 ),
        array( 'page', $member, 'desktop', 4700, 800, 2200 ),
    );
    for ( $i = 0; $i < $extra; $i++ ) {
        $id      = wp_insert_post(
            array(
                'post_type'    => 'page',
                'post_status'  => 'publish',
                'post_title'   => 'Extra ' . ( $i + 1 ),
                'post_content' => wfd_test_content( 'Extra ' . ( $i + 1 ) ),
            )
        );
        $specs[] = array( 'page', $id, 'mobile', 6400 + ( $i % 7 ) * 480, intdiv( $i, 7 ) * 1000, 800 );
    }

    $artboards = array();
    foreach ( $specs as $spec ) {
        $artboards[] = array(
            'id'       => wp_generate_uuid4(),
            'kind'     => $spec[0],
            'entityId' => $spec[1],
            'device'   => $spec[2],
            'x'        => $spec[3],
            'y'        => $spec[4],
            'height'   => $spec[5],
        );
    }
    $layout = array(
        'version'   => 1,
        'artboards' => $artboards,
    );
    $board  = wp_insert_post(
        array(
            'post_type'    => 'wfd_board',
            'post_status'  => 'publish',
            'post_title'   => 'Fixture board',
            'post_content' => wp_slash( wp_json_encode( $layout ) ),
        )
    );

    return array(
        'boardId' => (int) $board,
        'layout'  => $layout,
        'pages'   => array(
            'about'  => (int) $about,
            'member' => (int) $member,
        ),
        'patterns' => array(
            'hero' => (int) $hero,
            'sign' => (int) $sign,
        ),
        'theme'   => $theme,
    );
}

// A style sheet WordPress loads into the canvas itself (AC-DEV-05).
add_action(
    'enqueue_block_assets',
    function () {
        wp_enqueue_style( 'test-vh-sheet', plugins_url( 'test-vh-sheet.css', __FILE__ ), array(), '1' );
    }
);

add_action(
    'rest_api_init',
    function () {
        register_rest_route(
            'wfd-test/v1',
            '/reset',
            array(
                'methods'             => 'POST',
                'permission_callback' => function () {
                    return current_user_can( 'manage_options' );
                },
                'callback'            => function ( $request ) {
                    wfd_test_wipe();
                    $result = array( 'users' => wfd_test_users() );
                    if ( $request['seed'] ) {
                        $result = array_merge( $result, wfd_test_seed( (int) $request['extra'] ) );
                    }
                    return rest_ensure_response( $result );
                },
            )
        );

        register_rest_route(
            'wfd-test/v1',
            '/lock',
            array(
                'methods'             => 'POST',
                'permission_callback' => function () {
                    return current_user_can( 'manage_options' );
                },
                'callback'            => function ( $request ) {
                    $id = (int) $request['id'];
                    if ( null !== $request['user'] ) {
                        if ( (int) $request['user'] ) {
                            update_post_meta( $id, '_edit_lock', time() . ':' . (int) $request['user'] );
                        } else {
                            delete_post_meta( $id, '_edit_lock' );
                        }
                    }
                    $lock = explode( ':', (string) get_post_meta( $id, '_edit_lock', true ) );
                    return rest_ensure_response(
                        array( 'holder' => isset( $lock[1] ) ? (int) $lock[1] : 0 )
                    );
                },
            )
        );

        register_rest_route(
            'wfd-test/v1',
            '/board-content',
            array(
                'methods'             => 'POST',
                'permission_callback' => function () {
                    return current_user_can( 'manage_options' );
                },
                'callback'            => function ( $request ) {
                    return rest_ensure_response(
                        array( 'content' => get_post_field( 'post_content', (int) $request['id'], 'raw' ) )
                    );
                },
            )
        );
    }
);
