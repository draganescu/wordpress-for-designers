<?php
/**
 * The demo's boards, in the order the Boards screen lists them.
 *
 * An item: kind, what it shows, device, x, y, and a height (a width for an
 * image). A note: x, y, colour, text.
 *
 * @package wfd-demo
 */

defined( 'ABSPATH' ) || exit;

return array(
    array(
        'title' => 'Site map',
        'items' => array(
            array( 'page', 'home', 'desktop', 0, 0, 7200 ),
            array( 'page', 'subscribe', 'desktop', 1760, 0, 4200 ),
            array( 'page', 'our-story', 'desktop', 3520, 0, 5600 ),
            array( 'page', 'wholesale', 'desktop', 5280, 0, 4200 ),
            array( 'page', 'brew-guides', 'desktop', 7040, 0, 3600 ),
            array( 'page', 'visit', 'desktop', 8800, 0, 1900 ),
        ),
        'notes' => array(
            array( 0, -360, 'yellow', 'Home. Hero, proof, this week\'s roasts, sourcing, brew guides, journal, subscribe.' ),
            array( 1760, -360, 'green', 'Subscribe is the page every button leads to. Three tiers, the middle one is the one we want.' ),
            array( 3520, -360, 'blue', 'The grower quote and the subscribe block are synced patterns. Change one, and Home, Our story and Wholesale change with it.' ),
            array( 7040, -360, 'pink', 'Brew guides needs real photography before launch.' ),
        ),
    ),
    array(
        'title' => 'Homepage, every screen',
        'items' => array(
            array( 'page', 'home', 'desktop', 0, 0, 7200 ),
            array( 'page', 'home', 'tablet', 2600, 0, 8200 ),
            array( 'page', 'home', 'mobile', 4500, 0, 11000 ),
            array( 'template-part', 'header', 'desktop', 6200, 0, 110 ),
            array( 'template-part', 'header', 'mobile', 6200, 1100, 90 ),
            array( 'template-part', 'footer', 'desktop', 6200, 2200, 560 ),
            array( 'template-part', 'footer', 'mobile', 6200, 3800, 900 ),
        ),
        'notes' => array(
            array( 2600, -420, 'yellow', 'One page, three widths. Edit any of them: it is the same page.' ),
            array( 6200, -420, 'blue', 'Header and footer are parts. They show on every page of the site.' ),
        ),
    ),
    array(
        'title' => 'Coffee pages, template and live data',
        'items' => array(
            array( 'template', 'single-coffee', 'desktop', 0, 0, 2400 ),
            array( 'browser', '/coffees/daybreak/', 'desktop', 1640, 0, 1100 ),
            array( 'browser', '/coffees/night-shift/', 'desktop', 3280, 0, 1100 ),
            array( 'browser', '/coffees/first-frost/', 'mobile', 4920, 0, 780 ),
            array( 'template', 'archive-coffee', 'desktop', 0, 3000, 1800 ),
            array( 'browser', '/coffees/', 'desktop', 1640, 3000, 1100 ),
            array( 'browser', '/coffees/', 'mobile', 3280, 3000, 780 ),
        ),
        'notes' => array(
            array( 0, -300, 'yellow', 'One template for every coffee. It shows the fields, not a coffee.' ),
            array( 1640, -300, 'green', 'These are browsers. Each one is the real page, with real data, as a visitor gets it.' ),
            array( 4920, -300, 'blue', 'Change the template on the left and watch all three before anything is saved.' ),
        ),
    ),
    array(
        'title' => 'Journal',
        'items' => array(
            array( 'template', 'home', 'desktop', 0, 0, 1900 ),
            array( 'template', 'single', 'desktop', 1640, 0, 2600 ),
            array( 'browser', '/journal/', 'desktop', 3280, 0, 1100 ),
            array( 'browser', '/meet-the-growers-of-guji/', 'desktop', 4920, 0, 1100 ),
            array( 'browser', '/meet-the-growers-of-guji/', 'mobile', 6560, 0, 780 ),
        ),
        'notes' => array(
            array( 1640, -300, 'yellow', 'The article template. Five articles use it today.' ),
        ),
    ),
    array(
        'title' => 'Shared patterns',
        'items' => array(
            array( 'pattern', 'subscribe-cta', 'desktop', 0, 0, 560 ),
            array( 'page', 'home', 'desktop', 1640, -5700, 7200 ),
            array( 'page', 'our-story', 'desktop', 3280, -4140, 5600 ),
        ),
        'notes' => array(
            array( 0, -300, 'yellow', 'One synced pattern, used at the foot of Home and Our story. Edit it here and both pages change.' ),
        ),
    ),
    array(
        'title' => 'Design system',
        'items' => array(
            array( 'pattern', 'announcement-bar', 'desktop', 0, 0, 60 ),
            array( 'pattern', 'stat-row', 'desktop', 0, 340, 300 ),
            array( 'pattern', 'subscribe-cta', 'desktop', 0, 920, 560 ),
            array( 'pattern', 'pricing-tiers', 'desktop', 0, 1760, 760 ),
            array( 'pattern', 'feature-split', 'desktop', 0, 2800, 900 ),
            array( 'pattern', 'grower-quote', 'desktop', 1640, 0, 760 ),
            array( 'pattern', 'newsletter', 'desktop', 1640, 1040, 260 ),
            array( 'pattern', 'pricing-tiers', 'mobile', 1640, 1760, 1900 ),
            array( 'pattern', 'subscribe-cta', 'mobile', 2440, 1760, 700 ),
            array( 'pattern', 'stat-row', 'mobile', 3240, 1760, 700 ),
            array( 'media', 'bag-daybreak.jpg', '', 4200, 0, 640 ),
            array( 'media', 'bag-slow-river.jpg', '', 4960, 0, 640 ),
            array( 'media', 'bag-night-shift.jpg', '', 5720, 0, 640 ),
            array( 'media', 'bag-paper-kite.jpg', '', 4200, 800, 640 ),
            array( 'media', 'bag-soft-landing.jpg', '', 4960, 800, 640 ),
            array( 'media', 'bag-first-frost.jpg', '', 5720, 800, 640 ),
            array( 'media', 'sunrise-arcs.jpg', '', 4200, 1600, 1400 ),
            array( 'media', 'tasting-wheel.jpg', '', 5720, 1600, 640 ),
        ),
        'notes' => array(
            array( 0, -300, 'yellow', 'Patterns, at desktop and phone width. Click the empty board to open Styles: every artboard here repaints as you change a colour or a font.' ),
            array( 4200, -300, 'pink', 'Packaging. The site takes its colours from the bags.' ),
        ),
    ),
    array(
        'title' => 'First Frost, winter campaign',
        'items' => array(
            array( 'page', 'first-frost', 'desktop', 0, 0, 2600 ),
            array( 'page', 'first-frost', 'mobile', 1900, 0, 3600 ),
            array( 'pattern', 'announcement-bar', 'desktop', 0, -420, 60 ),
            array( 'media', 'winter-lineup.jpg', '', 3000, 0, 900 ),
            array( 'media', 'bag-first-frost.jpg', '', 4040, 0, 600 ),
            array( 'media', 'peaks-clouds.jpg', '', 3000, 760, 600 ),
            array( 'media', 'alpine-lake.jpg', '', 3720, 760, 600 ),
            array( 'media', 'valley-clouds.jpg', '', 4440, 760, 600 ),
        ),
        'notes' => array(
            array( 3000, -300, 'blue', 'Goes live 1 December. The page is a draft until then.' ),
            array( 3280, -300, 'pink', 'Hero: navy with the ice bag, or the other way round?' ),
            array( 3560, -300, 'yellow', 'Mood: cold mornings, cloud in the valley, something warm in your hands.' ),
        ),
    ),
);
