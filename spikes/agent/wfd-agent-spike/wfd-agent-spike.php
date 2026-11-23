<?php
/**
 * Plugin Name: WFD Agent Spikes (throwaway)
 * Description: Milestone 13 proofs for the agent surface. Not part of the plugin.
 *
 * Spike (b): a call written to an option by a WP-CLI command, found by an
 * open board page that polls, answered, and printed by the command.
 * Spike (d): serves a build of the board's script that has one extra chunk.
 *
 * PHP used for the relay is limited to what spec/api-allowlist.md lists for
 * the agent surface: WP_CLI::add_command, add_option / get_option /
 * update_option / delete_option, $wpdb with prepare and esc_like,
 * register_rest_route, rest_ensure_response, wp_generate_uuid4.
 */

defined( 'ABSPATH' ) || exit;

const WFD_SPIKE_CALL = 'wfd_spike_call_';

/**
 * Reads an option row straight from the database, with no cache.
 *
 * @param string $name The option name.
 * @return array|null
 */
function wfd_spike_read( $name ) {
    global $wpdb;
    $value = $wpdb->get_var( $wpdb->prepare( "SELECT option_value FROM $wpdb->options WHERE option_name = %s", $name ) );
    return null === $value ? null : json_decode( $value, true );
}

/**
 * The names of every call option, oldest first.
 *
 * @return string[]
 */
function wfd_spike_call_names() {
    global $wpdb;
    return $wpdb->get_col(
        $wpdb->prepare(
            "SELECT option_name FROM $wpdb->options WHERE option_name LIKE %s ORDER BY option_id ASC",
            $wpdb->esc_like( WFD_SPIKE_CALL ) . '%'
        )
    );
}

add_action(
    'rest_api_init',
    function () {
        $can = function () {
            return current_user_can( 'edit_theme_options' );
        };
        register_rest_route(
            'wfd-spike/v1',
            '/poll',
            array(
                'methods'             => 'POST',
                'permission_callback' => $can,
                'callback'            => function ( $request ) {
                    $board = (int) $request['board'];
                    foreach ( wfd_spike_call_names() as $name ) {
                        $call = wfd_spike_read( $name );
                        if ( $call && 'queued' === $call['status'] && $board === (int) $call['board'] ) {
                            $call['status'] = 'running';
                            update_option( $name, wp_json_encode( $call ), false );
                            return rest_ensure_response(
                                array(
                                    'call' => array(
                                        'id'   => $call['id'],
                                        'tool' => $call['tool'],
                                    ),
                                )
                            );
                        }
                    }
                    return rest_ensure_response( array( 'call' => null ) );
                },
            )
        );
        register_rest_route(
            'wfd-spike/v1',
            '/result',
            array(
                'methods'             => 'POST',
                'permission_callback' => $can,
                'callback'            => function ( $request ) {
                    $name = WFD_SPIKE_CALL . $request['id'];
                    $call = wfd_spike_read( $name );
                    if ( ! $call || 'running' !== $call['status'] ) {
                        return rest_ensure_response( array( 'stored' => false ) );
                    }
                    $call['status'] = 'done';
                    $call['result'] = $request['result'];
                    update_option( $name, wp_json_encode( $call ), false );
                    return rest_ensure_response( array( 'stored' => true ) );
                },
            )
        );
    }
);

if ( defined( 'WP_CLI' ) && WP_CLI ) {
    /**
     * Enqueues one call for a board and waits for its answer.
     *
     * ## OPTIONS
     *
     * <tool>
     * : A name for the call.
     *
     * --board=<id>
     * : The board.
     *
     * [--timeout=<seconds>]
     * : How long to wait. Default 10.
     *
     * [--read=<how>]
     * : "db" reads the record with $wpdb each time (default); "option" reads it with get_option.
     */
    WP_CLI::add_command(
        'wfd-spike call',
        function ( $args, $assoc ) {
            $start   = microtime( true );
            $timeout = isset( $assoc['timeout'] ) ? (float) $assoc['timeout'] : 10;
            $read    = isset( $assoc['read'] ) ? $assoc['read'] : 'db';
            $id      = wp_generate_uuid4();
            $name    = WFD_SPIKE_CALL . $id;
            add_option(
                $name,
                wp_json_encode(
                    array(
                        'id'     => $id,
                        'board'  => (int) $assoc['board'],
                        'tool'   => $args[0],
                        'status' => 'queued',
                    )
                ),
                '',
                false
            );
            $queued = microtime( true );
            $polls  = 0;
            $call   = null;
            while ( microtime( true ) - $queued < $timeout ) {
                usleep( 200000 );
                ++$polls;
                $call = 'option' === $read ? json_decode( get_option( $name ), true ) : wfd_spike_read( $name );
                if ( $call && 'done' === $call['status'] ) {
                    break;
                }
            }
            $fresh = wfd_spike_read( $name );
            delete_option( $name );
            $done = $call && 'done' === $call['status'];
            WP_CLI::line(
                wp_json_encode(
                    array(
                        'ok'            => $done,
                        'result'        => $done ? $call['result'] : null,
                        'read'          => $read,
                        'statusSeen'    => $call ? $call['status'] : null,
                        'statusInDb'    => $fresh ? $fresh['status'] : null,
                        'polls'         => $polls,
                        'bootMs'        => (int) round( ( $start - $_SERVER['REQUEST_TIME_FLOAT'] ) * 1000 ),
                        'waitMs'        => (int) round( ( microtime( true ) - $queued ) * 1000 ),
                        'left'          => count( wfd_spike_call_names() ),
                    )
                )
            );
            if ( ! $done ) {
                WP_CLI::halt( 1 );
            }
        }
    );
}

/*
 * Spike (d): with ?wfd_spike_chunk=1 the board page loads the board's script
 * from chunk-build/, which is the same entry built with one dynamic import().
 */
add_action(
    'admin_enqueue_scripts',
    function () {
        $asset_file = __DIR__ . '/chunk-build/board.asset.php';
        if ( empty( $_GET['wfd_spike_chunk'] ) || ! file_exists( $asset_file ) || ! wp_script_is( 'wfd-board', 'registered' ) ) {
            return;
        }
        $asset        = include $asset_file;
        $script       = wp_scripts()->registered['wfd-board'];
        $script->src  = plugins_url( 'chunk-build/board.js', __FILE__ );
        $script->deps = $asset['dependencies'];
        $script->ver  = $asset['version'];
    },
    100
);

/*
 * Spike (a), second run: the cases the fixture lacks. Run after
 * wfd-test/v1/reset. Makes the site show exactly three posts, and adds to the
 * board one more template that holds a Query Loop showing three posts, a
 * synced pattern and a Navigation block that points at a menu.
 */
add_action(
    'rest_api_init',
    function () {
        register_rest_route(
            'wfd-spike/v1',
            '/seed-a2',
            array(
                'methods'             => 'POST',
                'permission_callback' => function () {
                    return current_user_can( 'manage_options' );
                },
                'callback'            => function ( $request ) {
                    $board = (int) $request['board'];
                    $theme = get_stylesheet();

                    // Posts are not wiped by the reset: drop the last run's.
                    $old = get_posts(
                        array(
                            'post_type'   => 'post',
                            'post_status' => 'any',
                            'numberposts' => -1,
                            'fields'      => 'ids',
                            'meta_key'    => '_wfd_spike',
                        )
                    );
                    foreach ( $old as $id ) {
                        wp_delete_post( $id, true );
                    }

                    $synced = wp_insert_post(
                        array(
                            'post_type'    => 'wp_block',
                            'post_status'  => 'publish',
                            'post_title'   => 'Spike synced',
                            'post_content' => '<!-- wp:group --><div class="wp-block-group"><!-- wp:heading --><h2 class="wp-block-heading">Synced heading</h2><!-- /wp:heading -->'
                                . '<!-- wp:paragraph --><p>Synced paragraph.</p><!-- /wp:paragraph --></div><!-- /wp:group -->',
                        )
                    );
                    $menu   = wp_insert_post(
                        array(
                            'post_type'    => 'wp_navigation',
                            'post_status'  => 'publish',
                            'post_title'   => 'Spike menu',
                            'post_content' => '<!-- wp:navigation-link {"label":"Home","url":"/","kind":"custom"} /-->'
                                . '<!-- wp:navigation-submenu {"label":"More","url":"#","kind":"custom"} --><!-- wp:navigation-link {"label":"About","url":"/about","kind":"custom"} /--><!-- /wp:navigation-submenu -->'
                                . '<!-- wp:navigation-link {"label":"Contact","url":"/contact","kind":"custom"} /-->',
                        )
                    );

                    // Exactly three published posts on the site.
                    $have  = count(
                        get_posts(
                            array(
                                'post_type'   => 'post',
                                'post_status' => 'publish',
                                'numberposts' => -1,
                                'fields'      => 'ids',
                            )
                        )
                    );
                    $posts = array();
                    for ( $i = $have; $i < 3; $i++ ) {
                        $content = '<!-- wp:paragraph --><p>Spike post ' . $i . ' first paragraph.</p><!-- /wp:paragraph -->'
                            . '<!-- wp:group --><div class="wp-block-group"><!-- wp:heading --><h2 class="wp-block-heading">Inside post ' . $i . '</h2><!-- /wp:heading -->'
                            . '<!-- wp:paragraph --><p>Nested paragraph.</p><!-- /wp:paragraph --></div><!-- /wp:group -->';
                        if ( 2 === $i ) {
                            // A synced pattern inside a post drawn read-only.
                            $content .= '<!-- wp:block {"ref":' . (int) $synced . '} /-->';
                        }
                        $id = wp_insert_post(
                            array(
                                'post_type'    => 'post',
                                'post_status'  => 'publish',
                                'post_title'   => 'Spike post ' . $i,
                                'post_content' => $content,
                            )
                        );
                        update_post_meta( $id, '_wfd_spike', 1 );
                        $posts[] = (int) $id;
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
                        . '<!-- wp:paragraph --><p>After the loop.</p><!-- /wp:paragraph -->'
                        . '</main><!-- /wp:group -->';
                    $template = wp_insert_post(
                        array(
                            'post_type'    => 'wp_template',
                            'post_status'  => 'publish',
                            'post_name'    => 'wfd-spike-a',
                            'post_title'   => 'Spike A',
                            'post_content' => $content,
                        )
                    );
                    wp_set_post_terms( $template, $theme, 'wp_theme' );

                    $layout                = json_decode( get_post_field( 'post_content', $board, 'raw' ), true );
                    $layout['artboards'][] = array(
                        'id'       => wp_generate_uuid4(),
                        'kind'     => 'template',
                        'entityId' => $theme . '//wfd-spike-a',
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
                    return rest_ensure_response(
                        array(
                            'layout'      => $layout,
                            'postsBefore' => $have,
                            'postsAdded'  => $posts,
                            'synced'      => (int) $synced,
                            'menu'        => (int) $menu,
                            'template'    => (int) $template,
                        )
                    );
                },
            )
        );
    }
);
