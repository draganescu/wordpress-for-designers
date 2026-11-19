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

/**
 * The name of the query argument, of the user option the changes are kept
 * in, and of the nonce.
 */
define( 'WFD_PREVIEW', 'wfd_preview' );

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
    return wp_create_nonce( WFD_PREVIEW ) . '.' . ( $session ?? wp_generate_uuid4() );
}

/**
 * What the board page is given to preview with: the argument's name, its
 * first value and the route its changes are sent to
 * (src/artboard-frame/preview.js).
 *
 * @return array
 */
function wfd_preview_config() {
    return array(
        'arg'   => WFD_PREVIEW,
        'value' => wfd_preview_value(),
        'path'  => '/wfd/v1/preview',
    );
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
    $records = get_user_option( WFD_PREVIEW, $user_id );
    return array_filter(
        is_array( $records ) ? $records : array(),
        function ( $record ) {
            return is_array( $record ) && isset( $record['time'], $record['changes'] ) && time() - $record['time'] < WFD_PREVIEW_LIFETIME;
        }
    );
}

/**
 * Whether the current user may open the plugin.
 *
 * @return bool
 */
function wfd_preview_permission() {
    return current_user_can( WFD_CAPABILITY );
}

/**
 * Registers the preview route. Its schema is the shape of the changes.
 */
function wfd_register_preview_route() {
    $text = array( 'type' => 'string' );
    register_rest_route(
        'wfd/v1',
        '/preview',
        array(
            'methods'             => 'POST',
            'callback'            => 'wfd_preview_keep',
            'permission_callback' => 'wfd_preview_permission',
            'args'                => array(
                'preview'   => array(
                    'type'     => 'string',
                    'required' => true,
                ),
                // By post id: pages, synced patterns and navigation menus.
                'posts'     => array(
                    'type'                 => 'object',
                    'default'              => array(),
                    'patternProperties'    => array(
                        '^[1-9][0-9]*$' => array(
                            'type'                 => 'object',
                            'properties'           => array(
                                'title'    => $text,
                                'content'  => $text,
                                'template' => $text,
                            ),
                            'additionalProperties' => false,
                        ),
                    ),
                    'additionalProperties' => false,
                ),
                // By template id, theme//slug: templates and parts.
                'templates' => array(
                    'type'                 => 'object',
                    'default'              => array(),
                    'additionalProperties' => array(
                        'type'                 => 'object',
                        'properties'           => array(
                            'postType' => array(
                                'type'     => 'string',
                                'enum'     => array( 'wp_template', 'wp_template_part' ),
                                'required' => true,
                            ),
                            'slug'     => array(
                                'type'     => 'string',
                                'required' => true,
                            ),
                            'title'    => array(
                                'type'     => 'string',
                                'required' => true,
                            ),
                            'content'  => array(
                                'type'     => 'string',
                                'required' => true,
                            ),
                            'area'     => $text,
                        ),
                        'additionalProperties' => false,
                    ),
                ),
                'styles'    => array(
                    'type'                 => array( 'object', 'null' ),
                    'default'              => null,
                    'properties'           => array(
                        'styles'   => array(
                            'type'     => 'object',
                            'required' => true,
                        ),
                        'settings' => array(
                            'type'     => 'object',
                            'required' => true,
                        ),
                    ),
                    'additionalProperties' => false,
                ),
                'site'      => array(
                    'type'                 => array( 'object', 'null' ),
                    'default'              => null,
                    'properties'           => array(
                        'title'       => $text,
                        'description' => $text,
                        'site_logo'   => array( 'type' => array( 'integer', 'null' ) ),
                    ),
                    'additionalProperties' => false,
                ),
            ),
        )
    );
}
add_action( 'rest_api_init', 'wfd_register_preview_route' );

/**
 * A string from the request, made safe for a user who may not post
 * unfiltered HTML.
 *
 * @param string $value The value.
 * @return string
 */
function wfd_preview_text( $value ) {
    return current_user_can( 'unfiltered_html' ) ? $value : wp_kses_post( $value );
}

/**
 * Keeps a board page's unsaved changes for the current user, or removes them
 * when there are none.
 *
 * @param WP_REST_Request $request The request, checked against the route's schema.
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
        'styles'    => $request['styles'],
        'site'      => array(),
    );

    foreach ( $request['posts'] as $id => $post ) {
        foreach ( array( 'title', 'content' ) as $field ) {
            if ( isset( $post[ $field ] ) ) {
                $changes['posts'][ $id ][ $field ] = wfd_preview_text( $post[ $field ] );
            }
        }
        if ( isset( $post['template'] ) ) {
            $changes['posts'][ $id ]['template'] = sanitize_text_field( $post['template'] );
        }
    }

    foreach ( $request['templates'] as $id => $template ) {
        $changes['templates'][ $id ] = array(
            'postType' => $template['postType'],
            'slug'     => sanitize_title( $template['slug'] ),
            'title'    => wfd_preview_text( $template['title'] ),
            'content'  => wfd_preview_text( $template['content'] ),
            'area'     => sanitize_key( $template['area'] ?? '' ),
        );
    }

    foreach ( array( 'title', 'description' ) as $field ) {
        if ( isset( $request['site'][ $field ] ) ) {
            $changes['site'][ $field ] = sanitize_text_field( $request['site'][ $field ] );
        }
    }
    // A logo taken away is sent as null and kept as 0, no logo.
    if ( array_key_exists( 'site_logo', (array) $request['site'] ) ) {
        $changes['site']['site_logo'] = absint( $request['site']['site_logo'] );
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
        update_user_option( $user_id, WFD_PREVIEW, wp_slash( $records ) );
    } else {
        delete_user_option( $user_id, WFD_PREVIEW );
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
    if ( is_admin() || ! empty( $wp->query_vars['rest_route'] ) || ! isset( $_GET[ WFD_PREVIEW ] ) ) {
        return null;
    }
    $value   = sanitize_text_field( wp_unslash( $_GET[ WFD_PREVIEW ] ) );
    $session = wfd_preview_session( $value );
    if ( null === $session || ! wp_verify_nonce( strtok( $value, '.' ), WFD_PREVIEW ) || ! current_user_can( WFD_CAPABILITY ) ) {
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
 * Draws a synced pattern from its kept content the way the core/block block
 * draws the saved one: with its embeds and its overrides, and once only when
 * it holds itself.
 *
 * @param string $content    The kept content.
 * @param array  $attributes The block's attributes.
 * @return string
 */
function wfd_preview_pattern( $content, $attributes ) {
    static $seen = array();
    global $wp_embed;
    $ref = $attributes['ref'];
    if ( isset( $seen[ $ref ] ) ) {
        return '';
    }
    $seen[ $ref ] = true;
    $overrides    = $attributes['content'] ?? $attributes['overrides'] ?? null;
    $with         = function ( $context ) use ( $overrides ) {
        if ( null !== $overrides ) {
            $context['pattern/overrides'] = $overrides;
        }
        return $context;
    };
    add_filter( 'render_block_context', $with, 1 );
    $html = do_blocks( $wp_embed->autoembed( $wp_embed->run_shortcode( $content ) ) );
    remove_filter( 'render_block_context', $with, 1 );
    unset( $seen[ $ref ] );
    return $html;
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
    // A post is changed as a copy, so that the query does not put the
    // changed one in the object cache, which may outlive this request.
    add_filter(
        'posts_results',
        function ( $results ) use ( $posts, $templates ) {
            foreach ( $results as $index => $post ) {
                if ( ! is_object( $post ) ) {
                    continue;
                }
                $kept = $posts[ $post->ID ] ?? array();
                $id   = get_stylesheet() . '//' . $post->post_name;
                if ( in_array( $post->post_type, array( 'wp_template', 'wp_template_part' ), true ) && isset( $templates[ $id ] ) && $templates[ $id ]['postType'] === $post->post_type ) {
                    $kept = $templates[ $id ];
                }
                if ( ! isset( $kept['title'] ) && ! isset( $kept['content'] ) ) {
                    continue;
                }
                $post = clone $post;
                if ( isset( $kept['title'] ) ) {
                    $post->post_title = $kept['title'];
                }
                if ( isset( $kept['content'] ) ) {
                    $post->post_content = $kept['content'];
                }
                $results[ $index ] = $post;
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
            // A kept template or part that was not found is new. It is
            // offered where the query could find one like it.
            if ( ! empty( $query['wp_id'] ) || ! empty( $query['post_type'] ) ) {
                return $results;
            }
            foreach ( $templates as $id => $template ) {
                $is_wanted = $template['postType'] === $type
                    && ( empty( $query['slug__in'] ) || in_array( $template['slug'], $query['slug__in'], true ) )
                    && ( empty( $query['slug__not_in'] ) || ! in_array( $template['slug'], $query['slug__not_in'], true ) )
                    && ( empty( $query['area'] ) || $template['area'] === $query['area'] );
                if ( $is_wanted && ! in_array( $id, $found, true ) ) {
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
            return wfd_preview_pattern( $posts[ $ref ]['content'], $parsed['attrs'] );
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

    // Global styles: the kept ones in place of the saved ones, in the
    // schema version the saved ones are read in.
    if ( is_array( $changes['styles'] ?? null ) ) {
        $styles = $changes['styles'];
        add_filter(
            'wp_theme_json_data_user',
            function ( $saved ) use ( $styles ) {
                $version = $saved->get_data()['version'];
                if ( ! current_user_can( 'unfiltered_html' ) ) {
                    // What WordPress would take out when saving them.
                    $styles['version']                     = $version;
                    $styles['isGlobalStylesUserThemeJSON'] = true;
                    $styles                                = json_decode( wp_unslash( wp_filter_global_styles_post( wp_slash( wp_json_encode( $styles ) ) ) ), true );
                }
                return new WP_Theme_JSON_Data(
                    array(
                        'version'  => $version,
                        'styles'   => $styles['styles'] ?? array(),
                        'settings' => $styles['settings'] ?? array(),
                    ),
                    'custom'
                );
            }
        );
        // Styles read earlier in the request are read again.
        wp_clean_theme_json_cache();
        // WordPress keeps the block styles it compiles in a transient, for
        // every visitor. A preview leaves there what it found, so that the
        // next visitor's request does not have to compile and write it again.
        add_filter(
            'pre_set_transient_wp_styles_for_blocks',
            function ( $compiled ) {
                $found = get_transient( 'wp_styles_for_blocks' );
                return false === $found ? $compiled : $found;
            }
        );
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
