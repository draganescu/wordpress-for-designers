# Performance suite

Written 2026-11-20. The suite measures the board app and records numbers. It is separate from the acceptance suite: nothing in `tests/perf/` is an acceptance criterion, and the three `AC-PERF` tests stay in `tests/e2e/perf.spec.ts`.

## What runs where

| Part | Where | Holds |
|---|---|---|
| The tests | `tests/perf/*.spec.ts` | Playwright tests that measure and call `record()`; they assert almost nothing |
| Helpers | `tests/perf/support.ts` | The `record` fixture, and everything taken from Chromium itself: CPU slow-down, process memory, long tasks, frame timing, compositor layers, trace reading |
| Results | `tests/perf/reporter.ts` | A Playwright reporter that writes what the tests recorded to a results file |
| Budgets | `tests/perf/budgets.json` | `budgets`: the most each budgeted indicator may be. `tolerances`: how far an indicator that varies between runs must move before the report points at it |
| Build sizes | `tools/perf-bundle.mjs` | Size of each built file, and the WordPress scripts each entry depends on |
| Report | `tools/perf-report.mjs` | Medians, base against head, budget check, as Markdown |
| CI | `.github/workflows/perf.yml` | Runs all of it on a pull request. `.github/actions/site` builds a checkout and starts its WordPress, for this workflow and for `tests.yml` |

The suite uses the acceptance suite's configuration, login and helpers (`tests/e2e/playwright.config.ts`, `global-setup.ts`, `utils.ts`) and adds only what is in the table.

The tests are in two groups, by tag:

- `@once`: the app's counters, board size and memory. One run is enough.
- `@timing`: timings and gestures. They vary from run to run, so CI runs them three times on each build and the report gives the median.

### What can fail a run

Only a budget. Budgets are on what is the same on every run of the same code, or nearly: build sizes, the app's own counters (renders, style compiles, parses), REST requests, the number of iframes, and the size of a frozen copy.

Nothing else has a budget. Timings depend on the machine. Memory figures are sizes of processes and counts that depend on when Chromium collects garbage. Both are compared with the base build's and shown in the report.

### Replacing a part with WordPress's own

`support.ts` is the one file that knows Chromium: the DevTools protocol, the operating system's process list, and the names of trace events. Tracing and the trace itself already come from the `metrics` fixture of `@wordpress/e2e-test-utils-playwright`. A test hands over its results as an attachment named `results`, which a reporter writes out; Gutenberg's performance tests do the same, so its reporter could take the place of `reporter.ts`.

## On a pull request

`perf.yml` checks out the pull request (`head/`) and its base (`base/`), builds both, and starts a WordPress for each on the same runner (ports 8888 and 8889, `SCRIPT_DEBUG` off). The suite always comes from head. The `@once` group runs once on each build; the `@timing` group runs three rounds, base and head taking turns. Each run writes its own results file into the build's folder, and the report reads the folder.

A pull request that changes only `docs/`, `spec/` or Markdown files is not measured.

The report is in the job summary:

- **Over budget** fails the job. A budgeted indicator that was not measured also fails it.
- **Changes worth a look** lists what moved: a count by 2% or more, a size by 5% or more, a timing by 10% or more and at least 16 ms; in each case to outside the range the base was seen in. An indicator with an entry under `tolerances` in `budgets.json` needs that much instead. Indicators measured on base and missing on head are named here. This does not fail the job.
- **Every indicator** is the full table.

The results files are uploaded as the `perf-results` artifact for 30 days.

When a rise is meant, raise the number in `tests/perf/budgets.json` in the same pull request.

## Running it here

WordPress must be running with the test helper plugin active, as for the acceptance suite, and the plugin built. **The suite wipes the site's content on every test.**

```bash
npm run test:perf
```

```bash
npm run perf:report
```

- A run writes `artifacts/perf/results.jsonl` afresh; `PERF_RESULTS` names another file. A test that fails leaves nothing in it.
- `perf:report` adds the build sizes as `artifacts/perf/bundle.jsonl` and reports every `.jsonl` file in `artifacts/perf`. With `-- --strict` a budgeted indicator that was not measured fails it.
- One group or one file: `npm run test:perf -- --grep @once`, `npm run test:perf -- timings.spec.ts`.
- From a git worktree, use a site of its own, as for the acceptance suite: `WP_ENV_PORT=8895 npx wp-env start`, then `WP_BASE_URL=http://localhost:8895 npm run test:perf`.
- To compare two builds here, run each into a folder of its own (`PERF_RESULTS=artifacts/a/results.jsonl`) and give both to the report: `node tools/perf-report.mjs --base artifacts/a --head artifacts/b`.
- For numbers like CI's, turn `SCRIPT_DEBUG` off: put `{ "config": { "SCRIPT_DEBUG": false } }` in `.wp-env.override.json` (ignored by git) and run `npx wp-env start --update`. With it on, WordPress serves unminified scripts and the development build of React, and every timing is slower.

### On a real laptop

A CI runner has no graphics chip: Chromium draws in software there. The frame, raster and layer indicators then show main-thread and CPU drawing cost, not what a laptop's graphics chip and memory do. For the same reason CI runs the gestures at device pixel ratio 1 only; here they also run at 2. Before a release, or after a change to the canvas or the tiers, run the gestures on a mid-range laptop with a window and without the slow-down:

```bash
PERF_CPU_THROTTLE=1 npm run test:perf -- gestures.spec.ts --headed
```

`PERF_CPU_THROTTLE` is how many times slower the page's main thread is made for the timing tests. It is 4 by default. `perf.yml` sets 2: the runner is itself about 1.6 times slower than a recent laptop, and at 4 there the frame indicators were at their worst value on every run and a board of 30 artboards came close to never finishing (see "Things to know").

## The indicators

Names are as they appear in the report. `@2x` after a name means it was measured at device pixel ratio 2.

### Build sizes (`tools/perf-bundle.mjs`)

| Indicator | What it is |
|---|---|
| `bundle.*.js`, `bundle.*.css`, and `.gzip` of each | Size of each built file |
| `bundle.board.dependencies`, `bundle.boards.dependencies` | How many WordPress scripts the entry asks for. The report names any added or removed |

### Counts for one of each action (`counts.spec.ts`, `@once`)

All nine artboards of the fixture are Previews, at 40% zoom, so that entering edit does not zoom the board.

| Indicator | What it is |
|---|---|
| `select.renders`, `move.renders`, `edit-enter.renders`, `type.renders`, `edit-leave.renders`, `style-change.renders` | Component renders caused by one of each action, by the app's test counter. It counts component renders, not React commits. A move includes the layout save that follows it. Typing is 20 characters |
| `type.parses`, `style-change.style-generations` | Parses for the 20 characters; style compiles for one style change |

### Board size (`scale.spec.ts`, `@once`)

Each for boards of 9, 30 and 100 artboards, opened fitted, so that their artboards open as Snapshots.

| Indicator | What it is |
|---|---|
| `board-N.requests`, `.rest-requests` | Requests made opening the board, and how many of them are REST calls |
| `board-N.renders`, `.style-generations`, `.parses` | The app's test counters once the board is drawn. The renders and the requests vary by about 2% between runs, with the order requests come back in |
| `board-N.iframes` | Iframes in the page |
| `board-N.documents`, `.nodes` | Documents and nodes in the tab, the artboards' included, after garbage collection |
| `board-N.heap` | JavaScript heap after garbage collection |
| `board-N.tab-memory`, `.gpu-memory` | Resident memory of the tab's process and of the GPU process, as the operating system reports it |

`tab-memory` is the number that decides whether an 8 GB machine copes: the artboards' documents are in it and are not in the JavaScript heap.

### Memory (`memory.spec.ts`, `@once`)

| Indicator | What it is |
|---|---|
| `memory.board-of-ghosts` | Tab memory with the fixture board open and every artboard a Ghost |
| `memory.per-snapshot`, `memory.per-preview` | Tab memory added per artboard with all nine as Snapshots, or as Previews, each in a tab of its own |
| `memory.live-editor`, `memory.per-warm-editor` | Tab memory added by the first editor, and by each of the next two, with the eight other artboards staying Previews |
| `leak.documents`, `leak.nodes`, `leak.heap`, `leak.tab-memory` | What is still held after 20 more edits, compared with after the first four. Documents and nodes should be 0 |
| `snapshot.long-page`, `snapshot.all-nine` | Size in bytes of the markup of a frozen copy: of a long page, and of all nine together |

The per-tier figures are differences between process sizes and are rough. Read them for scale, not to the megabyte.

### Timings (`timings.spec.ts`, `@timing`, main thread slowed)

| Indicator | What it is |
|---|---|
| `open.first-artboard`, `open.all-artboards` | From navigation, with nothing cached, to the first artboard shown and to the last. Also `open-30.*` |
| `open.blocking`, `open.longest-task` | Total blocking time (the part of each main-thread task beyond 50 ms) and the longest task while opening |
| `select.handling` | Main-thread time handling the click that selects an artboard |
| `drag.frame-p95`, `drag.frames-dropped` | Time between frames while dragging an artboard, and frames later than 25 ms |
| `edit.enter` | From the double-click to an editor that can be typed in, at 50% zoom |
| `type.handling-p50`, `type.handling-p95` | Main-thread time handling each of 30 key presses in the editor |
| `style.repaint`, `style.longest-task`, `style.blocking` | A global style change with twelve Previews in view: until every one shows it, and the main-thread cost |
| `snapshot.create-30` | Making the frozen copies of a 30-artboard board never rendered before |
| `tidy.apply`, `tidy.longest-task` | Tidy up on 30 artboards |
| `idle.main-thread`, `idle.process-cpu` | CPU time used in ten seconds with a board open and nothing happening (not slowed) |

The handling indicators are what WordPress's own performance tests measure for typing: the time the browser spends dispatching the events of one interaction (`pointerdown`, `pointerup` and `click`; or `keydown`, `keypress` and `keyup`), read from a trace recorded by the `metrics` fixture. That is the listeners and everything they run at once, React's render and the edit of the text included. It stops before the browser lays out and paints, so it is less than the delay a person sees. The test fails if the trace does not hold every event.

### Gestures (`gestures.spec.ts`, `@timing`)

A board of 30 artboards with twelve Previews in view.

| Indicator | What it is |
|---|---|
| `pan.frame-p95`, `pan.frames-dropped`, `zoom.frame-p95`, `zoom.frames-dropped` | Time between frames over 120 frames of wheel events, and frames later than 25 ms |
| `zoom.raster` | Drawing work done for 40 frames of zooming in and back out |
| `zoom.sharpen` | How long after the last wheel event that drawing goes on: the time the board looks soft. The trace runs for four seconds after the zoom, and the test fails if drawing has not stopped by then |
| `layers.count`, `layers.pixels-memory` | Compositor layers that draw, and their memory at four bytes a pixel were each fully drawn |
| `gestures.gpu-memory` | Resident memory of the browser's GPU process |

## Things to know

- **A board opens fitted.** For the fixture that is 11% zoom, so every artboard is a Snapshot. Tests that need Previews store a viewport first with `openBoardAt`.
- **Editing below 30% zoom moves the board.** The app zooms to fit the artboard first, which changes the tier of the others. A test that measures what an edit costs opens the board at 30% or more (`viewOn`) and checks that the zoom did not change.
- **`settle()` does not use Playwright's "networkidle".** Two `OPTIONS` requests on the board never report as finished to Playwright, so it would wait for ever. `settle()` waits for the render counter, the resource count and the iframe count to stop changing, and fails after four minutes.
- **Do not poll every frame while artboards mount.** The app mounts Previews and makes frozen copies in the main thread's idle time (`@wordpress/priority-queue`). A check that runs on every animation frame asks for a frame every 16 ms, and on a slow machine that leaves no idle time: the first CI run timed out this way. `drawn()` and `watchOpening()` check on an interval; `timeUntil` takes an interval as its last argument for the same reason.
- **The app itself has this limit.** With the main thread slowed 12 times here, a board of 30 artboards had shown 21 of them after four minutes; at 7 times it took 44 seconds. On a machine slow enough to have no idle time, artboards mount very slowly.
- **A slow frame in a gesture re-tiers the board.** The app calls the viewport settled 140 ms after it last moved. On a slow machine one frame of a pan or zoom can take longer than that, so the tiers are worked out for a view the gesture only passes through: artboards outside it become Ghosts and, when the gesture ends, Snapshots again, and their frozen copies load again. `settle()` can return before they have. After a gesture, wait with `drawn()`. It was thought to be the cause of the CI failures of `zoom.sharpen`, where drawing had not stopped four seconds after the zoom. It was not: see the next item.
- **A frozen copy can hold a running animation.** The `zoom.sharpen` failures on CI were one of WordPress's spinners turning in a frozen copy: the Site Logo block shows it while the site's settings load, its height does not change meanwhile, and a copy made in that moment kept the spinner, so the board drew 60 frames a second for ever. It needs the settings to arrive about half a second late, which the runner did now and then and a Mac never; holding `/wp/v2/settings` back 400 to 600 ms with `page.route` gave it every time. The app no longer copies a Preview that shows a `Spinner` (`isLoading` in `src/artboard-preview/index.js`; OQ-54). No animation runs in a frozen copy at all: each is taken to its end when the copy is made (`STILL` in `src/artboard-snapshot/index.js`). When the check fails it lists each running animation with its artboard, tier and block.
- **Nothing is filled in.** A measurement that is not a number, a trace without its marks, or a wait that runs out fails the test. A failed test leaves no results, so a budgeted indicator it should have measured fails the report as well.
- **No retries.** A measurement that fails is looked at, not tried again.
- **The budgets were set on macOS**, with `SCRIPT_DEBUG` off. They hold what is the same on every machine; check them against the first CI run all the same.
- **Base is measured with head's tests.** If a new test needs something base does not have, base's run of it fails, its indicators are missing from the comparison, and the job goes on.
