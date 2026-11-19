# Screens

Twenty-two screens. Each has an image in `images/` and a file here naming its state, the regions it uses and its own elements. Regions shared by many screens are defined once in this file.

Rules for reading the images (see also `CLAUDE.md`, rules 6 and 7):

- They were rendered at 1440 × 900 from hand-styled markup. Layout, grouping, wording and states are binding. Exact pixel values are not; spacing, colour, type and radius come from the components and `--wpds-*` tokens.
- Icons in the images are approximations. Use the named `@wordpress/icons` icon.
- The site shown inside artboards (The Slow Margin) and the names, counts and dates in lists are fixture data.
- Three things visible in the images are **not** built: the "⌘K" hint in the document bar, the zoom control at the bottom left of the canvas on the two editing screens (zoom lives in the header, H8), and dimming that covers only the canvas behind dialogs (dialogs are modal over the whole window). `[N]`

Component names refer to `@wordpress/ui` unless prefixed: `wpc.` is `@wordpress/components`, `be.` is `@wordpress/block-editor`, `ed.` is `@wordpress/editor`, `gs.` is `@wordpress/global-styles-ui`.

## Region: Header `[D:Main]` `[D:Overview]` `[U]`

Left to right:

| ID | Element | Component | Text / label | Behaviour |
|---|---|---|---|---|
| H1 | Boards link | `ButtonLink` with the `wordpress` icon, dark square | Label "All boards" | Goes to the Boards screen. If there are unsaved edits, the browser's leave warning applies. |
| H2 | Inserter toggle | `IconButton`, `plus` icon, solid brand; when on, `close` icon, neutral strong | Labels "Block inserter" / "Close block inserter" | Toggles the inserter in the left panel. |
| H3 | Undo | `IconButton`, `undo` | Tooltip in the form given in `architecture.md`, Undo; "Undo" when history is empty | Disabled when the active history is empty. |
| H4 | Redo | `IconButton`, `redo` | Same form with "Redo" | Disabled when nothing to redo. |
| H5 | List view toggle | `IconButton`, `listView`, pressed state | Label "List view" | Shows or hides the list view. Disabled when no artboard is in edit. |
| H6 | Block toolbar | `be.BlockToolbar`, filled from the Live editor through a slot | Stock | Present only while an artboard is in edit and a block is selected. |
| H7 | Document bar | Centred `Text` on a weak neutral surface; in edit, preceded by an `IconButton` with `arrowLeft` | Board name; in edit "{artboard name} · {Kind}", back button label "Back to the board" | Back button leaves edit. The bar itself is not clickable. `[N]` |
| H8 | Zoom menu | `Menu` whose trigger shows the zoom as a percentage with `chevronDown` | Trigger label "Zoom"; items "Zoom in", "Zoom out", "Zoom to 50%", "Zoom to 100%", "Fit all", "Fit selection" | Items act on the viewport. "Fit selection" is disabled with nothing selected. `[N]` for the item list |
| H9 | Review button | `Button`, solid brand | "Review {n} changes", "Review 1 change"; with none, "Review changes", disabled | Opens the Review drawer. |

Kind names used in labels: "Page", "Template", "Template part", "Pattern". `[D:Overview]`

## Region: Left panel, artboards by kind `[D:Overview]` `[U]`

| ID | Element | Component | Text | Behaviour |
|---|---|---|---|---|
| L1 | Panel heading | `Text` heading-md | "Artboards" | |
| L2 | Add artboard | `IconButton`, `plus`, opens a `Menu` | Label "Add artboard" | See the "New artboard 1" screen. |
| L3 | Group heading | `Text` heading-sm with a count at the right | "Pages", "Templates", "Template parts", "Patterns" | A group with no artboards is not shown. `[N]` |
| L4 | Artboard row | `wpc.ItemGroup` / `Item` row: kind icon (`page`, `layout`, `header`, `symbol`), name, device at the right | Device words "Desktop", "Tablet", "Mobile" | Click selects the artboard and scrolls it into view. Double-click or Enter edits it. Selected row uses the brand surface. |

Rows are ordered by name within a group, then Desktop, Tablet, Mobile. `[N]`

## Region: Left panel, list view `[D:Main]` `[U]`

| ID | Element | Component | Text | Behaviour |
|---|---|---|---|---|
| L5 | Panel heading with close | `Text` heading-md, `IconButton` `closeSmall` | "List view", label "Close list view" | Close turns the H5 toggle off. |
| L6 | Block tree | `be.__experimentalListView` filled from the Live editor | Stock | Stock. |

## Region: Left panel, inserter `[D:Library]` `[U]`

| ID | Element | Component | Text | Behaviour |
|---|---|---|---|---|
| L7 | Search | `wpc.SearchControl` | Placeholder "Search" | Filters all four tabs; the tab strip stays. |
| L8 | Tabs | `Tabs` | "Blocks", "Patterns", "Templates", "Media" | |
| L9 | Group heading | as L3 | per tab, see each inserter screen | |
| L10 | Item row | as L4: icon, name, optional second line | per tab | Click inserts into the artboard in edit at the editor's insertion point. With no artboard in edit, click does nothing and the row is not disabled. `[N]` for the last sentence |
| L11 | Hint | `Text` on a weak neutral surface, pinned to the panel bottom | per tab | |

## Region: Canvas `[D:Overview]` `[D:Main]` `[U]`

| ID | Element | Component | Text | Behaviour |
|---|---|---|---|---|
| A1 | Artboard label | `Text` body-sm above the artboard's top-left corner | "{Name} · {Kind} · {Device}" | Not interactive, except on the Live artboard (A2). |
| A2 | Live artboard label | `Text` in brand colour, "{Name} · {Kind}", followed by a `Menu` trigger showing the device | Menu items "Desktop", "Tablet", "Mobile"; trigger label "Artboard device" | Choosing a device changes this artboard's device. |
| A3 | Artboard | The tier content at the device width, scaled by the zoom | | Click selects; drag moves; double-click edits. |
| A4 | Selection outline | 2 px brand stroke around the selected or Live artboard | | |

The canvas background is the weak neutral surface. Dragging an artboard moves it freely; there is no snapping or grid. `[N]`

## Region: Right panel, Styles `[D:Overview]` `[D:Styles]` `[U]`

| ID | Element | Component | Text | Behaviour |
|---|---|---|---|---|
| S1 | Heading | `Text` heading-lg | "Styles" | |
| S2 | Variation menu | `Menu`, trigger shows the active variation | "Variation: {name}"; "Variation: Default" when none | See `architecture.md`, Styles. Hidden when the theme has no variations. `[N]` for both fallbacks |
| S3 | Tabs | `Tabs` | "Tokens", "Blocks", "History" | |
| S4 | Tokens: Colors group | heading-sm "Colors" with "Uses" at the right; rows of `wpc.ColorIndicator`, name, hex in the mono font, use count; "Add color" `Button` minimal | | Clicking a row selects the token (usage highlight) and opens a `Popover` with `wpc.ColorPalette`'s picker to edit it. Clicking the selected row again clears the selection. `[N]` for the popover |
| S5 | Tokens: Typography group | heading-sm "Typography" / "Uses"; rows with an "Aa" sample, name, "{family} · {size} / {line height}", use count | | Clicking selects the token for usage highlight. Editing typography presets is done in the Blocks tab's stock panels, not here. `[N]` |
| S6 | Tokens: Spacing group | heading-sm "Spacing"; one square per spacing preset with its px value under it | | Display only. `[N]` |

## Region: Right panel, editing `[D:Main]` `[D:AddArtboard2]` `[U]`

| ID | Element | Component | Text | Behaviour |
|---|---|---|---|---|
| E1 | Tabs | `Tabs` | First tab is the artboard's kind ("Page", "Template", "Template part", "Pattern"); second is "Block" | "Block" is selected when a block is selected. |
| E2 | Block tab: block card | Stock, from `be.BlockInspector` | | |
| E3 | Block tab: scope switch | `wpc.ToggleGroupControl` | Label "Style applies to"; options "This block", "All {block title}"; help "Switch to change every {block title} block on the site." | See `architecture.md`, Styles. |
| E4 | Block tab: controls | `be.BlockInspector` filled through a slot, or `gs.GlobalStylesUI` when E3 is on "All" | Stock | |
| E5 | Kind tab: entity card | kind icon, `Text` heading-md name, `Text` weak description | Description by kind, see the "New artboard 2" and "Selected" screens | |
| E6 | Kind tab: device | `wpc.ToggleGroupControl` | Label "Artboard device"; "Desktop", "Tablet", "Mobile" | Changes this artboard's device. |
| E7 | Kind tab: live notice | `Notice`, caution tone, templates and parts only | "Templates have no draft. Saving this one puts it live on every {purpose} of the site." for templates; "Template parts have no draft. Saving this one puts it live everywhere it is used." for parts | The parts wording is `[N]`. |
