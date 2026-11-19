# Sources

Every statement in this spec carries a tag saying where it came from. The harness treats all tagged statements as binding. The tags exist so the product owner can audit the spec.

| Tag | Meaning |
|---|---|
| `[U]` | Decided by the product owner in conversation, a design comment, or the accepted "Locked defaults" list. |
| `[B1]` to `[B8]` | Stated on the whiteboard, in the numbered section. |
| `[D:Name]` | Shown on the design screen of that name (see `screens/`). |
| `[V]` | Verified in code: Gutenberg commit `e77b5057a91`, WordPress core `7.2-beta5`, or the WordPress for Writers plugin. |
| `[N]` | New in this spec. Written to close a gap, not yet seen by the product owner. Listed in "Needs approval" below. |

Whiteboard sections: 1 Information architecture, 2 Board screen wireframe, 3 Artboard kinds, 4 System parts, 5 Performance tiers, 6 Data streams, 7 Global styles, 8 Decisions.

## Needs approval

The list below is generated from every `[N]` tag in the spec. Until the product owner approves an item, the harness still builds it as written.

| # | File | Line | Statement |
|---|---|---|---|
| 1 | `acceptance.md` | 3 | Each criterion is one end-to-end test. The test's title starts with its ID. Tests live in `tests/e2e/{group}.spec.ts`, where the group is the middle part of the ID in lower case (`AC-TIER-01` is in `tier.spec.ts`). Structural checks read `data-wfd-*` attrib... |
| 2 | `acceptance.md` | 17 | AC-BOARD-03 Saving a layout with an unknown field or a wrong type is rejected with status 400. `[N]` |
| 3 | `acceptance.md` | 18 | AC-BOARD-04 Rename and Move to trash on a board card work; a trashed board leaves the list. `[N]` |
| 4 | `acceptance.md` | 20 | AC-BOARD-06 Reopening a board restores the user's last pan and zoom; a board never opened by this browser opens fitted to all artboards. `[N]` |
| 5 | `acceptance.md` | 34 | AC-CANVAS-04 The H8 menu items change zoom as named; "Fit all" shows every artboard. `[N]` |
| 6 | `acceptance.md` | 112 | AC-INS-03 With no artboard in edit, clicking a block row inserts nothing and the hint reads "Edit an artboard to insert blocks." `[N]` |
| 7 | `acceptance.md` | 144 | AC-SAVE-06 Discard all, after confirmation, reverts every edited record and removes unsaved new templates and parts from the board. `[N]` |
| 8 | `acceptance.md` | 154 | AC-STATE-06 An artboard whose entity no longer exists is removed from the board on load. `[N]` |
| 9 | `acceptance.md` | 160 | AC-A11Y-03 The automated accessibility scan used by WordPress's end-to-end utilities reports no violations on the Overview, Main, Styles and Review states. `[N]` |
| 10 | `api-allowlist.md` | 49 | Use WordPress public functions only. The ones this plugin needs: `register_post_type`, `add_menu_page`, `add_submenu_page`, `current_user_can`, `get_block_editor_settings`, `WP_Block_Editor_Context`, `block_editor_rest_api_preload`, `wp_enqueue_script`, `wp... |
| 11 | `api-allowlist.md` | 53 | `@wordpress/scripts` for build, lint and unit tests; `@wordpress/env` for the local WordPress; `@wordpress/e2e-test-utils-playwright` with Playwright for end-to-end tests; `@wordpress/theme-build-tools` for token linting. No other dev dependency without an ... |
| 12 | `architecture.md` | 14 | Uninstall / Deletes all `wfd_board` posts. Site content is untouched. / `[N]` |
| 13 | `architecture.md` | 49 | Thresholds use hysteresis so tiers do not flicker: an artboard changes tier at the stated zoom going down, and at the stated zoom plus 2 percentage points going up. `[B5]` for hysteresis, `[N]` for the 2 points |
| 14 | `architecture.md` | 50 | An artboard that has never been rendered goes straight to the Preview queue when eligible; until rendered it shows a `Skeleton`. `[N]` |
| 15 | `architecture.md` | 63 | The list view toggle is disabled when no artboard is in edit. `[N]` |
| 16 | `architecture.md` | 103 | Tab order and the Shift + arrow step are `[N]`. |
| 17 | `architecture.md` | 108 | Layout history lives in `board-store`: moves, device changes, adds and removals from the board. It lasts for the session. Removing an artboard with the "also delete" box checked is not undoable and clears nothing else. `[B8]` `[U]` `[N]` |
| 18 | `architecture.md` | 119 | "Style applies to" in the Block tab: "This block" edits the block's own attributes through the stock inspector. "All {block name}" shows `GlobalStylesUI` at that block's path in place of the stock inspector controls. `[B7]` `[D:Main]` `[N]` for the second s... |
| 19 | `architecture.md` | 123 | For each entity on the board, parse its content with `parse` from `@wordpress/blocks` and record, per block, the preset slugs it references: colours (`backgroundColor`, `textColor`, `gradient`, and `var:preset/color/…` values under `style`), font sizes (`fo... |
| 20 | `architecture.md` | 124 | Also count references in the merged global styles (root, elements and per-block entries). These add to a token's total but belong to no artboard. `[N]` |
| 21 | `architecture.md` | 125 | A token's use count is the number of referencing blocks across the board's entities, each entity counted once however many artboards show it, plus global styles references. `[N]` |
| 22 | `architecture.md` | 126 | Picking a token in the Tokens tab shows a banner on the canvas in the form "Showing where Brick is used: 3 places on 3 artboards", adds "· N use(s)" to the label of each artboard that uses it, and outlines the referencing blocks on Preview and Live artboard... |
| 23 | `architecture.md` | 131 | Tests run against a local WordPress with the Twenty Twenty-Five theme and a seeded board containing two pages, two templates, three template-part artboards (Header on Desktop and Mobile, Footer) and two patterns, matching the arrangement in `screens/images/... |
| 24 | `constraints.md` | 9 | C3 / `__experimental*` and `__unstable*` exports are used only through `src/adapter/experimental.js`, and only the ones `api-allowlist.md` marks experimental. / Same reason as C2; these can change without notice. / ESLint rule forbidding identifiers with th... |
| 25 | `constraints.md` | 29 | C23 / Every user-facing string goes through `@wordpress/i18n` with the text domain `wordpress-for-designers`. / WordPress convention. / ESLint `@wordpress/i18n-text-domain`. / `[N]` |
| 26 | `constraints.md` | 31 | C25 / No runtime dependency outside the allowlist. No state library, canvas library or screenshot library. / "Invent nothing"; the concept app's stack (Zustand, Vite) is not carried over. / `package.json` review; C1 lint. / `[U]` `[N]` |
| 27 | `data-model.md` | 32 | Post type registration: `[N]` |
| 28 | `data-model.md` | 39 | `post_title` is the board name. `post_content` holds the layout as a JSON string with this shape and no other fields: `[U]` for JSON storage, `[N]` for the field list |
| 29 | `data-model.md` | 58 | One board unit is one CSS pixel at 100% zoom. Artboard order in the array is the order of creation. `[N]` |
| 30 | `data-model.md` | 60 | The viewport (pan and zoom) is not stored on the board, because boards are shared. It is kept per user and per board in `localStorage` and restored on open; with nothing stored, the board opens fitted to all artboards. `[N]` |
| 31 | `data-model.md` | 62 | The server validates the JSON against this shape on save and rejects anything else with a 400. `[N]` |
| 32 | `data-model.md` | 73 | Until its first save, a new template or template part exists only in the browser session. Its artboard is not written to the board's layout until that save. Closing the tab before saving loses it; the unsaved-changes warning covers this. `[N]` |
| 33 | `data-model.md` | 77 | If the theme has no Header or Footer part, the new template's content is the one empty paragraph. `[N]` |
| 34 | `data-model.md` | 89 | When the entity is deleted, trashed or reset, every other artboard on any board that references it is handled on next load: a missing entity removes the artboard from that board. `[N]` |
| 35 | `data-model.md` | 96 | Saving never changes a page's or pattern's status. Publishing drafts is done in wp-admin. `[N]` |
| 36 | `out-of-scope.md` | 21 | Publishing a draft page or pattern from the board (done in wp-admin) / `[N]` |
| 37 | `screens/Boards.md` | 7 | **Source.** [U] [D:Boards]; "Untitled board", the card actions and the two omissions are [N] |
| 38 | `screens/DeleteDialog.md` | 7 | **Source.** [U]; wording for pages and user templates is [N] |
| 39 | `screens/InserterBlocks.md` | 7 | **Source.** [U]; the no-artboard hint is [N] |
| 40 | `screens/InserterMedia.md` | 7 | **Source.** [U]; the limit of 50 is [N] |
| 41 | `screens/Library.md` | 7 | **Source.** [U] [D:Library]; the copy rule for theme patterns is [N] |
| 42 | `screens/README.md` | 10 | Three things visible in the images are **not** built: the "⌘K" hint in the document bar, the zoom control at the bottom left of the canvas on the two editing screens (zoom lives in the header, H8), and dimming that covers only the canvas behind dialogs (dia... |
| 43 | `screens/README.md` | 26 | H7 / Document bar / Centred `Text` on a weak neutral surface; in edit, preceded by an `IconButton` with `arrowLeft` / Board name; in edit "{artboard name} · {Kind}", back button label "Back to the board" / Back button leaves edit. The bar itself is not clic... |
| 44 | `screens/README.md` | 27 | H8 / Zoom menu / `Menu` whose trigger shows the zoom as a percentage with `chevronDown` / Trigger label "Zoom"; items "Zoom in", "Zoom out", "Zoom to 50%", "Zoom to 100%", "Fit all", "Fit selection" / Items act on the viewport. "Fit selection" is disabled w... |
| 45 | `screens/README.md` | 38 | L3 / Group heading / `Text` heading-sm with a count at the right / "Pages", "Templates", "Template parts", "Patterns" / A group with no artboards is not shown. `[N]` |
| 46 | `screens/README.md` | 41 | Rows are ordered by name within a group, then Desktop, Tablet, Mobile. `[N]` |
| 48 | `screens/README.md` | 69 | The canvas background is the weak neutral surface. Dragging an artboard moves it freely; there is no snapping or grid. `[N]` |
| 49 | `screens/README.md` | 76 | S2 / Variation menu / `Menu`, trigger shows the active variation / "Variation: {name}"; "Variation: Default" when none / See `architecture.md`, Styles. Hidden when the theme has no variations. `[N]` for both fallbacks |
| 50 | `screens/README.md` | 78 | S4 / Tokens: Colors group / heading-sm "Colors" with "Uses" at the right; rows of `wpc.ColorIndicator`, name, hex in the mono font, use count; "Add color" `Button` minimal / / Clicking a row selects the token (usage highlight) and opens a `Popover` with `wp... |
| 51 | `screens/README.md` | 79 | S5 / Tokens: Typography group / heading-sm "Typography" / "Uses"; rows with an "Aa" sample, name, "{family} · {size} / {line height}", use count / / Clicking selects the token for usage highlight. Editing typography presets is done in the Blocks tab's stock... |
| 52 | `screens/README.md` | 80 | S6 / Tokens: Spacing group / heading-sm "Spacing"; one square per spacing preset with its px value under it / / Display only. `[N]` |
| 53 | `screens/README.md` | 92 | E7 / Kind tab: live notice / `Notice`, caution tone, templates and parts only / "Templates have no draft. Saving this one puts it live on every {purpose} of the site." for templates; "Template parts have no draft. Saving this one puts it live everywhere it ... |
| 54 | `screens/ResetDialog.md` | 7 | **Source.** [U]; hiding the checkbox is [N] |
| 55 | `screens/Review.md` | 7 | **Source.** [U] [D:Review]; each item's "Discard" control and what it does are D48 [U] and are not in the image; that control's variant and place, the wording of the discard confirmations, the five-line limit and the wording of block change lines are [N] |
| 56 | `screens/Selected.md` | 7 | **Source.** [U] [N] for this panel's content |
