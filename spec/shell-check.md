# Shell check (Milestone 2)

Each screen in `screens/` was built from its mapped components with fixed data and no behaviour, rendered at 1440 × 900 in Chromium on WordPress 7.2-RC2, and compared with its image. The fixed-data renderings are reachable only in test builds (`&wfd-screen={Name}` on the board app URL); `node tools/shots.mjs` writes them to `artifacts/shell/`. Five independent reviewers compared each screenshot with its image, its screen file and `screens/README.md`; their raw findings are in `artifacts/shell/compare.json`. Every finding was either fixed and re-shot, or is listed below.

Checked on 2026-11-19.

## Differences that apply to every screen

| Difference | Why |
|---|---|
| Artboards are empty boxes; the header block toolbar (H6), the list view tree (L6) and the block inspector (E2, E4) are empty slots | Editors and previews are built in Milestones 4 and 5. The slots are in place. |
| No "⌘K" hint, no zoom control at the bottom left of the canvas, dialogs dim the whole window | `screens/README.md` says these three are not built. |
| Rows are ordered by name, so Footer comes before Header | `screens/README.md`, L4. The image order is fixture data. |
| Artboard positions, counts and the site content inside them differ | Fixture data. |
| Spacing, colour, type and radius differ slightly; the left panel is 280 px and the right 360 px | They come from the components and `--wpds-*` tokens (C4). |
| Apostrophes are straight, as typed in the screen files | UI text is verbatim (rule 7). |

## Per screen

| Screen | Result | Remaining differences from the image |
|---|---|---|
| Overview | Matches | None beyond the general list. |
| Main | Matches | Undo tooltip is a hover state and is not in the screenshot. The device menu trigger is a `Button` with a chevron. |
| Selected | Matches | None. |
| EmptyBoard | Matches | None. |
| ErrorArtboard | Matches | The notice keeps screen size at any zoom, so at 17% it extends past the artboard box; "Retry" is the Notice's action button (OQ-4). |
| Boards | Matches | The "Settings" sub-item, miniature layouts and "unsaved changes" text are not built, as `Boards.md` says. Search and layout controls are DataViews' own. The "Rename" action is not built (OQ-3). |
| BoardsEmpty | Matches | None. |
| AddArtboard | Matches | Kind items have no chevron except Template, which is the only one with a submenu (`AddArtboard.md`). The pressed look of L2 is the Menu trigger's own. |
| AddArtboard2 | Matches | Edit starts at the board's zoom (D37). |
| DeleteDialog | Matches | Cancel is the AlertDialog's minimal button and Remove takes the irreversible intent only when the box is checked (OQ-4). |
| ResetDialog | Matches | Same as DeleteDialog. |
| LockDialog (two states, no image) | Matches the screen file | Second state built with `Dialog` (OQ-9). |
| InserterBlocks | Matches | None. |
| InserterEmpty | Matches | None. |
| InserterMedia | Matches | None. |
| InserterTemplates | Matches | None. |
| Library | Matches | Patterns used exactly once have no second line (OQ-6). The drag chip exists only during a real drag. The "Dragging" second line in the image is not in the component map and is not built. Group counts are the number of rows listed. |
| Styles | Matches | The "Aa" samples are one size (font sizes come from tokens). |
| StylesBlocks | Matches | None. |
| StylesHistory | Matches | "Unsaved" and "Theme default" rows show only their name (OQ-8). |
| Review | Matches | The drawer is the `Drawer` component's full window height, so it covers the right end of the header. "Discard all" is neutral (OQ-4). Change lines are plain text: the swatches and struck-through values in the image have no component in `Review.md`. |
| ReviewEmpty | Matches | None. |
| ReviewError | Matches the screen file | The image keeps saved items in the list and counts one; the screen file says saved items leave the list and the button counts checked items. Built as the screen file says (rule 3). |

## Gate

AC-SHELL-01 to AC-SHELL-04 pass (`tests/e2e/shell.spec.ts`).
