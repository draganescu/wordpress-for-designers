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
