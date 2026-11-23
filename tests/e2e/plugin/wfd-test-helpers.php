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
    // Posts a test made (wfd_test_seed_blocks).
    $made = get_posts(
        array(
            'post_type'   => 'post',
            'post_status' => 'any',
            'numberposts' => -1,
            'fields'      => 'ids',
            'meta_key'    => '_wfd_test',
        )
    );
    foreach ( $made as $id ) {
        wp_delete_post( $id, true );
    }
    // The site becomes one no agent has used (constraint C27).
    global $wpdb;
    $options = $wpdb->get_col( $wpdb->prepare( "SELECT option_name FROM $wpdb->options WHERE option_name LIKE %s", $wpdb->esc_like( 'wfd_agent_' ) . '%' ) );
    foreach ( $options as $option ) {
        delete_option( $option );
    }
    wp_clear_scheduled_hook( 'wfd_agent_cleanup' );
    delete_option( 'wfd_test_runbook' );
}

// Text a test adds to the runbook through the plugin's filter (AC-CLI-02).
add_filter(
    'wfd_agent_runbook',
    function ( $text ) {
        $more = get_option( 'wfd_test_runbook' );
        return $more ? $text . "\n\n" . $more : $text;
    }
);

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

/**
 * Adds to a board a template that holds a Query Loop showing three posts, a
 * Comment Template, a synced pattern and a Navigation block that points at a
 * menu, and makes the site have exactly three posts (AC-TOOL-24).
 *
 * @param int $board The board.
 * @return array The board's layout and what was made.
 */
function wfd_test_seed_blocks( $board ) {
    $theme  = get_stylesheet();
    $synced = wp_insert_post(
        array(
            'post_type'    => 'wp_block',
            'post_status'  => 'publish',
            'post_title'   => 'Synced card',
            'post_content' => '<!-- wp:group --><div class="wp-block-group"><!-- wp:heading --><h2 class="wp-block-heading">Synced heading</h2><!-- /wp:heading -->'
                . '<!-- wp:paragraph --><p>Synced paragraph.</p><!-- /wp:paragraph --></div><!-- /wp:group -->',
        )
    );
    $menu   = wp_insert_post(
        array(
            'post_type'    => 'wp_navigation',
            'post_status'  => 'publish',
            'post_title'   => 'Test menu',
            'post_content' => '<!-- wp:navigation-link {"label":"Home","url":"/","kind":"custom"} /-->'
                . '<!-- wp:navigation-submenu {"label":"More","url":"#","kind":"custom"} --><!-- wp:navigation-link {"label":"About","url":"/about","kind":"custom"} /--><!-- /wp:navigation-submenu -->'
                . '<!-- wp:navigation-link {"label":"Contact","url":"/contact","kind":"custom"} /-->',
        )
    );
    $have   = count(
        get_posts(
            array(
                'post_type'   => 'post',
                'post_status' => 'publish',
                'numberposts' => -1,
                'fields'      => 'ids',
            )
        )
    );
    for ( $i = $have; $i < 3; $i++ ) {
        $content = '<!-- wp:paragraph --><p>Test post ' . $i . ' first paragraph.</p><!-- /wp:paragraph -->'
            . '<!-- wp:group --><div class="wp-block-group"><!-- wp:heading --><h2 class="wp-block-heading">Inside post ' . $i . '</h2><!-- /wp:heading --></div><!-- /wp:group -->';
        if ( 2 === $i ) {
            $content .= '<!-- wp:block {"ref":' . (int) $synced . '} /-->';
        }
        $id = wp_insert_post(
            array(
                'post_type'    => 'post',
                'post_status'  => 'publish',
                'post_title'   => 'Test post ' . $i,
                'post_content' => $content,
            )
        );
        update_post_meta( $id, '_wfd_test', 1 );
    }
    $content  = '<!-- wp:template-part {"slug":"header","tagName":"header"} /-->'
        . '<!-- wp:group {"tagName":"main","layout":{"type":"constrained"}} --><main class="wp-block-group">'
        . '<!-- wp:navigation {"ref":' . (int) $menu . '} /-->'
        . '<!-- wp:block {"ref":' . (int) $synced . '} /-->'
        . '<!-- wp:query {"queryId":7,"query":{"perPage":3,"pages":0,"offset":0,"postType":"post","order":"desc","orderBy":"date","author":"","search":"","exclude":[],"sticky":"","inherit":false}} --><div class="wp-block-query">'
        . '<!-- wp:post-template -->'
        . '<!-- wp:post-title {"isLink":true} /-->'
        . '<!-- wp:group --><div class="wp-block-group"><!-- wp:post-date /--><!-- wp:post-excerpt /--></div><!-- /wp:group -->'
        . '<!-- wp:post-content /-->'
        . '<!-- /wp:post-template -->'
        . '<!-- wp:query-pagination --><!-- wp:query-pagination-previous /--><!-- wp:query-pagination-next /--><!-- /wp:query-pagination -->'
        . '</div><!-- /wp:query -->'
        . '<!-- wp:comments --><div class="wp-block-comments"><!-- wp:comment-template -->'
        . '<!-- wp:group --><div class="wp-block-group"><!-- wp:comment-author-name /--><!-- wp:comment-date /--></div><!-- /wp:group -->'
        . '<!-- wp:comment-content /-->'
        . '<!-- /wp:comment-template --></div><!-- /wp:comments -->'
        . '<!-- wp:paragraph --><p>After the loops.</p><!-- /wp:paragraph -->'
        . '</main><!-- /wp:group -->';
    $template = wp_insert_post(
        array(
            'post_type'    => 'wp_template',
            'post_status'  => 'publish',
            'post_name'    => 'wfd-test-blocks',
            'post_title'   => 'Test blocks',
            'post_content' => $content,
        )
    );
    wp_set_post_terms( $template, $theme, 'wp_theme' );

    $layout                = json_decode( get_post_field( 'post_content', $board, 'raw' ), true );
    $layout['artboards'][] = array(
        'id'       => wp_generate_uuid4(),
        'kind'     => 'template',
        'entityId' => $theme . '//wfd-test-blocks',
        'device'   => 'desktop',
        'x'        => 6400,
        'y'        => 0,
        'height'   => 2400,
    );
    wp_update_post(
        array(
            'ID'           => $board,
            'post_content' => wp_slash( wp_json_encode( $layout ) ),
        )
    );
    return array(
        'layout' => $layout,
        'synced' => (int) $synced,
        'menu'   => (int) $menu,
    );
}

// A block that sets one of its own attributes a moment after it is first
// drawn, as some blocks do (AC-MARK-08). It is not offered in the inserter.
add_action(
    'enqueue_block_editor_assets',
    function () {
        wp_add_inline_script(
            'wp-blocks',
            "wp.blocks.registerBlockType( 'test/self-setting', { apiVersion: 3, title: 'Self setting', category: 'text', supports: { inserter: false }, attributes: { stamp: { type: 'string', default: '' } }, edit: function ( props ) { wp.element.useEffect( function () { if ( props.attributes.stamp ) { return; } var timer = setTimeout( function () { props.setAttributes( { stamp: 'set' } ); }, 400 ); return function () { clearTimeout( timer ); }; }, [] ); return wp.element.createElement( 'p', wp.blockEditor.useBlockProps(), 'Self setting ' + props.attributes.stamp ); }, save: function () { return null; } } );",
            'after'
        );
        // A block that holds two inner blocks and mounts only one of them:
        // its second child draws no element, so the artboard never meets
        // the settling conditions (AC-TOOL-29).
        wp_add_inline_script(
            'wp-blocks',
            "wp.blocks.registerBlockType( 'test/unmounted', { apiVersion: 3, title: 'Unmounted', category: 'text', parent: [ 'test/half-mounted' ], supports: { inserter: false }, edit: function () { return null; }, save: function () { return null; } } ); wp.blocks.registerBlockType( 'test/half-mounted', { apiVersion: 3, title: 'Half mounted', category: 'design', supports: { inserter: false }, edit: function () { return wp.element.createElement( 'div', wp.blockEditor.useInnerBlocksProps( wp.blockEditor.useBlockProps() ) ); }, save: function () { return wp.element.createElement( 'div', wp.blockEditor.useInnerBlocksProps.save( wp.blockEditor.useBlockProps.save() ) ); } } );",
            'after'
        );
    }
);

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
            '/seed-blocks',
            array(
                'methods'             => 'POST',
                'permission_callback' => function () {
                    return current_user_can( 'manage_options' );
                },
                'callback'            => function ( $request ) {
                    return rest_ensure_response( wfd_test_seed_blocks( (int) $request['board'] ) );
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

        // The agent surface's PHP functions, called in a web request, outside
        // WP-CLI (AC-AGENT-11 to AC-AGENT-14). `run` says which: `relay`,
        // `begin`, `boards`, or `options` for what the relay's options hold.
        register_rest_route(
            'wfd-test/v1',
            '/agent',
            array(
                'methods'             => 'POST',
                'permission_callback' => function () {
                    return current_user_can( 'manage_options' );
                },
                'callback'            => function ( $request ) {
                    switch ( $request['run'] ) {
                        case 'relay':
                            // The body as it was sent, so that an empty input stays an object.
                            $body = json_decode( $request->get_body() );
                            return rest_ensure_response( wfd_agent_relay( array_map( 'get_object_vars', $body->calls ), $request['args'] ) );
                        case 'begin':
                            return rest_ensure_response( wfd_agent_begin( $request['source'] ) );
                        case 'boards':
                            return rest_ensure_response( wfd_agent_boards() );
                        case 'board-new':
                            return rest_ensure_response( wfd_agent_board_new( (string) $request['title'] ) );
                        case 'options':
                            return rest_ensure_response( (object) array_map( 'json_decode', wfd_agent_records( 'wfd_agent_', null ) ) );
                    }
                },
            )
        );
    }
);
