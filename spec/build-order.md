# Build order

Each milestone ends with a gate. The gate is the listed acceptance criteria passing. Do not start the next milestone before it does.

| # | Milestone | Builds | Gate |
|---|---|---|---|
| 0 | Spikes | Three throwaway proofs on a real WordPress 7.2: (a) one `artboard-editor` inside a CSS-scaled container at 50%, 75% and 100% with the block toolbar docked in the header and popovers positioned correctly; (b) `PostLockedModal` and `EntitiesSavedStates` working without `EditorProvider`; (c) a frozen Snapshot of a Preview with no React root that looks the same. Write the results to `spec/spike-report.md`. | All three succeed using only the allowlist. If any fails, stop and report. |
| 1 | Plugin skeleton | Plugin header, activation, `wfd_board` post type and REST validation, Designer menu, permission checks, build and lint set-up with the C1 to C3 and C23 rules, test environment and fixture. | AC-PERM-*, AC-BOARD-01 to 03 |
| 2 | Static shell | Every screen in `screens/` built from the mapped components with fixed data and no behaviour. Compare each against its image. | AC-SHELL-*; a visual check of every screen against `screens/images/` recorded in `spec/shell-check.md` |
| 3 | Board and canvas | `board-store`, `viewport`, artboard frames as Ghosts, selection, move, layout autosave, layout undo, keyboard map, Boards list. | AC-BOARD-*, AC-CANVAS-*, AC-KEY-*, AC-PERF-01 |
| 4 | Preview tier | `artboard-preview`, editor bootstrap, device widths, the queue. | AC-DEV-*, AC-TIER-03 to 05, AC-DATA-02 |
| 5 | Live editor | `artboard-editor`, chrome slots, list view, document bar, enter and leave edit, content undo, locks. | AC-EDIT-*, AC-TIER-01, AC-TIER-02, AC-DATA-01, AC-UNDO-* |
| 6 | Creating and removing | Add artboard menu and placement, entity creation rules, remove dialog. | AC-NEW-*, AC-DEL-* |
| 7 | Inserter | Four tabs, search, click to insert, drag to board. | AC-INS-* |
| 8 | Styles | Style compile, Tokens, Blocks, History, variation menu, "Style applies to". | AC-STYLE-* |
| 9 | Usage index | Index, counts, highlights. | AC-INDEX-* |
| 10 | Review and saving | Review drawer, save, discard, errors, unsaved-changes warning. | AC-SAVE-* |
| 11 | Snapshots and limits | `artboard-snapshot`, tier thresholds with hysteresis, Preview cap, warm editors, iframe event forwarding, stale marking. | AC-TIER-*, AC-PERF-* |
| 12 | States and finish | Empty and error states, accessibility pass, translations ready, uninstall. | AC-STATE-*, AC-A11Y-*, every criterion in `acceptance.md` |
