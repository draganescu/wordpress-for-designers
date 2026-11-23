<?php
/**
 * The agent relay: how a call made on the server reaches the open board and
 * how its result comes back (spec/agent/relay.md; decisions D68, D69, D92
 * and D93).
 *
 * All of its state is in options that are not autoloaded:
 *
 * - `wfd_agent_seen`: the time a way in was last used.
 * - `wfd_agent_sources`: the time each way in was last used, by its label.
 * - `wfd_agent_listener_{client}`: one open board page that is asking.
 * - `wfd_agent_call_{id}`: one call, with its results once it is done.
 *
 * @package WordPressForDesigners
 */

defined( 'ABSPATH' ) || exit;

define( 'WFD_AGENT_SEEN', 'wfd_agent_seen' );
define( 'WFD_AGENT_SOURCES', 'wfd_agent_sources' );
define( 'WFD_AGENT_LISTENER', 'wfd_agent_listener_' );
define( 'WFD_AGENT_CALL', 'wfd_agent_call_' );
define( 'WFD_AGENT_CLEANUP', 'wfd_agent_cleanup' );
// A session is active this long after a way in was last used, in seconds.
define( 'WFD_AGENT_SESSION', 120 );
// A board page is listening this long after it last asked.
define( 'WFD_AGENT_LISTENING', 25 );
// A listener record is deleted this long after its page last asked.
define( 'WFD_AGENT_LISTENER_LIFE', 60 );
// A call record lives this long at most.
define( 'WFD_AGENT_CALL_LIFE', 300 );
// The largest call input and result body, in bytes.
define( 'WFD_AGENT_MAX_BYTES', 1048576 );
// What a write to the relay's options that failed is reported as.
define( 'WFD_AGENT_WRITE_FAILED', 'The relay could not write to the database.' );

/**
 * The tool declarations, as includes/agent-tools.json holds them.
 *
 * @return string The file's content.
 */
function wfd_agent_tools_json() {
    return (string) file_get_contents( WFD_DIR . 'includes/agent-tools.json' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
}

/**
 * The tool declarations.
 *
 * @return array One array per tool: name, description, input.
 */
function wfd_agent_tools() {
    $tools = json_decode( wfd_agent_tools_json(), true );
    return is_array( $tools ) ? $tools : array();
}

/**
 * Reads one of the relay's records from the database, not from a cache.
 *
 * A call is read as objects, so that an empty object in an input or a result
 * stays one; a listener is read as an array.
 *
 * @param string $name     The option name.
 * @param bool   $as_array Whether objects become arrays.
 * @return array|object|null The record, or null when there is none.
 */
function wfd_agent_read( $name, $as_array = true ) {
    global $wpdb;
    $value = $wpdb->get_var( $wpdb->prepare( "SELECT option_value FROM $wpdb->options WHERE option_name = %s", $name ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
    if ( null === $value ) {
        return null;
    }
    $record = json_decode( $value, $as_array );
    return is_array( $record ) || is_object( $record ) ? $record : null;
}

/**
 * Every record whose option name starts with a prefix, oldest first, read
 * from the database.
 *
 * @param string $prefix   The prefix.
 * @param bool   $as_array Whether objects become arrays; null gives each
 *                         record as the string it is stored as.
 * @return array Records by option name.
 */
function wfd_agent_records( $prefix, $as_array = true ) {
    global $wpdb;
    $rows = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $wpdb->prepare(
            "SELECT option_name, option_value FROM $wpdb->options WHERE option_name LIKE %s ORDER BY option_id ASC",
            $wpdb->esc_like( $prefix ) . '%'
        )
    );
    $records = array();
    foreach ( (array) $rows as $row ) {
        $record = json_decode( $row->option_value, $as_array );
        if ( null === $as_array ) {
            // The rows as they are stored.
            $records[ $row->option_name ] = $row->option_value;
        } elseif ( is_array( $record ) || is_object( $record ) ) {
            $records[ $row->option_name ] = $record;
        }
    }
    return $records;
}

/**
 * Writes an option of the relay's, and says whether the row holds the value
 * afterwards. `update_option` also answers false when the row already held
 * the value, which is not a failure.
 *
 * @param string $name  The option name.
 * @param mixed  $value The value, as it is stored.
 * @return bool Whether the row holds the value.
 */
function wfd_agent_update( $name, $value ) {
    global $wpdb;
    // The value this process last read may be older than the row.
    wp_cache_delete( $name, 'options' );
    if ( update_option( $name, $value, false ) ) {
        return true;
    }
    $stored = $wpdb->get_var( $wpdb->prepare( "SELECT option_value FROM $wpdb->options WHERE option_name = %s", $name ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
    return null !== $stored && (string) $stored === (string) $value;
}

/**
 * Writes one of the relay's records.
 *
 * @param string       $name   The option name.
 * @param array|object $record The record.
 * @return bool Whether it was written.
 */
function wfd_agent_write( $name, $record ) {
    return wfd_agent_update( $name, wp_json_encode( $record ) );
}

/**
 * The error a route answers with when a write to the relay's options
 * failed.
 *
 * @return WP_Error
 */
function wfd_agent_write_error() {
    return new WP_Error( 'wfd_agent_write_failed', WFD_AGENT_WRITE_FAILED, array( 'status' => 500 ) );
}

/**
 * Whether an agent has ever used this site.
 *
 * @return bool
 */
function wfd_agent_was_seen() {
    return false !== get_option( WFD_AGENT_SEEN );
}

/**
 * Whether a session is active.
 *
 * @return bool
 */
function wfd_agent_is_active() {
    global $wpdb;
    $seen = $wpdb->get_var( $wpdb->prepare( "SELECT option_value FROM $wpdb->options WHERE option_name = %s", WFD_AGENT_SEEN ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
    return null !== $seen && time() - (int) $seen < WFD_AGENT_SESSION;
}

/**
 * Marks the session: notes that a way in was used now, under its label
 * (D93), and makes sure the cleanup is scheduled.
 *
 * @param string $source The label of the way in.
 * @return bool Whether the times were written.
 */
function wfd_agent_begin( string $source ) {
    $now     = time();
    $written = wfd_agent_update( WFD_AGENT_SEEN, (string) $now );
    $written = wfd_agent_note_source( $source, $now ) && $written;
    if ( ! wp_next_scheduled( WFD_AGENT_CLEANUP ) ) {
        wp_schedule_event( $now, 'hourly', WFD_AGENT_CLEANUP );
    }
    return $written;
}

/**
 * Writes the time a way in was used under its label, keeping the times of
 * the others. The row changes only while it still holds what was read, so
 * two ways in used at once never lose each other's time.
 *
 * @param string $source The label of the way in.
 * @param int    $now    The time.
 * @return bool Whether the row holds the time afterwards.
 */
function wfd_agent_note_source( $source, $now ) {
    global $wpdb;
    for ( $attempt = 0; $attempt < 5; $attempt++ ) {
        wp_cache_delete( WFD_AGENT_SOURCES, 'options' );
        $stored = $wpdb->get_var( $wpdb->prepare( "SELECT option_value FROM $wpdb->options WHERE option_name = %s", WFD_AGENT_SOURCES ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        if ( null === $stored ) {
            // No row yet. Another way in may add it first: then read again.
            if ( add_option( WFD_AGENT_SOURCES, wp_json_encode( array( $source => $now ) ), '', false ) ) {
                return true;
            }
            continue;
        }
        $sources            = json_decode( $stored, true );
        $sources            = is_array( $sources ) ? $sources : array();
        $sources[ $source ] = $now;
        $next               = wp_json_encode( $sources );
        if ( $next === $stored ) {
            return true;
        }
        $changed = $wpdb->query( // phpcs:ignore WordPress.DB.DirectDatabaseQuery
            $wpdb->prepare(
                "UPDATE $wpdb->options SET option_value = %s WHERE option_name = %s AND option_value = %s",
                $next,
                WFD_AGENT_SOURCES,
                $stored
            )
        );
        wp_cache_delete( WFD_AGENT_SOURCES, 'options' );
        if ( 1 === $changed ) {
            return true;
        }
    }
    return false;
}

/**
 * The boards that have a page listening, each once, by id.
 *
 * @return array Arrays of `id` and `title`.
 */
function wfd_agent_listening_boards() {
    $boards = array();
    foreach ( wfd_agent_records( WFD_AGENT_LISTENER ) as $listener ) {
        if ( isset( $listener['board'], $listener['seen'] ) && time() - (int) $listener['seen'] < WFD_AGENT_LISTENING ) {
            $boards[ (int) $listener['board'] ] = array(
                'id'    => (int) $listener['board'],
                'title' => isset( $listener['title'] ) ? (string) $listener['title'] : '',
            );
        }
    }
    ksort( $boards );
    return array_values( $boards );
}

/**
 * Every published board, by id, for a way in that runs in PHP (D92). It
 * marks no session.
 *
 * @return array Arrays of `id`, `title`, `address` and `listening`.
 */
function wfd_agent_boards() {
    $listening = wp_list_pluck( wfd_agent_listening_boards(), 'id' );
    $boards    = array();
    $posts     = get_posts(
        array(
            'post_type'   => WFD_POST_TYPE,
            'post_status' => 'publish',
            'numberposts' => -1,
            'orderby'     => 'ID',
            'order'       => 'ASC',
        )
    );
    foreach ( $posts as $post ) {
        $boards[] = array(
            'id'        => $post->ID,
            'title'     => $post->post_title,
            'address'   => wfd_board_url( $post->ID ),
            'listening' => in_array( $post->ID, $listening, true ),
        );
    }
    return $boards;
}

/**
 * A failure of the relay itself.
 *
 * @param string $code    The error code.
 * @param string $message The message.
 * @return array The failed envelope.
 */
function wfd_agent_failure( $code, $message ) {
    return array(
        'ok'    => false,
        'error' => array(
            'code'    => $code,
            'message' => $message,
        ),
    );
}

/**
 * Makes a board as "Add board" does, for a way in that runs in PHP (D103).
 * It marks no session.
 *
 * @param string $title The board's title; "Untitled board" without one.
 * @return array The board as `wfd_agent_boards` lists it, or a failed
 *               envelope.
 */
function wfd_agent_board_new( string $title = '' ) {
    $id = wp_insert_post(
        wp_slash(
            array(
                'post_type'    => WFD_POST_TYPE,
                'post_status'  => 'publish',
                'post_title'   => '' === $title ? __( 'Untitled board', 'wordpress-for-designers' ) : $title,
                'post_content' => wp_json_encode( wfd_empty_layout() ),
            )
        )
    );
    if ( ! $id ) {
        return wfd_agent_failure( 'unavailable', 'The board could not be made.' );
    }
    return array(
        'id'        => $id,
        'title'     => get_post( $id )->post_title,
        'address'   => wfd_board_url( $id ),
        'listening' => false,
    );
}

/**
 * Hands calls to a listening board, waits for the board's answer and gives
 * the results (D92). The caller checks that its user may use the plugin.
 *
 * @param array $calls The entries, 1 to 50, each an array of `tool` and
 *                     `input`.
 * @param array $args  `source`, the label of the way in; `board`, a board
 *                     id, when several are listening; `timeout`, whole
 *                     seconds from 1 to 120, 30 without it.
 * @return array `ok` true and `results`, one envelope per entry, or a failed
 *               envelope for a failure of the relay itself.
 */
function wfd_agent_relay( array $calls, array $args ) {
    $source = isset( $args['source'] ) ? $args['source'] : null;
    if ( ! is_string( $source ) || ! preg_match( '/^[a-z0-9-]{1,20}$/', $source ) ) {
        return wfd_agent_failure( 'invalid_args', 'source must be 1 to 20 lowercase letters, digits and dashes.' );
    }
    if ( ! wfd_agent_begin( $source ) ) {
        return wfd_agent_failure( 'unavailable', WFD_AGENT_WRITE_FAILED );
    }
    // A timeout outside 1 to 120 is brought to the nearest of the two.
    $timeout = isset( $args['timeout'] ) ? max( 1, min( 120, (int) $args['timeout'] ) ) : 30;
    // What a caller that broke part way left behind.
    wfd_agent_cleanup();

    if ( count( $calls ) < 1 || count( $calls ) > 50 ) {
        return wfd_agent_failure( 'invalid_args', 'calls must be a JSON array of 1 to 50 calls.' );
    }
    $calls   = array_values( $calls );
    $schemas = wp_list_pluck( wfd_agent_tools(), 'input', 'name' );
    foreach ( $calls as $index => $call ) {
        if ( ! is_array( $call ) || ! isset( $call['tool'] ) || ! is_string( $call['tool'] ) ) {
            return wfd_agent_failure( 'invalid_args', sprintf( 'calls[%d] must be an object with a tool.', $index ) );
        }
        $input = isset( $call['input'] ) ? $call['input'] : array();
        if ( ! is_array( $input ) && ! is_object( $input ) ) {
            return wfd_agent_failure( 'invalid_args', sprintf( 'calls[%d].input must be an object.', $index ) );
        }
        if ( ! isset( $schemas[ $call['tool'] ] ) ) {
            return wfd_agent_failure( 'unknown_tool', sprintf( 'There is no tool named %s.', $call['tool'] ) );
        }
        // An input given as an array is stored as an object, and so is
        // every field the tool declares as one, so that an empty one does
        // not reach the page as an empty list.
        $calls[ $index ] = array(
            'tool'  => $call['tool'],
            'input' => (object) wfd_agent_shape( $input, $schemas[ $call['tool'] ] ),
        );
    }

    $boards = wfd_agent_listening_boards();
    $none   = 'No board is listening. Open a board in WordPress for Designers; if one is open, reload it once.';
    if ( isset( $args['board'] ) ) {
        $board = (int) $args['board'];
        if ( ! in_array( $board, wp_list_pluck( $boards, 'id' ), true ) ) {
            return wfd_agent_failure( 'no_board', $none );
        }
    } elseif ( ! $boards ) {
        return wfd_agent_failure( 'no_board', $none );
    } elseif ( count( $boards ) > 1 ) {
        $named = array();
        foreach ( $boards as $listening ) {
            $named[] = sprintf( '%d "%s"', $listening['id'], $listening['title'] );
        }
        return wfd_agent_failure( 'several_boards', sprintf( 'Several boards are open: %s. Pass --board=<id>.', implode( ', ', $named ) ) );
    } else {
        $board = $boards[0]['id'];
    }

    $encoded = wp_json_encode( $calls );
    if ( false === $encoded || strlen( $encoded ) > WFD_AGENT_MAX_BYTES ) {
        return wfd_agent_failure( 'invalid_args', 'The input is larger than 1 MB.' );
    }

    $id   = wp_generate_uuid4();
    $name = WFD_AGENT_CALL . $id;
    $now  = time();
    // When the caller starts waiting, to the microsecond: the page is told
    // the time left from it (D89).
    $started = microtime( true );
    $added   = add_option(
        $name,
        wp_json_encode(
            array(
                'id'      => $id,
                'board'   => $board,
                'calls'   => $calls,
                'status'  => 'queued',
                'source'  => $source,
                'created' => $started,
                'expires' => $now + WFD_AGENT_CALL_LIFE,
                // The page starts no entry once this has passed (D89).
                'timeout' => $timeout,
            )
        ),
        '',
        false
    );
    if ( ! $added ) {
        return wfd_agent_failure( 'unavailable', WFD_AGENT_WRITE_FAILED );
    }

    // A request that ends while it waits (a time limit, a fatal error)
    // leaves no call for the board to run after its caller has gone.
    $waiting = true;
    register_shutdown_function(
        function () use ( $name, &$waiting ) {
            if ( $waiting ) {
                delete_option( $name );
            }
        }
    );

    $call = null;
    while ( microtime( true ) - $started < $timeout ) {
        usleep( 200000 );
        $call = wfd_agent_read( $name, false );
        if ( $call && isset( $call->status ) && 'done' === $call->status ) {
            break;
        }
    }
    delete_option( $name );
    $waiting = false;

    $failed = wfd_agent_failure( 'timeout', sprintf( 'The board did not answer within %d seconds.', $timeout ) );
    if ( ! $call || ! isset( $call->status, $call->results ) || 'done' !== $call->status ) {
        return $failed;
    }
    // An answer that is not one envelope per entry is no answer.
    $results = (array) $call->results;
    if ( count( $results ) !== count( $calls ) ) {
        return $failed;
    }
    foreach ( $results as $envelope ) {
        if ( ! is_object( $envelope ) || ! isset( $envelope->ok ) ) {
            return $failed;
        }
        if ( ! $envelope->ok && ( ! isset( $envelope->error ) || ! is_object( $envelope->error ) || ! isset( $envelope->error->code, $envelope->error->message ) ) ) {
            return $failed;
        }
    }
    return array(
        'ok'      => true,
        'results' => array_values( $results ),
    );
}

/**
 * Makes an object of every part of a value that a schema declares as one.
 * A value a PHP caller holds as arrays cannot tell an empty object from an
 * empty list; the tool's declaration can. A part the declaration leaves
 * open, or allows to be either, is left as it is.
 *
 * @param mixed $value  The value.
 * @param mixed $schema Its schema, as the declarations hold it.
 * @return mixed The value.
 */
function wfd_agent_shape( $value, $schema ) {
    if ( ! is_array( $value ) || ! is_array( $schema ) || ! isset( $schema['type'] ) ) {
        return $value;
    }
    $types = (array) $schema['type'];
    if ( in_array( 'object', $types, true ) && ! in_array( 'array', $types, true ) ) {
        if ( isset( $schema['properties'] ) && is_array( $schema['properties'] ) ) {
            foreach ( $schema['properties'] as $key => $property ) {
                if ( array_key_exists( $key, $value ) ) {
                    $value[ $key ] = wfd_agent_shape( $value[ $key ], $property );
                }
            }
        }
        return (object) $value;
    }
    if ( in_array( 'array', $types, true ) && ! in_array( 'object', $types, true ) && isset( $schema['items'] ) ) {
        foreach ( $value as $index => $item ) {
            $value[ $index ] = wfd_agent_shape( $item, $schema['items'] );
        }
    }
    return $value;
}

/**
 * Deletes what was left behind: calls past their time, and the records of
 * pages that stopped asking.
 */
function wfd_agent_cleanup() {
    foreach ( wfd_agent_records( WFD_AGENT_CALL ) as $name => $call ) {
        if ( ! isset( $call['expires'] ) || time() > (int) $call['expires'] ) {
            delete_option( $name );
        }
    }
    foreach ( wfd_agent_records( WFD_AGENT_LISTENER ) as $name => $listener ) {
        if ( ! isset( $listener['seen'] ) || time() - (int) $listener['seen'] > WFD_AGENT_LISTENER_LIFE ) {
            delete_option( $name );
        }
    }
}
add_action( WFD_AGENT_CLEANUP, 'wfd_agent_cleanup' );

/**
 * Deactivation: the cleanup is no longer scheduled.
 */
function wfd_agent_deactivate() {
    wp_clear_scheduled_hook( WFD_AGENT_CLEANUP );
}
register_deactivation_hook( WFD_FILE, 'wfd_agent_deactivate' );

/**
 * What the board page is told about the relay when it loads.
 *
 * @return array
 */
function wfd_agent_config() {
    return array(
        'seen' => wfd_agent_was_seen(),
        'poll' => '/wfd/v1/agent/poll',
        'send' => '/wfd/v1/agent/result',
    );
}

/**
 * Who may use the relay's routes.
 *
 * @return bool
 */
function wfd_agent_permission() {
    return current_user_can( WFD_CAPABILITY );
}

/**
 * Hands the oldest queued call for a board to one page.
 *
 * @param int    $board  The board.
 * @param string $client The page.
 * @return array|null The call's id and entries, or null.
 */
function wfd_agent_take_call( $board, $client ) {
    global $wpdb;
    foreach ( wfd_agent_records( WFD_AGENT_CALL, null ) as $name => $stored ) {
        $call = json_decode( $stored );
        if (
            ! is_object( $call ) ||
            ! isset( $call->id, $call->calls, $call->status, $call->board, $call->expires ) ||
            'queued' !== $call->status ||
            (int) $call->board !== $board ||
            time() > (int) $call->expires
        ) {
            continue;
        }
        $taken         = clone $call;
        $taken->status = 'running';
        $taken->client = $client;
        // The row changes only if it still is the queued call that was read,
        // so two pages that ask at once never both take it.
        $changed = $wpdb->query( // phpcs:ignore WordPress.DB.DirectDatabaseQuery
            $wpdb->prepare(
                "UPDATE $wpdb->options SET option_value = %s WHERE option_name = %s AND option_value = %s",
                wp_json_encode( $taken ),
                $name,
                $stored
            )
        );
        wp_cache_delete( $name, 'options' );
        if ( 1 === $changed ) {
            // The seconds left of the command's timeout, worked out here so
            // that the page compares no clock of its own with the server's
            // (D89).
            $timeout = isset( $call->timeout ) ? (int) $call->timeout : 30;
            return array(
                'id'        => $call->id,
                'calls'     => $call->calls,
                'remaining' => max( 0, round( (float) $call->created + $timeout - microtime( true ), 3 ) ),
            );
        }
    }
    return null;
}

/**
 * POST wfd/v1/agent/poll.
 *
 * @param WP_REST_Request $request The request.
 * @return WP_REST_Response|WP_Error
 */
function wfd_agent_poll( $request ) {
    $board   = (int) $request['board'];
    $client  = (string) $request['client'];
    $written = wfd_agent_write(
        WFD_AGENT_LISTENER . $client,
        array(
            'board' => $board,
            'title' => (string) $request['title'],
            'seen'  => time(),
        )
    );
    if ( ! $written ) {
        return wfd_agent_write_error();
    }
    // The ways in that are in use, by their labels (D93).
    $sources = array();
    foreach ( (array) wfd_agent_read( WFD_AGENT_SOURCES ) as $source => $seen ) {
        if ( time() - $seen < WFD_AGENT_SESSION ) {
            $sources[] = $source;
        }
    }
    return rest_ensure_response(
        array(
            'active'  => wfd_agent_is_active(),
            'sources' => $sources,
            'call'    => wfd_agent_take_call( $board, $client ),
        )
    );
}

/**
 * POST wfd/v1/agent/result.
 *
 * @param WP_REST_Request $request The request.
 * @return WP_REST_Response|WP_Error
 */
function wfd_agent_result( $request ) {
    $name = WFD_AGENT_CALL . (string) $request['id'];
    $call = wfd_agent_read( $name, false );
    // A body over the limit is not stored: each entry fails instead, so the
    // command answers at once.
    if ( strlen( $request->get_body() ) > WFD_AGENT_MAX_BYTES ) {
        $results = array();
        $count   = is_object( $call ) && isset( $call->calls ) ? count( (array) $call->calls ) : 0;
        for ( $index = 0; $index < $count; $index++ ) {
            $results[] = array(
                'ok'    => false,
                'error' => array(
                    'code'    => 'invalid_args',
                    'message' => 'The result is larger than 1 MB.',
                ),
            );
        }
        $body = (object) array( 'results' => json_decode( wp_json_encode( $results ) ) );
    } else {
        // The body is read as objects, so that an empty object in a result
        // is not stored as an empty list.
        $body = json_decode( $request->get_body() );
    }
    if (
        ! is_object( $call ) ||
        ! isset( $call->status, $call->client, $body->results ) ||
        ! is_array( $body->results ) ||
        'running' !== $call->status ||
        (string) $request['client'] !== $call->client
    ) {
        return rest_ensure_response( array( 'stored' => false ) );
    }
    // The page did not ask while it ran the call: it is listening still, so
    // that the command that follows finds it.
    $listener_name = WFD_AGENT_LISTENER . $call->client;
    $listener      = wfd_agent_read( $listener_name );
    if ( is_array( $listener ) ) {
        $listener['seen'] = time();
        if ( ! wfd_agent_write( $listener_name, $listener ) ) {
            return wfd_agent_write_error();
        }
    }
    $call->status  = 'done';
    $call->results = $body->results;
    // The row changes only if it is still there: a call the command has
    // given up on and deleted is not made again.
    global $wpdb;
    $changed = $wpdb->query( // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $wpdb->prepare(
            "UPDATE $wpdb->options SET option_value = %s WHERE option_name = %s",
            wp_json_encode( $call ),
            $name
        )
    );
    wp_cache_delete( $name, 'options' );
    if ( false === $changed ) {
        return wfd_agent_write_error();
    }
    return rest_ensure_response( array( 'stored' => 1 === $changed ) );
}

/**
 * Registers the two routes.
 */
function wfd_agent_register_routes() {
    $uuid = array(
        'type'     => 'string',
        'required' => true,
        'pattern'  => '^[0-9a-fA-F-]{36}$',
    );
    register_rest_route(
        'wfd/v1',
        '/agent/poll',
        array(
            'methods'             => 'POST',
            'permission_callback' => 'wfd_agent_permission',
            'callback'            => 'wfd_agent_poll',
            'args'                => array(
                'board'  => array(
                    'type'     => 'integer',
                    'required' => true,
                ),
                'client' => $uuid,
                'title'  => array(
                    'type'    => 'string',
                    'default' => '',
                ),
            ),
        )
    );
    register_rest_route(
        'wfd/v1',
        '/agent/result',
        array(
            'methods'             => 'POST',
            'permission_callback' => 'wfd_agent_permission',
            'callback'            => 'wfd_agent_result',
            'args'                => array(
                'id'      => $uuid,
                'client'  => $uuid,
                'results' => array(
                    'type'     => 'array',
                    'required' => true,
                ),
            ),
        )
    );
}
add_action( 'rest_api_init', 'wfd_agent_register_routes' );

if ( defined( 'WP_CLI' ) && WP_CLI ) {
    require_once WFD_DIR . 'includes/agent-cli.php';
}
