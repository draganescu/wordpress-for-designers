/**
 * The import allowlist of spec/api-allowlist.md, as data. The ESLint rules for
 * C1 and C3 are generated from it (see eslint.config.cjs).
 *
 * `true` means every export of the package is allowed.
 */
const allowed = {
    '@wordpress/element': true,
    '@wordpress/i18n': [ '__', '_n', '_x', 'sprintf', 'isRTL' ],
    '@wordpress/data': [
        'useSelect',
        'useDispatch',
        'useRegistry',
        'createReduxStore',
        'register',
        'select',
        'dispatch',
        'subscribe',
        'RegistryProvider',
    ],
    '@wordpress/compose': [
        'useMergeRefs',
        'useDebounce',
        'useThrottle',
        'useResizeObserver',
        'useInstanceId',
        'usePrevious',
        'useViewportMatch',
        'useMediaQuery',
        'useRefEffect',
        'useEvent',
    ],
    '@wordpress/api-fetch': [ 'default' ],
    '@wordpress/url': [ 'addQueryArgs', 'getQueryArg' ],
    '@wordpress/keycodes': true,
    '@wordpress/keyboard-shortcuts': [
        'useShortcut',
        'ShortcutProvider',
        'store',
    ],
    '@wordpress/priority-queue': [ 'createQueue' ],
    '@wordpress/notices': [ 'store' ],
    '@wordpress/blocks': [
        'parse',
        'serialize',
        'createBlock',
        'getBlockType',
        'getBlockTypes',
        'getCategories',
        'store',
    ],
    '@wordpress/block-library': [ 'registerCoreBlocks' ],
    '@wordpress/core-data': [
        'store',
        'EntityProvider',
        'useEntityBlockEditor',
        'useEntityRecord',
        'useEntityRecords',
        'useEntityProp',
    ],
    '@wordpress/block-editor': [
        'BlockEditorProvider',
        'BlockContextProvider',
        'BlockCanvas',
        'BlockTools',
        'BlockList',
        'BlockInspector',
        'BlockToolbar',
        'BlockPreview',
        'BlockBreadcrumb',
        'BlockIcon',
        'BlockTitle',
        'BlockEditorKeyboardShortcuts',
        'WritingFlow',
        'ObserveTyping',
        'Inserter',
        'MediaUpload',
        'MediaUploadCheck',
        'useBlockEditingMode',
        'store',
    ],
    '@wordpress/editor': [
        'EntitiesSavedStates',
        'UnsavedChangesWarning',
        'ErrorBoundary',
        'EditorSnackbars',
    ],
    '@wordpress/components': [
        'Button',
        'DropdownMenu',
        'MenuGroup',
        'MenuItem',
        'Popover',
        'SearchControl',
        'SelectControl',
        'RangeControl',
        'CheckboxControl',
        'ColorIndicator',
        'ColorPalette',
        'Modal',
        'Notice',
        'Snackbar',
        'SnackbarList',
        'Spinner',
        'Tooltip',
        'Toolbar',
        'ToolbarGroup',
        'ToolbarButton',
        'SlotFillProvider',
        'Slot',
        'Fill',
        'createSlotFill',
        'VisuallyHidden',
        'Navigator',
        'TabPanel',
    ],
    '@wordpress/ui': [
        'Button',
        'IconButton',
        'ButtonLink',
        'Icon',
        'InputControl',
        'Stack',
        'Text',
        'Badge',
        'Tabs',
        'Menu',
        'Dialog',
        'AlertDialog',
        'Drawer',
        'Popover',
        'Tooltip',
        'Notice',
        'EmptyState',
        'Card',
        'Skeleton',
        'Spinner',
        'Link',
        'VisuallyHidden',
        'useEnableWpCompatOverlaySlot',
    ],
    '@wordpress/theme': [ 'ThemeProvider' ],
    '@wordpress/icons': true,
    '@wordpress/admin-ui': [ 'Page', 'NavigableRegion', 'Breadcrumbs' ],
    '@wordpress/dataviews': [ 'DataViews', 'filterSortAndPaginate' ],
    '@wordpress/global-styles-engine': [
        'getSetting',
        'setSetting',
        'getStyle',
        'setStyle',
        'getPalettes',
        'mergeGlobalStyles',
        'generateGlobalStyles',
        'areGlobalStylesEqual',
        'getGlobalStylesChanges',
    ],
    '@wordpress/global-styles-ui': [
        'GlobalStylesUI',
        'useGlobalStylesRevisions',
    ],
};

/**
 * Experimental exports. Importable only in src/adapter/experimental.js.
 */
const experimental = {
    '@wordpress/block-editor': [ '__experimentalListView' ],
    '@wordpress/components': [
        '__experimentalToggleGroupControl',
        '__experimentalToggleGroupControlOption',
        '__experimentalConfirmDialog',
        '__experimentalHStack',
        '__experimentalVStack',
        '__experimentalItemGroup',
        '__experimentalItem',
        '__experimentalText',
        '__experimentalHeading',
    ],
};

/**
 * Builds the `no-restricted-imports` options.
 *
 * @param {boolean} withExperimental Whether experimental exports are allowed.
 * @return {Object} Rule options.
 */
function restrictedImports( withExperimental ) {
    const paths = [];
    for ( const [ name, names ] of Object.entries( allowed ) ) {
        if ( names === true ) {
            continue;
        }
        const extra = withExperimental ? experimental[ name ] || [] : [];
        paths.push( {
            name,
            allowImportNames: [ ...names, ...extra ],
            message: 'Not in spec/api-allowlist.md (C1).',
        } );
    }
    const packages = Object.keys( allowed )
        .map( ( name ) => name.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' ) )
        .join( '|' );
    return {
        paths,
        patterns: [
            {
                regex: `^(?!\\.{1,2}/)(?!(${ packages })$)`,
                message:
                    'Only packages named in spec/api-allowlist.md may be imported (C1, C25).',
            },
        ],
    };
}

module.exports = { allowed, experimental, restrictedImports };
