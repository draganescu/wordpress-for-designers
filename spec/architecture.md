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
| Preview route | REST route `wfd/v1/preview` (D57): takes an open board page's unsaved changes and keeps them for the current user on this site, apart from those of that user's other open board pages, for an hour after the page last sent them; removes them when the list is empty. It answers whether that page's changes were still kept, so the board can reload its browsers when they were not. Requires `edit_theme_options`. | `[U]` |
| Preview layer | On a front-end request from a user with `edit_theme_options` whose `wfd_preview` argument holds a nonce of that user and names one of that user's open board pages, puts that page's kept changes in place of the saved content through public filters: posts and parts found by queries, block templates and parts, synced patterns and navigation menus as they render, global styles, and the site's title, tagline and logo. The page is sent with no-cache headers. It never acts on a request to the REST API. The nonce is given to the board with its page and again with each answer of the preview route. | `[U]` |
| Uninstall | Deletes all `wfd_board` posts and every user's unsaved changes kept for previews (D57). Site content is untouched. | `[N]` |

## Client parts

| Part | Responsibility | Source |
|---|---|---|
| `shell` | Header, left panel, canvas area, right panel. Owns which panel content shows (see State rules). | `[B2]` `[U]` |
| `board-store` | A `@wordpress/data` store named `wfd/board`: artboard list, notes (D46), selection, which artboard is Live, which browser is browsed (D55), layout undo history. Autosaves layout 2 s after the last change. | `[B4]` `[U]` |
| `viewport` | Pan and zoom state kept outside React. Writes one CSS transform on the canvas surface per animation frame and notifies React only when a gesture settles. | `[B4]` `[B6]` |
| `tier-scheduler` | Decides each artboard's tier from visibility and zoom, and mounts through a `@wordpress/priority-queue` queue. | `[B4]` `[B5]` `[V]` |
| `artboard-frame` | One per artboard: position, label, selection outline, tier content. Also draws a browser's page (D55), and holds the client side of the preview of unsaved changes (D57) in one file, `preview.js`, which the app uses in one line and a browser through two functions it is handed, so that it can be deleted with `includes/preview.php`. | `[B4]` |
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
- A browser (D55) is not tiered: far from view (the Ghost rule) it is a sized box; otherwise its page is loaded, at every zoom. It is not counted among the 12 and has no Snapshot. `[U]`
- Up to 2 editors that were Live most recently stay mounted but inactive, so returning to them is immediate. They do not fill chrome slots and hold no lock. `[B5]` `[U]`
- Mounting goes through the queue: nearest to the viewport centre first, one mount per idle slice. `[B5]`
- Thresholds use hysteresis so tiers do not flicker: an artboard changes tier at the stated zoom going down, and at the stated zoom plus 2 percentage points going up. `[B5]` for hysteresis, `[N]` for the 2 points
- An artboard that has never been rendered goes straight to the Preview queue when eligible; until rendered it shows a `Skeleton`. `[N]`
- A Snapshot artboard that has never been rendered has no frozen copy to show. Such artboards are rendered once each through the same queue, one at a time, nearest to the viewport centre first; the render is frozen as soon as its height stops changing and the artboard stays in the Snapshot tier throughout. Until then it shows a `Skeleton`. `[U]`
- When a shared thing changes (global styles, a part used by a template, a synced pattern), Live and Preview artboards update and Snapshots are marked stale. After a global styles change each stale Snapshot is rendered again once to renew its frozen copy, as a never-rendered one is (the rule above), with its old copy shown until the new one is frozen, and only once the change has settled (D51). After any other shared change a stale Snapshot is re-rendered the next time it becomes a Preview. `[B5]` `[U]`
- If zoom changes while an artboard is Live, it leaves edit and becomes a Preview. Panning does not leave edit. `[B8]` `[U]`
- The hysteresis rule applies to the 20% threshold only. Edit ends when the zoom settles below 30% and is not started again by zooming back in (D37). `[U]`
- The Live editor is drawn at screen size with only its canvas iframe scaled to the board's zoom, so that WordPress's block tools, which are placed correctly only at screen size, work at every zoom. The plugin adds no element of its own around or inside the canvas for this; it styles the elements WordPress renders (`spike-report.md`, "Editing below 100%"). `[V]`

## State rules

| State | Left panel | Right panel | Header | Source |
|---|---|---|---|---|
| Nothing selected | Artboards by kind | Styles | Document bar shows the board name | `[U]` `[D:Overview]` |
| An artboard selected | Artboards by kind, its row highlighted | Artboard settings | Same | `[U]` `[D:Selected]` |
| An artboard in edit | List view of its blocks when the list view toggle is on (on by default when entering edit); otherwise closed | Tabs: the entity (for example "Template part") and "Block" | Document bar shows the artboard's name and kind with a back arrow; while a block is selected the block toolbar is shown in place of the name, until it is hidden with H14, and the back arrow stays (D50) | `[U]` `[D:Main]` |
| A browser browsing (D55) | Artboards by kind, its row highlighted | Its settings, without "Browse" | Document bar shows "{address} · Browser" with a back arrow | `[U]` |
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
| Layout | Moves, adds, removals, device changes, notes (D46) | `board-store` | `wfd-boards` REST | 2 s debounce | `[B6]` `[U]` |
| Boot | Server preload | Editor settings, assets, base styles | Shared by every editor | Once per session | `[B6]` |

## Events inside artboard iframes

Each artboard iframe forwards wheel, pinch (ctrl+wheel) and the board shortcuts to the shell. The shell coalesces them to one viewport update per animation frame. While an artboard is Live, plain wheel scrolling over it scrolls the board as elsewhere; keyboard input goes to the editor except the shortcuts marked "always" below. `[B8]`

Touches inside the Live artboard's document are forwarded as well, and the shell counts those fingers with the ones on the canvas area (D64). The editor still receives them. `[U]`

## Keyboard map

Outside an artboard in edit: `[U]`

| Keys | Action |
|---|---|
| Space + drag, or middle-button drag | Pan |
| Cmd/Ctrl + wheel, Cmd/Ctrl + `+` / `-` | Zoom (always) |
| Shift + 1 | Fit all artboards (always) |
| Cmd/Ctrl + \ | Hide or show both side panels (always) |
| Ctrl + Option + H on a Mac, Shift + Alt + H elsewhere | Open or close the keyboard shortcuts dialog (always) (D42) |
| Shift + 2 | Fit the selected artboards |
| Tab / Shift + Tab | Move selection to the next or previous artboard in left-panel order |
| Enter | Edit the selected artboard; nothing with several selected |
| Arrow keys | Nudge the selected artboards by 1 unit; with Shift, 10 units |
| Delete / Backspace | Remove the selected artboard (opens the confirmation); with several selected, take them all off the board with no confirmation (D41) |
| Cmd/Ctrl + Z, Cmd/Ctrl + Shift + Z | Undo, redo layout |
| Esc | Clear selection |

While the window is narrower than 1180 px and the message of D49 shows, no key reaches the board, the ones marked "always" included. `[U]`

While an artboard is in edit, a click on empty board leaves edit and clears the selection, and a click on another artboard leaves edit and selects it (D38). `[U]`

A drag from empty board selects the artboards its rectangle touches; with Cmd/Ctrl it adds them to the selection. While an artboard is in edit the drag first leaves edit. Esc during the drag cancels it and puts the selection back as it was (D43). Like an artboard drag, the rectangle is drawn by changing the DOM directly; the store hears only when the set of selected artboards changes. `[U]`

Inside an artboard in edit, the block editor's own shortcuts apply unchanged. Esc, pressed when the editor itself has nothing left to dismiss, leaves edit and keeps the artboard selected. Cmd/Ctrl + Z undoes content. `[U]` `[B1]`

Delete and Backspace do the same with focus on a row of the left panel's artboard list. `[U]`

A selected note counts as a selected artboard for Shift + 2, the arrow keys and Delete; Delete takes a note off the board with no confirmation. Enter on one selected note edits its text, and Esc while its text is edited ends that and keeps the note selected. Tab and Shift + Tab step through artboards only. While the note tool is armed, Esc switches it off (D46). `[U]`

A browser (D55) counts as an artboard for every key above; Enter starts browsing. While browsing, keys typed in the page go to the page, except Esc, which ends browsing and keeps the browser selected. Cmd/Ctrl + Z acts on the layout history while the focus is on the board. `[U]`

Tab order and the Shift + arrow step are `[N]`.

## Touch

On the canvas area (D64): `[U]`

| Fingers | Action |
|---|---|
| Two, dragged | Pan |
| Two, pinched | Zoom about the point midway between them |
| One | The pointer: a tap is a click, a drag is a drag, a double tap is a double-click |

- Two-finger gestures go through the viewport like the wheel: one transform per animation frame, and React is told when they settle (C22).
- The canvas area has `touch-action: none`, so the browser neither scrolls nor zooms the page with fingers that are on it, in an artboard's document included.
- What one finger pressed is acted on when it moves or lifts, not when it lands, so the first finger of two selects nothing and leaves edit on nothing. `[N]`
- A second finger landing during a one-finger drag undoes that drag in the DOM; the store never hears of it, except that a selection changed by the rectangle is put back.
- A one-finger drag that the browser cancels (`pointercancel`) is undone in the same way; nothing of it is committed. `[N]`

## Undo

- Content history is core-data's undo stack. It is active while an artboard is Live. Discarding saved items' changes from Review, one item or all of them at once, is one step of it (D48). `[B8]` `[U]`
- Layout history lives in `board-store`: moves, tidying up (D45), device changes, browser resizes (D56), adds and removals from the board, and every change to a note (D46). It lasts for the session. Removing an artboard with the "also delete" box checked is not undoable and clears nothing else. `[B8]` `[U]` `[N]`
- The header's Undo and Redo act on the active history. Their tooltips name the action and scope, in the form "Undo {action}, in {artboard name}" and "Undo {action}, on the board" (the same with "Redo"). `[U]` `[D:Main]` `[D:Overview]`
- Action names. On the board: "move artboard", "tidy up", "change device", "add artboard", "remove artboard"; for browsers "resize browser" (D56); for notes "add note", "move note", "edit note", "change note color", "remove note". Moving or removing artboards and notes together is named for artboards. Editing a note's text, from the moment it enters edit until it leaves, is one step. In an artboard the action is always "edit" ("Undo edit, in Header"); WordPress keeps no name for a content change, so the "block spacing" in `images/Main.png` is not built. `[U]`

## Styles

- Inputs: the theme's base global styles, the user's `globalStyles` entity (edited record), and, only while a History revision is being previewed, that revision in place of the user record. `[B7]`
- One merge and one generate per change, using `mergeGlobalStyles` and `generateGlobalStyles`. The resulting stylesheet and settings are given to every mounted artboard. `[B7]` `[V]`
- Tokens tab: colours (palette), typography (font sizes and families presets), spacing (spacing scale presets), each row with its use count. Editing a token writes through `setSetting` / `setStyle`. `[B7]` `[D:Styles]` `[V]` Site-wide styles are edited from this tab in the stock screens: "Edit" on a group opens `GlobalStylesUI` at `/colors`, `/typography` or `/layout`, and the "Background" and "Shadows" rows open it at `/background` and `/shadows`, in place of the tab's content (D52). `[U]`
- Blocks tab: a searchable list of block types; choosing one opens `GlobalStylesUI` at that block's path. A block with user changes shows the count of changed properties. `[B7]` `[D:StylesBlocks]` `[V]` The stock screen's own Back control returns to the list; the plugin adds no back control (D58). `[U]` Before the blocks the list has the elements, in the stock list's three groups; an element opens `GlobalStylesUI` at `/blocks/elements/{element}` and counts its changes from the user record's `styles.elements` (D53). `[U]`
- History tab: global styles revisions, newest first, plus "Unsaved" when there are edits and "Theme default" last. Picking one previews it on the whole board; Restore makes it the edited record; Stop previewing returns to the edited record. `[B7]` `[D:StylesHistory]` `[U]`
- Variation menu: lists the theme's style variations; choosing one replaces the user record's values with the variation's, as an edit that appears in Review. `[B7]` `[U]` "Default", its first item, replaces them with nothing. The trigger names the variation the user record equals, reads "Default" for a user record with no values and "Custom" otherwise (D54). `[U]`
- "Style applies to" in the Block tab: "This block" edits the block's own attributes through the stock inspector. "All {block name}" shows `GlobalStylesUI` at that block's path in place of the stock inspector controls. `[B7]` `[D:Main]` `[N]` for the second sentence's mechanism. The stock screen's Back control sets the switch back to "This block" (D58). `[U]`
- Every stock screen (`GlobalStylesUI`, in the Tokens tab, the Blocks tab and "All {block name}") is drawn inside `ErrorBoundary` of `@wordpress/editor`. If one throws, the stock notice takes its place and nothing else on the board is lost; in the Styles panel a screen that has thrown is closed when its tab is left (D60). The two styles packages are pinned to the releases named in `api-allowlist.md` (D59). `[U]`

## Usage index

- For each entity on the board, parse its content with `parse` from `@wordpress/blocks` and record, per block, the preset slugs it references: colours (`backgroundColor`, `textColor`, `gradient`, and `var:preset|color|…` values under `style`), font sizes (`fontSize`), font families (`fontFamily`), spacing (`var:preset|spacing|…` under `style.spacing`). `[U]` `[N]` for the attribute list
- Also count references in the merged global styles (root, elements and per-block entries). These add to a token's total but belong to no artboard. `[N]`
- A token's use count is the number of referencing blocks across the board's entities, each entity counted once however many artboards show it, plus global styles references. `[N]`
- Picking a token in the Tokens tab shows a banner on the canvas in the form "Showing where Brick is used: 3 places on 3 artboards", adds "· N use(s)" to the label of each artboard that uses it, and outlines the referencing blocks on Preview and Live artboards. Snapshot and Ghost artboards show the label count only. `[D:Styles]` `[N]` for the Snapshot rule
- The index for an entity is rebuilt when that entity's edited record changes, and at no other time. `[U]`

## Fixture for tests

Tests run against a local WordPress with the Twenty Twenty-Five theme and a seeded board containing two pages, two templates, three template-part artboards (Header on Desktop and Mobile, Footer) and two patterns, matching the arrangement in `screens/images/Overview.png`. The colours and text in the images come from a different demo theme and are not asserted. `[N]`
