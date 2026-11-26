<?php
/**
 * The board post type and the validation of its layout.
 *
 * @package WordPressForDesigners
 */

defined( 'ABSPATH' ) || exit;

/**
 * Registers the wfd_board post type (spec/data-model.md, Board).
 */
function wfd_register_post_type() {
    $caps = array();
    foreach ( array( 'edit_post', 'read_post', 'delete_post', 'edit_posts', 'edit_others_posts', 'delete_posts', 'publish_posts', 'read_private_posts', 'read', 'delete_private_posts', 'delete_published_posts', 'delete_others_posts', 'edit_private_posts', 'edit_published_posts', 'create_posts' ) as $cap ) {
        $caps[ $cap ] = WFD_CAPABILITY;
    }

    register_post_type(
        WFD_POST_TYPE,
        array(
            'labels'       => array(
                'name'          => __( 'Boards', 'wordpress-for-designers' ),
                'singular_name' => __( 'Board', 'wordpress-for-designers' ),
            ),
            'public'       => false,
            'show_ui'      => false,
            'show_in_rest' => true,
            'rest_base'    => 'wfd-boards',
            'supports'     => array( 'title' ),
            'capabilities' => $caps,
            'map_meta_cap' => false,
        )
    );

    register_rest_field(
        WFD_POST_TYPE,
        'layout',
        array(
            'get_callback'    => 'wfd_get_layout',
            'update_callback' => 'wfd_update_layout',
            'schema'          => array(
                'description' => __( 'The board layout.', 'wordpress-for-designers' ),
                'type'        => 'object',
                'context'     => array( 'view', 'edit' ),
                'arg_options' => array(
                    'validate_callback' => 'wfd_validate_layout',
                ),
            ),
        )
    );
}
add_action( 'init', 'wfd_register_post_type' );

/**
 * Keeps the wfd-boards REST routes to users who can open the plugin (C19,
 * spec/data-model.md, Permissions). A board is always published, and
 * WordPress lets anyone read a published post of a type shown in REST, so
 * the capabilities of the post type alone do not stop a read. WordPress
 * matches a route whatever the case of its letters, so this does too.
 *
 * @param mixed           $response The response so far.
 * @param array           $handler  The route's handler.
 * @param WP_REST_Request $request  The request.
 * @return mixed
 */
function wfd_boards_rest_permission( $response, $handler, $request ) {
    if ( is_wp_error( $response ) || ! preg_match( '#^/wp/v2/wfd-boards(/|$)#i', $request->get_route() ) ) {
        return $response;
    }
    if ( current_user_can( WFD_CAPABILITY ) ) {
        return $response;
    }
    return new WP_Error(
        'rest_forbidden',
        __( 'Sorry, you are not allowed to do that.', 'wordpress-for-designers' ),
        array( 'status' => rest_authorization_required_code() )
    );
}
add_filter( 'rest_request_before_callbacks', 'wfd_boards_rest_permission', 10, 3 );

/**
 * The layout of an empty board.
 *
 * @return array
 */
function wfd_empty_layout() {
    return array(
        'version'   => 1,
        'artboards' => array(),
    );
}

/**
 * Reads the layout stored in post_content.
 *
 * @param array $post Prepared post data.
 * @return array
 */
function wfd_get_layout( $post ) {
    $raw    = get_post_field( 'post_content', $post['id'], 'raw' );
    $layout = json_decode( (string) $raw, true );
    if ( ! is_array( $layout ) || true !== wfd_layout_error( $layout ) ) {
        return wfd_empty_layout();
    }
    return $layout;
}

/**
 * Stores the layout as a JSON string in post_content.
 *
 * @param array   $layout The validated layout.
 * @param WP_Post $post   The board.
 * @return true|WP_Error
 */
function wfd_update_layout( $layout, $post ) {
    $error = wfd_layout_error( $layout );
    if ( true !== $error ) {
        return new WP_Error( 'wfd_invalid_layout', $error, array( 'status' => 400 ) );
    }
    $result = wp_update_post(
        array(
            'ID'           => $post->ID,
            'post_content' => wp_slash( wp_json_encode( $layout, JSON_HEX_TAG | JSON_HEX_AMP ) ),
        ),
        true
    );
    return is_wp_error( $result ) ? $result : true;
}

/**
 * REST argument validation for the layout.
 *
 * @param mixed $value The submitted value.
 * @return true|WP_Error
 */
function wfd_validate_layout( $value ) {
    $error = wfd_layout_error( $value );
    if ( true !== $error ) {
        return new WP_Error( 'rest_invalid_param', $error, array( 'status' => 400 ) );
    }
    return true;
}

/**
 * Whether a value is strictly a JSON number (not a numeric string).
 *
 * @param mixed $value The value.
 * @return bool
 */
function wfd_is_number( $value ) {
    return is_int( $value ) || is_float( $value );
}

/**
 * Whether a value is a JSON list: an array whose keys are 0, 1, 2 and so on
 * in order. An object with number keys, such as {"5": {}}, decodes to an
 * array too, and would be stored and read back as an object.
 *
 * @param mixed $value The value.
 * @return bool
 */
function wfd_is_list( $value ) {
    return is_array( $value ) && array_values( $value ) === $value;
}

/**
 * Checks a layout against the shape in spec/data-model.md.
 *
 * @param mixed $layout The decoded layout.
 * @return true|string True when valid, otherwise the reason.
 */
function wfd_layout_error( $layout ) {
    if ( ! is_array( $layout ) ) {
        return __( 'The layout must be an object.', 'wordpress-for-designers' );
    }
    // The notes list and the guides list are optional (D46, D113).
    $keys = array_keys( $layout );
    if ( array_diff( array( 'version', 'artboards' ), $keys ) || array_diff( $keys, array( 'version', 'artboards', 'notes', 'guides' ) ) ) {
        return __( 'The layout must have exactly the fields version and artboards, and may have notes and guides.', 'wordpress-for-designers' );
    }
    if ( 1 !== $layout['version'] ) {
        return __( 'The layout version must be 1.', 'wordpress-for-designers' );
    }
    if ( ! wfd_is_list( $layout['artboards'] ) ) {
        return __( 'The layout artboards must be a list.', 'wordpress-for-designers' );
    }

    $ids = array();
    foreach ( $layout['artboards'] as $artboard ) {
        $kind   = is_array( $artboard ) && isset( $artboard['kind'] ) && is_string( $artboard['kind'] ) ? $artboard['kind'] : '';
        $fields = wfd_artboard_fields( $kind );
        if ( ! is_array( $artboard ) || array_diff( array_keys( $artboard ), $fields ) || count( $artboard ) !== count( $fields ) ) {
            if ( 'browser' === $kind ) {
                return __( 'Each browser must have exactly the fields id, kind, path, device, x, y, height and shows.', 'wordpress-for-designers' );
            }
            return 'media' === $kind
                ? __( 'Each media object must have exactly the fields id, kind, entityId, x, y, width and height.', 'wordpress-for-designers' )
                : __( 'Each artboard must have exactly the fields id, kind, entityId, device, x, y and height.', 'wordpress-for-designers' );
        }
        if ( ! is_string( $artboard['id'] ) || ! wp_is_uuid( $artboard['id'] ) || isset( $ids[ $artboard['id'] ] ) ) {
            return __( 'Each artboard id must be a unique UUID.', 'wordpress-for-designers' );
        }
        $ids[ $artboard['id'] ] = $kind;
        if ( ! in_array( $kind, array( 'page', 'template', 'template-part', 'pattern', 'media', 'browser' ), true ) ) {
            return __( 'The artboard kind is not valid.', 'wordpress-for-designers' );
        }
        if ( in_array( 'entityId', $fields, true ) ) {
            $numeric_entity = in_array( $kind, array( 'page', 'pattern', 'media' ), true );
            if ( $numeric_entity ? ! is_int( $artboard['entityId'] ) : ( ! is_string( $artboard['entityId'] ) || '' === $artboard['entityId'] ) ) {
                return __( 'The artboard entityId has the wrong type for its kind.', 'wordpress-for-designers' );
            }
        }
        if ( in_array( 'device', $fields, true ) && ! in_array( $artboard['device'], array( 'desktop', 'tablet', 'mobile' ), true ) ) {
            return __( 'The artboard device is not valid.', 'wordpress-for-designers' );
        }
        if ( 'browser' === $kind ) {
            $error = wfd_browser_error( $artboard );
            if ( true !== $error ) {
                return $error;
            }
            continue;
        }
        foreach ( array_intersect( array( 'x', 'y', 'width', 'height' ), $fields ) as $number ) {
            if ( ! wfd_is_number( $artboard[ $number ] ) ) {
                return 'media' === $kind
                    ? __( 'The media object x, y, width and height must be numbers.', 'wordpress-for-designers' )
                    : __( 'The artboard x, y and height must be numbers.', 'wordpress-for-designers' );
            }
        }
    }
    if ( array_key_exists( 'notes', $layout ) ) {
        $error = wfd_notes_error( $layout['notes'], $ids );
        if ( true !== $error ) {
            return $error;
        }
        $ids += array_fill_keys( array_column( $layout['notes'], 'id' ), 'note' );
    }
    return array_key_exists( 'guides', $layout )
        ? wfd_guides_error( $layout['guides'], $ids )
        : true;
}

/**
 * The fields an artboard of a kind is saved with, and no others
 * (spec/data-model.md). A media object has a width and no device; a browser
 * (D55) has an address, a height and what it shows, and no entity; every
 * other kind has an entity and a device. `KINDS` in src/shell/constants.js
 * holds the same lists.
 *
 * @param string $kind The kind.
 * @return string[]
 */
function wfd_artboard_fields( $kind ) {
    if ( 'media' === $kind ) {
        return array( 'id', 'kind', 'entityId', 'x', 'y', 'width', 'height' );
    }
    if ( 'browser' === $kind ) {
        return array( 'id', 'kind', 'path', 'device', 'x', 'y', 'height', 'shows' );
    }
    return array( 'id', 'kind', 'entityId', 'device', 'x', 'y', 'height' );
}

/**
 * Checks what only a browser of a layout has (spec/data-model.md, D55).
 *
 * @param array $browser The decoded browser, with exactly its fields.
 * @return true|string True when valid, otherwise the reason.
 */
function wfd_browser_error( $browser ) {
    if ( ! is_string( $browser['path'] ) || '/' !== substr( $browser['path'], 0, 1 ) || strlen( $browser['path'] ) > 2000 ) {
        return __( 'The browser path must start with / and have at most 2000 characters.', 'wordpress-for-designers' );
    }
    if ( ! wfd_is_number( $browser['x'] ) || ! wfd_is_number( $browser['y'] ) ) {
        return __( 'The browser x and y must be numbers.', 'wordpress-for-designers' );
    }
    // The window is 200 board units tall at least (D56).
    if ( ! wfd_is_number( $browser['height'] ) || $browser['height'] < 200 ) {
        return __( 'The browser height must be a number of 200 or more.', 'wordpress-for-designers' );
    }
    // What it shows (D57).
    if ( ! in_array( $browser['shows'], array( 'unsaved', 'saved' ), true ) ) {
        return __( 'The browser shows must be unsaved or saved.', 'wordpress-for-designers' );
    }
    return true;
}

/**
 * Checks the notes of a layout (spec/data-model.md, D46).
 *
 * @param mixed $notes The decoded notes.
 * @param array $ids   Ids already used by artboards.
 * @return true|string True when valid, otherwise the reason.
 */
function wfd_notes_error( $notes, $ids ) {
    if ( ! wfd_is_list( $notes ) ) {
        return __( 'The layout notes must be a list.', 'wordpress-for-designers' );
    }
    $fields = array( 'id', 'x', 'y', 'text', 'color' );
    foreach ( $notes as $note ) {
        if ( ! is_array( $note ) || array_diff( array_keys( $note ), $fields ) || count( $note ) !== count( $fields ) ) {
            return __( 'Each note must have exactly the fields id, x, y, text and color.', 'wordpress-for-designers' );
        }
        if ( ! is_string( $note['id'] ) || ! wp_is_uuid( $note['id'] ) || isset( $ids[ $note['id'] ] ) ) {
            return __( 'Each note id must be a unique UUID.', 'wordpress-for-designers' );
        }
        $ids[ $note['id'] ] = true;
        if ( ! wfd_is_number( $note['x'] ) || ! wfd_is_number( $note['y'] ) ) {
            return __( 'The note x and y must be numbers.', 'wordpress-for-designers' );
        }
        if ( ! is_string( $note['text'] ) ) {
            return __( 'The note text must be a string.', 'wordpress-for-designers' );
        }
        if ( ! in_array( $note['color'], array( 'yellow', 'green', 'blue', 'pink' ), true ) ) {
            return __( 'The note color is not valid.', 'wordpress-for-designers' );
        }
    }
    return true;
}

/**
 * Checks the guides of a layout (spec/data-model.md, D113).
 *
 * @param mixed $guides The decoded guides.
 * @param array $ids    What each id already used in the layout belongs to:
 *                      an artboard's kind, or a note.
 * @return true|string True when valid, otherwise the reason.
 */
function wfd_guides_error( $guides, $ids ) {
    if ( ! wfd_is_list( $guides ) ) {
        return __( 'The layout guides must be a list.', 'wordpress-for-designers' );
    }
    $owners = array( 'page', 'template', 'template-part', 'pattern' );
    foreach ( $guides as $guide ) {
        // An artboard's guide has an artboard and a device; a board guide has neither.
        $fields = is_array( $guide ) && ( array_key_exists( 'artboard', $guide ) || array_key_exists( 'device', $guide ) )
            ? array( 'id', 'axis', 'at', 'artboard', 'device' )
            : array( 'id', 'axis', 'at' );
        if ( ! is_array( $guide ) || array_diff( array_keys( $guide ), $fields ) || count( $guide ) !== count( $fields ) ) {
            return __( 'Each guide must have exactly the fields id, axis and at, or those with artboard and device.', 'wordpress-for-designers' );
        }
        if ( ! is_string( $guide['id'] ) || ! wp_is_uuid( $guide['id'] ) || isset( $ids[ $guide['id'] ] ) ) {
            return __( 'Each guide id must be a unique UUID.', 'wordpress-for-designers' );
        }
        if ( ! in_array( $guide['axis'], array( 'x', 'y' ), true ) ) {
            return __( 'The guide axis must be x or y.', 'wordpress-for-designers' );
        }
        if ( ! wfd_is_number( $guide['at'] ) || floor( $guide['at'] ) !== (float) $guide['at'] ) {
            return __( 'The guide at must be a whole number.', 'wordpress-for-designers' );
        }
        if ( array_key_exists( 'artboard', $guide ) ) {
            if ( ! is_string( $guide['artboard'] ) || ! in_array( $ids[ $guide['artboard'] ] ?? '', $owners, true ) ) {
                return __( 'The guide artboard must be a page, template, template part or pattern of the layout.', 'wordpress-for-designers' );
            }
            if ( ! in_array( $guide['device'], array( 'desktop', 'tablet', 'mobile' ), true ) ) {
                return __( 'The guide device is not valid.', 'wordpress-for-designers' );
            }
        }
        $ids[ $guide['id'] ] = 'guide';
    }
    return true;
}

/**
 * A board is always published; a removed board goes to the trash.
 *
 * @param stdClass $prepared The post about to be inserted or updated.
 * @return stdClass
 */
function wfd_force_publish( $prepared ) {
    $prepared->post_status = 'publish';
    return $prepared;
}
add_filter( 'rest_pre_insert_' . WFD_POST_TYPE, 'wfd_force_publish' );

/**
 * Gives a board created without a layout the empty layout.
 *
 * @param WP_Post $post     The board.
 * @param mixed   $request  The request.
 * @param bool    $creating Whether the board is being created.
 */
function wfd_default_layout( $post, $request, $creating ) {
    if ( $creating && '' === $post->post_content ) {
        wp_update_post(
            array(
                'ID'           => $post->ID,
                'post_content' => wp_slash( wp_json_encode( wfd_empty_layout() ) ),
            )
        );
    }
}
add_action( 'rest_after_insert_' . WFD_POST_TYPE, 'wfd_default_layout', 10, 3 );
