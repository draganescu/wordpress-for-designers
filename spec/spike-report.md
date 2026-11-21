# Milestone 0 spike report

**Gate result: PASSED on 2026-11-19, as respecified by the product owner.** The first run failed spikes (a) and (b); the product owner then decided OQ-1 and OQ-2 (commit `26f8a35`: edit at exactly 100% zoom, C18 and D30; plugin lock route and dialog in place of `PostLockedModal`, D31). The re-run against the new Milestone 0 wording is in "Re-run after the decisions" below. Everything after that section is the record of the first run.

| Spike, as now worded in `build-order.md` | Result |
|---|---|
| (a) `artboard-editor` at 100% inside a transformed container with a non-zero pan | Passes |
| (b) `EntitiesSavedStates` without `EditorProvider`; a lock route that takes, refreshes, detects and releases a post lock | Passes |
| (c) Frozen Snapshot of a Preview with no React root | Passes |

## Re-run after the decisions

- **(a)** Container `transform: translate(63.5px, 53.25px) scale(1)`, public `BlockCanvas`, `BlockToolbar` filled into a header slot. All six checks pass with no console errors: toolbar docked in the header only, typing, link popover, slash popover, add-block button on the empty paragraph, toolbar menu. Data: `spikes/evidence/a-pan.json`. (`node spikes/tests/run-a.mjs pan 100`)
- **(b) `EntitiesSavedStates`** re-run unchanged: lists the edited page, saves it, leaves no dirty record, no console errors. Data: `spikes/evidence/b.json`.
- **(b) lock route** `wfd/v1/lock/{id}` (`POST` to take or refresh, `POST` with `takeover`, `DELETE` to release), built on `wp_check_post_lock` and `wp_set_post_lock`, driven by two administrators. All eight steps pass (`spikes/evidence/lock.json`): take a free lock; refresh it; the second user is told who holds it; the second user takes over; the first user's refresh detects the takeover and names the new holder; the first user cannot release the other's lock; the holder releases it; the first user takes it again. `_edit_lock` was read with WP-CLI after each step.
- **(c)** unchanged from the first run.

Other findings from the investigation that led to the decisions (`spikes/diag-oq1/`, `spikes/diag-oq2/`, `spikes/diag-workflow-result.json`):

- The private `ExperimentalBlockCanvas` scale and the private store zoom level were both measured and neither places the block tools correctly below 100%.
- The allowlisted `EditorSnackbars` logs a deprecation on 7.2-RC2 pointing to `wp.notices.SnackbarNotices`. No screen in `screens/` maps an element to it, so it is not used.
- Measured in Chromium at 1440 × 900 on 7.2-RC2 only.

# Editing below 100% (2026-11-19, after manual testing)

The product owner found editing only at 100% unusable and decided that editing works from 30% zoom up (C18, D37). A second spike measured how. Throwaway scripts and evidence: `spikes/zoom-edit/` (`counter/recipe.mjs` is the CSS as measured, `counter/results/` the numbers, `inventory/NOTES.md` the reading of WordPress's source). The spike was run on the built app by injecting CSS at run time; the same rules are now in `src/shell/style.scss` and are covered by AC-EDIT-09.

**Structure that works.** The canvas surface keeps its `translate() scale(z)`. Inside the Live artboard:

1. The element `BlockCanvas` renders (WordPress's block tools wrapper, a `div` with no class that holds `.block-editor-iframe__container` and `.popover-slot`) gets `transform: scale(1 / z)`, so the tools are at screen size.
2. The `iframe[name="editor-canvas"]` inside it gets `transform: scale(z)`, so the content is drawn at the board's zoom. Its layout width stays the device width (measured `innerWidth` 1440 at every zoom), so media queries do not change.
3. The wrapper has `pointer-events: none` (at screen size its box is larger than the artboard looks); the iframe and the popover slot take pointer events again.
4. The Live artboard's frame has `overflow: visible`; with `hidden`, popovers are squeezed inside the artboard's box.
5. Tools built on WordPress's `BlockPopoverCover` (the add-block button of an empty paragraph, spacing and grid overlays) size themselves from `offsetWidth`, which ignores transforms. Their container gets `zoom: z` and the add-block button `zoom: 1 / z`. Some of these are drawn outside the artboard, so `--wfd-zoom` is also set on the document's root element.
6. The canvas area has `overflow: clip`, not `hidden`: the editor scrolls its selection into view, and a hidden box can still be scrolled by script, which moved the whole board.

No element of the plugin's is added around or inside the canvas. Nothing is put in the canvas document.

**Measured with this structure** (Chromium, Firefox and WebKit at 30%, 50%, 75% and 100%; Chromium also at 150%): block toolbar in the header only and at full size; a click puts the caret in the block under the pointer and typing edits it; link popover and slash inserter next to their text at full size; add-block button at the right end of its paragraph at 24 px (0 px error; without rule 5 it was 1008, 720 and 360 px to the right at 30%, 50% and 75%); header toolbar menus under their buttons; in-between inserter on its gap; selection and multi-selection outlines on the right blocks; image block placeholder usable and its resize handles follow the pointer (a 30 px drag resizes by 30 screen px). No console errors.

**What it depends on.** Every selector is a class name or inline style of WordPress's editor markup, none of it public API: `.block-editor-iframe__container`, `iframe[name="editor-canvas"]`, `.popover-slot`, `.block-editor-block-popover`, `.components-popover__content`, `.block-editor-block-list__empty-block-inserter`, and the inline `position: absolute` of the cover container. If WordPress changes them, the tools go back to being misplaced below 100%; AC-EDIT-09 fails when that happens.

**Known to be imperfect below 100%** (recorded as OQ-21):

- Dragging the Cover block's resize handle (and, by the same code, a grid item's) does not follow the pointer: WordPress applies the pointer's movement in screen pixels as layout pixels.
- While a block is dragged over the artboard from the list view, WordPress's drag chip sits away from the pointer. The drop lands in the right place.
- Everything inside the canvas is drawn at the zoom, including WordPress's own in-canvas controls: at 30% a selection outline is 0.6 px and a placeholder button is about 12 px high.
- An open popover follows the artboard while the board is panned. During a zoom it keeps its place and is placed again when the zoom settles (the plugin sends the window a `resize` event then, which is what WordPress's popovers listen for).
- Not measured: the drop-zone highlight.

# First run (2026-11-19, before the decisions)

**Gate result: FAILED.** Spikes (a) and (b) fail using only the allowlist. Spike (c) passes. Per `CLAUDE.md` rule 9 and `build-order.md`, no later milestone was started.

| Spike | Result |
|---|---|
| (a) `artboard-editor` in a CSS-scaled container at 50%, 75%, 100% | **Fails at 50% and 75%.** Passes at 100%. |
| (b) `PostLockedModal` and `EntitiesSavedStates` without `EditorProvider` | **Fails for `PostLockedModal`.** `EntitiesSavedStates` passes. |
| (c) Frozen Snapshot of a Preview with no React root | Passes. |

## Environment

- WordPress `7.2-RC2` (`https://wordpress.org/wordpress-7.2-RC2.zip`) in `@wordpress/env` 12.2.0, PHP 8.2, Twenty Twenty-Five active, no Gutenberg plugin, `SCRIPT_DEBUG` on. The spec was checked against `7.2-beta5`; RC2 was the 7.2 build available on 2026-11-19.
- Chromium (Playwright 1.65.1), viewport 1440 × 900.
- Throwaway code: `spikes/wfd-spikes/` (plugin), `spikes/tests/run-{a,b,c}.mjs` (measurements), `spikes/evidence/` (JSON results and screenshots). Imports in the spike plugin are limited to `api-allowlist.md`.
- Fixture: one page (id 4) with a heading, paragraphs, a coloured group with a button, columns with a quote, and an empty paragraph.

## Spike (a): editor in a scaled container

Composition: `EntityProvider` → `useEntityBlockEditor` → `BlockEditorProvider` (`hasFixedToolbar: true`) → `BlockCanvas`; `BlockToolbar` rendered through a `Fill` into a `Slot` in a header element outside the scaled container.

Three ways of scaling were tried, all with allowlisted imports only:

| Mode | How the scale is applied |
|---|---|
| naive | `transform: scale(z)` on an ancestor of `BlockCanvas` (tools and iframe scaled together) |
| counter | ancestor `scale(z)`, a wrapper around `BlockCanvas` with `scale(1/z)`, and plugin CSS putting `scale(z)` on the iframe element (tools unscaled, iframe scaled) |
| inner | as counter, but the iframe element is unscaled and `html { transform: scale(z) }` is injected through `BlockCanvas` children (scale inside the canvas document) |

A fourth, CSS `zoom` on the ancestor, broke pointer hit-testing inside the iframe (clicks on a paragraph were intercepted by the group block below it) and was dropped.

Checks per zoom: block toolbar is in the header and nowhere else; a click lands on the intended block and typing edits it; the link popover (Cmd+K) sits next to the selected text at full size; the slash-inserter popover sits next to the caret; the empty paragraph's add-block button sits at the right end of that paragraph at 24 px; a toolbar dropdown opens under its button. No console errors in any run.

| Mode | Zoom | Toolbar docked | Typing | Link popover | Slash popover | Add-block button | Toolbar menu |
|---|---|---|---|---|---|---|---|
| naive | 50 | pass | pass | **fail** | pass | **fail** | pass |
| naive | 75 | pass | pass | **fail** | pass | **fail** | pass |
| naive | 100 | pass | pass | pass | pass | pass | pass |
| counter | 50 | pass | pass | pass | pass | **fail** | pass |
| counter | 75 | pass | pass | pass | pass | **fail** | pass |
| counter | 100 | pass | pass | pass | pass | pass | pass |
| inner | 50 | pass | pass | pass | pass | **fail** | pass |
| inner | 75 | pass | pass | pass | pass | **fail** | pass |
| inner | 100 | pass | pass | pass | pass | pass | pass |

Evidence for the failures (viewport px; "anchor" is where the block is on screen, from `spikes/evidence/a-*.json`):

| Mode | Zoom | Element | Anchor (left, top → right, bottom) | Measured | Problem |
|---|---|---|---|---|---|
| naive | 50 | Add-block button | 220, 372 → 940, 387 | 889, 312, 12 × 12 px | 60 px above its paragraph, half size |
| naive | 75 | Add-block button | 220, 497 → 1300, 520 | 1243, 467, 18 × 18 px | 30 px above its paragraph, three-quarter size |
| naive | 50 | Link popover | 220, 180 → 940, 196 | 181, 139 → 356, 176 | 175 px wide instead of 350; starts left of the artboard |
| naive | 75 | Link popover | 220, 210 → 1300, 233 | 237, 208 → 500, 264 | Covers the text it is anchored to; 263 px wide |
| counter | 50 | Add-block button | 220, 372 → 940, 387 | 1636, 372, 24 × 24 px | 696 px to the right of the artboard's right edge |
| counter | 75 | Add-block button | 220, 497 → 1300, 520 | 1636, 497, 24 × 24 px | 336 px to the right of the artboard's right edge |
| inner | 50 | Add-block button | 220, 372 → 940, 387 | 1636, 372, 24 × 24 px | same as counter |
| inner | 75 | Add-block button | 220, 497 → 1300, 520 | 1636, 497, 24 × 24 px | same as counter |

Cause, read from `wp-includes/js/dist/block-editor.js` in 7.2-RC2:

- `BlockTools` renders its own popover slots inside its wrapper, so any transform on an ancestor of `BlockCanvas` also scales those popovers and the position maths is applied twice (naive mode).
- The empty-block inserter is a `BlockPopoverCover`. Its `CoverContainer` sizes itself from `selectedElement.offsetWidth` / `offsetHeight`, which are layout sizes and ignore every CSS scale. With a 1440 px device width shown at 720 px, the cover is 1440 px wide and its right-aligned button lands outside the artboard (counter and inner modes). The same component backs other block covers, so they are expected to be mis-sized the same way; only the add-block button was measured.
- The public `BlockCanvas` accepts only `children`, `height` and `styles`. The iframe's own `scale` handling is reachable only through `ExperimentalBlockCanvas` / `iframeProps`, which are not exported publicly and not on the allowlist.

What this blocks: C18 and D30 (editing from 50% zoom), AC-EDIT-04 (the stock add-block button on an empty artboard, which `screens/AddArtboard.md` enters at 50%), and the "popovers positioned correctly" condition of the gate.

## Spike (b): `PostLockedModal` and `EntitiesSavedStates` without `EditorProvider`

### `EntitiesSavedStates`: passes

Rendered alone, with a page title edited through `editEntityRecord`. Panel text: "Are you ready to save? There is 1 site change waiting to be saved. Pages The following has been modified. Spike title edited". Clicking Save wrote the title to the database (`wp post get 4 --field=post_title` → "Spike title edited"), `hasEditsForEntityRecord` returned `false` afterwards, no console errors. Screenshot: `spikes/evidence/b-saved-states.png`.

### `PostLockedModal`: fails

Set-up: user 2 holds the lock on page 4 (`_edit_lock` meta); the administrator opens the spike page, which renders `<PostLockedModal />` with a `core-data` record for the page loaded.

| Measurement | Value |
|---|---|
| `wp_check_post_lock( 4 )` on the server | `2` (locked by user 2) |
| `.editor-post-locked-modal` elements after 3 s | **0** |
| `select( 'core/editor' ).getCurrentPostId()` | `null` |
| `select( 'core/editor' ).isPostLocked()` | `false` |
| `getEditorSettings().postLockUtils` | not set |
| With the page free, `_edit_lock` after 2 s on the spike page | empty: no lock is taken |

Cause, from `editor.js` in 7.2-RC2: `PostLockedModal` reads the post id, lock state, lock user and `postLockUtils` only from the `core/editor` store. `EditorProvider` is what fills that store. The allowlist names five components from `@wordpress/editor` and no store, actions or selectors, so nothing allowlisted can tell the modal which post is open or that it is locked.

Diagnostic outside the allowlist (run from the test, not from plugin code), to show what would be needed: after `dispatch( 'core/editor' ).setEditedPost( 'page', 4 )`, `updateEditorSettings( { postLockUtils } )` and `updatePostLock( { isLocked: true, user } )`, the modal renders. Its links are then:

- "Take over" → `post.php?get-post-lock=1&lockKey=true&post=4&action=edit&_wpnonce=…`
- "Exit editor" → `edit.php?post_type=page`

Both leave the board for wp-admin's own screens. So even with the store filled, the stock dialog does not give the behaviour in `data-model.md`, Locks ("the artboard stays read-only unless the user takes over"): taking over opens the post editor instead of the artboard. Screenshot: `spikes/evidence/b-locked-with-editor-store.png`.

What this blocks: D28, `data-model.md` Locks, AC-EDIT-06.

## Spike (c): frozen Snapshot

A `BlockPreview` of the fixture page at `viewportWidth` 1440 was rendered in a 720 px host. The freeze step clones the preview's DOM with plain DOM calls, serialises the iframe document and the CSS rules of all its style sheets, and writes them to a new iframe through `srcdoc` with `sandbox="allow-same-origin"` (scripts cannot run). No library is used.

| Check | Result |
|---|---|
| Size of Preview iframe / Snapshot iframe | 720 × 277 / 720 × 277 |
| Pixels differing between the two screenshots | **0 of 199,440** |
| Nodes inside the Snapshot (host subtree and iframe document) carrying React keys | 0 of 112 |
| `<script>` elements in the Snapshot document | 0 |
| After editing the entity: Preview shows the new content | yes |
| After editing the entity: Snapshot pixels changed | 0 of 199,440 |
| Console errors | none |

Screenshots: `spikes/evidence/c-preview.png`, `c-snapshot.png`, `c-snapshot-after-edit.png`.

## Decisions needed before work can continue

Recorded at the time as OQ-1 and OQ-2 in `open-questions.md`; both were decided by the product owner and removed from that file (see the top of this report).

# Agent surface

Milestone 13 of `build-order.md`: four throwaway proofs for the agent surface (D65), run on 2026-11-21.

**Gate result: PASSED**, on the second run of spike (a). The first run of spike (a) failed as the spike was then worded and left OQ-43, which D79 answered; run again as `build-order.md` now words it, it passes ("Spike (a), second run" below). Spikes (b), (c) and (d) passed on the first run and were not run again. All four use only the allowlist. The rule that gives equal trees also has to leave out the editor's block appender; `agent/surface.md`, Block paths, was changed afterwards to say so. Milestone 14 was not started.

| Spike | Result |
|---|---|
| (a) The tree read from a Preview's document and from its Snapshot equals the Live editor's tree read block by block, with preview copies left out | First run, as then worded: **failed** on the two template artboards, and for the Live tree read as `agent/surface.md` then worded it. Second run, as worded after D79: **passes** on all ten artboards. |
| (b) A call written to an option by a command in the WP-CLI container, found by an open board page that polls, answered, and printed, in under 3 seconds | Passes |
| (c) `updateBlockAttributes`, `insertBlocks`, `removeBlocks` and `moveBlockToPosition` dispatched on the Live editor's registry from outside the editor | Passes |
| (d) A chunk of the board's script is requested only when asked for | Passes |

## Environment

- WordPress `7.2-RC2` in `@wordpress/env` 12.2.0, PHP 8.2, Twenty Twenty-Five, no Gutenberg plugin, `SCRIPT_DEBUG` on: the same as Milestone 0. Chromium (Playwright), viewport 1440 × 900.
- A WordPress of its own, on port 8893, started from `spikes/agent/.wp-env.json`, so that the site on port 8888 was not wiped. It mounts the plugin as built from `master` (`npm run build`), the test helper plugin, and the spike plugin. It was stopped after the runs.
- The fixture is the one the end-to-end tests seed (`wfd-test/v1/reset`): nine artboards, wiped and seeded again at the start of every run.
- Throwaway code, all under `spikes/agent/`: `wfd-agent-spike/` (the spike plugin: the relay of spike (b) and the script swap of spike (d)), `chunk.webpack.config.js` and `wfd-agent-spike/chunk/` (the build of spike (d)), `tests/run-{a,b,c,d}.mjs` and `tests/diag-a-active-copy.mjs` (the measurements), `evidence/*.json` (the results). Nothing was added to `src/` or `includes/`.
- The spikes reach the Live editor's registry through `window.wfdTest.editorBridge`, the bridge the shell already holds and a test build exposes. That is the first seam of `agent/surface.md`.

## Spike (a): block paths

**What was run.** `node spikes/agent/tests/run-a.mjs`. For each of the nine fixture artboards, in this order: the document of its Snapshot as the board opens (fitted, 11% zoom, so each frozen copy was made without the artboard ever being a Preview); the document of its Preview at 30% zoom; then, in edit, the Live editor's tree and the Live canvas document; and last, back at 11%, the document of its Snapshot again (for the two artboards edited last, of their warm editor). Each document was read as `agent/surface.md`, Block paths, says: a block is an element with a `data-block` attribute, its inner blocks are the `data-block` elements whose nearest `data-block` ancestor it is, in document order. Each list was read once it had stopped changing for 1.5 seconds. Two lists are equal when they hold the same paths with the same block names in the same order.

The Live tree was read two ways. "As worded" is the sentence of `agent/surface.md`: `getBlocks()` and `innerBlocks` under each block. "Per block" asks `getBlocks( clientId )` for each block's inner blocks.

**What was observed.**

| Artboard | Live tree, as worded | Live tree, per block | Document (Preview) | Preview equals Live (per block) | Snapshot equals Live (per block) |
|---|---|---|---|---|---|
| Index (template) | 19 | 46 | 53 | **no**, 7 more in the document | **no**, the same 7 |
| Header, Desktop | 2 | 2 | 2 | yes | yes |
| Header, Mobile | 2 | 2 | 2 | yes | yes |
| Hero (pattern) | 2 | 2 | 2 | yes | yes |
| Sign-off (pattern) | 1 | 1 | 1 | yes | yes |
| About (page) | 7 | 36 | 36 | yes | yes |
| Single (template) | 43 | 70 | 103 | **no**, 33 more in the document | **no**, the same 33 |
| Footer | 25 | 25 | 25 | yes | yes (warm editor) |
| Become a member (page) | 7 | 36 | 36 | yes | yes (warm editor) |
| All nine | 108 | 220 | 260 | | |

1. **The three kinds of document agree with each other, always.** On all nine artboards the Preview's document, the first Snapshot's, the later Snapshot's (or warm editor's) and the Live canvas document gave the same list. A Snapshot frozen without ever having been a Preview gave the same paths as the Preview.
2. **Every block of the editor's tree is in every document at its own path.** With the tree read per block, each of its 220 blocks has an element at the same path with the same name in the Preview and in the Snapshot. Nothing of the tree is missing from a document.
3. **The tree as `agent/surface.md` words it is not the tree the artboard renders.** `getBlocks()` gives a block that controls its inner blocks an empty `innerBlocks`: a template part, and Content around a page. Read that way the tree stops at each Header, Footer and Content block (108 blocks, not 220) and equals the document on five artboards of nine. `getBlocks( clientId )`, the same allowlisted selector with an argument, gives those inner blocks.
4. **Two templates draw elements that are no block of the editor.** 40 `data-block` elements in all, the same ones in the Preview, the Snapshot and the Live canvas:
   - A Query Loop's Post Template draws its inner blocks once more for each post, as previews. In the fixture, with one post, that is one copy, hidden, after the real one: 5 elements in Index and 3 in Single. In edit the copy carries the same `data-block` ids as the real blocks, so the same block is at two paths (`1.1.0.0` and `1.1.0.1` in Index; `spikes/agent/evidence/a-active-copy.json`).
   - A Comment Template draws its inner blocks for each placeholder comment: three more copies of ten blocks in Single, 30 elements.
   - Content inside a Query Loop draws the post's own blocks, read only: 2 Paragraph elements in Index, at `1.1.0.0.2.0` and `1.1.0.1.2.0`. They are in no editor's store.
5. No console errors.

**Whether it passed.** No. `build-order.md` asks that the path read from the Preview's document, and from its Snapshot, equal the block's path in the Live editor's tree for every block of every fixture artboard, and `agent/surface.md` says "The two give the same path for the same block." On Index and Single the document holds blocks the tree does not, so a path read there (for a target, or a reference handed to a block tool) can name nothing in the editor. With the tree read as the spec words it, the two differ on four artboards.

**What would make it pass**, for the product owner to decide (OQ-43): read the Live tree with `getBlocks( clientId )` per block, and say what a `data-block` element with no block in the editor's tree is: not a block (left out of paths and targets), or a block that can be pointed at and not changed.

**Not measured.** A Query Loop with two or more posts, where the copy that is the editor's own blocks may not be the first one drawn: the fixture has one post. Synced patterns and Navigation blocks that point at a menu: the fixture has neither inside an artboard.

Data: `spikes/agent/evidence/a.json`, `a-active-copy.json`.

## Spike (a), second run

Run on 2026-11-21, after D79, as `build-order.md` now words spike (a).

**What was run.** `node spikes/agent/tests/run-a2.mjs`, on the same environment as the first run (its own WordPress on port 8893, stopped afterwards). The fixture was wiped and seeded, and then a route added to the spike plugin for this run, `wfd-spike/v1/seed-a2`, added the cases the fixture lacks:

- Two more posts, so the site has three. Each holds a Paragraph and a Group with a Heading and a Paragraph; one also holds a synced pattern. The fixture's Index template therefore draws three posts as well, where the first run had one.
- A synced pattern, "Spike synced": a Group holding a Heading and a Paragraph.
- A menu, "Spike menu" (`wp_navigation`): a link, a submenu holding a link, and a link.
- One more template, "Spike A", as a tenth artboard on the fixture board. It holds the Header part, and in a Group: a Navigation block that points at the menu, the synced pattern, a Query Loop that shows three posts (a Post Template holding Title, a Group with Date and Excerpt, and Content; then Pagination), and a Paragraph after the loop.

For each of the ten artboards, in this order: the document of its Snapshot as the board opens (fitted, 9% zoom, never a Preview before); the document of its Preview at 30%; in edit, the Live editor's tree read block by block (`getBlocks( clientId )` for each block) and the Live canvas document; and last, back at 9%, the document of its Snapshot again (of the warm editor for the two edited last). In edit, three more things were done:

- Where a Query Loop draws several posts, each other post in turn was made the one whose blocks are the editor's own, by a click in its copy, and tree and document were read again: three states for Index, Single and Spike A.
- Every block of the tree was selected in turn, 244 selections in all, and tree and document were read after each, because a selected block draws more around itself.
- The tree was compared with itself across all of these.

Each document was read under four candidate rules for "is a preview copy", and with no rule. Two trees are equal when they hold the same paths with the same block names in the same order.

**The rule.** In the document of an artboard, in any tier:

1. An element is a block when it has both a `data-block` and a `data-type` attribute, and no ancestor of it in that document has the class `block-editor-block-preview__live-content`.
2. Every other element with `data-block` is not a block. It has no path, and it is not counted as a sibling.
3. A block's inner blocks are the blocks whose nearest block ancestor it is, in document order.

`block-editor-block-preview__live-content` is the class WordPress's block preview puts on the element it draws a copy into. It is on the list item a Post Template draws for each post and on the element a Comment Template draws for each comment, which are not blocks themselves; and on a Post Content block that shows a post read-only, which is a block itself and whose descendants are the copy. "Ancestor" does not include the element itself, so that Post Content block stays in the tree. The class is in the frozen markup of a Snapshot as it is in a Preview and in the Live canvas.

The `data-type` half is not about preview copies. In edit, and in a warm editor, the block editor draws a block appender, `div.block-list-appender`, with `data-block="true"` and no `data-type`. It is no block of the tree and no preview copy as `agent/surface.md` defines one. It showed inside a Submenu without anything being selected, and inside a Group, Navigation, Content, Query Loop, Post Template or Pagination block while that block or one of its inner blocks was selected. Without this half the Live document differed from the tree on Spike A in every state, and on 14 of the other 220 selections. When this was run `agent/surface.md` said "a block is an element with a `data-block` attribute that is not a preview copy", which counts the appender as a block. The product owner had that file changed afterwards, on 2026-11-21, to ask for `data-type` as well and to name the appender.

Rules that were tried and do not work:

- **Inert.** "Inside an inert element" leaves out too little and too much. The elements a Post Template and a Comment Template draw their copies into are not inert, in any tier. In edit, the locked template around a page is inert, so 27 real blocks of each page artboard would be left out, and one of the Footer.
- **Disabled.** No copy is inside an element with the class `components-disabled`.
- **Repeated ids.** A copy repeats the `data-block` ids of the blocks it copies, in every tier (15 repeats in Index and in Spike A, 39 in Single). That says an id is drawn more than once, not which element is the block: once another post is active, the copies come before the real blocks in the document.

**The table.** "Elements" is every element with `data-block`. "Left out" is what the rule leaves out. Where three numbers are given, they are for the three posts made active in turn.

| Artboard | Live tree | Elements, Snapshot and Preview | Left out | Elements, Live | Left out, Live | First Snapshot equals tree | Preview equals tree | Live document equals tree | Later Snapshot equals tree | Selections equal |
|---|---|---|---|---|---|---|---|---|---|---|
| Index (template) | 46 | 82 | 36 | 82 / 78 / 75 | 36 / 32 / 29 | yes | yes | yes, all three | yes | 46 of 46 |
| Header, Desktop | 2 | 2 | 0 | 2 | 0 | yes | yes | yes | yes | 2 of 2 |
| Header, Mobile | 2 | 2 | 0 | 2 | 0 | yes | yes | yes | yes | 2 of 2 |
| Hero (pattern) | 2 | 2 | 0 | 2 | 0 | yes | yes | yes | yes | 2 of 2 |
| Sign-off (pattern) | 1 | 1 | 0 | 1 | 0 | yes | yes | yes | yes | 1 of 1 |
| About (page) | 36 | 36 | 0 | 36 | 0 | yes | yes | yes | yes | 36 of 36 |
| Single (template) | 70 | 109 | 39 | 109 / 109 / 109 | 39 / 39 / 39 | yes | yes | yes, all three | yes | 70 of 70 |
| Footer | 25 | 25 | 0 | 25 | 0 | yes | yes | yes | yes | 25 of 25 |
| Become a member (page) | 36 | 36 | 0 | 36 | 0 | yes | yes | yes | yes (warm editor) | 36 of 36 |
| Spike A (template) | 24 | 60 | 36 | 61 / 57 / 54 | 37 / 33 / 30 | yes | yes | yes, all three | yes (warm editor) | 24 of 24 |
| All ten | 244 | 355 | 111 | | | | | | | 244 of 244 |

What was left out, by artboard:

- **Index**, 36: three copies of the Post Template's five blocks, one for each post (the active post has a hidden copy beside its real blocks), 15; and the posts' own blocks drawn read-only inside Content, 21, the active post's twice, among them the synced pattern one post holds and its blocks.
- **Single**, 39: three copies of the Comment Template's ten blocks, 30, and three copies of the three blocks of the Post Template in the template's own Query Loop, 9.
- **Spike A**, 36 in the Snapshot and Preview: three copies of the Post Template's five blocks, 15, and the posts' own blocks inside Content, 21. In edit, one more: the appender inside the Submenu.

Other things observed:

1. **The tree did not change** when another post was made active or a block was selected: the Post Template's blocks are in it once, at the same paths, whichever post is active.
2. **The Navigation block that points at a menu** has its links and its submenu in the tree and in every document at the same paths (`1.0.0` to `1.0.2`, and `1.0.1.0` inside the submenu), in Preview and Snapshot as in edit.
3. **The synced pattern** has its blocks in the tree and in every document at the same paths (`1.1.0`, `1.1.0.0`, `1.1.0.1`). The same pattern inside a post drawn read-only is left out with the rest of that post.
4. **The Paragraph after the Query Loop** is at `1.3` everywhere: the copies before it are not counted as siblings.
5. With no rule, Index, Single and Spike A differ from the tree in every tier, as in the first run.
6. No console errors.

**Whether it passed.** Yes. With the rule above, which uses the document alone, the tree read from the Preview's document, from the first Snapshot's and from the later Snapshot's or warm editor's equals the Live editor's tree read block by block on all ten artboards: the same paths, block names and order. The Live canvas document equals it too, in every state tried.

**Not measured.** A Query Loop inside a Query Loop. A Comment Template drawing real comments (a template draws placeholder comments). Blocks from plugins that draw previews of their own without WordPress's block preview: none is in the test environment. A browser other than Chromium. A WordPress other than 7.2-RC2: the class is WordPress's own markup, not a documented interface, so AC-TOOL-24 is what would notice it changing.

Data: `spikes/agent/evidence/a2.json`. Code: `spikes/agent/tests/run-a2.mjs`, and the `seed-a2` route in `spikes/agent/wfd-agent-spike/wfd-agent-spike.php`.

## Spike (b): the relay round trip

**What was run.** `node spikes/agent/tests/run-b.mjs`. The spike plugin adds a command, `wp wfd-spike call <tool> --board=<id>`, and two REST routes, `wfd-spike/v1/poll` and `wfd-spike/v1/result`, both requiring `edit_theme_options`. The command writes a call record with `add_option` (not autoloaded), reads it again every 200 ms with `$wpdb`, prints the result as one JSON line and deletes the record. The fixture board was open in one page, which asked the poll route once a second with the page's own `wp.apiFetch` and answered a call with the number of artboards in `wfd/board`. The command was run 10 times with `docker exec` in the site's WP-CLI container and 5 times through `wp-env run cli`, each started at a different moment of the page's second. PHP used: `WP_CLI::add_command`, `add_option`, `update_option`, `delete_option`, `get_option`, `$wpdb` with `prepare` and `esc_like`, `register_rest_route`, `rest_ensure_response`, `wp_generate_uuid4`, all on the allowlist.

**What was observed.**

| Run as | Runs | Answered | Wall time, min / median / max |
|---|---|---|---|
| `docker exec` in the CLI container | 10 | 10, each with 9 artboards | 0.47 s / 0.90 s / 1.32 s |
| `wp-env run cli` | 5 | 5 | 1.25 s / 1.61 s / 2.04 s |

- Inside the command, the wait from writing the record to reading the answer was 0.2 to 1.0 s, as a one-second poll and a 200 ms read give. WP-CLI took 0.2 to 0.5 s to load WordPress before that. `wp-env run cli` adds about 0.7 s of its own.
- No record was left behind after any run.
- **The record has to be read from the database.** The same command reading its record with `get_option` never saw the answer: after 4 seconds it still read `queued` while the row in the database said `done`. WordPress keeps an option it has read in the process's cache. `agent/relay.md` already says "from the database and not from a cache"; this is why.
- With no page asking, the command gave up after its timeout (2 s) with exit code 1 and deleted its record.
- No console errors.

**Whether it passed.** Yes: every call was answered and printed in under 3 seconds, the slowest in 2.04 s through `wp-env run cli`.

Data: `spikes/agent/evidence/b.json`.

## Spike (c): block actions from outside the editor

**What was run.** `node spikes/agent/tests/run-c.mjs`. The Header template part (a Group holding one Paragraph) was put in edit at 40% zoom; the Header (Mobile) artboard stayed a Preview. The four actions were dispatched from the page, outside the editor's React tree, on `registry.dispatch( 'core/block-editor' )` of the Live editor's registry: `updateBlockAttributes` (the Paragraph's `content`), `insertBlocks` (a Heading parsed from markup, into the Group at index 1), `moveBlockToPosition` (that Heading out of the Group to the top level) and `removeBlocks` (the Paragraph). First `updateBlockAttributes`, `insertBlocks` and `removeBlocks` each alone, followed by one press of the header's Undo (H3). Then all four in a row, the Review drawer opened and closed, and Undo pressed four times. After every step these were read: the editor's blocks serialized, the text of the Live canvas, the text of the Header (Mobile) Preview, the Review button (H9) and core-data's dirty records.

**What was observed.**

- **Changes the artboard.** After each action the Live canvas showed the change, and so did the Header (Mobile) Preview, which shows the same part.
- **Appears in Review.** After each action H9 read "Review 1 change" and the dirty record was `wp_template_part/twentytwentyfive//header`. After all four the drawer listed "Header", "Template part · used by 8 templates", "Heading: added", "Paragraph: removed".
- **Undoes as one step each.** Alone: one Undo put the blocks, the canvas and the Preview back exactly, H9 read "Review changes" and was disabled, and no record was dirty. In a row: each of the four Undos took back exactly one action, in reverse order, the state after each equal to the state before that action; after the fourth nothing was dirty and Undo was disabled.
- No console errors.
- **One thing to know.** The same attribute of the same block changed twice in a row (0.7 s apart) is one undo step: one Undo took back both. The block editor treats a second change of the same attribute of the same block as a continuation of the first, as it does for typing. Two `block-update` calls on one block's text would undo together; the designer undoing "the agent's step" then undoes both.

**Whether it passed.** Yes.

Data: `spikes/agent/evidence/c.json`.

## Spike (d): a chunk requested on demand

**What was run.** `node spikes/agent/tests/run-d.mjs`. The board's own entry, `src/shell/index.js`, was built with `wp-scripts build` and the repository's webpack configuration from a second entry file that imports it and adds the stub of `agent/surface.md`: `window.wfdAgent = { ready }`, where `ready()` calls the build's own dynamic `import()` of one more module, once. That module imports `select` from `@wordpress/data` and `store` from `@wordpress/block-editor`. The output went to `spikes/agent/wfd-agent-spike/chunk-build/`, and the spike plugin served it in place of the board's script on a board opened with `?wfd_spike_chunk=1`. Every script request to either build folder was recorded.

**What was observed.**

- The build wrote the module to a file of its own, `agent.js` (344 bytes), beside `board.js`. The module's code is in `agent.js` and not in `board.js`. `board.asset.php` lists the same dependencies as the plugin's own build.
- For 31 seconds after the board was at rest, during which an artboard was put in edit and left and the board was fitted, the only script requested from the build was `board.js`. `window.wfdAgent` held `ready` and nothing else, and the chunk had not run.
- `ready()` then requested `agent.js` once (status 200, from the folder `board.js` came from, with no public path configured) and resolved to the module's interface, which read 9 artboards from the page's `wfd/board` store and the name of the block-editor store: the chunk shares the page's WordPress scripts and registry.
- Two more calls to `ready()` returned the same promise and requested nothing.
- No console errors.

**Whether it passed.** Yes.

**For Milestone 14.** `tools/package.sh` packages `build/` whole, so a chunk file written there ships with the plugin. The chunk's own version (`?ver=330fe…`) comes from webpack, not from `board.asset.php`.

Data: `spikes/agent/evidence/d.json`.
