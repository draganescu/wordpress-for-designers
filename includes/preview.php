<?php
/**
 * The preview layer (D57): the unsaved changes of each open board page, kept
 * per user and site, put in place of the saved content on front-end pages
 * asked for with a wfd_preview argument that holds a nonce of that user and
 * names the board page.
 *
 * @package WordPressForDesigners
 */

defined( 'ABSPATH' ) || exit;

define( 'WFD_PREVIEW_META', 'wfd_preview' );
define( 'WFD_PREVIEW_ARG', 'wfd_preview' );

/**
 * How long a board page's changes are kept after it last sent them. An open
 * board sends them again well inside this time (OQ-38).
 */
define( 'WFD_PREVIEW_LIFETIME', HOUR_IN_SECONDS );

/**
 * The value the preview argument must have for the current user: a nonce,
 * a dot, and the session, a UUID that names one open board page.
 *
 * @param string|null $session The session, or null to start one.
 * @return string
 */
function wfd_preview_value( $session = null ) {
    return wp_create_nonce( WFD_PREVIEW_ARG ) . '.' . ( $session ?? wp_generate_uuid4() );
}

/**
 * The session a preview value names.
 *
 * @param mixed $value The value.
 * @return string|null Null when the value names none.
 */
function wfd_preview_session( $value ) {
    $parts = is_string( $value ) ? explode( '.', $value, 2 ) : array();
    return isset( $parts[1] ) && wp_is_uuid( $parts[1], 4 ) ? $parts[1] : null;
}

/**
 * The changes kept for a user on this site, by session, without the ones
 * whose time has passed.
 *
 * @param int $user_id The user.
 * @return array Each with `time` and `changes`.
 */
function wfd_preview_records( $user_id ) {
    $records = get_user_option( WFD_PREVIEW_META, $user_id );
    return array_filter(
        is_array( $records ) ? $records : array(),
        function ( $record ) {
            return is_array( $record ) && isset( $record['time'], $record['changes'] ) && time() - $record['time'] < WFD_PREVIEW_LIFETIME;
        }
    );
}

/**
 * Registers the preview route.
 */
function wfd_register_preview_route() {
    register_rest_route(
        'wfd/v1',
        '/preview',
        array(
            'methods'             => 'POST',
            'callback'            => 'wfd_preview_keep',
            'permission_callback' => function () {
                return current_user_can( WFD_CAPABILITY );
            },
        )
    );
}
add_action( 'rest_api_init', 'wfd_register_preview_route' );

/**
 * A string from the request, made safe for a user who may not post
 * unfiltered HTML.
 *
 * @param mixed $value The value.
 * @return string|null Null when the value is not a string.
 */
function wfd_preview_text( $value ) {
    if ( ! is_string( $value ) ) {
        return null;
    }
    return current_user_can( 'unfiltered_html' ) ? $value : wp_kses_post( $value );
}

/**
 * Keeps a board page's unsaved changes for the current user, or removes them
 * when there are none.
 *
 * @param WP_REST_Request $request The request.
 * @return WP_REST_Response|WP_Error
 */
function wfd_preview_keep( $request ) {
    $user_id = get_current_user_id();
    $session = wfd_preview_session( $request['preview'] );
    if ( null === $session ) {
        return new WP_Error( 'wfd_preview_session', __( 'The preview value names no session.', 'wordpress-for-designers' ), array( 'status' => 400 ) );
    }
    $changes = array(
        'posts'     => array(),
        'templates' => array(),
        'styles'    => null,
        'site'      => array(),
    );

    foreach ( (array) $request['posts'] as $id => $post ) {
        if ( ! is_array( $post ) || ! absint( $id ) ) {
            continue;
        }
        $kept = array();
        foreach ( array( 'title', 'content', 'template' ) as $field ) {
            if ( array_key_exists( $field, $post ) ) {
                $value = 'template' === $field
                    ? ( is_string( $post[ $field ] ) ? sanitize_file_name( $post[ $field ] ) : null )
                    : wfd_preview_text( $post[ $field ] );
                if ( null !== $value ) {
                    $kept[ $field ] = $value;
                }
            }
        }
        if ( $kept ) {
            $changes['posts'][ absint( $id ) ] = $kept;
        }
    }

    foreach ( (array) $request['templates'] as $id => $template ) {
        if ( ! is_array( $template ) || ! is_string( $id ) || ! isset( $template['slug'], $template['postType'] ) ) {
            continue;
        }
        if ( ! in_array( $template['postType'], array( 'wp_template', 'wp_template_part' ), true ) ) {
            continue;
        }
        $changes['templates'][ $id ] = array(
            'postType' => $template['postType'],
            'slug'     => sanitize_title( $template['slug'] ),
            'title'    => (string) wfd_preview_text( $template['title'] ?? '' ),
            'content'  => (string) wfd_preview_text( $template['content'] ?? '' ),
            'area'     => sanitize_key( $template['area'] ?? '' ),
        );
    }

    if ( is_array( $request['styles'] ) ) {
        $changes['styles'] = array(
            'styles'   => is_array( $request['styles']['styles'] ?? null ) ? $request['styles']['styles'] : array(),
            'settings' => is_array( $request['styles']['settings'] ?? null ) ? $request['styles']['settings'] : array(),
        );
    }

    if ( is_array( $request['site'] ) ) {
        foreach ( array( 'title', 'description' ) as $field ) {
            if ( isset( $request['site'][ $field ] ) && is_string( $request['site'][ $field ] ) ) {
                $changes['site'][ $field ] = sanitize_text_field( $request['site'][ $field ] );
            }
        }
        if ( isset( $request['site']['site_logo'] ) ) {
            $changes['site']['site_logo'] = absint( $request['site']['site_logo'] );
        }
    }

    $is_empty = ! $changes['posts'] && ! $changes['templates'] && null === $changes['styles'] && ! $changes['site'];
    $records  = wfd_preview_records( $user_id );
    // Whether this session's changes were kept until now. When a board page
    // sends the same changes again and they were not, their time had passed
    // or another page's send was written over them.
    $was_held = isset( $records[ $session ] );
    unset( $records[ $session ] );
    if ( ! $is_empty ) {
        $records[ $session ] = array(
            'time'    => time(),
            'changes' => $changes,
        );
    }
    if ( $records ) {
        update_user_option( $user_id, WFD_PREVIEW_META, wp_slash( $records ) );
    } else {
        delete_user_option( $user_id, WFD_PREVIEW_META );
    }
    return rest_ensure_response(
        array(
            'kept'    => ! $is_empty,
            'held'    => $was_held,
            // A nonce lasts a day at most; the board takes a new one with each send.
            'preview' => wfd_preview_value( $session ),
        )
    );
}

/**
 * The kept changes for this request, or null when it is not a preview: a
 * front-end request, never one to the REST API, whose preview argument holds
 * a nonce of a user who may open the plugin and names a session of theirs.
 *
 * @param WP $wp The request, parsed.
 * @return array|null
 */
function wfd_preview_changes( $wp ) {
    if ( is_admin() || ! empty( $wp->query_vars['rest_route'] ) || ! isset( $_GET[ WFD_PREVIEW_ARG ] ) ) {
        return null;
    }
    $value   = sanitize_text_field( wp_unslash( $_GET[ WFD_PREVIEW_ARG ] ) );
    $session = wfd_preview_session( $value );
    if ( null === $session || ! wp_verify_nonce( strtok( $value, '.' ), WFD_PREVIEW_ARG ) || ! current_user_can( WFD_CAPABILITY ) ) {
        return null;
    }
    $records = wfd_preview_records( get_current_user_id() );
    return $records[ $session ]['changes'] ?? null;
}

/**
 * A block template object for a kept template or part that has no saved
 * record and no theme file.
 *
 * @param string $id       The template id, theme//slug.
 * @param array  $template The kept template.
 * @return WP_Block_Template
 */
function wfd_preview_new_template( $id, $template ) {
    $object                 = new WP_Block_Template();
    $object->id             = $id;
    $object->theme          = get_stylesheet();
    $object->slug           = $template['slug'];
    $object->type           = $template['postType'];
    $object->title          = $template['title'];
    $object->content        = $template['content'];
    $object->source         = 'custom';
    $object->status         = 'publish';
    $object->has_theme_file = false;
    $object->is_custom      = true;
    if ( 'wp_template_part' === $template['postType'] ) {
        $object->area = $template['area'] ? $template['area'] : WP_TEMPLATE_PART_AREA_UNCATEGORIZED;
    }
    return $object;
}

/**
 * Puts the kept changes in place, for a preview request.
 *
 * @param WP $wp The request, parsed.
 */
function wfd_preview_hooks( $wp ) {
    $changes = wfd_preview_changes( $wp );
    if ( null === $changes ) {
        return;
    }
    $posts     = $changes['posts'] ?? array();
    $templates = $changes['templates'] ?? array();

    // Never cache a page drawn with someone's unsaved changes.
    add_action( 'send_headers', 'nocache_headers' );

    // Posts found by queries: the page itself, and template and part posts.
    add_filter(
        'posts_results',
        function ( $results ) use ( $posts, $templates ) {
            foreach ( $results as $post ) {
                if ( ! $post instanceof WP_Post && ! is_object( $post ) ) {
                    continue;
                }
                if ( isset( $posts[ $post->ID ] ) ) {
                    $kept = $posts[ $post->ID ];
                    if ( isset( $kept['title'] ) ) {
                        $post->post_title = $kept['title'];
                    }
                    if ( isset( $kept['content'] ) ) {
                        $post->post_content = $kept['content'];
                    }
                }
                if ( in_array( $post->post_type, array( 'wp_template', 'wp_template_part' ), true ) ) {
                    $id = get_stylesheet() . '//' . $post->post_name;
                    if ( isset( $templates[ $id ] ) && $templates[ $id ]['postType'] === $post->post_type ) {
                        $post->post_content = $templates[ $id ]['content'];
                        $post->post_title   = $templates[ $id ]['title'];
                    }
                }
            }
            return $results;
        }
    );

    // A page's template, changed from the right panel (D35).
    add_filter(
        'get_post_metadata',
        function ( $value, $object_id, $meta_key, $single ) use ( $posts ) {
            if ( '_wp_page_template' !== $meta_key || ! isset( $posts[ $object_id ]['template'] ) ) {
                return $value;
            }
            $template = $posts[ $object_id ]['template'];
            return $single ? $template : array( $template );
        },
        10,
        4
    );

    // Block templates and parts, saved, from the theme, or new.
    $swap = function ( $template, $id, $type ) use ( $templates ) {
        if ( ! isset( $templates[ $id ] ) || $templates[ $id ]['postType'] !== $type ) {
            return $template;
        }
        if ( ! $template ) {
            return wfd_preview_new_template( $id, $templates[ $id ] );
        }
        $template          = clone $template;
        $template->content = $templates[ $id ]['content'];
        $template->title   = $templates[ $id ]['title'];
        return $template;
    };
    add_filter( 'get_block_template', $swap, 10, 3 );
    add_filter( 'get_block_file_template', $swap, 10, 3 );
    add_filter(
        'get_block_templates',
        function ( $results, $query, $type ) use ( $templates, $swap ) {
            $found = array();
            foreach ( $results as $index => $template ) {
                $results[ $index ] = $swap( $template, $template->id, $type );
                $found[]           = $template->id;
            }
            $slugs = $query['slug__in'] ?? null;
            foreach ( $templates as $id => $template ) {
                $is_wanted = ! $slugs || in_array( $template['slug'], $slugs, true );
                if ( $template['postType'] === $type && $is_wanted && ! in_array( $id, $found, true ) ) {
                    $results[] = wfd_preview_new_template( $id, $template );
                }
            }
            return $results;
        },
        10,
        3
    );

    // Synced patterns and navigation menus, read with get_post() as they
    // render.
    add_filter(
        'pre_render_block',
        function ( $pre, $parsed ) use ( $posts ) {
            $ref = $parsed['attrs']['ref'] ?? null;
            if ( 'core/block' !== $parsed['blockName'] || ! $ref || ! isset( $posts[ $ref ]['content'] ) ) {
                return $pre;
            }
            return do_blocks( $posts[ $ref ]['content'] );
        },
        10,
        2
    );
    add_filter(
        'render_block_data',
        function ( $parsed ) use ( $posts ) {
            $ref = $parsed['attrs']['ref'] ?? null;
            if ( 'core/navigation' !== $parsed['blockName'] || ! $ref || ! isset( $posts[ $ref ]['content'] ) ) {
                return $parsed;
            }
            $inner = array_values(
                array_filter(
                    parse_blocks( $posts[ $ref ]['content'] ),
                    function ( $block ) {
                        return null !== $block['blockName'];
                    }
                )
            );
            unset( $parsed['attrs']['ref'] );
            $parsed['innerBlocks']  = $inner;
            $parsed['innerContent'] = array_fill( 0, count( $inner ), null );
            $parsed['innerHTML']    = '';
            return $parsed;
        }
    );

    // Global styles.
    if ( is_array( $changes['styles'] ?? null ) ) {
        $styles = $changes['styles'];
        add_filter(
            'wp_theme_json_data_user',
            function () use ( $styles ) {
                return new WP_Theme_JSON_Data(
                    array(
                        'version'  => WP_Theme_JSON::LATEST_SCHEMA,
                        'styles'   => $styles['styles'],
                        'settings' => $styles['settings'],
                    ),
                    'custom'
                );
            }
        );
        // Styles read earlier in the request are read again.
        if ( function_exists( 'wp_clean_theme_json_cache' ) ) {
            wp_clean_theme_json_cache();
        } else {
            WP_Theme_JSON_Resolver::clean_cached_data();
        }
    }

    // The site's title, tagline and logo.
    $site    = $changes['site'] ?? array();
    $options = array(
        'title'       => 'blogname',
        'description' => 'blogdescription',
        'site_logo'   => 'site_logo',
    );
    foreach ( $options as $field => $option ) {
        if ( array_key_exists( $field, $site ) ) {
            $value = $site[ $field ];
            add_filter(
                'pre_option_' . $option,
                function () use ( $value ) {
                    return $value;
                }
            );
        }
    }
}
// Once the request is known not to be for the REST API, and before the page
// is queried.
add_action( 'parse_request', 'wfd_preview_hooks', 0 );
