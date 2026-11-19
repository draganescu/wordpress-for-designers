# Performance suite

Written 2026-11-20. The suite measures the board app and records numbers. It is separate from the acceptance suite: nothing in `tests/perf/` is an acceptance criterion, and the three `AC-PERF` tests stay in `tests/e2e/perf.spec.ts`.

## What runs where

| Part | Where | Holds |
|---|---|---|
| The tests | `tests/perf/*.spec.ts` | Playwright tests that measure and call `record()`; they assert almost nothing |
| Helpers | `tests/perf/support.ts` | `record`, CPU slow-down, process memory, long tasks, interaction timing, frame timing |
| Budgets | `tests/perf/budgets.json` | The most each budgeted indicator may be |
| Build sizes | `tools/perf-bundle.mjs` | Size of each built file, and the WordPress scripts each entry depends on |
| Report | `tools/perf-report.mjs` | Medians, base against head, budget check, as Markdown |
| CI | `.github/workflows/perf.yml` | Runs all of it on every pull request |

The tests are in two groups, by tag:

- `@once`: exact counts, board size and memory. One run is enough. These are the ones with budgets.
- `@timing`: timings and gestures. They vary from run to run, so CI runs them three times on each build and the report gives the median. They have no budgets.

## On a pull request

`perf.yml` checks out the pull request (`head/`) and its base (`base/`), builds both, and starts a WordPress for each on the same runner (ports 8888 and 8889, `SCRIPT_DEBUG` off). The suite always comes from head. The `@once` group runs once on each build; the `@timing` group runs three rounds, base and head taking turns.

The report is in the job summary:

- **Over budget** fails the job. A budgeted indicator that was not measured also fails it.
- **Changes worth a look** lists what moved: a count by 2% or more, a size by 5% or more, a timing by 10% or more and outside the range the base was seen in. This does not fail the job.
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

- The results go to `artifacts/perf/results.jsonl`, started afresh on each run. With `PERF_APPEND=1` a run adds to the file, which is how several rounds become one set of results. `PERF_RESULTS` names another file.
- One group or one file: `npm run test:perf -- --grep @once`, `npm run test:perf -- timings.spec.ts`.
- From a git worktree, use a site of its own, as for the acceptance suite: `WP_ENV_PORT=8895 npx wp-env start`, then `WP_BASE_URL=http://localhost:8895 npm run test:perf`.
- To compare two builds here, run each into its own file and give both to the report: `node tools/perf-report.mjs --base a.jsonl --head b.jsonl`.
- For numbers like CI's, turn `SCRIPT_DEBUG` off: put `{ "config": { "SCRIPT_DEBUG": false } }` in `.wp-env.override.json` (ignored by git) and run `npx wp-env start --update`. With it on, WordPress serves unminified scripts and the development build of React, and every timing is slower.

### On a real laptop

A CI runner has no graphics chip: Chromium draws in software there. The frame, raster and layer indicators then show main-thread and CPU drawing cost, not what a laptop's graphics chip and memory do. Before a release, or after a change to the canvas or the tiers, run the gestures on a mid-range laptop with a window and without the slow-down:

```bash
PERF_CPU_THROTTLE=1 npm run test:perf -- gestures.spec.ts --headed
```

`PERF_CPU_THROTTLE` is how many times slower the page's main thread is made for the timing tests. It is 4 by default, which on a CI runner stands for an older laptop.

## The indicators

Names are as they appear in the report. `@2x` after a name means it was measured at device pixel ratio 2.

### Exact counts (`counts.spec.ts`, `@once`)

| Indicator | What it is |
|---|---|
| `bundle.*.js`, `bundle.*.css`, and `.gzip` of each | Size of each built file |
| `bundle.board.dependencies`, `bundle.boards.dependencies` | How many WordPress scripts the entry asks for. The report names any added or removed |
| `open.requests`, `open.rest-requests` | Requests made opening the nine-artboard fixture board, and how many of them are REST calls |
| `open.renders`, `open.style-generations`, `open.parses` | The app's test counters once the board is drawn. `renders` counts component renders, not React commits |
| `select.renders`, `move.renders`, `edit-enter.renders`, `type.renders`, `edit-leave.renders`, `style-change.renders` | Component renders caused by one of each action. Typing is 20 characters |
| `type.parses`, `style-change.style-generations` | Parses for the 20 characters; style compiles for one style change |

### Board size (`scale.spec.ts`, `@once`)

Each for boards of 9, 30 and 100 artboards, opened fitted (so the larger ones open as Snapshots): `board-N.renders`, `.rest-requests`, `.iframes`, `.documents`, `.nodes` (every document in the tab), `.heap` (JavaScript heap after garbage collection), `.tab-memory` and `.gpu-memory`.

`tab-memory` is the resident memory of the tab's process as the operating system reports it. It is the number that decides whether an 8 GB machine copes: the artboards' documents are in it and are not in the JavaScript heap.

### Memory (`memory.spec.ts`, `@once`)

| Indicator | What it is |
|---|---|
| `memory.board-of-ghosts` | Tab memory with the fixture board open and every artboard a Ghost |
| `memory.per-snapshot`, `memory.per-preview` | Tab memory added per artboard with all nine as Snapshots, or as Previews, each in a tab of its own |
| `memory.live-editor`, `memory.per-warm-editor` | Tab memory added by the first editor, and by each of the next two |
| `leak.documents`, `leak.nodes`, `leak.heap`, `leak.tab-memory` | What is still held after 20 more edits, compared with after the first four. Documents and nodes should be 0 |
| `snapshot.long-page`, `snapshot.all-nine` | Size of the markup of a frozen copy: of a long page, and of all nine together |

The per-tier figures are differences between process sizes and are rough. Read them for scale, not to the megabyte.

### Timings (`timings.spec.ts`, `@timing`, main thread slowed)

| Indicator | What it is |
|---|---|
| `open.first-artboard`, `open.all-artboards` | From navigation, with nothing cached, to the first artboard shown and to the last. Also `open-30.*` |
| `open.blocking`, `open.longest-task` | Total blocking time (the part of each main-thread task beyond 50 ms) and the longest task while opening |
| `select.latency` | From the click that selects an artboard to the next paint |
| `drag.frame-p95`, `drag.frames-dropped` | Time between frames while dragging an artboard, and frames later than 25 ms |
| `edit.enter` | From the double-click to an editor that can be typed in, at 50% zoom |
| `type.latency-p50`, `type.latency-p95` | From each of 30 key presses to the next paint, in the editor |
| `style.repaint`, `style.longest-task`, `style.blocking` | A global style change with twelve Previews in view: until every one shows it, and the main-thread cost |
| `snapshot.create-30` | Making the frozen copies of a 30-artboard board never rendered before |
| `tidy.apply`, `tidy.longest-task` | Tidy up on 30 artboards |
| `idle.main-thread`, `idle.process-cpu` | CPU time used in ten seconds with a board open and nothing happening (not slowed) |

The latency indicators use the browser's Event Timing API, which reports in steps of 8 ms and nothing under 16 ms; an interaction it did not report counts as 16.

### Gestures (`gestures.spec.ts`, `@timing`, at pixel ratio 1 and 2)

A board of 30 artboards with twelve Previews in view.

| Indicator | What it is |
|---|---|
| `pan.frame-p95`, `pan.frames-dropped`, `zoom.frame-p95`, `zoom.frames-dropped` | Time between frames over 120 frames of wheel events, and frames later than 25 ms |
| `zoom.raster` | Drawing work done for a 40-frame zoom that ends at a new scale |
| `zoom.sharpen` | How long after the last wheel event that drawing goes on: the time the board looks soft |
| `layers.count`, `layers.pixels-memory` | Compositor layers that draw, and their memory at four bytes a pixel were each fully drawn |
| `gestures.gpu-memory` | Resident memory of the browser's GPU process |

## Things to know

- **A board opens fitted.** For the fixture that is 11% zoom, so every artboard is a Snapshot. Tests that need Previews store a viewport first with `openBoardAt`.
- **`settle()` does not use Playwright's "networkidle".** Two `OPTIONS` requests on the board never report as finished to Playwright, so it would wait for ever. `settle()` waits for the render counter, the resource count and the iframe count to stop changing.
- **No retries.** A retried test would record its numbers twice.
- **Budgets were set on macOS.** The memory ceilings in particular may sit differently on the Linux runner; check them against the first CI run.
- **Base is measured with head's tests.** If a new test needs something base does not have, base's run of it fails, its indicators are missing from the comparison, and the job goes on.
