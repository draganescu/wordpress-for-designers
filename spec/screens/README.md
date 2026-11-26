# Screens

Thirty-four screens. Each has an image in `images/` (except `LockDialog`, `ShortcutsDialog`, `NeedsSpace` and `InserterPages`, which have none) and a file here naming its state, the regions it uses and its own elements. Regions shared by many screens are defined once in this file.

Rules for reading the images (see also `CLAUDE.md`, rules 6 and 7):

- They were rendered at 1440 × 900 from hand-styled markup. Layout, grouping, wording and states are binding. Exact pixel values are not; spacing, colour, type and radius come from the components and `--wpds-*` tokens.
- Icons in the images are approximations. Use the named `@wordpress/icons` icon.
- The site shown inside artboards (The Slow Margin) and the names, counts and dates in lists are fixture data.
- The five screens of rulers and guides (`Rulers`, `RulersSelected`, `GuideDrag`, `GuideSelected`, `RulersEditing`) were rendered at 1440 × 900 from markup of their own, kept in `reference-markup/` like the others and bound by the same rules. Their board is not the fixture's. Guides are cyan in them; the colour that is built is the token GD1 names. `[N]`
- The three agent screens (`AgentConnected`, `AgentWorking`, `AgentReview`) were cut, at 1279 × 962, from the design of a session in WordPress Studio. They show the demo site, Morrow Coffee Roasters, and each file lists what in its image is not built.
- Three things visible in the images are **not** built: the "⌘K" hint in the document bar, the zoom control at the bottom left of the canvas on the two editing screens (zoom lives in the header, H8), and dimming that covers only the canvas behind dialogs (dialogs are modal over the whole window). `[N]`

Component names refer to `@wordpress/ui` unless prefixed: `wpc.` is `@wordpress/components`, `be.` is `@wordpress/block-editor`, `ed.` is `@wordpress/editor`, `gs.` is `@wordpress/global-styles-ui`.

## Region: Header `[D:Main]` `[D:Overview]` `[U]`

Left to right:

| ID | Element | Component | Text / label | Behaviour |
|---|---|---|---|---|
| H1 | Boards link | `ButtonLink` with the `wordpress` icon, dark square | Label "All boards" | Goes to the Boards screen. If there are unsaved edits, the browser's leave warning applies. |
| H2 | Inserter toggle | `IconButton`, `plus` icon, solid brand; when on, `close` icon, neutral strong | Labels "Block inserter" / "Close block inserter" | Toggles the inserter in the left panel. The inserter is the one place artboards are added from (D63). |
| H3 | Undo | `IconButton`, `undo` | Tooltip in the form given in `architecture.md`, Undo; "Undo" when history is empty | Disabled when the active history is empty. |
| H4 | Redo | `IconButton`, `redo` | Same form with "Redo" | Disabled when nothing to redo. |
| H5 | List view toggle | `IconButton`, `listView`, pressed state | Label "List view" | Shows or hides the list view. Disabled when no artboard is in edit. |
| H10 | Left panel toggle | `IconButton`, `drawerLeft`, pressed state while the left panel is shown | Labels "Hide left panel" / "Show left panel" | Hides or shows the left panel (D32). Sits after H5. |
| H13 | Note tool | `IconButton`, `comment`, pressed state while the tool is armed | Label "Add note" | Arms the note tool; pressed again, switches it off (D46). Sits after H10. Disabled while an artboard is in edit. |
| H6 | Block toolbar | `be.BlockToolbar`, filled from the Live editor through a slot | Stock | Present only while an artboard is in edit and a block is selected. While it is shown it takes the place of H7's title (D50). When it is wider than its room it scrolls sideways, as the stock toolbar does. |
| H14 | Block tools toggle | `IconButton`, `previous` while the block toolbar is shown, `next` while it is hidden | Labels "Hide block tools" / "Show block tools" | Hides the block toolbar, which brings H7's title back, and shows it again (D50). Selecting another block shows the toolbar. Present only while the selected block has a toolbar. Sits at the end of H6. |
| H7 | Document bar | Centred `Text` on a weak neutral surface; in edit, preceded by an `IconButton` with `arrowLeft` | Board name; in edit "{artboard name} · {Kind}", back button label "Back to the board" | Back button leaves edit. The bar itself is not clickable. `[N]` While H6 is shown the bar is only its back button, next to H14 (D50). `[U]` |
| H12 | Tidy up | `IconButton`, `grid`, minimal neutral | Label "Tidy up" | Arranges everything on the board in one row per kind, in left-panel order (D45), and fits all. Disabled while an artboard is in edit and with fewer than two items on the board. Sits just before H8. |
| H8 | Zoom menu | `Menu` whose trigger shows the zoom as a percentage with `chevronDown` | Trigger label "Zoom"; items "Zoom in", "Zoom out", "Zoom to 50%", "Zoom to 100%", "Fit all", "Fit selection"; then a `Menu.Separator` and two `Menu.CheckboxItem`s, "Rulers" and "Guides" (D109) | Items act on the viewport. "Fit selection" is disabled with nothing selected. An item that takes the zoom below 30% while an artboard is in edit leaves edit (D37). "Rulers" is checked while the rulers are shown and "Guides" while guides are shown; choosing one shows or hides them and keeps the menu's other items as they are. Both work in every state of the board, an artboard in edit included. `[N]` for the item list, `[U]` `[D:Rulers]` for the two checkbox items |
| H11 | Right panel toggle | `IconButton`, `drawerRight`, pressed state while the right panel is shown | Labels "Hide right panel" / "Show right panel" | Hides or shows the right panel (D32). Sits between H8 and H9. |
| H9 | Review button | `Button`, solid brand | "Review {n} changes", "Review 1 change"; with none, "Review changes", disabled | Opens the Review drawer. |

Below 1440 px wide the panels make room as D50 says; below 1180 px the board is replaced by `NeedsSpace.md` (D49). `[U]`

Kind names used in labels: "Page", "Template", "Template part", "Pattern". `[D:Overview]`

Media objects (D34): `[U]`

- Kind name "Media", `image` icon. In the left panel they are the last group, "Media"; a row has no device word.
- On the board a media object is the image in a frame like an artboard's, with the label "{Name} · Media", where the name is the attachment's title. It is selected, moved, nudged and removed like an artboard. Double-click and Enter do nothing.
- Selected, the right panel shows the entity card (name; description "{width} × {height}", the image's pixel size) and one `Button` outline "Remove from board". No device control, no "Edit", no hint line.
- The remove dialog has its title and buttons only: no description and no checkbox.
- If the image cannot be loaded the error state reads "Couldn't load this image."
- Dragging a row of the Media tab over empty board shows the drop target at the object's size with the label "{file name} · Media"; dropping places it there. Clicking the row places it in the middle of the board in view, moved right past anything it would cover. Both apply only with no artboard in edit; in edit the image goes into the artboard as an Image block (D39).

Browsers (D55): `[U]`

- Kind name "Browser", `globe` icon. A browser's name is its address, for example "/" or "/about/". In the left panel browsers are the group "Browsers", after Media; a row has the `globe` icon, the address and the device word.
- On the board a browser is a frame like an artboard's at its device width, with a window of its own height (900 board units when placed, D56) showing the page at its address, and the label A1 "{address} · Browser · {Device}". Until the page has loaded the window shows a `Skeleton`. A browser far from view (the Ghost rule) is a sized box; otherwise its page is loaded. Browsers do not count toward the 12 Previews and have no Snapshot.
- Outside browsing the page takes no pointer input: a click selects the browser, a drag moves it, double-click starts browsing.
- The window's bottom edge is a resize handle (D56): on a browser not being browsed, hovering it shows the `ns-resize` pointer and dragging it changes the window's height, 200 board units at least, by changing the DOM as the drag goes; the store hears when the drag ends. Outside browsing the page stays where it was scrolled to while browsing.
- While browsing, the label is A2 with the address in place of "{Name} · {Kind}": an `InputControl` labelled "Address" holding the address, which goes to the typed address on Enter (a missing leading "/" is added); an `IconButton` `rotateRight` labelled "Reload", which reloads the page; then the device menu. The document bar reads "{address} · Browser" with the back button. Undo and Redo act on the layout history. The list view toggle stays disabled, the Blocks tab is not shown and the inserter acts as with no artboard in edit; anything it places ends browsing.
- Selected alone or browsing, the right panel shows the entity card (the address; description "The site as visitors see it."), the device control E6, a `wpc.ToggleGroupControl` labelled "Shows" with the options "Unsaved changes" and "Saved site" (D57), then `Button` solid "Browse", which starts browsing and is not shown while browsing, `Button` outline "Reload" and `Button` outline "Remove from board", and the hint "Enter or double-click browses. Delete removes it from the board."
- The remove dialog has its title and buttons only, as for a media object.
- A link or a typed address that leads off the site does nothing: the window stays on the page it was on.
- When the board's unsaved changes cannot be sent for the preview (D57), the canvas shows a `Notice`, error tone, at its top left, where the usage and preview banners of the Styles screens are shown: "We're having a problem saving." (D61). There is one notice for as long as sends keep failing, however often the send is tried again; it goes away when a send succeeds.

Notes (D46): `[U]`

- While the note tool is armed the pointer is a crosshair over the whole canvas area, artboards included. A click places the note there; nothing else on the board reacts to that click. Esc or H13 switches the tool off.
- On the board a note is a box 240 board units wide on a colour surface, with no label, drawn above every artboard. Its text is `Text` body-md, line breaks kept; an empty note keeps the height of one line. Selected, it has the selection outline (A4).
- Its text is edited in place in a plain text field with the placeholder "Write a note". Typing does not move or zoom the board.
- Colours, with the `--wpds-*` surface each uses: Yellow (`caution`), Green (`success`), Blue (`info`), Pink (`error`).
- Selected alone, the right panel shows: `Text` heading-md "Note"; `wpc.ColorPalette` labelled "Color" with the four colours, named as above, no custom colour and no clear button; one `Button` outline "Remove from board"; the hint "Enter or double-click edits. Delete removes it from the board."
- In the left panel notes are the last group, "Notes", in order of creation. A row has the `comment` icon and the note's first line, or "Empty note" when it has no text, and nothing at the right. A row is selected, added to the selection and removed like an artboard row (L4); double-click or Enter edits the note's text.

## Agent marks (D65, D73) `[U]` `[A]`

Four marks show the designer that an agent is connected, what it is working on and what it changed: G1, a `Badge` in the header just before H12; G2 and G3, endings of the artboard label A1 (and A2), G2 with a dashed outline; G4, a `Badge` on a Review card. Their text, components and conditions are defined once, in `agent/surface.md`, Marks, and their screens are `AgentConnected.md`, `AgentWorking.md` and `AgentReview.md`. They are shown only while the agent surface is loaded; on a site no agent has used, every screen in this folder is exactly as it was.

## Region: Left panel, artboards by kind `[D:Overview]` `[U]`

| ID | Element | Component | Text | Behaviour |
|---|---|---|---|---|
| L1 | Panel heading | `Text` heading-md | "Artboards" | |
| L2 | Removed by D63 | | | The left panel has no "Add artboard" control: artboards are added from the inserter (H2, L12). |
| L3 | Group heading | `Text` heading-sm with a count at the right | "Pages", "Templates", "Template parts", "Patterns", "Media", "Browsers", "Notes" | A group with no artboards is not shown. `[N]` |
| L4 | Artboard row | `wpc.ItemGroup` / `Item` row: kind icon (`page`, `layout`, `header`, `symbol`), name, device at the right | Device words "Desktop", "Tablet", "Mobile" | Click selects the artboard and scrolls it into view. Cmd/Ctrl + click adds the row to the selection or takes it out; Shift + click selects every row from the one clicked last to this one (D41). Double-click or Enter edits it. Delete or Backspace on a focused row removes the selected artboards, as on the board. Every selected row uses the brand surface. |

Rows are ordered by name within a group, then Desktop, Tablet, Mobile. `[N]`

## Region: Left panel, list view `[D:Main]` `[U]`

| ID | Element | Component | Text | Behaviour |
|---|---|---|---|---|
| L5 | Panel heading with close | `Text` heading-md, `IconButton` `closeSmall` | "List view", label "Close list view" | Close turns the H5 toggle off. |
| L6 | Block tree | `be.__experimentalListView` filled from the Live editor | Stock | Stock. |

## Region: Left panel, inserter `[D:Library]` `[U]`

| ID | Element | Component | Text | Behaviour |
|---|---|---|---|---|
| L7 | Search | `wpc.SearchControl` | Placeholder "Search" | Filters every tab; the tab strip stays. |
| L8 | Tabs | `Tabs` | "Blocks", "Pages", "Patterns", "Templates", "Media" | With no artboard in edit the Blocks tab is not shown and Pages is the first tab. With an artboard in edit the Pages tab is not shown and Blocks is the first tab (D33, D63). |
| L9 | Group heading | as L3 | per tab, see each inserter screen | |
| L10 | Item row | as L4: icon, name, optional second line | per tab | Click and drag do the same thing (D39). With an artboard in edit: click inserts at the editor's insertion point, drag inserts where it is dropped in that artboard; a template row does nothing. With no artboard in edit: click or drag puts the item on the board as an artboard, or a media object for an image. |
| L11 | Hint | `Text` on a weak neutral surface, pinned to the panel bottom | per tab | |
| L12 | New row | as L10 with the `plus` icon, in the first groups of the Pages, Patterns and Templates tabs; those group headings have no count | Group "New": "New page", "New browser", "New pattern", "New template part". Group "New template for": the template purposes. See each inserter screen | Click arms placement of a new artboard of that kind (D63, the "New artboard 1" screen). Not dragged. Shown only with no artboard in edit. The search filters it by its name like any row. |

## Region: Canvas `[D:Overview]` `[D:Main]` `[U]`

| ID | Element | Component | Text | Behaviour |
|---|---|---|---|---|
| A1 | Artboard label | `Text` body-sm above the artboard's top-left corner | "{Name} · {Kind} · {Device}"; for a media object "{Name} · Media"; for a browser "{address} · Browser · {Device}" (D55) | Not interactive, except on the Live artboard (A2), and except that a double-click on the label of a page or pattern artboard renames it (A7). |
| A2 | Live artboard label | `Text` in brand colour, "{Name} · {Kind}", followed by a `Menu` trigger showing the device | Menu items "Desktop", "Tablet", "Mobile"; trigger label "Artboard device" | Choosing a device changes this artboard's device. A double-click on the label of a page or pattern renames it (A7). |
| A3 | Artboard | The tier content at the device width, scaled by the zoom | | Click selects; Cmd/Ctrl + click adds it to the selection or takes it out when no artboard is in edit (D41); drag moves it, and with several selected moves them all; double-click edits. |
| A4 | Selection outline | 2 px brand stroke around each selected artboard and the Live artboard | | |
| A5 | Keyboard shortcuts | `IconButton`, `keyboard`, on a neutral surface with a subtle shadow, floating over the board at the bottom left of the canvas area | Label "Keyboard shortcuts" | Opens the keyboard shortcuts dialog (D42, `ShortcutsDialog.md`). It stays in its corner while the board pans and zooms, and is there in every state of the board, an artboard in edit included. While the rulers are shown it sits clear of the left ruler (R2). |
| A6 | Selection rectangle | A rectangle from where the drag started to the pointer, with a 1 px brand stroke and no fill (D47) | | Shown only while dragging from empty board (D43). Every artboard and media object it touches is selected, as it is dragged. Cmd/Ctrl + drag adds to the selection. Esc cancels the drag and puts the selection back as it was. |
| A7 | Name field | `InputControl` in the label, in place of the name; its label "Name" is hidden from view | The name, selected | Shown after a double-click on the label of a page or pattern artboard, or F2 with that one artboard selected (D62). Enter or a click elsewhere keeps the new name; Esc leaves the name as it was; an empty name is not kept. The rest of the label stays as it is. The new name is an unsaved edit, saved from Review. |

The canvas background is the weak neutral surface. Dragging an artboard moves it freely; there is no snapping or grid. `[N]`, confirmed for guides too by D110 `[U]` Dragging from empty board selects with a rectangle (A6, D43). `[U]`

## Region: Right panel, Styles `[D:Overview]` `[D:Styles]` `[U]`

| ID | Element | Component | Text | Behaviour |
|---|---|---|---|---|
| S1 | Heading | `Text` heading-lg | "Styles" | |
| S2 | Variation menu | `Menu`, trigger shows the active variation; first item "Default", then the theme's variations | "Variation: {name}" when the styles are exactly that variation; "Variation: Default" when they are the theme's own; "Variation: Custom" otherwise (D54) | See `architecture.md`, Styles. Hidden when the theme has no variations. `[N]` "Default" returns the styles to the theme's. `[U]` |
| S3 | Tabs | `Tabs` | "Tokens", "Blocks", "History" | |
| S4 | Tokens: Colors group | heading-sm "Colors" with an "Edit" `Button` minimal with `chevronRight` and "Uses" at the right; rows of `wpc.ColorIndicator`, name, hex in the mono font, use count; "Add color" `Button` minimal | | Clicking a row selects the token (usage highlight) and opens a `Popover` with `wpc.ColorPalette`'s picker to edit it. Clicking the selected row again clears the selection. "Add color" adds a custom colour named "Color 1", "Color 2" and so on, black, and selects it so its picker opens; it is an unsaved Styles change like any other. "Edit" opens the stock Colors screen (S8). `[N]` for the popover, `[U]` for Add color and Edit |
| S5 | Tokens: Typography group | heading-sm "Typography" / "Edit" / "Uses"; rows with an "Aa" sample, name, "{family} · {size} / {line height}", use count | | One row per font-size preset and one per font-family preset. A row fills the parts it does not have from the site's base text style (base family, base size, base line height). Clicking selects the token for usage highlight. Typography is edited in the stock Typography screen that "Edit" opens (S8), not in the rows (D52). `[N]` `[U]` |
| S6 | Tokens: Spacing group | heading-sm "Spacing" / "Edit"; one square per spacing preset with its px value under it | | The squares are display only. `[N]` "Edit" opens the stock Layout screen (S8). `[U]` |
| S7 | Tokens: Background and Shadows | Two rows after Spacing: icon, name, `chevronRight` | "Background", "Shadows" | A row opens the stock Background or Shadows screen (S8). `[U]` |
| S8 | Tokens: stock screen | `gs.GlobalStylesUI` at `/colors`, `/typography`, `/layout`, `/background` or `/shadows`, in place of the Tokens tab's content | Stock | Opened by "Edit" in S4 to S6 and by the rows of S7 (D52). Its own Back control returns to the tokens. If the screen throws, `ed.ErrorBoundary` shows its stock notice in its place; switching to another tab closes it, and the tokens are back on return (D60). `[U]` |

## Region: Right panel, editing `[D:Main]` `[D:AddArtboard2]` `[U]`

| ID | Element | Component | Text | Behaviour |
|---|---|---|---|---|
| E1 | Tabs | `Tabs` | First tab is the artboard's kind ("Page", "Template", "Template part", "Pattern"); second is "Block" | "Block" is selected when a block is selected. |
| E2 | Block tab: block card | Stock, from `be.BlockInspector` | | |
| E3 | Block tab: scope switch | `wpc.ToggleGroupControl` | Label "Style applies to"; options "This block", "All {block title}"; help "Switch to change every {block title} block on the site." | See `architecture.md`, Styles. |
| E4 | Block tab: controls | `be.BlockInspector` filled through a slot, or `gs.GlobalStylesUI` when E3 is on "All" | Stock | With E3 on "All", the stock screen's Back control sets E3 back to "This block" (D58). `[U]` |
| E5 | Kind tab: entity card | kind icon, `Text` heading-md name, `Text` weak description | Description by kind, see the "New artboard 2" and "Selected" screens | |
| E6 | Kind tab: device | `wpc.ToggleGroupControl` | Label "Artboard device"; "Desktop", "Tablet", "Mobile" | Changes this artboard's device. |
| E8 | Kind tab: page template | `wpc.SelectControl`, pages only, after E6 | Label "Template"; first option "Default template", then the site's custom templates by title | Changes the page's template (D35). The same control is in the artboard settings of a selected page, after the device control. |
| E7 | Kind tab: live notice | `Notice`, caution tone, templates and parts only | "Templates have no draft. Saving this one puts it live on every archive of the site." for the Archive template; "Templates have no draft. Saving this one puts it live on the site." for every other template; "Template parts have no draft. Saving this one puts it live everywhere it is used." for parts | The parts wording is `[N]`. |

## Rulers (D108, D109) `[U]` `[D:Rulers]` `[D:RulersSelected]` `[D:RulersEditing]` `[R1]`

In the page only while the "Rulers" item of H8 is checked (C37).

| ID | Element | Component | Text | Behaviour |
|---|---|---|---|---|
| R1 | Top ruler | A `canvas` element along the top edge of the canvas area, as wide as the area, on the strong neutral surface with a 1 px neutral stroke under it. Ticks in the neutral stroke; numbers in the weak neutral foreground at the smallest text size | The numbers of the ticks, in board units | Counts along x. Stays at the edge while the board pans and zooms, and is painted on each frame (C34). Pressing on it and dragging into the canvas area pulls out a horizontal guide (D110). |
| R2 | Left ruler | The same along the left edge, its numbers turned to read upwards | The same | Counts along y. Pulls out a vertical guide. |
| R3 | Corner | A square where R1 and R2 meet, same surface and stroke | None | Not interactive. |
| R4 | Span | The part of a ruler between two values, on the brand surface with a 1 px brand stroke at each end; its two end numbers in the brand foreground, emphasis weight | The value at each end | What it covers is given below. A tick's number that would touch an end number is not drawn. |
| R5 | Guide mark | A 1 px line across the ruler at a guide's position, in the guide's colour; for the guide that is selected or being dragged, in the brand colour with its position as a number beside it | The position, for that one guide | On each ruler, one mark for every guide read on it that is shown: board guides, and the guides of the artboard in context. Not drawn while "Guides" is unchecked. |

The rulers are about 20 CSS px thick at every zoom. They take no focus and are hidden from assistive technology; their colours are the `--wpds-*` tokens named above, read from the page. `[N]`

What zero is and what R4 covers: `[R1]`

| When | Zero sits at | R4 covers |
|---|---|---|
| Nothing selected | The board's origin | Nothing: R4 is absent |
| One artboard selected | Its top-left corner | The artboard: 0 to its device width on R1, 0 to its height on R2 |
| A guide of an artboard dragged or selected | That artboard's top-left corner | That artboard |
| An artboard in edit | Its top-left corner | The selected block: its left and right edges on R1, its top and bottom edges on R2, in the page's pixels |

Cases the whiteboard does not draw: `[N]`

- A media object or a browser selected alone counts as an artboard selected. Several things selected, or a note selected, count as nothing selected.
- A board guide dragged or selected counts as nothing selected. A new guide dragged over empty board, a note, a media object or a browser is a board guide.
- In edit with no block selected, R4 covers the artboard. With several blocks selected it covers them all, from the first edge to the last.
- In edit the span is read again when the block selection changes and when the selected block changes size.

Numbers and ticks: the step between numbers is the smallest of 1, 2 or 5 times a power of ten, in board units, that is at least 50 CSS px long at the present zoom (500 at 17%, 100 at 50%), with four smaller ticks between two numbers. Numbers on the far side of zero are negative and written with a minus sign. `[N]`

While the rulers are shown, the notices at the top left of the canvas (the usage and preview banners, the saving notice) sit clear of them, and so do the keyboard shortcuts control (A5) and the snackbar notices above it (D118) at the bottom left. `[N]`

## Guides (D110 to D114) `[U]` `[D:GuideDrag]` `[D:GuideSelected]` `[D:RulersEditing]` `[R1]` `[R3]`

Drawn only while the "Guides" item of H8 is checked.

| ID | Element | Component | Text | Behaviour |
|---|---|---|---|---|
| GD1 | Guide | A line 1 px wide at every zoom, in `--wpds-color-stroke-surface-info-strong`. A board guide runs across the whole canvas area. An artboard's guide runs across its artboard only, from edge to edge, and is drawn in every tier | None | With no artboard in edit: the pointer over it is `row-resize` for a horizontal guide and `col-resize` for a vertical one, within 4 CSS px of the line on each side; a click selects it and clears any other selection; a drag moves it along its axis (D112). With an artboard in edit it takes no pointer input (D114). Drawn above artboards and their labels and below notes. |
| GD2 | Position chip | `Badge` beside the pointer | The position as a whole number, for example "700" | Shown only while a guide is dragged, a new one or one being moved. Follows the pointer. |
| GD3 | Selected guide | GD1 in `--wpds-color-stroke-interactive-brand`, 2 px wide at every zoom | None | One guide at most. |
| GD4 | Guide card | In the right panel, in place of Styles: the entity card as E5 with the `lineSolid` icon, `Text` heading-md "Guide" and a `Text` weak description; `InputControl`, whole numbers, with the suffix "px"; a `Text` weak help under it; `Button` outline "Remove guide"; `Text` weak hint | Description "Horizontal. On {artboard name}." or "Vertical. On {artboard name}."; for a board guide "Horizontal. On the board." or "Vertical. On the board.". Field label "Position". Help "Measured from the top of {artboard name}." for a horizontal guide and "Measured from the left of {artboard name}." for a vertical one; for a board guide "Measured from the top of the board." and "Measured from the left of the board.". Hint "Drag moves it. Delete removes it." | The field shows the guide's position and follows it while it is dragged or nudged. A typed position is kept on Enter or when the field loses focus, as one "move guide" step; a value that is not a whole number, or that lies outside its artboard, is not kept and the field shows the position again. "Remove guide" takes the guide off the board. |

The wording for a vertical guide and for a board guide, the icon, the width that takes the pointer and the chip's component are `[N]`.

While a new guide is dragged over an artboard that can own it, that artboard has a 1 px brand stroke around it, and the guide is drawn across that artboard only; over anything else the guide runs from edge to edge of the canvas area. `[D:GuideDrag]`

Guides are not listed in the left panel, an artboard's settings say nothing about them, and Review never lists them (D112, D113). `[U]`
