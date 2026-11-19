/**
 * Fixed props that reproduce the inserter screens in spec/screens/images/.
 * The site content (The Slow Margin) is fixture data, not UI text.
 */
import {
    paragraph,
    heading,
    list,
    quote,
    image,
    gallery,
    buttons,
    columns,
    group,
    row,
    navigation,
    mapMarker,
    siteLogo,
} from '@wordpress/icons';

const blocks = [
    {
        category: { slug: 'text', title: 'Text' },
        items: [
            { name: 'core/paragraph', title: 'Paragraph', icon: paragraph },
            { name: 'core/heading', title: 'Heading', icon: heading },
            { name: 'core/list', title: 'List', icon: list },
            { name: 'core/quote', title: 'Quote', icon: quote },
        ],
    },
    {
        category: { slug: 'media', title: 'Media' },
        items: [
            { name: 'core/image', title: 'Image', icon: image },
            { name: 'core/gallery', title: 'Gallery', icon: gallery },
        ],
    },
    {
        category: { slug: 'design', title: 'Design' },
        items: [
            { name: 'core/buttons', title: 'Buttons', icon: buttons },
            { name: 'core/columns', title: 'Columns', icon: columns },
            { name: 'core/group', title: 'Group', icon: group },
            { name: 'core/row', title: 'Row', icon: row },
        ],
    },
    {
        category: { slug: 'theme', title: 'Theme' },
        items: [
            {
                name: 'core/navigation',
                title: 'Navigation',
                icon: navigation,
            },
            { name: 'core/site-title', title: 'Site title', icon: mapMarker },
            { name: 'core/site-logo', title: 'Site logo', icon: siteLogo },
        ],
    },
];

const patterns = [
    {
        source: 'user',
        items: [
            { id: 101, name: 'Hero', isOnBoard: true, usedIn: [] },
            { id: 102, name: 'Sign-off', isOnBoard: true, usedIn: [] },
        ],
    },
    {
        source: 'theme',
        themeName: 'Writer Newsletter',
        items: [
            {
                id: 'writer-newsletter/post-list',
                name: 'Post list',
                isOnBoard: false,
                usedIn: [],
            },
            {
                id: 'writer-newsletter/byline',
                name: 'Byline',
                isOnBoard: false,
                usedIn: [ 'Single post' ],
            },
            {
                id: 'writer-newsletter/comments',
                name: 'Comments',
                isOnBoard: false,
                usedIn: [],
            },
            {
                id: 'writer-newsletter/colophon',
                name: 'Colophon',
                isOnBoard: false,
                usedIn: [ 'Footer' ],
            },
            {
                id: 'writer-newsletter/about-page',
                name: 'About page',
                isOnBoard: false,
                usedIn: [],
            },
        ],
    },
];

const templates = [
    {
        id: 'writer-newsletter//front-page',
        name: 'Front page',
        isOnBoard: true,
    },
    { id: 'writer-newsletter//single', name: 'Single post', isOnBoard: true },
    { id: 'writer-newsletter//index', name: 'Index', isOnBoard: false },
    { id: 'writer-newsletter//page', name: 'Page', isOnBoard: false },
    { id: 'writer-newsletter//404', name: 'Page: 404', isOnBoard: false },
];

const templateParts = [
    { id: 'writer-newsletter//header', name: 'Header', isOnBoard: true },
    { id: 'writer-newsletter//footer', name: 'Footer', isOnBoard: true },
    { id: 'writer-newsletter//comments', name: 'Comments', isOnBoard: false },
];

const media = [
    { id: 201, filename: 'long-walk-home.jpg', width: 2400, height: 1600 },
    { id: 202, filename: 'desk-morning.jpg', width: 2000, height: 1333 },
    { id: 203, filename: 'ana-portrait.jpg', width: 1200, height: 1500 },
    { id: 204, filename: 'sunday-letter.jpg', width: 2400, height: 1600 },
    { id: 205, filename: 'margin-notes.png', width: 1600, height: 900 },
];

const lists = { blocks, patterns, templates, templateParts, media };

export const fixtures = {
    InserterBlocks: {
        ...lists,
        query: '',
        tab: 'blocks',
        liveArtboardName: 'Header',
    },
    InserterEmpty: {
        ...lists,
        query: 'carousel',
        tab: 'blocks',
        liveArtboardName: null,
    },
    InserterMedia: {
        ...lists,
        query: '',
        tab: 'media',
        liveArtboardName: 'Header',
    },
    InserterTemplates: {
        ...lists,
        query: '',
        tab: 'templates',
        liveArtboardName: null,
    },
    Library: {
        ...lists,
        query: '',
        tab: 'patterns',
        liveArtboardName: null,
    },
};
