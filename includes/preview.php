<?php
/**
 * The preview layer (D57): the board's unsaved changes, kept per user, put in
 * place of the saved content on front-end pages asked for with wfd_preview=1.
 *
 * @package WordPressForDesigners
 */

defined( 'ABSPATH' ) || exit;

define( 'WFD_PREVIEW_META', 'wfd_preview' );
define( 'WFD_PREVIEW_ARG', 'wfd_preview' );

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
 * Keeps the board's unsaved changes for the current user, or removes them
 * when there are none.
 *
 * @param WP_REST_Request $request The request.
 * @return WP_REST_Response
 */
function wfd_preview_keep( $request ) {
    $user_id = get_current_user_id();
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
    if ( $is_empty ) {
        delete_user_meta( $user_id, WFD_PREVIEW_META );
    } else {
        update_user_meta( $user_id, WFD_PREVIEW_META, wp_slash( wp_json_encode( $changes ) ) );
    }
    return rest_ensure_response( array( 'kept' => ! $is_empty ) );
}

/**
 * The kept changes for this request, or null when it is not a preview.
 *
 * @return array|null
 */
function wfd_preview_changes() {
    static $changes = false;
    if ( false !== $changes ) {
        return $changes;
    }
    $changes = null;
    // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read only, for the current user's own changes.
    if ( ! isset( $_GET[ WFD_PREVIEW_ARG ] ) || is_admin() || ! current_user_can( WFD_CAPABILITY ) ) {
        return $changes;
    }
    $stored = json_decode( (string) get_user_meta( get_current_user_id(), WFD_PREVIEW_META, true ), true );
    if ( is_array( $stored ) ) {
        $changes = $stored;
    }
    return $changes;
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
 */
function wfd_preview_hooks() {
    $changes = wfd_preview_changes();
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
        // Styles read before this request's user was known are read again.
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
add_action( 'init', 'wfd_preview_hooks', 0 );
