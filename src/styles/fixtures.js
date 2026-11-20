/**
 * Fixed props that reproduce the Styles panel of each screen image in
 * spec/screens/images/. The site content is fixture data, not UI text.
 */
import {
    button,
    heading,
    image,
    navigation,
    paragraph,
    quote,
    siteLogo,
} from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import { blockPath } from './stock-screens';

const variations = [ { title: 'Paper' }, { title: 'Ink' } ];

const colors = [
    { slug: 'paper', name: 'Paper', color: '#f6f1e7', uses: 11 },
    { slug: 'ink', name: 'Ink', color: '#24211c', uses: 23 },
    { slug: 'brick', name: 'Brick', color: '#b4432b', uses: 3 },
    { slug: 'sand', name: 'Sand', color: '#e3dccd', uses: 9 },
];

const typography = [
    {
        slug: 'display',
        name: 'Display',
        family: 'Georgia',
        size: '48',
        lineHeight: '52',
        uses: 7,
        fontFamilyCss: 'Georgia, serif',
    },
    {
        slug: 'heading',
        name: 'Heading',
        family: 'Georgia',
        size: '28',
        lineHeight: '34',
        uses: 12,
        fontFamilyCss: 'Georgia, serif',
    },
    {
        slug: 'body',
        name: 'Body',
        family: 'System',
        size: '18',
        lineHeight: '28',
        uses: 31,
        fontFamilyCss: 'system-ui, sans-serif',
    },
];

const spacing = [
    { slug: '20', px: 8 },
    { slug: '30', px: 16 },
    { slug: '40', px: 24 },
    { slug: '50', px: 40 },
    { slug: '60', px: 64 },
];

const blocks = [
    {
        path: blockPath( 'core/button' ),
        title: 'Button',
        icon: button,
        changes: 2,
    },
    {
        path: blockPath( 'core/heading' ),
        title: 'Heading',
        icon: heading,
        changes: 1,
    },
    {
        path: blockPath( 'core/image' ),
        title: 'Image',
        icon: image,
        changes: 0,
    },
    {
        path: blockPath( 'core/navigation' ),
        title: 'Navigation',
        icon: navigation,
        changes: 0,
    },
    {
        path: blockPath( 'core/paragraph' ),
        title: 'Paragraph',
        icon: paragraph,
        changes: 0,
    },
    {
        path: blockPath( 'core/quote' ),
        title: 'Quote',
        icon: quote,
        changes: 0,
    },
    {
        path: blockPath( 'core/site-title' ),
        title: 'Site title',
        icon: siteLogo,
        changes: 0,
    },
];

const historyRows = [
    {
        id: 'unsaved',
        kind: 'unsaved',
        author: 'You',
        changes: [ 'Brick', 'Heading size' ],
    },
    {
        id: 214,
        kind: 'revision',
        date: 'Today, 09:12',
        author: 'Ana',
        changes: [ 'Block spacing' ],
    },
    {
        id: 209,
        kind: 'revision',
        date: '17 Nov, 16:40',
        author: 'Ana',
        changes: [ 'Brick', 'Sand' ],
    },
    {
        id: 198,
        kind: 'revision',
        date: '12 Nov, 11:05',
        author: 'Ana',
        changes: [ 'Body font size' ],
    },
    {
        id: 'theme',
        kind: 'theme',
        author: 'Writer Newsletter',
        changes: [ 'Reset to default' ],
    },
];

const base = {
    variations,
    activeVariation: 'Paper',
    tab: 'tokens',
    colors,
    typography,
    spacing,
    selectedToken: null,
    blockQuery: '',
    blockGroups: [
        { title: __( 'Blocks', 'wordpress-for-designers' ), rows: blocks },
    ],
    openBlock: null,
    historyRows,
    selectedHistoryId: null,
};

export const fixtures = {
    Overview: base,
    Styles: { ...base, selectedToken: { type: 'color', slug: 'brick' } },
    StylesBlocks: { ...base, tab: 'blocks' },
    StylesHistory: { ...base, tab: 'history', selectedHistoryId: 209 },
};
