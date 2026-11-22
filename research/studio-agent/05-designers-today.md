# WordPress for Designers: what an agent would meet

`[repo]` throughout: this repository at `master` `90e3a26`, version 0.2.0. Sources are `spec/`, `docs/state.md`, `includes/` and `src/`.

## What a canvas agent needs, and what is here

| Need | Paper / Pencil | Here today |
|---|---|---|
| The document | The open file; `get_basic_info`, `get_editor_state` | A board is a `wfd_board` post. REST `wp/v2/wfd-boards`, with a `layout` field: `version`, `artboards[]`, optional `notes[]`. The server validates the shape and answers 400 otherwise |
| The artboard list | In the document info | `layout.artboards`: `id`, `kind` (page, template, template-part, pattern, media, browser), `entityId` or `path`, `device`, `x`, `y`, `height` |
| What an artboard holds | Nodes in the file | Nothing on the board. An artboard references a WordPress entity (C10); content is that entity's blocks, read through core-data or REST |
| Selection | `get_selection` | `wfd/board` store: `getSelectedIds`, `getSelectedId`, `getLiveId`, `getBrowsingId`, `getEditId`, `getSelectedNoteId`. Per browser tab, not stored. Block selection lives in the Live artboard's block-editor registry |
| Tokens | `get_variables`, Figma sync | Global styles: palette, font sizes and families, spacing presets, through the `globalStyles` entity and the theme's `theme.json`. Style variations |
| Where a token is used | `search_all_unique_properties` | The usage index: per entity, per block, the preset slugs referenced, from parsed markup with no render (C16) |
| Small writes | `write_html`, `batch_design` | The stock block editor in the one Live artboard. Edits are core-data edited records until saved |
| Layout writes | Move and create artboards | Store actions for add, move, device, remove, notes, tidy up; autosaved to REST 2 s after a change, with a layout undo history |
| Seeing the result | `get_screenshot` | No image of an artboard. Bitmap snapshots are cut (`out-of-scope.md`), and no screenshot library may be added (C25). A browser artboard shows the real front end, with unsaved changes if asked (D57) |
| Empty space | `find_empty_space_on_canvas` | A click in the inserter places an artboard "in the middle of the view and clear of other artboards"; `src/shell/tidy.js` arranges rows by kind |
| A claim on an artboard | `start_working_on_nodes` | The WordPress post lock for pages and patterns (`wfd/v1/lock`), shown in the lock dialog. Templates and parts have no lock |
| Approval | Per-tool prompts; Git | Review changes: every unsaved item listed, saved one REST request per checked item, discardable one by one |
| Notes | Pencil has a `note` node | Notes on the board: plain text, four colours, in `layout.notes` |
| A live page | Pencil has a `browser` node | Browser artboards: a path on the site at a device width |

## Properties that shape any agent design

1. **Real entities.** There is no private canvas format. Anything an agent makes on a board is a page, pattern, template or part of the site. The Studio agent already makes those through WP-CLI and theme files.
2. **Unsaved by default.** Board edits stay in the browser's core-data registry until Review. An agent working through the page would produce the same reviewable list. An agent working through WP-CLI or REST writes saved content at once, and for templates and parts that is the live site (C13).
3. **One Live artboard** (C8), at 30% zoom or more (C18). A block-editor registry exists only for the Live artboard and the two warm ones. Blocks in other artboards are reachable as entity content (`editEntityRecord` on the shared core-data registry), which re-renders their Previews. `[inf]` Whether editing a non-Live artboard's blocks through core-data behaves well with tiers and undo needs a spike.
4. **Layout races.** The board autosaves its whole layout 2 seconds after any change and does not refetch. A layout written from outside while the board is open is overwritten by the next autosave, and is invisible until reload. `[inf]`
5. **Validation is on REST.** `wfd_validate_layout` runs for the REST field. A `wp post create --post_type=wfd_board` or a direct `post_content` write bypasses it. `[inf]`
6. **Permissions.** Everything needs `edit_theme_options` (C19). Studio's agent browser signs in as the administrator.
7. **Preview of unsaved changes** (D57). `wfd/v1/preview` keeps one user's unsaved changes for an hour so that front-end requests carrying that user's `wfd_preview` nonce render with them. This is the only place unsaved board state exists outside the browser tab.
8. **Devices, not sizes.** Desktop 1440, Tablet 780, Mobile 360 (C12). Studio's own screenshot viewports are 1040 and 390 wide.
9. **Minimum window.** Below 1180 px wide the board shows "Designing needs more space" (D49). Studio's preview pane can be narrower than that. `[inf]`
10. **No plugin UI inside an artboard** (C6), and the shell keeps the editor's familiar arrangement (C7). An agent's presence would have to live in the shell or outside the plugin, in Studio.
11. **Public APIs only** (C1 to C3) on WordPress 7.2. `@wordpress/abilities` is a core script module since 7.0, so it is available without the Gutenberg plugin, and it is absent from `spec/api-allowlist.md` today. `document.modelContext` is a browser API, which the allowlist does not cover.

## Entry points that exist

| Entry | Detail |
|---|---|
| Boards screen | `/wp-admin/admin.php?page=wfd-boards` |
| A board | `/wp-admin/admin.php?page=wfd-board&board={id}`, full screen with no wp-admin chrome |
| Boards REST | `wp/v2/wfd-boards`, field `layout` |
| Lock REST | `wfd/v1/lock`: check, take, refresh, release |
| Preview REST | `wfd/v1/preview` |
| Store | `wfd/board` on the page's `@wordpress/data` registry |
| Page config | `window.wfdConfig`: `boardId`, `editorSettings`, `theme`, `homeUrl`, `preview` |
| Demo | `demo/`: the Morrow theme, a seeding plugin with a WP-CLI command, seven boards; `blueprint.json` builds it in Playground |

## What is absent

- Any ability, MCP or WebMCP registration.
- A way for another process to learn what is selected or in edit.
- An image of an artboard.
- A marker that someone other than the user is working on an artboard, other than the post lock.
- Block-level addressing that outlives a session. `clientId` values are made anew on each parse.
