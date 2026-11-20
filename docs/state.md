# Current state

As of 2026-11-19. This describes what exists; `spec/` says what should exist. For how the work was done and what to watch for, see [working-notes.md](working-notes.md).

## Summary

The plugin is built through Milestone 12 of `spec/build-order.md`, plus the decisions taken afterwards (D32 to D48).

| Check | Result |
|---|---|
| Acceptance criteria in `spec/acceptance.md` | 127 |
| End-to-end tests, one per criterion | 127. On 2026-11-20 the whole suite, AC-SAVE-08 and AC-SAVE-09 (D48) included, was run once from a worktree: 126 pass and AC-PERF-03 fails, as it does from any worktree. On 2026-11-19 the suite of 125 was run three times: all pass after two fixes to the tests. AC-CANVAS-03 used an empty-board point that D42's Keyboard shortcuts control now covers; AC-STYLE-07 (and three like it in `ins.spec.ts` and `style.spec.ts`) counted menu rows once instead of waiting for them, and failed one run in three. AC-PERF-03 still fails on a port-8890 environment from a worktree (see working-notes.md) |
| `npm run lint` | Exits 0, no disabled lines |
| CI | `.github/workflows/tests.yml` runs lint, build and the suite (Chromium, wp-env) on every pull request; CI retries a failed test twice and reports a pass on retry as flaky |
| Open questions waiting for the product owner | 27 (`spec/open-questions.md`) |
| Browsers the suite runs in | Chromium only |
| WordPress it was built and tested on | 7.2-RC2, Twenty Twenty-Five, PHP 8.2, no Gutenberg plugin |

Not done or not verified:

- **Nothing is pushed.** The repository has no remote. Everything is committed on `master`: the spec as received, six decision commits, the plugin (`0a5f318`) and the spike material.
- **Clean activation** was checked on the wp-env site with the test helper plugin and test theme also installed, not on a clean WordPress 7.2 final. No PHP messages and no console errors appeared on the Plugins, Boards and board screens.
- **`spec/shell-check.md`** (the comparison of each screen with its image) was done at Milestone 2. It has not been redone since, so it does not cover D32 to D40.
- **Firefox and WebKit** were used only in the second spike, on the recipe for editing below 100%, not on the app as built.
- **`spikes/`** still holds the throwaway code and evidence of both spikes. The second spike's screenshots and logs were not kept; its scripts, results and notes were.

## What the plugin does now

A "Designer" menu in wp-admin lists boards. A board opens full screen: a header, a left panel, an infinite canvas and a right panel.

- **Canvas.** Pan and zoom from 2% to 400%. Each artboard shows one page, template, template part or pattern at a device width (Desktop 1440, Tablet 780, Mobile 360 with default breakpoints). Images from the media library can also sit on the board as media objects.
- **Tiers.** An artboard far from view is an outline (Ghost). In view it is a read-only render (Preview), at most 12 at once. Below 20% zoom, or beyond the 12, it is a frozen copy (Snapshot); an artboard that was never rendered is rendered once to make that copy. One artboard at a time is the real block editor (Live); the two edited before it stay mounted (Warm).
- **Editing.** Double-click or Enter edits an artboard at the board's zoom, from 30% up. Below 30% the zoom first fits the artboard's width. The block toolbar sits in the header, the list view in the left panel, the inspector in the right panel. Esc, the back button, a click on empty board, a click on another artboard, or zooming out below 30% ends edit.
- **Selecting several.** Cmd/Ctrl + click in the artboard list or on the board adds an artboard to the selection or takes it out; Shift + click in the list selects a range (D41). Dragging from empty board draws a rectangle and selects every artboard it touches as it is dragged; with Cmd/Ctrl it adds to the selection, and in edit it first leaves edit (D43, in `src/shell/use-canvas-interactions.js`; OQ-29 lists the builder's choices). Several selected artboards move together, by drag or arrow keys, and Delete takes them all off the board with no dialog; the right panel shows Styles. The store keeps `selectedIds`; `getSelectedId` gives an id only when exactly one is selected.
- **Keyboard shortcuts dialog.** A control floating at the bottom left of the canvas area, and Ctrl + Option + H on a Mac or Shift + Alt + H elsewhere, open a dialog listing the board's shortcuts (D42). It is in `src/shell/shortcuts-dialog.js`. Closing it puts focus back where it was, the caret of a block included. The control's shadow is a Sass variable of `@wordpress/base-styles`, because the design system has no elevation token (OQ-28).
- **Tidy up.** A "Tidy up" control in the header, just before the zoom menu (H12), puts everything on the board in one row per kind, in left-panel order, starting at the top left of what was there, then fits all (D45). It is one undoable layout step named "tidy up", and is disabled while an artboard is in edit or with fewer than two items. The arrangement is in `src/shell/tidy.js`. Row spacing uses each artboard's last measured height, so a height not yet measured can leave a row gap uneven; labels are drawn at screen size, so at low zoom the labels of narrow artboards can run into the next one's.
- **Notes.** "Add note" in the header arms the note tool; the next click on the board places a note there and puts the caret in it (D46). Notes are plain text in Yellow, Green, Blue or Pink, 240 board units wide, drawn above every artboard. They are selected, moved and multi-selected like artboards, Delete removes them with no dialog, double-click or Enter edits the text. They are listed under "Notes" in the left panel and saved in the board's layout (`notes`) by the same 2-second autosave, typing included; they never reach Review. The note itself and its right-panel settings are in `src/shell/notes.js`; the store keeps `notes`, `editingNoteId` and `isNoteToolArmed`. `getSelectedId` gives an artboard only; `getSelectedNoteId` gives a note.
- **Dragging blocks.** A block that is not being edited moves when pressed anywhere, its text included, and dragged; a click puts the caret in it and dragging then selects text (D40). This is the behaviour of Gutenberg pull request 86911, added as a layer in `src/artboard-editor/drag-anywhere.js`; the top of that file says how to remove it once WordPress has the behaviour.
- **Pages** are shown inside their template, which is locked. A page's template can be changed from the right panel.
- **Creating.** The Add artboard menu places a new page, pattern, template or template part. Pages and patterns are created as drafts at once; templates and parts exist only in the session until saved.
- **Inserter.** Blocks, Patterns, Templates and Media tabs. A row does the same thing clicked or dragged (D39). With an artboard in edit, a pattern, template part or image goes into its content: at the insertion point on a click, where it is dropped on a drag. With none in edit, a pattern, template, part or image goes onto the board: at the drop point on a drag, in the middle of the view and clear of other artboards on a click. The Blocks tab is shown only while an artboard is in edit.
- **Styles.** With nothing selected the right panel edits global styles: tokens with use counts, per-block styles, revisions, variations. A change repaints every artboard from one style compile.
- **Review.** Nothing reaches the site until "Review changes" is used. It lists each changed item and saves the checked ones. "Discard all" reverts everything, and each item's own "Discard" that item alone, after a confirmation. Either is one step that Undo and Redo act on in an artboard, except for a new template or part, which leaves the board for good; only then does the confirmation say that it can't be undone (D48, OQ-32). Artboard positions save on their own, two seconds after a change.
- **Locks.** Editing a page or pattern takes WordPress's post lock through the plugin's own route and dialog.
- **Panels.** Both side panels can be hidden from the header or with Cmd/Ctrl + \. Resting the pointer on the left or right edge of the canvas area brings a hidden panel back.

## Layout of the repository

```
CLAUDE.md                     Build instructions and binding rules
spec/                         The specification (source of truth)
docs/                         This folder
wordpress-for-designers.php   Plugin header, loads includes/
uninstall.php                 Deletes all boards
includes/                     PHP, six files
src/                          JavaScript and SCSS, built by wp-scripts into build/
tests/e2e/                    Playwright tests, test helper plugin, test theme
tools/                        Allowlist data and small scripts
spikes/                       Throwaway spike code and evidence
```

Ignored by git: `node_modules/`, `build/`, `artifacts/`, `test-results/`, `playwright-report/`.

### PHP (`includes/`, about 640 lines with the two root files)

| File | Holds |
|---|---|
| `post-type.php` | The `wfd_board` post type; its REST field `layout` with strict validation (anything else is a 400); boards are always published |
| `menu.php` | The Designer menu: Boards, Add board |
| `assets.php` | Enqueues an entry and passes `window.wfdConfig` |
| `board-app.php` | The full-screen board page, without wp-admin chrome |
| `bootstrap.php` | Editor settings, REST preload, block definitions and editor assets for the board page |
| `lock.php` | `wfd/v1/lock/{id}`: take or refresh, take over, release |

### JavaScript (`src/`, about 10,300 lines, plus 640 of SCSS)

Two entries: `boards` (the Boards list, `src/boards/`) and `board` (the app, `src/shell/index.js`).

| Folder | Holds |
|---|---|
| `shell/` | The app: `app.js` connects everything; header, panels, dialogs, canvas; hooks for artboards, canvas pointer and key handling, editing, placement, removal. `style.scss` includes the rules that make editing work below 100% |
| `board-store/` | The `wfd/board` data store: artboards, selection, Live and Warm ids, layout undo, autosave |
| `viewport/` | Pan and zoom outside React: one transform and `--wfd-zoom` per animation frame, React told on settle |
| `tier-scheduler/` | Tier of each artboard; Previews mounted nearest first through a priority queue |
| `artboard-frame/` | One artboard: position, label, outline, error state, media image |
| `artboard-preview/` | The Preview tier; finding a page's template |
| `artboard-editor/` | The Live editor; `coalesce.js` groups typing into undo steps; `drag-anywhere.js` is the removable drag-from-anywhere layer (D40) |
| `artboard-snapshot/` | The frozen copy of a Preview |
| `chrome-slots/` | Slots for the block toolbar, inspector and list view |
| `inserter/` | The inserter panel, its data and actions |
| `styles/` | The Styles panel and global styles handling |
| `usage-index/` | Where tokens and blocks are used |
| `review/` | The Review drawer, change lines, saving, discarding |
| `lock/` | Client side of the post lock |
| `adapter/` | `private.js` is empty. `experimental.js` is the only place experimental WordPress exports are imported |
| `static/` | Every screen with fixed data and no behaviour, shown with `&wfd-screen=Name` in a test build |

### Tests (`tests/e2e/`, about 7,000 lines)

Twenty-one spec files, one per acceptance group: `a11y`, `board`, `canvas`, `data`, `del`, `dev`, `edit`, `index`, `ins`, `key`, `media`, `new`, `note`, `perf`, `perm`, `save`, `shell`, `state`, `style`, `tier`, `undo`. `utils.ts` has the shared helpers. `plugin/` is the test helper plugin. `themes/wfd-viewport` is a theme with non-default breakpoints for AC-DEV-02.

The app marks elements for the tests with `data-wfd-*` attributes: `region`, `control` (the H and L ids of `spec/screens/README.md`), `artboard`, `tier`, `kind`, `device`, `row`, `group`, `panel`, `placement`, `placer`, `banner`, `stale`, `live-notice`, `lock-dialog`, `template-control`.

## Running it

Install once:

```bash
npm install
```

Build, start WordPress, run everything:

```bash
npm run build
```

```bash
npx wp-env start
```

```bash
npm run test:e2e
```

```bash
npm run lint
```

- The site is http://localhost:8888, user `admin`, password `password` (wp-env's defaults).
- The suite needs the test helper plugin active and wipes the site's content on every test. See "The test helper plugin" in [working-notes.md](working-notes.md).
- At the time of writing wp-env is running as a demo: the fixture is seeded as "Fixture board", two images are in the media library, and the test helper plugin is switched off.

## Releasing it

A release is a version tag. Pushing `v1.2.3` runs `.github/workflows/release.yml`, which lints, builds, and attaches `wordpress-for-designers.zip` to a GitHub release of that name with generated notes. A tag with a hyphen (`v1.2.3-beta.1`) makes a pre-release.

The version is kept in three places: `package.json`, the plugin header and `WFD_VERSION`. `npm version` changes all three (its `version` script runs `tools/sync-version.mjs`), commits and makes the tag. The workflow stops before building if the tag and the three do not match.

```bash
npm version minor -m "Release %s"
```

```bash
git push --follow-tags
```

- The zip holds one folder, `wordpress-for-designers/`, with the plugin file, `uninstall.php`, `includes/` and `build/`. `tools/package.sh` has that list; the playground workflow uses it too.
- `npm run build` then `npm run package` makes the same zip locally in `dist/`.
- The newest release's zip is always at `https://github.com/draganescu/wordpress-for-designers/releases/latest/download/wordpress-for-designers.zip`.
- The workflow does not run the end-to-end suite and does not check that the tag is on `master`.

## Numbers that are built in

| What | Value | Where |
|---|---|---|
| Lowest zoom for editing | 30% | `src/shell/use-editing.js` |
| Snapshot threshold | Below 20% going down, 22% going up | `src/tier-scheduler/index.js` |
| Most Previews at once | 12 | `src/tier-scheduler/index.js` |
| Warm editors kept | 2 | `src/board-store/index.js` |
| Zoom range | 2% to 400% | `src/viewport/math.js` |
| Zoom step (menu and keys) | × 1.25 | `src/shell/use-canvas-interactions.js` |
| Layout autosave delay | 2 s | `src/board-store/use-layout-autosave.js` |
| Height of a new artboard before it is measured | 900 px | `src/shell/use-placement.js` |
| Viewport height that `vh` units resolve against in an artboard | 900 px | `src/artboard-frame/viewport-units.js` |
| Widest media object | 1440 px | `src/shell/constants.js` |
| Note width | 240 board units | `src/shell/notes.js` |
| Images listed in the Media tab | 50 most recent | `src/inserter/use-inserter-data.js` |

## Where the build differs from, or goes beyond, the spec as received

Each of these is recorded in the spec; this is the short list to read first.

- **Editing zoom.** The spec as received wanted editing from 50% zoom. It became "exactly 100%" after the first spike (D30) and "30% and up" after manual testing (D37). It works by styling WordPress's internal markup (`spec/spike-report.md`, "Editing below 100%"; OQ-21 lists what is imperfect there).
- **Post lock.** The plugin's own route and dialog replace `PostLockedModal` (D31).
- **Snapshots during gestures.** The spec asks for Snapshots during any pan or zoom; Previews stay mounted instead, because swapping them would break the no-render rule (OQ-19).
- **Drag from anywhere.** C6 has one stated addition, D40; OQ-26 lists how the layer differs from the pull request.
- **Accessibility scan.** It covers the plugin's document, not the artboard iframes (OQ-17).
- **Added after Milestone 12:** showing all of an artboard's content outside edit (D44), hiding the side panels (D32), the Blocks tab hidden outside edit (D33), media objects (D34), the page template select (D35), the new-page template (D36), leaving edit on deselect (D38), inserter rows that act the same clicked or dragged (D39), dragging blocks from anywhere (D40), notes on the board (D46), discarding one change from Review (D48).

## Open questions

Twenty-seven entries are open, OQ-4, OQ-6 to OQ-10 and OQ-12 to OQ-32. The missing numbers were decided by the product owner and removed from the file. None leaves something unbuilt; each records a choice made where the spec was silent or could not be met as written. Grouped:

| About | Entries |
|---|---|
| Wording the spec does not give | OQ-7, OQ-8, OQ-15, OQ-16, OQ-22 |
| A component that cannot do what the screen file asks | OQ-4, OQ-9 |
| The allowlist | OQ-14, OQ-17, OQ-20 |
| Limits inside WordPress | OQ-13, OQ-21 |
| Two spec statements that conflict | OQ-12, OQ-18, OQ-19 |
| Builder's choices to confirm | OQ-6, OQ-23, OQ-24, OQ-25, OQ-26, OQ-27, OQ-28, OQ-29, OQ-30, OQ-31, OQ-32 |
| Build order | OQ-10 |

## Sensible next steps

These are suggestions, not decisions.

1. Have the product owner go through the open questions; OQ-17, OQ-19 and OQ-21 change what "done" means.
2. Activate on a clean WordPress 7.2 final with only a block theme, and confirm there are no PHP notices or console errors.
3. Run the suite in Firefox and WebKit, at least AC-EDIT-09.
4. Redo `spec/shell-check.md` against the screens as they are now.
5. Decide what to do with `spikes/`.
