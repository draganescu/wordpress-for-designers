# API allowlist

Import only what is listed here. "WP script" means use the script handle WordPress ships and mark the package external in the build. "Bundled" means install from npm and bundle. Every export below was found in Gutenberg commit `e77b5057a91`; `[V]` applies to the whole file unless a row says otherwise.

"Exp." marks experimental exports. They may be imported only in `src/adapter/experimental.js` and re-exported under a plain name (C3).

## JavaScript

| Package | Delivery | Allowed exports | Exp. |
|---|---|---|---|
| `@wordpress/element` | WP script | React API as re-exported | |
| `@wordpress/i18n` | WP script | `__`, `_n`, `_x`, `sprintf`, `isRTL` | |
| `@wordpress/data` | WP script | `useSelect`, `useDispatch`, `useRegistry`, `createReduxStore`, `register`, `select`, `dispatch`, `subscribe`, `RegistryProvider` | |
| `@wordpress/compose` | WP script | `useMergeRefs`, `useDebounce`, `useThrottle`, `useResizeObserver`, `useInstanceId`, `usePrevious`, `useViewportMatch`, `useMediaQuery`, `useRefEffect`, `useEvent` | |
| `@wordpress/api-fetch` | WP script | default export | |
| `@wordpress/url` | WP script | `addQueryArgs`, `getQueryArg` | |
| `@wordpress/keycodes` | WP script | all | |
| `@wordpress/keyboard-shortcuts` | WP script | `useShortcut`, `ShortcutProvider`, `store` | |
| `@wordpress/priority-queue` | WP script | `createQueue` | |
| `@wordpress/notices` | WP script | `store` | |
| `@wordpress/blocks` | WP script | `parse`, `serialize`, `createBlock`, `getBlockType`, `getBlockTypes`, `getCategories`, `store` | |
| `@wordpress/block-library` | WP script | `registerCoreBlocks` | |
| `@wordpress/media-utils` | WP script | `uploadMedia` | Only as the `mediaUpload` editor setting (D117) |
| `@wordpress/core-data` | WP script | `store`, `EntityProvider`, `useEntityBlockEditor`, `useEntityRecord`, `useEntityRecords`, `useEntityProp`; store actions `editEntityRecord`, `clearEntityRecordEdits`, `saveEntityRecord`, `saveEditedEntityRecord`, `deleteEntityRecord`, `undo`, `redo`; store selectors `getEntityRecord`, `getEntityRecords`, `getEditedEntityRecord`, `hasEditsForEntityRecord`, `getEntityRecordEdits`, `isSavingEntityRecord`, `getLastEntitySaveError`, `canUser`, `hasUndo`, `hasRedo`, `getRevisions`, `getBlockPatterns`, `getBlockPatternCategories`, `getCurrentTheme` | |
| `@wordpress/core-data` | WP script | store selectors `__experimentalGetDirtyEntityRecords`, `__experimentalGetCurrentGlobalStylesId`, `__experimentalGetCurrentThemeBaseGlobalStyles`, `__experimentalGetCurrentThemeGlobalStylesVariations` | Exp. |
| `@wordpress/block-editor` | WP script | `BlockEditorProvider`, `BlockContextProvider`, `BlockCanvas`, `BlockTools`, `BlockList`, `BlockInspector`, `BlockToolbar`, `BlockPreview`, `BlockBreadcrumb`, `BlockIcon`, `BlockTitle`, `BlockEditorKeyboardShortcuts`, `WritingFlow`, `ObserveTyping`, `Inserter`, `MediaUpload`, `MediaUploadCheck`, `useBlockEditingMode`, `store` | |
| `@wordpress/block-editor` | WP script | `__experimentalListView` | Exp. |
| `@wordpress/editor` | WP script | `EntitiesSavedStates`, `UnsavedChangesWarning`, `ErrorBoundary`, `EditorSnackbars` | |
| `@wordpress/components` | WP script | `Button`, `DropdownMenu`, `MenuGroup`, `MenuItem`, `Popover`, `SearchControl`, `SelectControl`, `RangeControl`, `CheckboxControl`, `ColorIndicator`, `ColorPalette`, `Modal`, `Notice`, `Snackbar`, `SnackbarList`, `Spinner`, `Tooltip`, `Toolbar`, `ToolbarGroup`, `ToolbarButton`, `SlotFillProvider`, `Slot`, `Fill`, `createSlotFill`, `VisuallyHidden`, `Navigator`, `TabPanel` | |
| `@wordpress/components` | WP script | `__experimentalToggleGroupControl`, `__experimentalToggleGroupControlOption`, `__experimentalConfirmDialog`, `__experimentalHStack`, `__experimentalVStack`, `__experimentalItemGroup`, `__experimentalItem`, `__experimentalText`, `__experimentalHeading` | Exp. |
| `@wordpress/ui` | Bundled | `Button`, `IconButton`, `ButtonLink`, `Icon`, `InputControl`, `Stack`, `Text`, `Badge`, `Tabs`, `Menu`, `Dialog`, `AlertDialog`, `Drawer`, `Popover`, `Tooltip`, `Notice`, `EmptyState`, `Card`, `Skeleton`, `Spinner`, `Link`, `VisuallyHidden`, `useEnableWpCompatOverlaySlot` | |
| `@wordpress/theme` | WP script (style handle `wp-theme`) | `ThemeProvider`; the `--wpds-*` custom properties | |
| `@wordpress/icons` | Bundled | any icon | |
| `@wordpress/admin-ui` | Bundled | `Page`, `NavigableRegion`, `Breadcrumbs` | |
| `@wordpress/dataviews` | Bundled | `DataViews`, `filterSortAndPaginate` | |
| `@wordpress/global-styles-engine` | Bundled, release 2.2.0 exactly (D59) | `getSetting`, `setSetting`, `getStyle`, `setStyle`, `getPalettes`, `mergeGlobalStyles`, `generateGlobalStyles`, `areGlobalStylesEqual`, `getGlobalStylesChanges` | |
| `@wordpress/global-styles-ui` | Bundled, release 2.0.0 exactly (D59) | `GlobalStylesUI`, `useGlobalStylesRevisions` | |

One global is read besides these exports: `window.__experimentalBlockDragFromAnywhere`, the flag WordPress sets when its own "Drag blocks from anywhere" experiment is on. It is read only in `src/adapter/experimental.js`, to make the plugin's layer stand down (D40). `[U]`

The two styles packages are pinned in `package.json` to the releases named in their rows, with no range (D59). `@wordpress/global-styles-ui` uses private functions of the `@wordpress/block-editor` that WordPress ships and of `@wordpress/global-styles-engine`, so the three have to match: 2.0.0 is the newest release of it that runs on WordPress 7.2, and it was tested with engine 2.2.0. Its exports in the table are the same in that release. A release of either is raised only for a WordPress that has shipped. `[U]`

Prefer `@wordpress/ui` when both it and `@wordpress/components` have a component (C4). Call `useEnableWpCompatOverlaySlot()` once at the app root, because the two libraries are mixed and `@wordpress/ui` is bundled. `[V]`

The agent surface (D65) uses these members of stores the table already allows, through the Live editor's registry and the page's registry. They are listed so the use is deliberate; none is a new import. `[N]`; if one is missing in the WordPress built against, apply `CLAUDE.md`, rule 4.

| Store | Selectors | Actions |
|---|---|---|
| `core/block-editor` (`store` of `@wordpress/block-editor`) | `getBlocks`, `getBlock`, `getBlockName`, `getBlockAttributes`, `getBlockRootClientId`, `getBlockIndex`, `getBlockEditingMode`, `canInsertBlockType`, `canRemoveBlocks`, `canMoveBlocks` | `updateBlockAttributes`, `insertBlocks`, `removeBlocks`, `moveBlockToPosition` |
| `@wordpress/data` | `registry.batch`; of every store, the resolution members `hasFinishedResolution`, `getResolutionError`, `hasResolvingSelectors`, `invalidateResolution`, `invalidateResolutionForStore`, `startResolution`, `finishResolution`; `registry.resolveSelect` (D85, OQ-20) | |

The surface's chunk is loaded with the build's own dynamic `import()`. No package is added for the agent surface: not a schema validator, not an MCP or WebMCP library, not an AI SDK (C25, C26). `[U]`

## Not allowed

- `@wordpress/edit-post`, `@wordpress/edit-site`, `@wordpress/interface`, `@wordpress/lazy-editor`'s `Editor` and `Preview`, `EditorProvider` from `@wordpress/editor` (C5).
- `PostLockedModal` from `@wordpress/editor`, and the `core/editor` store whether imported or addressed by name (D31).
- `__experimentalLibrary` from `@wordpress/block-editor`: the inserter lists are built by the plugin (C17).
- `privateApis` or `unlock` from any package, outside `src/adapter/private.js` (C2).
- Any package not in the table: no state, canvas, drag-and-drop, screenshot, utility or CSS-in-JS library (C25).

## PHP

Use WordPress public functions only. The ones this plugin needs: `register_post_type`, `add_menu_page`, `add_submenu_page`, `current_user_can`, `get_block_editor_settings`, `WP_Block_Editor_Context`, `block_editor_rest_api_preload`, `wp_enqueue_script`, `wp_enqueue_style`, `wp_add_inline_script`, `wp_set_script_translations`, `iframe_header`, `iframe_footer`, `wp_check_post_lock`, `wp_set_post_lock`, `register_rest_field`, `register_rest_route`, `rest_ensure_response`. `[V]` Another public function may be used without an open question; a private or `_`-prefixed one may not. `[N]`

For the agent surface (D65) the plugin also uses `WP_CLI::add_command` and WP-CLI's own output functions, under WP-CLI only; `add_option`, `get_option`, `update_option` and `delete_option`; `$wpdb` with `prepare` and `esc_like`, to find and read the relay's own option rows without a cache, and for one conditional `UPDATE` of a call's own row that claims it for one page, followed by `wp_cache_delete` for that option (D85); `wp_schedule_event`, `wp_next_scheduled`, `wp_clear_scheduled_hook` and `register_deactivation_hook`; `wp_generate_uuid4`; `do_action` and `apply_filters`. `[N]`

## Build and test tooling

`@wordpress/scripts` for build, lint and unit tests; `@wordpress/env` for the local WordPress; `@wordpress/e2e-test-utils-playwright` with Playwright for end-to-end tests; `@wordpress/theme-build-tools` for token linting. No other dev dependency without an open question. `[N]`

## Known risks to settle in Milestone 0

- `EntitiesSavedStates` comes from `@wordpress/editor` and must work without `EditorProvider`. Settled: it does (`spike-report.md`). `PostLockedModal` does not and was replaced by the plugin lock route and dialog (D31). `[U]`
- Editing with block tools positioned correctly. Settled: correct at 30% zoom and more with the structure and CSS in `spike-report.md`, "Editing below 100%" (C18, D37). `[U]`
- A frozen Snapshot that keeps exact appearance with no React root. Outcome unknown.

The end-to-end tests of the agent surface run `wp wfd` in the test environment's WP-CLI container (`wp-env run cli`), started from the test with Node's own `child_process`. No dev dependency is added for this. `[N]`
