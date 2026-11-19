# Architecture

Part names in this file are fixed. Use them for the top-level folders under `src/` and in test names. How each part is written inside is yours to decide (see `CLAUDE.md`, rule 2).

## Server (PHP)

| Part | Responsibility | Source |
|---|---|---|
| Menu | Adds "Designer" to the wp-admin menu with sub-items "Boards" and "Add board". Requires `edit_theme_options`. | `[D:Boards]` `[U]` |
| Boards screen | A normal wp-admin page listing boards. | `[D:Boards]` |
| Board app page | A hidden admin page that prints the full-screen app with no wp-admin menu or toolbar, the way WordPress for Writers prints its editor page. | `[U]` `[V]` |
| Board post type | `wfd_board`, as in `data-model.md`, with server-side validation of the layout JSON. | `[U]` |
| Editor bootstrap | Passes block editor settings, block definitions and block assets to the app using the same public PHP functions wp-admin's editor uses (`get_block_editor_settings`, `WP_Block_Editor_Context`, REST preloading). Loaded once and shared by every editor. | `[B6]` `[V]` |
| Lock route | REST route `wfd/v1/lock` for pages and patterns: check, take, refresh and release the WordPress post lock with `wp_check_post_lock` and `wp_set_post_lock`. Requires `edit_theme_options` and permission to edit the post. | `[U]` |
| Uninstall | Deletes all `wfd_board` posts. Site content is untouched. | `[N]` |

## Client parts

| Part | Responsibility | Source |
|---|---|---|
| `shell` | Header, left panel, canvas area, right panel. Owns which panel content shows (see State rules). | `[B2]` `[U]` |
| `board-store` | A `@wordpress/data` store named `wfd/board`: artboard list, selection, which artboard is Live, layout undo history. Autosaves layout 2 s after the last change. | `[B4]` `[U]` |
| `viewport` | Pan and zoom state kept outside React. Writes one CSS transform on the canvas surface per animation frame and notifies React only when a gesture settles. | `[B4]` `[B6]` |
| `tier-scheduler` | Decides each artboard's tier from visibility and zoom, and mounts through a `@wordpress/priority-queue` queue. | `[B4]` `[B5]` `[V]` |
| `artboard-frame` | One per artboard: position, label, selection outline, tier content. | `[B4]` |
| `artboard-editor` | The Live editor: `BlockEditorProvider` on the entity via `useEntityBlockEditor`, `BlockCanvas`, `BlockTools`, keyboard shortcuts. Fills the chrome slots. Also holds the drag-from-anywhere layer (D40) in one file, `drag-anywhere.js`, used from two lines of the editor so that it can be deleted. | `[B4]` `[V]` |
| `artboard-preview` | Read-only blocks through `BlockPreview` in an iframe at the device width. | `[B5]` `[V]` |
| `artboard-snapshot` | A frozen copy of the last Preview render with no React root and no store subscription, behind one interface so a bitmap version can replace it. | `[B5]` `[B8]` |
| `chrome-slots` | Slots in the shell for block toolbar, inspector, list view. Only the Live editor fills them. | `[B4]` `[B6]` |
| `inserter` | The left-panel lists for Blocks, Patterns, Templates, Media. | `[U]` |
| `styles` | Tokens, Blocks and History tabs; one style compile per change; pushes one stylesheet to every mounted artboard. | `[B7]` |
| `usage-index` | Counts and locates uses of tokens and blocks per artboard from entity content. | `[U]` |
| `review` | The Review changes drawer. | `[D:Review]` |
| `lock` | Takes the post lock when a page or pattern is about to become Live, refreshes it while Live, releases it on leaving edit and on page unload, and shows the lock dialog (see `data-model.md`, Locks). | `[U]` |
| `adapter` | `private.js` and `experimental.js` (C2, C3). | `[B8]` |

## Tiers

| Tier | When | What is mounted | Interaction | Source |
|---|---|---|---|---|
| Ghost | The artboard is more than one viewport width or height outside the visible area | A sized box using the cached height | None | `[B5]` `[U]` |
| Snapshot | Zoom below 20%; or during any pan or zoom gesture; or the artboard would be a Preview but 12 Previews are already mounted | Frozen copy of the last Preview render | Select, move | `[B5]` `[U]` |
| Preview | Within one viewport of the visible area, zoom 20% or more, not Live | `artboard-preview` | Select, move, double-click to edit | `[B5]` `[U]` |
| Live | The one artboard in edit, zoom 30% or more (D37) | `artboard-editor` | Everything | `[B5]` `[U]` |

Rules:

- At most 12 Previews are mounted; the nearest to the viewport centre win. `[U]`
- Up to 2 editors that were Live most recently stay mounted but inactive, so returning to them is immediate. They do not fill chrome slots and hold no lock. `[B5]` `[U]`
- Mounting goes through the queue: nearest to the viewport centre first, one mount per idle slice. `[B5]`
- Thresholds use hysteresis so tiers do not flicker: an artboard changes tier at the stated zoom going down, and at the stated zoom plus 2 percentage points going up. `[B5]` for hysteresis, `[N]` for the 2 points
- An artboard that has never been rendered goes straight to the Preview queue when eligible; until rendered it shows a `Skeleton`. `[N]`
- A Snapshot artboard that has never been rendered has no frozen copy to show. Such artboards are rendered once each through the same queue, one at a time, nearest to the viewport centre first; the render is frozen as soon as its height stops changing and the artboard stays in the Snapshot tier throughout. Until then it shows a `Skeleton`. `[U]`
- When a shared thing changes (global styles, a part used by a template, a synced pattern), Live and Preview artboards update; Snapshots are marked stale and re-rendered the next time they become Previews. `[B5]`
- If zoom changes while an artboard is Live, it leaves edit and becomes a Preview. Panning does not leave edit. `[B8]` `[U]`
- The hysteresis rule applies to the 20% threshold only. Edit ends when the zoom settles below 30% and is not started again by zooming back in (D37). `[U]`
- The Live editor is drawn at screen size with only its canvas iframe scaled to the board's zoom, so that WordPress's block tools, which are placed correctly only at screen size, work at every zoom. The plugin adds no element of its own around or inside the canvas for this; it styles the elements WordPress renders (`spike-report.md`, "Editing below 100%"). `[V]`

## State rules

| State | Left panel | Right panel | Header | Source |
|---|---|---|---|---|
| Nothing selected | Artboards by kind | Styles | Document bar shows the board name | `[U]` `[D:Overview]` |
| An artboard selected | Artboards by kind, its row highlighted | Artboard settings | Same | `[U]` `[D:Selected]` |
| An artboard in edit | List view of its blocks when the list view toggle is on (on by default when entering edit); otherwise closed | Tabs: the entity (for example "Template part") and "Block" | Block toolbar shown; document bar shows the artboard's name and kind with a back arrow | `[U]` `[D:Main]` |
| Inserter toggle on (any state) | Inserter, replacing whatever was there | Unchanged | Toggle shows a close icon | `[U]` `[D:Library]` |

The list view toggle is disabled when no artboard is in edit. `[N]`

Hiding the panels (D32): `[U]`

- A hidden panel takes no room; the canvas area grows into it. The state rules above still decide what a panel holds; hiding only decides whether it is drawn.
- The left panel counts as shown only when it is not hidden and has something to show. In edit with the list view and the inserter both off it is not shown, and the left toggle reads "Show left panel"; pressing it then turns the list view on.
- Turning the inserter toggle or the list view toggle on shows the left panel if it was hidden.
- A hidden right panel stays hidden when the selection changes or an artboard enters or leaves edit.
- Cmd/Ctrl + \ hides both panels when either is shown, and shows both when neither is.
- Resting the pointer on the left or right edge of the canvas area shows the panel that is not shown on that side, exactly as its header toggle would. A pointer that crosses the edge with a button held does not.
- Nothing about this is stored. Both panels are shown each time a board opens.

## Data streams

| Stream | Source | Through | Lands in | Rate control | Source tag |
|---|---|---|---|---|---|
| Viewport | Wheel, pointer, keys | `viewport`, one frame at a time | One CSS transform | React hears only on settle | `[B6]` |
| Tiers | Viewport settle, selection and edit changes | `tier-scheduler` and the queue | Mount or unmount per artboard | One mount per idle slice, capped | `[B6]` |
| Content | Typing and block edits in Live | `useEntityBlockEditor` to the core-data edited record | Every artboard that references the entity | Previews re-render; Snapshots go stale | `[B6]` |
| Styles | Styles panel, variation switch, History preview | `globalStyles` edit, merge, generate once | One style element in every mounted artboard iframe | Once per animation frame while a control is dragged | `[B6]` `[B7]` |
| Chrome | Selection in the Live editor | SlotFill from the Live tree | Header toolbar, right panel, list view | Only Live fills | `[B6]` |
| Inserter | Block types, patterns, templates, media | core-data and blocks selectors | Inserter lists | Loaded once, filtered locally | `[B6]` `[U]` |
| Usage index | Entity records and global styles | Parse block markup, no render | Use counts and highlights in Styles | Rebuilt only for the entity that changed | `[B6]` `[U]` |
| Save | Dirty entity records | `review` | REST, one request per entity | Explicit | `[B6]` |
| Layout | Moves, adds, removals, device changes | `board-store` | `wfd-boards` REST | 2 s debounce | `[B6]` `[U]` |
| Boot | Server preload | Editor settings, assets, base styles | Shared by every editor | Once per session | `[B6]` |

## Events inside artboard iframes

Each artboard iframe forwards wheel, pinch (ctrl+wheel) and the board shortcuts to the shell. The shell coalesces them to one viewport update per animation frame. While an artboard is Live, plain wheel scrolling over it scrolls the board as elsewhere; keyboard input goes to the editor except the shortcuts marked "always" below. `[B8]`

## Keyboard map

Outside an artboard in edit: `[U]`

| Keys | Action |
|---|---|
| Space + drag, or middle-button drag | Pan |
| Cmd/Ctrl + wheel, Cmd/Ctrl + `+` / `-` | Zoom (always) |
| Shift + 1 | Fit all artboards (always) |
| Cmd/Ctrl + \ | Hide or show both side panels (always) |
| Shift + 2 | Fit the selected artboards |
| Tab / Shift + Tab | Move selection to the next or previous artboard in left-panel order |
| Enter | Edit the selected artboard; nothing with several selected |
| Arrow keys | Nudge the selected artboards by 1 unit; with Shift, 10 units |
| Delete / Backspace | Remove the selected artboard (opens the confirmation); with several selected, take them all off the board with no confirmation (D41) |
| Cmd/Ctrl + Z, Cmd/Ctrl + Shift + Z | Undo, redo layout |
| Esc | Clear selection |

While an artboard is in edit, a click on empty board leaves edit and clears the selection, and a click on another artboard leaves edit and selects it (D38). `[U]`

Inside an artboard in edit, the block editor's own shortcuts apply unchanged. Esc, pressed when the editor itself has nothing left to dismiss, leaves edit and keeps the artboard selected. Cmd/Ctrl + Z undoes content. `[U]` `[B1]`

Tab order and the Shift + arrow step are `[N]`.

## Undo

- Content history is core-data's undo stack. It is active while an artboard is Live. `[B8]`
- Layout history lives in `board-store`: moves, device changes, adds and removals from the board. It lasts for the session. Removing an artboard with the "also delete" box checked is not undoable and clears nothing else. `[B8]` `[U]` `[N]`
- The header's Undo and Redo act on the active history. Their tooltips name the action and scope, in the form "Undo {action}, in {artboard name}" and "Undo {action}, on the board" (the same with "Redo"). `[U]` `[D:Main]` `[D:Overview]`
- Action names. On the board: "move artboard", "change device", "add artboard", "remove artboard". In an artboard the action is always "edit" ("Undo edit, in Header"); WordPress keeps no name for a content change, so the "block spacing" in `images/Main.png` is not built. `[U]`

## Styles

- Inputs: the theme's base global styles, the user's `globalStyles` entity (edited record), and, only while a History revision is being previewed, that revision in place of the user record. `[B7]`
- One merge and one generate per change, using `mergeGlobalStyles` and `generateGlobalStyles`. The resulting stylesheet and settings are given to every mounted artboard. `[B7]` `[V]`
- Tokens tab: colours (palette), typography (font sizes and families presets), spacing (spacing scale presets), each row with its use count. Editing a token writes through `setSetting` / `setStyle`. `[B7]` `[D:Styles]` `[V]`
- Blocks tab: a searchable list of block types; choosing one opens `GlobalStylesUI` at that block's path. A block with user changes shows the count of changed properties. `[B7]` `[D:StylesBlocks]` `[V]`
- History tab: global styles revisions, newest first, plus "Unsaved" when there are edits and "Theme default" last. Picking one previews it on the whole board; Restore makes it the edited record; Stop previewing returns to the edited record. `[B7]` `[D:StylesHistory]` `[U]`
- Variation menu: lists the theme's style variations; choosing one replaces the user record's values with the variation's, as an edit that appears in Review. `[B7]` `[U]`
- "Style applies to" in the Block tab: "This block" edits the block's own attributes through the stock inspector. "All {block name}" shows `GlobalStylesUI` at that block's path in place of the stock inspector controls. `[B7]` `[D:Main]` `[N]` for the second sentence's mechanism

## Usage index

- For each entity on the board, parse its content with `parse` from `@wordpress/blocks` and record, per block, the preset slugs it references: colours (`backgroundColor`, `textColor`, `gradient`, and `var:preset|color|…` values under `style`), font sizes (`fontSize`), font families (`fontFamily`), spacing (`var:preset|spacing|…` under `style.spacing`). `[U]` `[N]` for the attribute list
- Also count references in the merged global styles (root, elements and per-block entries). These add to a token's total but belong to no artboard. `[N]`
- A token's use count is the number of referencing blocks across the board's entities, each entity counted once however many artboards show it, plus global styles references. `[N]`
- Picking a token in the Tokens tab shows a banner on the canvas in the form "Showing where Brick is used: 3 places on 3 artboards", adds "· N use(s)" to the label of each artboard that uses it, and outlines the referencing blocks on Preview and Live artboards. Snapshot and Ghost artboards show the label count only. `[D:Styles]` `[N]` for the Snapshot rule
- The index for an entity is rebuilt when that entity's edited record changes, and at no other time. `[U]`

## Fixture for tests

Tests run against a local WordPress with the Twenty Twenty-Five theme and a seeded board containing two pages, two templates, three template-part artboards (Header on Desktop and Mobile, Footer) and two patterns, matching the arrangement in `screens/images/Overview.png`. The colours and text in the images come from a different demo theme and are not asserted. `[N]`
