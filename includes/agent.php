<?php
/**
 * The agent relay: how a call made on the server reaches the open board and
 * how its result comes back (spec/agent/relay.md; decisions D68 and D69).
 *
 * All of its state is in options that are not autoloaded:
 *
 * - `wfd_agent_seen`: the time of the last `wp wfd` command.
 * - `wfd_agent_listener_{client}`: one open board page that is asking.
 * - `wfd_agent_call_{id}`: one call, with its results once it is done.
 *
 * @package WordPressForDesigners
 */

defined( 'ABSPATH' ) || exit;

define( 'WFD_AGENT_SEEN', 'wfd_agent_seen' );
define( 'WFD_AGENT_LISTENER', 'wfd_agent_listener_' );
define( 'WFD_AGENT_CALL', 'wfd_agent_call_' );
define( 'WFD_AGENT_CLEANUP', 'wfd_agent_cleanup' );
// A session is active this long after the last command, in seconds.
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
 * Notes that a `wp wfd` command ran now, and makes sure the cleanup is
 * scheduled.
 *
 * @return bool Whether the time was written.
 */
function wfd_agent_touch() {
    $written = wfd_agent_update( WFD_AGENT_SEEN, (string) time() );
    if ( ! wp_next_scheduled( WFD_AGENT_CLEANUP ) ) {
        wp_schedule_event( time(), 'hourly', WFD_AGENT_CLEANUP );
    }
    return $written;
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
                'remaining' => max( 0, round( (int) $call->created + $timeout - microtime( true ), 3 ) ),
            );
        }
    }
    return null;
}

/**
 * POST wfd/v1/agent/poll.
 *
 * @param WP_REST_Request $request The request.
 * @return WP_REST_Response
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
    return rest_ensure_response(
        array(
            'active' => wfd_agent_is_active(),
            'call'   => wfd_agent_take_call( $board, $client ),
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
    $call->status  = 'done';
    $call->results = $body->results;
    if ( ! wfd_agent_write( $name, $call ) ) {
        return wfd_agent_write_error();
    }
    return rest_ensure_response( array( 'stored' => true ) );
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
