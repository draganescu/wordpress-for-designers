<?php
/**
 * The seed command of the demo site.
 *
 * @package wfd-demo
 */

defined( 'ABSPATH' ) || exit;

/**
 * Seeds Morrow Coffee Roasters.
 */
class WFD_Demo_Command {

    /**
     * Deletes the site's content and seeds the demo site.
     *
     * Every page, post, coffee, pattern, board, image, navigation menu and
     * customisation of a template, part or the styles is deleted first.
     *
     * ## OPTIONS
     *
     * [--yes]
     * : Do not ask before deleting.
     *
     * [--[no-]thumbnails]
     * : Keep only the full size of each image.
     *
     * @param array $args  Positional arguments.
     * @param array $assoc Named arguments.
     */
    public function seed( $args, $assoc ) {
        WP_CLI::confirm( 'This deletes all content of this site and seeds the demo. Go on?', $assoc );

        $seeder  = new WFD_Demo_Seeder();
        $summary = $seeder->run(
            array( 'thumbnails' => WP_CLI\Utils\get_flag_value( $assoc, 'thumbnails', true ) )
        );
        foreach ( $seeder->warnings as $warning ) {
            WP_CLI::warning( $warning );
        }
        WP_CLI::success( $summary );
    }
}
