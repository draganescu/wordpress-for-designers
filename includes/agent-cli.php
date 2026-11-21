<?php
/**
 * `wp wfd`: the command an agent harness runs (spec/agent/cli.md). Loaded
 * only under WP-CLI.
 *
 * @package WordPressForDesigners
 */

defined( 'ABSPATH' ) || exit;

/**
 * The runbook `wp wfd tools` prints before the tool list.
 *
 * @return string
 */
function wfd_agent_runbook() {
    return <<<'RUNBOOK'
# Working on a WordPress for Designers board

A board is a canvas of artboards. Each artboard shows one page, template, template part or pattern of this site with real blocks, at one device width. The designer has a board open in a browser and sees what you do as you do it.

How to work:
1. Run `wp wfd status`. If no board is listening, ask the designer to open one.
2. Run `wp wfd call board-get` to see the board's artboards, notes and selection.
3. Make changes with `wp wfd call <tool>`. Several changes that belong together go in one `wp wfd batch`.
4. Say what you changed and on which artboards.

Rules:
- Nothing you change is saved. Every change waits in Review, where the designer saves or discards it. Never offer to save.
- Blocks are changed in the artboard in edit. The block tools put the artboard in edit for you, and only one artboard is in edit at a time.
- Read a block with `blocks-get` before you change it. A path names a place, and the block there may have changed.
- A reference is a string that starts with `wfd-ref-`. Pass it wherever a tool takes an artboard, a path or a token. `board-get`, `blocks-get` and `styles-get` give the reference of everything they list.
- Templates and template parts have no draft. Tell the designer when a change to one will reach the live site once saved.
- If you change the site with other commands, run `wp wfd call board-refresh` afterwards so the board shows it.

Calling a tool:
  wp wfd call <tool> --<field>=<value> ...
  wp wfd call <tool> --input='<json object>'
A value that is valid JSON is read as JSON, so arrays and numbers can be passed as `--path='[0,2]'`. Anything else is read as a string.
The answer is one JSON object: {"ok":true,"result":...} or {"ok":false,"error":{"code":"...","message":"..."}}.
RUNBOOK;
}

/**
 * The tool list `wp wfd tools` prints after the runbook.
 *
 * @return string
 */
function wfd_agent_tool_list() {
    $lines = array( '# Tools' );
    foreach ( wfd_agent_tools() as $tool ) {
        $lines[]    = '';
        $lines[]    = '## ' . $tool['name'];
        $lines[]    = $tool['description'];
        $properties = isset( $tool['input']['properties'] ) ? (array) $tool['input']['properties'] : array();
        $required   = isset( $tool['input']['required'] ) ? (array) $tool['input']['required'] : array();
        if ( ! $properties ) {
            $lines[] = 'Input: none';
            continue;
        }
        $lines[] = 'Input:';
        foreach ( $properties as $field => $schema ) {
            $type = isset( $schema['enum'] ) ? $schema['enum'] : ( isset( $schema['type'] ) ? $schema['type'] : array() );
            $type = implode( ' | ', (array) $type );
            $lines[] = in_array( $field, $required, true )
                ? sprintf( '- %s (%s, required)', $field, $type )
                : sprintf( '- %s (%s)', $field, $type );
        }
    }
    return implode( "\n", $lines );
}

/**
 * Works on an open WordPress for Designers board.
 */
class WFD_Agent_Command {

    /**
     * Prints one JSON document and ends with the exit code.
     *
     * @param mixed $document The document.
     * @param int   $code     The exit code.
     */
    private function finish( $document, $code = 0 ) {
        WP_CLI::line( wp_json_encode( $document, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) );
        WP_CLI::halt( $code );
    }

    /**
     * Prints a failed envelope and ends with exit code 1.
     *
     * @param string $code    The error code.
     * @param string $message The message.
     */
    private function fail( $code, $message ) {
        $this->finish(
            array(
                'ok'    => false,
                'error' => array(
                    'code'    => $code,
                    'message' => $message,
                ),
            ),
            1
        );
    }

    /**
     * The value of a flag: as parsed when it is valid JSON, else the string.
     *
     * @param mixed $value The flag's value.
     * @return mixed
     */
    private function value( $value ) {
        if ( ! is_string( $value ) ) {
            return $value;
        }
        $parsed = json_decode( $value );
        return JSON_ERROR_NONE === json_last_error() ? $parsed : $value;
    }

    /**
     * The timeout in seconds, from --timeout.
     *
     * @param array $assoc_args The flags.
     * @return int
     */
    private function timeout( $assoc_args ) {
        if ( ! isset( $assoc_args['timeout'] ) ) {
            return 30;
        }
        $timeout = $assoc_args['timeout'];
        if ( ! is_string( $timeout ) || ! ctype_digit( $timeout ) || (int) $timeout < 1 || (int) $timeout > 120 ) {
            $this->fail( 'invalid_args', 'timeout must be a whole number of seconds from 1 to 120.' );
        }
        return (int) $timeout;
    }

    /**
     * Puts calls in the queue for a listening board, waits for the board's
     * answer and gives the results.
     *
     * @param array $calls      The entries, as objects with `tool` and `input`.
     * @param array $assoc_args The flags.
     * @return array One envelope per entry.
     */
    private function relay( $calls, $assoc_args ) {
        $timeout = $this->timeout( $assoc_args );
        wfd_agent_cleanup();

        $boards = wfd_agent_listening_boards();
        $none   = 'No board is listening. Open a board in WordPress for Designers; if one is open, reload it once.';
        if ( isset( $assoc_args['board'] ) ) {
            $board = (int) $assoc_args['board'];
            if ( ! in_array( $board, wp_list_pluck( $boards, 'id' ), true ) ) {
                $this->fail( 'no_board', $none );
            }
        } elseif ( ! $boards ) {
            $this->fail( 'no_board', $none );
        } elseif ( count( $boards ) > 1 ) {
            $named = array();
            foreach ( $boards as $listening ) {
                $named[] = sprintf( '%d "%s"', $listening['id'], $listening['title'] );
            }
            $this->fail( 'several_boards', sprintf( 'Several boards are open: %s. Pass --board=<id>.', implode( ', ', $named ) ) );
        } else {
            $board = $boards[0]['id'];
        }

        $id   = wp_generate_uuid4();
        $name = WFD_AGENT_CALL . $id;
        $now  = time();
        add_option(
            $name,
            wp_json_encode(
                array(
                    'id'      => $id,
                    'board'   => $board,
                    'calls'   => $calls,
                    'status'  => 'queued',
                    'created' => $now,
                    'expires' => $now + WFD_AGENT_CALL_LIFE,
                )
            ),
            '',
            false
        );

        $started = microtime( true );
        $call    = null;
        while ( microtime( true ) - $started < $timeout ) {
            usleep( 200000 );
            $call = wfd_agent_read( $name, false );
            if ( $call && isset( $call->status ) && 'done' === $call->status ) {
                break;
            }
        }
        delete_option( $name );
        if ( ! $call || ! isset( $call->status, $call->results ) || 'done' !== $call->status ) {
            $this->fail( 'timeout', sprintf( 'The board did not answer within %d seconds.', $timeout ) );
        }
        return (array) $call->results;
    }

    /**
     * Says which boards are listening.
     *
     * ## EXAMPLES
     *
     *     wp wfd status
     */
    public function status() {
        wfd_agent_touch();
        $status = array(
            'plugin' => WFD_VERSION,
            'boards' => wfd_agent_listening_boards(),
        );
        if ( ! $status['boards'] ) {
            $status['hint'] = 'No board is listening. Open a board in WordPress for Designers; if one is open, reload it once.';
        }
        $this->finish( $status );
    }

    /**
     * Says how to work on a board, and lists the tools.
     *
     * ## OPTIONS
     *
     * [--format=<format>]
     * : What to print.
     * ---
     * default: runbook
     * options:
     *   - runbook
     *   - json
     * ---
     *
     * @param array $args       Positional arguments.
     * @param array $assoc_args The flags.
     */
    public function tools( $args, $assoc_args ) {
        wfd_agent_touch();
        if ( isset( $assoc_args['format'] ) && 'json' === $assoc_args['format'] ) {
            WP_CLI::line( rtrim( wfd_agent_tools_json() ) );
            return;
        }
        WP_CLI::line( apply_filters( 'wfd_agent_runbook', wfd_agent_runbook() ) . "\n\n" . wfd_agent_tool_list() );
    }

    /**
     * Runs one tool on a listening board.
     *
     * ## OPTIONS
     *
     * <tool>
     * : The tool's name.
     *
     * [--<field>=<value>]
     * : A field of the tool's input. A value that is valid JSON is read as JSON.
     *
     * [--input=<json>]
     * : The tool's input as a JSON object.
     *
     * [--ref=<reference>]
     * : A reference, put in the tool's artboard field or else its slug field.
     *
     * [--board=<id>]
     * : The board to call, when several are listening.
     *
     * [--timeout=<seconds>]
     * : How long to wait for the board, 1 to 120. Default 30.
     *
     * @param array $args       Positional arguments.
     * @param array $assoc_args The flags.
     */
    public function call( $args, $assoc_args ) {
        wfd_agent_touch();
        $name = $args[0];
        $tool = null;
        foreach ( wfd_agent_tools() as $declared ) {
            if ( $declared['name'] === $name ) {
                $tool = $declared;
            }
        }
        if ( ! $tool ) {
            $this->fail( 'unknown_tool', sprintf( 'There is no tool named %s.', $name ) );
        }

        $input = new stdClass();
        if ( isset( $assoc_args['input'] ) ) {
            $input = json_decode( (string) $assoc_args['input'] );
            if ( ! is_object( $input ) ) {
                $this->fail( 'invalid_args', 'input must be a JSON object.' );
            }
        }
        $fields = isset( $tool['input']['properties'] ) ? (array) $tool['input']['properties'] : array();
        if ( isset( $assoc_args['ref'] ) ) {
            if ( isset( $fields['artboard'] ) ) {
                $input->artboard = (string) $assoc_args['ref'];
            } elseif ( isset( $fields['slug'] ) ) {
                $input->slug = (string) $assoc_args['ref'];
            } else {
                $this->fail( 'invalid_args', sprintf( 'ref cannot be used with %s: it has no artboard field and no slug field.', $name ) );
            }
        }
        foreach ( $assoc_args as $field => $value ) {
            if ( ! in_array( $field, array( 'input', 'ref', 'board', 'timeout' ), true ) ) {
                $input->$field = $this->value( $value );
            }
        }

        $results = $this->relay(
            array(
                array(
                    'tool'  => $name,
                    'input' => $input,
                ),
            ),
            $assoc_args
        );
        $envelope = isset( $results[0] ) ? $results[0] : null;
        if ( ! is_object( $envelope ) || ! isset( $envelope->ok ) ) {
            $this->fail( 'timeout', sprintf( 'The board did not answer within %d seconds.', $this->timeout( $assoc_args ) ) );
        }
        $this->finish( $envelope, $envelope->ok ? 0 : 1 );
    }

    /**
     * Runs several calls in order on one board.
     *
     * ## OPTIONS
     *
     * [--calls=<json>]
     * : A JSON array of 1 to 50 calls, each with a tool and an input. Read from standard input when absent.
     *
     * [--board=<id>]
     * : The board to call, when several are listening.
     *
     * [--timeout=<seconds>]
     * : How long to wait for the board, 1 to 120. Default 30.
     *
     * @param array $args       Positional arguments.
     * @param array $assoc_args The flags.
     */
    public function batch( $args, $assoc_args ) {
        wfd_agent_touch();
        $json  = isset( $assoc_args['calls'] ) ? (string) $assoc_args['calls'] : (string) stream_get_contents( STDIN );
        $calls = json_decode( $json );
        if ( ! is_array( $calls ) || count( $calls ) < 1 || count( $calls ) > 50 ) {
            $this->fail( 'invalid_args', 'calls must be a JSON array of 1 to 50 calls.' );
        }
        $entries = array();
        foreach ( $calls as $index => $call ) {
            if ( ! is_object( $call ) || ! isset( $call->tool ) || ! is_string( $call->tool ) ) {
                $this->fail( 'invalid_args', sprintf( 'calls[%d] must be an object with a tool.', $index ) );
            }
            $input = isset( $call->input ) ? $call->input : new stdClass();
            if ( ! is_object( $input ) ) {
                $this->fail( 'invalid_args', sprintf( 'calls[%d].input must be an object.', $index ) );
            }
            $entries[] = array(
                'tool'  => $call->tool,
                'input' => $input,
            );
        }

        $results = $this->relay( $entries, $assoc_args );
        $ok      = count( $results ) === count( $entries );
        foreach ( $results as $envelope ) {
            $ok = $ok && is_object( $envelope ) && ! empty( $envelope->ok );
        }
        $this->finish(
            array(
                'ok'      => $ok,
                'results' => $results,
            ),
            $ok ? 0 : 1
        );
    }
}

WP_CLI::add_command( 'wfd', 'WFD_Agent_Command' );
