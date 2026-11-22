<?php
/**
 * Plugin Name:       WordPress for Designers: Studio adapter
 * Version:           0.2.0
 * Requires at least: 7.2
 * Requires PHP:      7.4
 * Text Domain:       wfd-studio
 *
 * Uses the two hooks WordPress for Designers gives adapters and nothing else
 * of it. When that plugin is not active, or has no agent surface, neither
 * hook fires and this file does nothing.
 *
 * @package WFDStudio
 */

defined( 'ABSPATH' ) || exit;

// The pick layer, on the board page only.
add_action(
    'wfd_board_enqueue_assets',
    function () {
        wp_enqueue_script( 'wfd-studio-pick-layer', plugins_url( 'pick-layer.js', __FILE__ ), array(), '0.2.0', true );
    }
);

// What the selector of an annotation is, for the agent that reads
// `wp wfd tools`.
add_filter(
    'wfd_agent_runbook',
    function ( $text ) {
        $section = <<<'RUNBOOK'
Annotations from Studio:
- When the designer annotates a board with Studio's Annotate tool, the selector of an annotation on an artboard, a block, a note or a style token is a reference: `#wfd-ref-` and more. Pass it to a tool with `--ref`.
- The text that comes with it starts with what the thing is and where, for example "Heading · Home · Desktop", then what it reads.
- Read the block with `blocks-get --ref=<reference>` before changing it.
- A selector that does not start with `#wfd-ref-` is on the board's own interface or on a normal page of the site, and is handled as Studio always handles one.
RUNBOOK;
        return $text . "\n\n" . $section;
    }
);
