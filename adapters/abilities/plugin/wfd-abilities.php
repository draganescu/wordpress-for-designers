<?php
/**
 * Plugin Name:       WordPress for Designers: Abilities
 * Version:           0.2.0
 * Requires at least: 7.2
 * Requires PHP:      7.4
 * Text Domain:       wfd-abilities
 *
 * Registers one ability for each tool of WordPress for Designers and four of
 * its own, and hands every call to the board through the functions that
 * plugin gives adapters. When that plugin is not active, or WordPress has no
 * Abilities API, this file registers nothing.
 *
 * @package WFDAbilities
 */

defined( 'ABSPATH' ) || exit;

/**
 * The guide `wfd/board-open` returns.
 *
 * @return string The text.
 */
function wfd_abilities_guide() {
    return <<<'GUIDE'
# Working on a WordPress for Designers board

A board is a canvas of artboards. Each artboard shows one page, template, template part or pattern of this site with real blocks, at one device width. The board is a page in a browser, and the designer sees what you do on it as you do it.

How to work:
1. Open the address that came with this text in the browser you control, signed in to this site. Keep that page open and in view: the abilities act on it, and fail with `no_board` when it is closed or hidden.
2. Run `wfd/board-get` to see the board's artboards, notes and selection.
3. Make changes with the other `wfd/` abilities. Several changes that belong together go in one `wfd/batch`.
4. Say what you changed and on which artboards.

Rules:
- Nothing you change is saved. Every change waits in Review, where the designer saves or discards it. Never offer to save, and never press Save or any other control of the board yourself: work through the abilities.
- Blocks are changed in the artboard in edit. The block abilities put the artboard in edit for you, and only one artboard is in edit at a time.
- Read a block with `wfd/blocks-get` before you change it. A block is named by its place, and the block at that place may have changed.
- A reference is a string that starts with `wfd-ref-`. Pass it wherever an ability takes an artboard, a block or a token. `wfd/board-get`, `wfd/blocks-get` and `wfd/styles-get` give the reference of everything they list.
- Templates and template parts have no draft. Tell the designer when a change to one will reach the live site once saved.
- If you change the site in another way, run `wfd/board-refresh` afterwards so the board shows it.
- With several boards open, pass `board` with the id of the one you mean.
- To work on another board, run `wfd/board-open` for it and open its address.
- To make a new board, run `wfd/board-new` and open its address.
GUIDE;
}

/**
 * An error as an agent receives it. What carries abilities to an agent may
 * keep an error's message only, so the message starts with the code (D101).
 *
 * @param string $code    The error code.
 * @param string $message The message.
 * @return WP_Error
 */
function wfd_abilities_error( $code, $message ) {
    return new WP_Error( $code, $code . ': ' . $message );
}

/**
 * Hands calls to a listening board and waits for their envelopes.
 *
 * @param array $calls   The entries, each with `tool` and `input`.
 * @param array $input   The ability's input, for its `board`.
 * @param int   $timeout How long to wait, in seconds.
 * @return array|WP_Error The envelopes as the board sent them, or the relay's failure.
 */
function wfd_abilities_relay( $calls, $input, $timeout ) {
    $args = array(
        'source'  => 'abilities',
        'timeout' => $timeout,
    );
    if ( isset( $input['board'] ) ) {
        $args['board'] = $input['board'];
    }
    $answer = wfd_agent_relay( $calls, $args );
    if ( $answer['ok'] ) {
        return $answer['results'];
    }

    // The relay's own messages for these two name the command's flags.
    $code    = $answer['error']['code'];
    $message = $answer['error']['message'];
    if ( 'no_board' === $code ) {
        $message = 'No board is listening. Run wfd/board-open and open the address it returns in your browser. If the board is open, bring it into view, or reload it once.';
    } elseif ( 'several_boards' === $code ) {
        $message = str_replace( '--board=<id>', 'board', $message );
    }
    return wfd_abilities_error( $code, $message );
}

/**
 * Registers the category.
 */
function wfd_abilities_register_category() {
    if ( ! function_exists( 'wp_register_ability' ) || ! function_exists( 'wfd_agent_relay' ) ) {
        return;
    }
    wp_register_ability_category(
        'wfd',
        array(
            'label'       => 'WordPress for Designers',
            'description' => 'Work on a WordPress for Designers board that is open in a browser.',
        )
    );
}
add_action( 'wp_abilities_api_categories_init', 'wfd_abilities_register_category' );

/**
 * Registers the abilities: one for each tool, then the adapter's own four.
 * Labels and descriptions are not translated: agents read them.
 */
function wfd_abilities_register() {
    if ( ! function_exists( 'wp_register_ability' ) || ! function_exists( 'wfd_agent_relay' ) ) {
        return;
    }

    $readonly    = array( 'board-get', 'blocks-get', 'styles-get', 'review-list' );
    $destructive = array( 'artboard-remove', 'review-discard' );
    $board       = array(
        'type'    => 'integer',
        'minimum' => 1,
    );
    $shared      = array(
        'category'              => 'wfd',
        'required_capabilities' => array( 'edit_theme_options' ),
    );
    $meta        = function ( $is_readonly, $is_destructive ) {
        return array(
            'mcp'         => array( 'public' => true ),
            'annotations' => array(
                'readonly'    => $is_readonly,
                'destructive' => $is_destructive,
            ),
        );
    };

    foreach ( wfd_agent_tools() as $tool ) {
        $name                          = $tool['name'];
        $schema                        = $tool['input'];
        $schema['properties']['board'] = $board;
        if ( empty( $schema['required'] ) ) {
            $schema['default'] = new stdClass();
        }
        wp_register_ability(
            'wfd/' . $name,
            $shared + array(
                'label'            => $name,
                'description'      => $tool['description'],
                'input_schema'     => $schema,
                'meta'             => $meta( in_array( $name, $readonly, true ), in_array( $name, $destructive, true ) ),
                'execute_callback' => function ( $input = array() ) use ( $name ) {
                    $input = (array) $input;
                    $call  = $input;
                    // The page never sees `board`.
                    unset( $call['board'] );
                    $results = wfd_abilities_relay(
                        array(
                            array(
                                'tool'  => $name,
                                'input' => $call,
                            ),
                        ),
                        $input,
                        30
                    );
                    if ( is_wp_error( $results ) ) {
                        return $results;
                    }
                    $envelope = (array) $results[0];
                    if ( ! empty( $envelope['ok'] ) ) {
                        return $envelope['result'];
                    }
                    $error = (array) $envelope['error'];
                    return wfd_abilities_error( $error['code'], $error['message'] );
                },
            )
        );
    }

    wp_register_ability(
        'wfd/boards-list',
        $shared + array(
            'label'            => 'List boards',
            'description'      => 'List this site\'s WordPress for Designers boards, with the address of each and whether it is open in a browser.',
            'input_schema'     => array(
                'type'                 => 'object',
                'additionalProperties' => false,
                'default'              => new stdClass(),
            ),
            'meta'             => $meta( true, false ),
            'execute_callback' => function () {
                return array( 'boards' => wfd_agent_boards() );
            },
        )
    );

    wp_register_ability(
        'wfd/board-open',
        $shared + array(
            'label'            => 'Open a board',
            'description'      => 'Get the address of a board to open in your browser, and how to work on it. Run this before any other board ability.',
            'input_schema'     => array(
                'type'                 => 'object',
                'properties'           => array( 'board' => $board ),
                'required'             => array( 'board' ),
                'additionalProperties' => false,
            ),
            'meta'             => $meta( false, false ),
            'execute_callback' => function ( $input ) {
                foreach ( wfd_agent_boards() as $entry ) {
                    if ( $entry['id'] === $input['board'] ) {
                        wfd_agent_begin( 'abilities' );
                        return array(
                            'board' => $entry,
                            'guide' => wfd_abilities_guide(),
                        );
                    }
                }
                return wfd_abilities_error( 'not_found', sprintf( 'Board %d was not found.', $input['board'] ) );
            },
        )
    );

    wp_register_ability(
        'wfd/board-new',
        $shared + array(
            'label'            => 'Make a board',
            'description'      => 'Make a new, empty board and get its address to open in your browser, and how to work on it.',
            'input_schema'     => array(
                'type'                 => 'object',
                'properties'           => array( 'title' => array( 'type' => 'string' ) ),
                'additionalProperties' => false,
                'default'              => new stdClass(),
            ),
            'meta'             => $meta( false, false ),
            'execute_callback' => function ( $input = array() ) {
                $input = (array) $input;
                $entry = wfd_agent_board_new( isset( $input['title'] ) ? $input['title'] : '' );
                if ( isset( $entry['error'] ) ) {
                    return wfd_abilities_error( $entry['error']['code'], $entry['error']['message'] );
                }
                wfd_agent_begin( 'abilities' );
                return array(
                    'board' => $entry,
                    'guide' => wfd_abilities_guide(),
                );
            },
        )
    );

    wp_register_ability(
        'wfd/batch',
        $shared + array(
            'label'            => 'Run several calls',
            'description'      => 'Run several board abilities in order on one board, in one round trip. After the first failure the rest are skipped.',
            'input_schema'     => array(
                'type'                 => 'object',
                'properties'           => array(
                    'calls' => array(
                        'type'     => 'array',
                        'minItems' => 1,
                        'maxItems' => 50,
                        'items'    => array(
                            'type'       => 'object',
                            'properties' => array(
                                'tool'  => array( 'type' => 'string' ),
                                'input' => array( 'type' => 'object' ),
                            ),
                            'required'   => array( 'tool' ),
                        ),
                    ),
                    'board' => $board,
                ),
                'required'             => array( 'calls' ),
                'additionalProperties' => false,
            ),
            'meta'             => $meta( false, false ),
            'execute_callback' => function ( $input ) {
                $calls = array();
                foreach ( $input['calls'] as $call ) {
                    $calls[] = array(
                        // A leading `wfd/` is ignored.
                        'tool'  => 0 === strpos( $call['tool'], 'wfd/' ) ? substr( $call['tool'], 4 ) : $call['tool'],
                        'input' => isset( $call['input'] ) ? $call['input'] : array(),
                    );
                }
                $results = wfd_abilities_relay( $calls, $input, 60 );
                if ( is_wp_error( $results ) ) {
                    return $results;
                }
                $ok = true;
                foreach ( $results as $envelope ) {
                    $ok = $ok && ! empty( ( (array) $envelope )['ok'] );
                }
                return array(
                    'ok'      => $ok,
                    'results' => $results,
                );
            },
        )
    );
}
add_action( 'wp_abilities_api_init', 'wfd_abilities_register' );
