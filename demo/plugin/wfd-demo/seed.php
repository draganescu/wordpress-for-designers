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
     * Attachment ids and URLs by file name.
     *
     * @var array
     */
    private $media = array();

    /**
     * Pattern ids by slug.
     *
     * @var array
     */
    private $patterns = array();

    /**
     * Pattern ids in manifest order, for the numbers content refers to.
     *
     * @var array
     */
    private $refs = array();

    /**
     * Page ids by slug.
     *
     * @var array
     */
    private $pages = array();

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
     * @param array $args  Positional arguments.
     * @param array $assoc Named arguments.
     */
    public function seed( $args, $assoc ) {
        WP_CLI::confirm( 'This deletes all content of this site and seeds the demo. Go on?', $assoc );

        require_once ABSPATH . 'wp-admin/includes/image.php';
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';

        $manifest = require WFD_DEMO_DIR . '/content/manifest.php';

        $this->wipe();
        $this->site();
        $this->media();
        $this->patterns( $manifest['patterns'] );
        $this->pages( $manifest['pages'] );
        $this->posts( $manifest['posts'], 'post' );
        $this->posts( $manifest['coffees'], 'coffee' );
        $this->navigation( $manifest['navigation'] );
        $boards = $this->boards( require WFD_DEMO_DIR . '/content/boards.php' );

        flush_rewrite_rules();

        WP_CLI::success( sprintf( 'Seeded %d images, %d patterns, %d pages, %d posts, %d coffees and %d boards.', count( $this->media ), count( $this->patterns ), count( $this->pages ), count( $manifest['posts'] ), count( $manifest['coffees'] ), count( $boards ) ) );
    }

    /**
     * Deletes everything the demo replaces.
     */
    private function wipe() {
        $types = array( 'page', 'post', 'coffee', 'wp_block', 'wfd_board', 'attachment', 'wp_navigation', 'wp_global_styles', 'wp_template', 'wp_template_part' );
        $ids   = get_posts(
            array(
                'post_type'   => $types,
                'post_status' => 'any, trash, auto-draft',
                'numberposts' => -1,
                'fields'      => 'ids',
            )
        );
        foreach ( $ids as $id ) {
            if ( 'attachment' === get_post_type( $id ) ) {
                wp_delete_attachment( $id, true );
            } else {
                wp_delete_post( $id, true );
            }
        }
    }

    /**
     * Sets the site's name, theme and addresses.
     */
    private function site() {
        switch_theme( 'morrow' );
        update_option( 'blogname', 'Morrow' );
        update_option( 'blogdescription', 'Coffee roasters' );
        update_option( 'permalink_structure', '/%postname%/' );
        update_option( 'posts_per_page', 9 );
        update_option( 'date_format', 'j M Y' );

        $term = get_term_by( 'slug', 'uncategorized', 'category' );
        if ( $term ) {
            wp_update_term(
                $term->term_id,
                'category',
                array(
                    'name' => 'Roastery',
                    'slug' => 'roastery',
                )
            );
        }
    }

    /**
     * Imports every image of the media folder.
     */
    private function media() {
        $credits = array();
        $file    = WFD_DEMO_DIR . '/media/credits.json';
        if ( file_exists( $file ) ) {
            foreach ( json_decode( file_get_contents( $file ), true ) as $credit ) {
                $credits[ $credit['file'] ] = $credit;
            }
        }
        $alts = require WFD_DEMO_DIR . '/content/alts.php';

        foreach ( array_merge( glob( WFD_DEMO_DIR . '/media/*.jpg' ), glob( WFD_DEMO_DIR . '/media/*.png' ) ) as $path ) {
            $name = basename( $path );
            $tmp  = wp_tempnam( $name );
            copy( $path, $tmp );
            $id = media_handle_sideload(
                array(
                    'name'     => $name,
                    'tmp_name' => $tmp,
                ),
                0,
                ucfirst( str_replace( '-', ' ', pathinfo( $name, PATHINFO_FILENAME ) ) )
            );
            if ( is_wp_error( $id ) ) {
                WP_CLI::warning( $name . ': ' . $id->get_error_message() );
                continue;
            }
            update_post_meta( $id, '_wp_attachment_image_alt', isset( $alts[ $name ] ) ? $alts[ $name ] : '' );
            if ( isset( $credits[ $name ] ) ) {
                wp_update_post(
                    array(
                        'ID'           => $id,
                        'post_excerpt' => 'CC0, WordPress Photo Directory: ' . $credits[ $name ]['source'],
                    )
                );
            }
            $size                 = wp_get_attachment_metadata( $id );
            $this->media[ $name ] = array(
                'id'     => $id,
                'url'    => wp_get_attachment_url( $id ),
                'width'  => (int) $size['width'],
                'height' => (int) $size['height'],
            );
        }

        if ( isset( $this->media['morrow-mark.png'] ) ) {
            update_option( 'site_logo', $this->media['morrow-mark.png']['id'] );
            update_option( 'site_icon', $this->media['morrow-mark.png']['id'] );
        }
    }

    /**
     * Reads a content file and puts the site's own addresses and ids in it.
     *
     * @param string $file Path below content/.
     * @return string
     */
    private function content( $file ) {
        $content = trim( file_get_contents( WFD_DEMO_DIR . '/content/' . $file ) );

        $content = preg_replace_callback(
            '#' . preg_quote( WFD_DEMO_HOST, '#' ) . 'media/([a-z0-9-]+\.(?:jpg|png))#',
            function ( $match ) {
                if ( ! isset( $this->media[ $match[1] ] ) ) {
                    WP_CLI::warning( 'No image ' . $match[1] );
                    return $match[0];
                }
                return $this->media[ $match[1] ]['url'];
            },
            $content
        );

        $content = preg_replace_callback(
            '#"ref":(' . substr( (string) WFD_DEMO_REF, 0, 3 ) . '\d{3})#',
            function ( $match ) {
                $index = (int) $match[1] - WFD_DEMO_REF - 1;
                if ( ! isset( $this->refs[ $index ] ) ) {
                    WP_CLI::warning( 'No pattern ' . $match[1] );
                    return $match[0];
                }
                return '"ref":' . $this->refs[ $index ];
            },
            $content
        );

        return str_replace( WFD_DEMO_HOST, home_url( '/' ), $content );
    }

    /**
     * Creates the patterns.
     *
     * @param array $patterns The manifest's patterns.
     */
    private function patterns( $patterns ) {
        foreach ( $patterns as $slug => $pattern ) {
            $id = wp_insert_post(
                wp_slash(
                    array(
                        'post_type'    => 'wp_block',
                        'post_status'  => 'publish',
                        'post_title'   => $pattern['title'],
                        'post_name'    => $slug,
                        'post_content' => $this->content( 'patterns/' . $slug . '.html' ),
                    )
                )
            );
            if ( empty( $pattern['synced'] ) ) {
                update_post_meta( $id, 'wp_pattern_sync_status', 'unsynced' );
            }
            $this->patterns[ $slug ] = $id;
            $this->refs[]            = $id;
        }
    }

    /**
     * Creates the pages and names the front page and the posts page.
     *
     * @param array $pages The manifest's pages.
     */
    private function pages( $pages ) {
        $order = 0;
        foreach ( $pages as $slug => $page ) {
            $file = WFD_DEMO_DIR . '/content/pages/' . $slug . '.html';
            $id   = wp_insert_post(
                wp_slash(
                    array(
                        'post_type'     => 'page',
                        'post_status'   => isset( $page['status'] ) ? $page['status'] : 'publish',
                        'post_title'    => $page['title'],
                        'post_name'     => $slug,
                        'menu_order'    => $order++,
                        'post_content'  => file_exists( $file ) ? $this->content( 'pages/' . $slug . '.html' ) : '',
                        'page_template' => isset( $page['template'] ) ? $page['template'] : '',
                    )
                )
            );
            $this->pages[ $slug ] = $id;
            if ( ! empty( $page['front'] ) ) {
                update_option( 'show_on_front', 'page' );
                update_option( 'page_on_front', $id );
            }
            if ( ! empty( $page['posts'] ) ) {
                update_option( 'page_for_posts', $id );
            }
        }
    }

    /**
     * Creates posts or coffees, oldest first.
     *
     * @param array  $posts The manifest's posts.
     * @param string $type  The post type.
     */
    private function posts( $posts, $type ) {
        $days = count( $posts ) * 6;
        foreach ( $posts as $slug => $post ) {
            $date = gmdate( 'Y-m-d 08:30:00', time() - $days * DAY_IN_SECONDS );
            $days -= 6;
            $id   = wp_insert_post(
                wp_slash(
                    array(
                        'post_type'     => $type,
                        'post_status'   => 'publish',
                        'post_title'    => $post['title'],
                        'post_name'     => $slug,
                        'post_excerpt'  => $post['excerpt'],
                        'post_date'     => $date,
                        'post_date_gmt' => $date,
                        'post_content'  => $this->content( ( 'coffee' === $type ? 'coffees/' : 'posts/' ) . $slug . '.html' ),
                    )
                )
            );
            if ( isset( $this->media[ $post['image'] ] ) ) {
                set_post_thumbnail( $id, $this->media[ $post['image'] ]['id'] );
            }
            if ( isset( $post['meta'] ) ) {
                foreach ( $post['meta'] as $key => $value ) {
                    update_post_meta( $id, $key, $value );
                }
            }
            if ( isset( $post['category'] ) ) {
                wp_set_object_terms( $id, $post['category'], 'category' );
            }
        }
    }

    /**
     * Creates the navigation menu the header shows.
     *
     * @param array $items Labels and paths.
     */
    private function navigation( $items ) {
        $content = '';
        foreach ( $items as $label => $path ) {
            $content .= '<!-- wp:navigation-link ' . wp_json_encode(
                array(
                    'label'          => $label,
                    'url'            => home_url( $path ),
                    'kind'           => 'custom',
                    'isTopLevelLink' => true,
                )
            ) . ' /-->' . "\n";
        }
        wp_insert_post(
            wp_slash(
                array(
                    'post_type'    => 'wp_navigation',
                    'post_status'  => 'publish',
                    'post_title'   => 'Main menu',
                    'post_content' => $content,
                )
            )
        );
    }

    /**
     * Creates the boards.
     *
     * An item is a list: kind, what it shows, device, x, y and, for some
     * kinds, a height. What it shows is a page or pattern slug, a template or
     * part slug, an image's file name or a browser's path.
     *
     * @param array $boards Board definitions.
     * @return array Board ids.
     */
    private function boards( $boards ) {
        $theme = get_stylesheet();
        $ids   = array();
        // Boards list newest first, so the first of the file is made last.
        $time = time() - count( $boards ) * 60;
        foreach ( array_reverse( $boards ) as $board ) {
            $artboards = array();
            foreach ( $board['items'] as $item ) {
                list( $kind, $what, $device, $x, $y ) = $item;
                $height                              = isset( $item[5] ) ? $item[5] : 900;
                $artboard                            = array(
                    'id'   => wp_generate_uuid4(),
                    'kind' => $kind,
                );
                if ( 'browser' === $kind ) {
                    $artboard += array(
                        'path'   => $what,
                        'device' => $device,
                        'x'      => $x,
                        'y'      => $y,
                        'height' => $height,
                        'shows'  => 'unsaved',
                    );
                } elseif ( 'media' === $kind ) {
                    if ( ! isset( $this->media[ $what ] ) ) {
                        WP_CLI::warning( 'No image ' . $what );
                        continue;
                    }
                    $image    = $this->media[ $what ];
                    $width    = isset( $item[5] ) ? $item[5] : min( 1440, $image['width'] );
                    $artboard += array(
                        'entityId' => $image['id'],
                        'x'        => $x,
                        'y'        => $y,
                        'width'    => $width,
                        'height'   => round( $width * $image['height'] / $image['width'] ),
                    );
                } else {
                    if ( 'page' === $kind ) {
                        $entity = isset( $this->pages[ $what ] ) ? $this->pages[ $what ] : 0;
                    } elseif ( 'pattern' === $kind ) {
                        $entity = isset( $this->patterns[ $what ] ) ? $this->patterns[ $what ] : 0;
                    } else {
                        $entity = $theme . '//' . $what;
                    }
                    if ( ! $entity ) {
                        WP_CLI::warning( 'Nothing called ' . $what );
                        continue;
                    }
                    $artboard += array(
                        'entityId' => $entity,
                        'device'   => $device,
                        'x'        => $x,
                        'y'        => $y,
                        'height'   => $height,
                    );
                }
                $artboards[] = $artboard;
            }

            $layout = array(
                'version'   => 1,
                'artboards' => $artboards,
            );
            if ( ! empty( $board['notes'] ) ) {
                $layout['notes'] = array();
                foreach ( $board['notes'] as $note ) {
                    $layout['notes'][] = array(
                        'id'    => wp_generate_uuid4(),
                        'x'     => $note[0],
                        'y'     => $note[1],
                        'text'  => $note[3],
                        'color' => $note[2],
                    );
                }
            }

            $error = function_exists( 'wfd_layout_error' ) ? wfd_layout_error( $layout ) : true;
            if ( true !== $error ) {
                WP_CLI::warning( $board['title'] . ': ' . $error );
            }

            $time += 60;
            $ids[] = wp_insert_post(
                array(
                    'post_type'     => 'wfd_board',
                    'post_status'   => 'publish',
                    'post_title'    => $board['title'],
                    'post_date'     => gmdate( 'Y-m-d H:i:s', $time ),
                    'post_date_gmt' => gmdate( 'Y-m-d H:i:s', $time ),
                    'post_content'  => wp_slash( wp_json_encode( $layout ) ),
                )
            );
        }
        return $ids;
    }
}
