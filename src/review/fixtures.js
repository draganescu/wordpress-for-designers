/**
 * Props that reproduce the three Review images with fixed data. The site
 * content (The Slow Margin) is fixture data, not UI text.
 */
const styles = {
    key: 'styles',
    name: 'Styles',
    type: 'styles',
    changeCount: 2,
    lines: [ 'Brick #a33a24 to #b4432b', 'Heading size 26px to 28px' ],
    artboardCount: 4,
    isChecked: true,
};

const header = {
    key: 'template-part:slow-margin//header',
    name: 'Header',
    type: 'template-part',
    usedByCount: 3,
    lines: [
        'Navigation: block spacing 16px to 20px',
        'Navigation: added link "Members"',
    ],
    isChecked: true,
};

const about = {
    key: 'page:12',
    name: 'About',
    type: 'page',
    status: 'published',
    lines: [ 'Image and text: swapped column order' ],
    isChecked: true,
};

export const fixtures = {
    Review: {
        isOpen: true,
        items: [ styles, header, about ],
        isSaving: false,
    },
    ReviewEmpty: {
        isOpen: true,
        items: [],
        isSaving: false,
    },
    ReviewError: {
        isOpen: true,
        items: [ { ...header, hasError: true } ],
        isSaving: false,
    },
};
