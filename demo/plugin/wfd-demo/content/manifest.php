<?php
/**
 * What the seed creates. A page, post, coffee or pattern has a file of the
 * same name in the folder of its kind.
 *
 * @package wfd-demo
 */

defined( 'ABSPATH' ) || exit;

return array(
    // The order matters: content refers to a synced pattern by its position.
    'patterns'   => array(
        'subscribe-cta'    => array( 'title' => 'Subscribe call to action', 'synced' => true ),
        'grower-quote'     => array( 'title' => 'Grower quote', 'synced' => true ),
        'newsletter'       => array( 'title' => 'Newsletter sign-up', 'synced' => true ),
        'stat-row'         => array( 'title' => 'Stat row' ),
        'pricing-tiers'    => array( 'title' => 'Pricing tiers' ),
        'feature-split'    => array( 'title' => 'Feature, image and text' ),
        'announcement-bar' => array( 'title' => 'Announcement bar' ),
    ),
    'pages'      => array(
        'home'        => array( 'title' => 'Home', 'front' => true, 'template' => 'page-no-title' ),
        'subscribe'   => array( 'title' => 'Subscribe', 'template' => 'page-no-title' ),
        'our-story'   => array( 'title' => 'Our story', 'template' => 'page-no-title' ),
        'wholesale'   => array( 'title' => 'Wholesale', 'template' => 'page-no-title' ),
        'brew-guides' => array( 'title' => 'Brew guides' ),
        'visit'       => array( 'title' => 'Visit', 'template' => 'page-no-title' ),
        'journal'     => array( 'title' => 'Journal', 'posts' => true ),
        'first-frost' => array( 'title' => 'First Frost, winter campaign', 'status' => 'draft', 'template' => 'page-no-title' ),
    ),
    // Oldest first.
    'posts'      => array(
        'why-we-roast-light'         => array( 'title' => 'Why we roast light', 'excerpt' => 'Dark roasts taste of roasting. Light roasts taste of where the coffee came from.', 'image' => 'beans-macro.jpg' ),
        'a-week-at-the-drying-beds'  => array( 'title' => 'A week at the drying beds', 'excerpt' => 'The least photographed part of coffee, and the one that ruins the most of it.', 'image' => 'drying-beds.jpg' ),
        'decaf-deserves-better'      => array( 'title' => 'Decaf deserves better', 'excerpt' => 'For years decaf was where bad coffee went to hide. It does not have to be.', 'image' => 'latte-croissant.jpg' ),
        'meet-the-growers-of-guji'   => array( 'title' => 'Meet the growers of Guji', 'excerpt' => 'Daybreak comes from 240 smallholders around one washing station. We went back.', 'image' => 'coffee-cherries.jpg' ),
        'how-to-brew-a-better-v60'   => array( 'title' => 'How to brew a better V60', 'excerpt' => 'It is not fussy. It only asks you to do the same thing twice in a row.', 'image' => 'latte-white.jpg' ),
    ),
    // Oldest first; the three newest are the homepage's roasts of the week.
    'coffees'    => array(
        'first-frost'  => array( 'title' => 'First Frost', 'excerpt' => 'The winter blend. Spiced plum and cocoa, here until February.', 'image' => 'bag-first-frost.jpg', 'meta' => array( 'morrow_origin' => 'Winter blend · Guatemala', 'morrow_process' => 'Washed + honey', 'morrow_notes' => 'Spiced plum, cocoa, orange peel', 'morrow_price' => '£13', 'morrow_roast' => 'Medium' ) ),
        'soft-landing' => array( 'title' => 'Soft Landing', 'excerpt' => 'Decaf for people who love coffee. Nothing missing but the caffeine.', 'image' => 'bag-soft-landing.jpg', 'meta' => array( 'morrow_origin' => 'Mexico · Chiapas', 'morrow_process' => 'Mountain water decaf', 'morrow_notes' => 'Milk chocolate, almond, honey', 'morrow_price' => '£12', 'morrow_roast' => 'Medium' ) ),
        'paper-kite'   => array( 'title' => 'Paper Kite', 'excerpt' => 'Sharp, juicy and unmistakably Kenyan. Blackcurrant first, grapefruit after.', 'image' => 'bag-paper-kite.jpg', 'meta' => array( 'morrow_origin' => 'Kenya · Nyeri', 'morrow_process' => 'Double washed', 'morrow_notes' => 'Blackcurrant, grapefruit, brown sugar', 'morrow_price' => '£14', 'morrow_roast' => 'Light' ) ),
        'night-shift'  => array( 'title' => 'Night Shift', 'excerpt' => 'Our espresso blend. Dense, sweet and built to cut through milk.', 'image' => 'bag-night-shift.jpg', 'meta' => array( 'morrow_origin' => 'Espresso blend · Brazil + Guatemala', 'morrow_process' => 'Natural + washed', 'morrow_notes' => 'Dark chocolate, hazelnut, molasses', 'morrow_price' => '£11', 'morrow_roast' => 'Medium dark' ) ),
        'slow-river'   => array( 'title' => 'Slow River', 'excerpt' => 'Sweet, round and happy in any brewer.', 'image' => 'bag-slow-river.jpg', 'meta' => array( 'morrow_origin' => 'Colombia · Huila', 'morrow_process' => 'Washed', 'morrow_notes' => 'Caramel, red apple, cocoa', 'morrow_price' => '£12', 'morrow_roast' => 'Light medium' ) ),
        'daybreak'     => array( 'title' => 'Daybreak', 'excerpt' => 'The coffee we drink first. Floral, bright and very hard to stop pouring.', 'image' => 'bag-daybreak.jpg', 'meta' => array( 'morrow_origin' => 'Ethiopia · Guji', 'morrow_process' => 'Washed', 'morrow_notes' => 'Bergamot, peach, jasmine', 'morrow_price' => '£13', 'morrow_roast' => 'Light' ) ),
    ),
    'navigation' => array(
        'Coffees'     => '/coffees/',
        'Subscribe'   => '/subscribe/',
        'Brew guides' => '/brew-guides/',
        'Journal'     => '/journal/',
        'Our story'   => '/our-story/',
    ),
);
