# Working notes

Written 2026-11-19 from the build session that took the plugin from "spec as received" to the state in [state.md](state.md). Read this before changing anything. It records how the work was done, what the project expects of whoever works on it, and what cost time.

These are notes, not rules. The rules are in `CLAUDE.md` and `spec/`. Where a note and the spec disagree, the spec wins.

## How the project works

### The spec is the source of truth, and it changes only by decision

- Everything a user can see or that is stored comes from `spec/`. When the spec is silent, the answer is an entry in `spec/open-questions.md`, not a guess (`CLAUDE.md`, rule 4).
- The product owner changes the spec by deciding in conversation. Each decision was then written into the spec files it touches and committed on its own, with a message starting "Record product owner decision". Six such commits exist. Follow the same pattern.
- A decision usually touches several files. For one feature expect to edit `decisions.md` (a new D number), the screen file or `screens/README.md`, `architecture.md` or `data-model.md`, and `acceptance.md` (new or reworded AC lines). Reversing an old decision means marking it superseded, not deleting it (see D30 and D37).
- Three spec files are working files and are never part of those commits: `open-questions.md`, `spike-report.md`, `shell-check.md`. The original goal checked that `git diff --stat HEAD -- spec CLAUDE.md` shows only those three.
- `CLAUDE.md` was not edited during the build.

### One acceptance criterion, one test, same name

- Every `AC-GROUP-NN` line in `spec/acceptance.md` has one Playwright test whose title starts with that ID, in `tests/e2e/{group}.spec.ts`.
- To check coverage, compare the IDs in the spec with the IDs of passing tests:

```bash
comm -23 <(grep -o '^- AC-[A-Z0-9]*-[0-9]*' spec/acceptance.md | cut -c3- | sort -u) <(npm run test:e2e 2>&1 | grep '✓' | grep -o 'AC-[A-Z0-9]*-[0-9]*' | sort -u)
```

- When a decision changes behaviour, reword the AC line and the test title together.

### Asking the product owner

- Questions that only the product owner can answer were asked in batches of up to four, each with a recommended option. Things that could be decided from the spec or measured were not asked.
- When an answer left gaps, the gaps were filled with the least inventive choice, listed in the reply, and recorded as open questions (OQ-21 to OQ-24 are examples). Do the same; do not fill gaps silently.

### Spike before reversing a measured limit

- Milestone 0 failed on editing below 100% zoom and on `PostLockedModal`. The build stopped and reported, as `build-order.md` requires. The product owner then decided (edit at 100%, a plugin lock route).
- Later the product owner asked for editing from 30%. That was not built from memory of the first spike. A second spike measured candidate fixes first, and only then was the app changed. Both are written up in `spec/spike-report.md`.

## Tools

| Tool | Used for | Notes |
|---|---|---|
| `@wordpress/env` | Local WordPress 7.2-RC2 on port 8888 | Config in `.wp-env.json`. Start with `npx wp-env start`, stop with `npx wp-env stop`. The owner's standing instruction: stop it when testing is done unless told to keep it. |
| `@wordpress/scripts` | `npm run build`, `npm run lint` (`lint-js` and `lint-style`), `npm run test:e2e` | Playwright runs with one worker; the full suite takes about five minutes. |
| WP-CLI through wp-env | Seeding, plugin toggles, reading config | `npx wp-env run cli wp ...`. Put `--` before `wp eval` so its arguments are passed through. |
| `docker exec` into the WordPress container | Reading WordPress's shipped JavaScript | `SCRIPT_DEBUG` is on, so `wp-includes/js/dist/block-editor.js` is unminified. This is the real source for 7.2; `node_modules/@wordpress/*/src` can differ. |
| Playwright scripts outside the suite | One-off measurements and debugging | A throwaway `tests/e2e/dbg.spec.ts` (deleted afterwards) was the fastest way to inspect the running app with the fixture and helpers. |
| Multi-agent workflows | The two spikes | See "Running spikes with agents" below. |
| `axe-core` | AC-A11Y-03 | Injected from `node_modules`; `@axe-core/playwright` is not an allowed dependency (OQ-17). |
| `tools/allowlist.cjs` | The import allowlist as data | `eslint.config.cjs` builds the C1 and C3 rules from it. Changing what may be imported means changing `spec/api-allowlist.md` first, then this file. |
| `tools/shots.mjs`, `tools/peek.mjs` | Screenshots of the fixed-data screens; run a snippet in the seeded board | Output goes to `artifacts/shell/`. Both need the test helper plugin active. |
| `tools/patch.py` | Whitespace-insensitive text replacement | Made because exact-match patches kept failing after Prettier reformatted files. |

### Commands that were run all the time

```bash
npm run build
```

```bash
npm run lint
```

```bash
npm run test:e2e -- -g "AC-EDIT-09|AC-TIER-07"
```

```bash
npm run test:e2e -- shell.spec.ts
```

Filter the test output; it is long. This pattern keeps the useful lines:

```bash
npm run test:e2e 2>&1 | grep -E "✘|passed|failed|^\s+(Error|Expected|Received|Locator|> [0-9]+ \|)"
```

### The test helper plugin

`tests/e2e/plugin/wfd-test-helpers.php` is mounted by wp-env under the plugin slug `plugin`.

- It defines `WFD_TEST_BUILD`, which turns on `window.wfdTest` (render, style-generation and parse counters, the viewport, the editor bridge, snapshots) and the fixed-data screens.
- Its `wfd-test/v1/reset` route wipes and reseeds. **The wipe deletes every board, page, pattern, template and part customisation, global styles post, attachment and navigation menu on the site.** Never point the tests at a site with content worth keeping.
- It creates two extra users, `wfd_editor` and `wfd_admin2`, with the password `password`.
- For a manual demo it is switched off so the app runs as it would in production, and switched on again before the suite:

```bash
npx wp-env run cli wp plugin deactivate plugin
```

```bash
npx wp-env run cli wp plugin activate plugin
```

- Reseeding the demo without the REST route:

```bash
npx wp-env run cli -- wp eval 'wfd_test_wipe(); wfd_test_users(); $r = wfd_test_seed(); echo "BOARD=" . $r["boardId"] . "\n";' --user=admin
```

### Running spikes with agents

The second spike had three agents explore in parallel (a source inventory, and two scaling approaches) with two verifiers to follow. What made it work:

- Agents did not edit source or rebuild. They drove the already built app with Playwright and injected CSS and JavaScript at run time, so they could not collide.
- The app left edit on any zoom change at the time, so agents simulated a zoom by overriding the canvas surface's transform with an `!important` stylesheet rule.
- Each agent was given its own artboard, and only templates and parts (pages and patterns take a post lock).
- Each wrote only under its own folder in `spikes/zoom-edit/`.

What to do differently:

- While agents use the running app, nothing can be rebuilt. Work that needs a build waits. Plan for that, or give the spike its own environment.
- The inner-scale agent and both verifiers had not reported after about 40 minutes. The run was stopped once one agent had a measured, passing recipe, and the real implementation was checked with an acceptance test instead (AC-EDIT-09, Chromium only). The independent verification the spike was designed to give did not happen.
- Agents' reports are claims. The recipe was re-measured in the real app before it was trusted, and that found a bug the spike had only listed as a risk (see "The board scrolled" below).

## Gotchas

### WordPress and Gutenberg behaviour

- **The stock styles package has to match the WordPress in use.** `@wordpress/global-styles-ui` is bundled, but it unlocks private functions of the `@wordpress/block-editor` that WordPress ships. Releases 2.1.0 and 2.2.0 call `getBlockTypesForElement`, which WordPress 7.2-RC2 does not have: opening an element's screen, or "Text" under Typography, threw "is not a function" and blanked the board. `package.json` pins 2.0.0, the last release without it, and pins `@wordpress/global-styles-engine` to 2.2.0, the release it was tested with, because the stock package uses private functions of the engine too. The rule is D59: build against the WordPress that has shipped. When a shipped WordPress has `getBlockTypesForElement`, and it is the oldest one the plugin supports (C20), the pins can be raised. Do it in one change: raise both releases in `package.json` and in `spec/api-allowlist.md`; give the element table in `src/styles/stock-screens.js` the titles of the new release's screens (2.2.0 says "Form input", "Form select", "Form button") and change D53's row names in `spec/screens/StylesBlocks.md` and the AC-STYLE-09 test with it; then open Typography → Text and an element row of the Blocks tab on that WordPress, which AC-STYLE-08 and AC-STYLE-09 do.
- **WordPress's error notice overflows outside the editor.** `.editor-error-boundary` is 100% wide with padding, and counts on the editor making every box a border box. In the right panel it ran past the edge. One rule in `src/styles/_style.scss` sets its `box-sizing` (D60); AC-STYLE-12 is the alarm if WordPress renames the class.
- **Block tools work only at screen size.** A CSS scale on an ancestor of `BlockCanvas` misplaces popovers. The fix in use scales the tools wrapper by `1/zoom` and the iframe by `zoom`. Tools built on `BlockPopoverCover` size themselves from `offsetWidth` and need their own rule. All of this is CSS on WordPress's internal class names in `src/shell/style.scss`; `spec/spike-report.md`, "Editing below 100%", lists every selector. AC-EDIT-09 is the alarm if WordPress changes them.
- **Dragging into the artboard in edit rides on WordPress's HTML drop.** While an artboard is in edit, an inserter drag carries the item's blocks as `text/html` (serialised block markup). The editor's own drop zone takes it like HTML dragged from anywhere, parses the block comments and inserts at its insertion line; the plugin handles no drop inside the iframe. WordPress's inserter uses a `wp-blocks` payload and a private `startDragging` instead, which the allowlist rules out. AC-INS-05 and AC-INS-08 are the alarm (`src/inserter/use-inserter-actions.js`).
- **The board scrolled.** The editor calls `scrollIntoView` on its selection. A box with `overflow: hidden` can still be scrolled by script, and the canvas area was. It is now `overflow: clip`.
- **Typing undid one keystroke at a time.** `block-editor` decides whether a change continues the last one from a `lastAction` value shared by every block-editor store on the page. With several editors mounted it is overwritten between keystrokes. `src/artboard-editor/coalesce.js` makes that decision for the Live editor. Page content is still affected in one case (OQ-13).
- **`BlockPreview` caps its height at 2000 px** with inline max-heights. A rule in `src/shell/style.scss` lifts the cap inside `.wfd-preview` (D44); AC-TIER-13 is the alarm.
- **The block toolbar scrolls itself.** In the header slot WordPress's `.block-editor-block-toolbar` takes the width it is given and scrolls sideways inside it, with no scrollbar, and it is a new element for each selected block. The plugin's box around it never overflows, so measure and scroll the stock element (AC-SHELL-12).
- **A modal of `@wordpress/ui` hides the rest of the body from assistive technology.** While a `Dialog`, `AlertDialog` or `Drawer` is open, every other child of the body has `aria-hidden="true"`, the board's root included. Anything that must stay readable above one has to be its own child of the body, as the needs-space message is.
- **Viewport-height units have no fixed meaning in an artboard.** The iframe is as tall as its content, so `100vh` content grows each time the iframe is fitted to it, without end. `src/artboard-frame/viewport-units.js` rewrites those lengths to pixels of a 900 px viewport in the styles passed to the canvas, and overrides the ones in inline styles and in the canvas's other style sheets with generated rules (OQ-30, AC-DEV-05). 900 is not a limit on content: it is only what `100vh` means.
- **A block's stock styles screen has its own heading and Back.** The Blocks tab of the Styles panel adds neither (D58). The stock Back moves the stock navigation up to its own block list at `/blocks`; `GlobalStylesUI` reports the new path through `onPathChange`, and the panel then shows its own list instead (`blockStylesFor` in `src/styles/use-styles-panel.js`). Where the stock Back leads is not documented by WordPress; AC-STYLE-04 is the alarm. Under "All {block}" in the Block tab the same report sets "Style applies to" back to "This block" (D58); AC-STYLE-11 is the alarm there.
- **`PostLockedModal` cannot be used without `EditorProvider`.** It reads everything from the `core/editor` store. The plugin has its own lock route and dialog (D31).
- **`/wp/v2/templates/lookup` ignores `is_custom`.** Asked for a custom template it returns the hierarchy's template. A page's named template is found by slug among the `wp_template` records (`src/artboard-preview/use-page-template.js`).
- **A failed entity request stores a `Response`, not a parsed body.** `getResolutionError` returns an object with `status`, and nothing under `data`. Read both (`src/shell/use-artboards.js`).
- **A list request fills in single records.** The inserter's `getEntityRecords` for patterns satisfies `getEntityRecord` for each of them, so a test that fails only the single request never sees the error state. Fail the list request too.
- **A new template or part has no saved record.** It lives as edits on an id that does not exist yet. `startResolution` and `finishResolution` are called on that id so core-data does not request it and get a 404.
- **Dropping a record's edits.** `clearEntityRecordEdits` adds no undo level and leaves an empty edits object behind, so `getEditedEntityRecord` of an id that was never saved is `{}`, not `false`. `editEntityRecord` cannot clear `meta` with `undefined`: it merges the key into the edit it holds; give it the saved `meta`. Edits of several records become one undo level when the first is an ordinary edit and the rest are cached ones (`isCached`); the other way round they join the level before. All of it is in `src/review/discard-entity-edits.js`.
- **Key events from the canvas iframe arrive late.** WordPress re-dispatches them on the iframe element after the editor has handled them. Whether a popover was open has to be recorded at capture time, inside the canvas document as well as the top one, or Esc cannot tell "close the popover" from "leave edit".
- **Pointer capture retargets `dblclick`** to the capturing element. The canvas uses `elementFromPoint` to find what was double-clicked. For the same reason a button inside an artboard (Retry) needs the canvas to skip capture on it.
- **A post changed inside `posts_results` reaches the object cache.** When the filter gives back the same objects, `WP_Query` hands them to `update_post_caches()`. The preview changes a copy of each post instead (`includes/preview.php`).
- **`wp_filter_global_styles_post()` drops `version`.** Styles passed through it must be given their schema version again, or `WP_Theme_JSON_Data` reads them as empty.
- **An iframe's `load` comes too late for its listeners.** A link pressed while the page is still loading is followed without them. A browser's page gets its listeners as soon as the new document exists, found by watching from the old one's `pagehide` (`src/artboard-frame/browser.js`).
- **`location.href` is not the string WordPress gave.** The web browser writes the host in lower case and in punycode and drops a default port, so a page's address is compared with the home URL by origin and path, not as a prefix.
- **`wp-polyfill`** must be enqueued in the parent page, or every artboard iframe requests it again (AC-PERF-03).
- **`defaultTemplateTypes`** in the editor settings is an object keyed by slug, not an array.
- **Theme patterns have no `source` field.**
- **`MediaUploadCheck`** renders nothing when the `mediaUpload` setting is missing, which it is here (OQ-14). `MediaUpload` is used on its own.
- **`EditorSnackbars`** is on the allowlist but logs a deprecation in 7.2-RC2. It is not used.
- **The empty paragraph's add-block button** appears only when typing has stopped. In a test, move the pointer first.

### `@wordpress/ui`

- `Button` has only the tones brand and neutral; `AlertDialog` always draws Cancel and Confirm (OQ-4, OQ-9).
- `Menu.ItemDescription` must be a direct child of `Menu.Item`. `Menu.RadioItem` needs `closeOnClick` to close the menu.
- A `Popover.Root` leaves a `span[aria-owns]` where it is rendered. Inside a `role="list"` that fails the accessibility scan, so the colour picker's popover is rendered after the list.
- An `aria-label` that does not contain the control's visible text fails the scan. The zoom and device triggers carry their label as `VisuallyHidden` text instead (OQ-18). Tests that use `toHaveText` on them see that hidden text too.

### Lint and formatting

- No `eslint-disable` or `stylelint-disable` lines are allowed. Where a rule did not fit, the rule was configured in `eslint.config.cjs`.
- Indentation is four spaces (`.prettierrc.js` overrides the WordPress default of tabs).
- `wp-scripts lint-js --fix` reformats files. A scripted text replacement written before it can fail after it. It also inserts placeholder JSDoc `@param` lines without a type, which then fail lint; fill them in.
- `@wordpress/no-global-active-element` applies to tests too. Use `element.matches( ':focus' )` or a selection check.
- `@wordpress/no-unknown-ds-tokens` rejects a raw token string in JavaScript; the brand colour is read from a probe element.
- The i18n rules reject strings with leading or trailing spaces; separators are their own translatable string.
- In zsh, quote globs passed to `grep` (`--include='*.js'`).
- The build writes a right-to-left copy of each style sheet and flips `direction: ltr` to `rtl` in it. To keep something left to right, set `dir="ltr"` on the element.
- In zsh, `$VAR:spec/file` applies the `:s` modifier. Write `${VAR}:spec/file`.

### Tests

- **Running the suite from a git worktree.** Port 8888 belongs to the main checkout's site, which the suite would wipe. Start a second site from the worktree on a free port and point the tests at it: `WP_ENV_PORT=8895 npx wp-env start`, then `WP_BASE_URL=http://localhost:8895 npx wp-scripts test-playwright --config tests/e2e/playwright.config.ts`. AC-PERF-03 fails there and only there: it looks for the plugin under the folder name `wordpress-for-designers`, and wp-env names the folder after the worktree.
- An element id or class starting with `wfd` inside a canvas fails AC-EDIT-04, a style handle of the test helper included (WordPress gives the link tag the id `{handle}-css`).
- The viewport is 1440 × 900. With both panels open the canvas area is 800 px wide.
- Layout autosave waits 2 seconds. Tests that check the saved layout poll or wait about 3 seconds.
- Since D37, entering edit at 30% zoom or more does not move the board. A test that wants a known position must call `setViewport` before `enterEdit`. The `enterEdit` helper presses Shift + 1 when the artboard is off screen, which takes the zoom below 30% and so triggers the fit.
- Dragging is done with real `page.mouse` moves in several steps; one jump does not start a drag.
- After typing `/` for the slash inserter, type slowly and wait for the option before pressing Enter.
- Click an artboard in the part of its frame that is inside the canvas area. Helpers compute that point.

## Paths taken

In order, with what was learnt at each turn.

1. **Milestone 0 spikes.** Three spikes; (a) editing in a scaled container and (b) `PostLockedModal` failed. Stopped and reported. The product owner decided: edit at exactly 100%, and a plugin lock route with its own dialog. The gate then passed as reworded.
2. **Milestones 1 to 11.** Built in order. Several gates name criteria that need a later milestone (OQ-10); each was tested as soon as its part existed. Product-owner decisions along the way: `BlockContextProvider` and `InputControl` allowlisted, fixed undo names, the template notice wording, "Site" and "Navigation menu" items in Review, typography rows, "Add color".
3. **Milestone 12.** State and accessibility tests. The scan found real problems (two unnamed landmarks, label mismatches, list markup) that were fixed in the app. The scan covers the plugin's document only (OQ-17).
4. **Demo.** wp-env with the fixture seeded and the test helper off.
5. **Hiding the side panels (D32).** Two header toggles and Cmd/Ctrl + \.
6. **Manual testing round (D33 to D38).** Editing only at 100% turned out unusable. A second spike found a way to edit from 30%; C18 was rewritten and D30 superseded. Also: edit ends on deselect, the Blocks tab is hidden outside edit, images can be placed on the board as media objects, a page's template can be changed, new pages start on a blank or title-less template.

What this history says about the spec: decisions taken to get past a failed spike (D30) were the first to be reversed by real use. Treat a workaround decision as provisional until someone has used the result.
