# Acceptance criteria

Each criterion is one end-to-end test. The test's title starts with its ID. Tests live in `tests/e2e/{group}.spec.ts`, where the group is the middle part of the ID in lower case (`AC-TIER-01` is in `tier.spec.ts`). Structural checks read `data-wfd-*` attributes that the app sets on artboard frames: `data-wfd-artboard` (id), `data-wfd-tier` (`ghost`, `snapshot`, `preview`, `live`, `warm`), `data-wfd-kind`, `data-wfd-device`. `[N]` for the attribute names

Unless a criterion says otherwise, the fixture in `architecture.md` is loaded and the user is an administrator.

## PERM

- AC-PERM-01 An administrator sees "Designer" in the wp-admin menu with "Boards" and "Add board". `[U]`
- AC-PERM-02 An editor (no `edit_theme_options`) does not see the menu; the board app URL and `wfd-boards` REST routes return a permission error. `[U]`
- AC-PERM-03 A board made by one administrator is listed and editable for another. `[U]`

## BOARD

- AC-BOARD-01 "Add board" creates a board titled "Untitled board" and opens the board app without wp-admin's menu or toolbar. `[U]`
- AC-BOARD-02 The Boards screen lists each board with its artboard count and edited time; search filters by name. `[D:Boards]`
- AC-BOARD-03 Saving a layout with an unknown field or a wrong type is rejected with status 400. `[N]`
- AC-BOARD-04 Rename and Move to trash on a board card work; a trashed board leaves the list. `[N]`
- AC-BOARD-05 Moving an artboard and waiting 3 seconds persists its position; a reload shows it there. Nothing appears in Review. `[U]`
- AC-BOARD-06 Reopening a board restores the user's last pan and zoom; a board never opened by this browser opens fitted to all artboards. `[N]`

## SHELL

- AC-SHELL-01 With nothing selected, the left panel lists artboards by kind with counts and the right panel shows Styles on the Tokens tab. `[U]`
- AC-SHELL-02 Header controls appear in the order H1 to H5, H10, H13, H6, H7, H12, H8, H11, H9; H5 is disabled and H6 absent when nothing is in edit. `[U]`
- AC-SHELL-03 Selecting an artboard highlights its row and shows artboard settings in the right panel; Styles is not shown. `[U]`
- AC-SHELL-04 Turning the inserter toggle on replaces the left panel with the inserter in every state, and off restores what was there. `[U]`
- AC-SHELL-05 The left and right panel toggles each hide and show their panel, their labels and pressed state follow, and the canvas area takes the freed room. `[U]`
- AC-SHELL-06 Cmd/Ctrl + \ hides both panels when either is shown and shows both when neither is, on the board and while an artboard is in edit. `[U]`
- AC-SHELL-07 Turning the inserter or list view toggle on shows a hidden left panel; a hidden right panel stays hidden through selection and edit; after a reload both panels are shown. `[U]`
- AC-SHELL-08 With both panels hidden, resting the pointer on the left edge of the canvas area shows the left panel and on the right edge shows the right panel. `[U]`
- AC-SHELL-09 In the artboard list, Cmd/Ctrl + click adds a row to the selection and a second one takes it out; Shift + click selects every row from the one clicked last to the one clicked, in list order; a plain click selects one row again. Each selected row has its artboard outlined on the board. `[U]`

## CANVAS

- AC-CANVAS-01 Each artboard shows the label "{Name} · {Kind} · {Device}". `[D:Overview]`
- AC-CANVAS-02 Click selects one artboard; clicking empty board clears selection; dragging an artboard moves it and the move is undoable. `[B1]` `[U]`
- AC-CANVAS-03 Cmd/Ctrl + wheel zooms around the pointer; Space + drag pans; both work with the pointer over an artboard, including the Live one. `[B8]` `[U]`
- AC-CANVAS-04 The H8 menu items change zoom as named; "Fit all" shows every artboard. `[N]`
- AC-CANVAS-05 Cmd/Ctrl + click on an artboard adds it to the selection and a second one takes it out; with several selected the right panel shows Styles, and dragging one of them or pressing an arrow key moves them all as one undoable step; while an artboard is in edit, Cmd/Ctrl + click on another artboard leaves edit and selects only that one. `[U]`
- AC-CANVAS-06 Dragging from empty board draws a rectangle and selects every artboard it touches while it is dragged, and one it no longer touches is deselected; Cmd/Ctrl + drag adds to the selection; Esc during the drag removes the rectangle and puts the selection back as it was; while an artboard is in edit the drag leaves edit and selects. `[U]`
- AC-CANVAS-07 "Tidy up" (H12) puts the seeded board in one row per kind, Pages above Templates above Template parts above Patterns, each row top-aligned and in left-panel order with no two items overlapping; Undo, whose tooltip reads "Undo tidy up, on the board", puts every item back where it was. The control is disabled while an artboard is in edit. `[U]`

## KEY

- AC-KEY-01 Every row of the keyboard map in `architecture.md` does what it says with focus on the board. `[U]`
- AC-KEY-02 With an artboard in edit, typing, arrows and Delete act on blocks, not on the board. `[U]`
- AC-KEY-03 Esc in edit, with no popover or selection for the editor to dismiss, leaves edit and keeps the artboard selected. `[B1]`
- AC-KEY-04 The "Keyboard shortcuts" control at the bottom left of the canvas area opens a dialog titled "Keyboard shortcuts" that has one row for each row of `screens/ShortcutsDialog.md`; Esc closes it and focus returns to the control. `[U]`
- AC-KEY-05 Ctrl + Option + H on a Mac, Shift + Alt + H elsewhere, opens the keyboard shortcuts dialog and pressed again closes it, on the board and while an artboard is in edit. `[U]`

## DEV

- AC-DEV-01 A Desktop artboard's content document is 1440 px wide, Tablet 780, Mobile 360, on a theme with default breakpoints. `[U]`
- AC-DEV-02 With a theme whose `settings.viewport.tablet` is 900px and `mobile` is 320px, Tablet renders at 898 and Mobile at 320. `[U]`
- AC-DEV-03 Changing device from the Live label menu or the right panel re-renders the artboard at the new width and is undoable as a layout change. `[U]`
- AC-DEV-04 No control offers any width other than the three devices. `[U]`
- AC-DEV-05 A length in viewport-height units resolves against a viewport 900 px high: a block with `min-height:100vh` in its inline style is 900 px tall, and one given `min-height:50vh` by a style sheet loaded into the canvas is 450 px tall, as a Preview and in edit, and the artboard's height settles (OQ-30). `[U]`

## TIER

- AC-TIER-01 At most one artboard has `data-wfd-tier="live"` at any time. `[B5]`
- AC-TIER-02 Only the Live artboard's blocks appear in the header toolbar, list view and Block tab. `[B8]`
- AC-TIER-03 On a board of 30 artboards at 25% zoom, at most 12 have tier `preview`; the rest in view are `snapshot`. `[U]`
- AC-TIER-04 An artboard more than one viewport outside the visible area has tier `ghost` and contains no iframe. `[U]`
- AC-TIER-05 Previews mount nearest-to-centre first. `[B5]`
- AC-TIER-06 Below 20% zoom every non-Ghost artboard is `snapshot`; zooming back to 22% or more returns eligible ones to `preview`. `[U]`
- AC-TIER-07 Double-clicking an artboard below 30% zoom ends with that artboard Live, the zoom set so its width fits the canvas area (between 30% and 100%) and its top-left corner at the top-left of the canvas area. At 30% zoom or more it enters edit without changing zoom or pan. `[U]`
- AC-TIER-08 Zooming while an artboard is Live keeps it in edit at 30% or more; when the zoom settles below 30% edit ends and the artboard stays selected; panning does not leave edit. `[U]`
- AC-TIER-09 After editing artboards A, B, C, D in turn, D is `live`, C and B are `warm`, A is not. `[U]`
- AC-TIER-10 A `snapshot` artboard's frame contains no React root and triggers no store subscription callbacks when an entity changes. `[B5]`
- AC-TIER-11 After a global style change, an artboard that was `snapshot` shows the new style when it next becomes `preview`. `[B5]`
- AC-TIER-12 Below 20% zoom an artboard that was never rendered gets its frozen copy without becoming `preview`; no `Skeleton` is left once every such artboard has one. `[U]`
- AC-TIER-13 An artboard whose content is taller than 2000 px shows all of it as a Preview and as a Snapshot, at the height it has in edit. `[U]`

## PERF

- AC-PERF-01 During a pan or zoom gesture the app commits no React render (measured with a render counter exposed in test builds); the canvas transform changes each frame. `[B5]`
- AC-PERF-02 Wheel events from inside artboard iframes produce at most one viewport update per animation frame. `[B8]`
- AC-PERF-03 Editor scripts and styles are requested once per session, not per artboard. `[B4]`

## DATA

- AC-DATA-01 Editing the Header artboard changes the header shown in the Front page Preview, and in the Header (Mobile) artboard, without saving. `[B4]`
- AC-DATA-02 The saved board layout contains no block markup. `[B3]`

## EDIT

- AC-EDIT-01 Double-click or Enter on a selected artboard enters edit: the document bar reads "{name} · {Kind}" with a back button, the list view opens, the label gains the device menu. `[U]`
- AC-EDIT-02 With a block selected, the stock block toolbar appears in the header, never over the canvas. `[U]`
- AC-EDIT-03 The Block tab shows the stock inspector for the selected block. `[U]`
- AC-EDIT-04 A new empty artboard shows only the stock empty paragraph with its placeholder and add-block button; no plugin element is inside the artboard. `[U]`
- AC-EDIT-05 A page artboard shows its template around the content; template blocks cannot be edited from the page artboard. `[U]`
- AC-EDIT-06 Entering edit on a page takes the post lock; leaving releases it. If another user holds the lock, the lock dialog appears and the artboard stays a Preview; Cancel leaves it a Preview; Take over takes the lock and enters edit. `[U]`
- AC-EDIT-07 The back button, and Esc as in AC-KEY-03, leave edit. `[U]`
- AC-EDIT-09 At 30%, 50% and 75% zoom the editor works as at 100%: a click puts the caret in the block under the pointer, the block toolbar is in the header at full size, and the add-block button, slash inserter and link popover sit at the block they belong to. `[U]` `[V]`
- AC-EDIT-10 Deselecting ends edit: a click on empty board leaves edit and clears the selection; a click on another artboard leaves edit and selects that one. `[U]`
- AC-EDIT-11 A block that is not being edited moves when it is pressed on its text and dragged: hovering its text shows the block's outline and the grab cursor, the stock drop indicator shows while dragging, and the block lands there. A press without a drag puts the caret where the press was; after that, dragging over the block's text selects text and does not move the block. A double-click on a block that is not being edited selects a word. A template block around a page does not move. `[U]`
- AC-EDIT-08 A page's "Template" select, in the artboard settings and in the Page tab, lists "Default template" and the site's custom templates; choosing one redraws the artboard with that template, lists the page in Review with "Template: changed", and saving stores it on the page. `[U]`

## UNDO

- AC-UNDO-01 In edit, Undo reverts the last content change and its tooltip reads "Undo edit, in {artboard name}". `[U]`
- AC-UNDO-02 On the board, Undo reverts the last layout change and its tooltip reads "Undo {action}, on the board". `[U]`
- AC-UNDO-03 Layout undo does not revert content, and content undo does not move artboards. `[B8]`

## NEW

- AC-NEW-01 The Add artboard menu lists the four kinds with their descriptions; Template has the submenu described in `screens/AddArtboard.md`. `[U]`
- AC-NEW-02 After choosing a kind, a placement ghost follows the pointer; Esc cancels and nothing is created. `[U]`
- AC-NEW-03 Placing a Page creates a draft page titled "Untitled page" whose template is the theme's `blank` template, or else its `page-no-title` template, when the theme has one; placing a Pattern creates a draft synced pattern titled "Untitled pattern". `[U]`
- AC-NEW-04 Placing a Template or Template part creates no post until it is saved from Review, where it is listed as "New". `[U]`
- AC-NEW-05 No control changes an artboard's kind. `[U]`
- AC-NEW-06 A new template's first tab shows the caution notice about having no draft. `[U]`
- AC-NEW-07 A new template part is saved with the General area. `[U]`
- AC-NEW-08 A purpose whose template exists is absent from "New template for" and present under "Already on the site". `[D:AddArtboard]`

## DEL

- AC-DEL-01 Delete on a selected artboard opens the dialog; Cancel changes nothing; Remove with the box unchecked removes the artboard and leaves the entity. `[U]`
- AC-DEL-02 With the box checked, a page goes to the trash, a user pattern is deleted, a user-made template is deleted. `[U]`
- AC-DEL-03 For a theme template with changes, the box offers reset; checking it restores the theme's version. `[U]`
- AC-DEL-04 Removing with the box unchecked is undoable as a layout change. `[U]`
- AC-DEL-05 Delete with several artboards selected opens no dialog, takes them all off the board, leaves their entities, and one undo brings them all back. `[U]`
- AC-DEL-06 Delete with focus on a row of the artboard list acts on the selection as on the board: with one artboard selected it opens the dialog, with several it takes them all off the board with no dialog. `[U]`

## INS

- AC-INS-01 Blocks tab lists allowed blocks by category; clicking one inserts it at the insertion point of the artboard in edit. `[U]`
- AC-INS-02 Patterns tab groups user patterns under "Yours" and others by source, each with the correct usage line. `[U]`
- AC-INS-03 With no artboard in edit the inserter has no Blocks tab: its tabs are Patterns, Templates and Media, and Patterns is selected. Entering edit brings the Blocks tab back. `[U]`
- AC-INS-04 With no artboard in edit, dragging a pattern, template or part to empty board shows the drop target and opens it as a Desktop artboard at the drop point; clicking one opens it as a Desktop artboard in view that covers no other artboard. `[U]`
- AC-INS-05 Clicking a pattern inserts its blocks into the artboard in edit; dragging one onto the artboard in edit inserts its blocks where it is dropped; dragging one to empty board while in edit adds nothing. `[U]`
- AC-INS-06 No inserter row contains a rendered preview or iframe. `[U]`
- AC-INS-07 With an artboard in edit, clicking a template part row inserts a Template Part block and clicking a template row does nothing. `[U]`
- AC-INS-08 Media tab lists images with dimensions; with an artboard in edit clicking one inserts an Image block for it and dragging one onto the artboard inserts an Image block where it is dropped; Upload adds a file and lists it. `[U]`
- AC-INS-09 Search filters all tabs. `[U]`

## MEDIA

- AC-MEDIA-01 With no artboard in edit, clicking an image in the Media tab places a media object in view, and dragging one to empty board shows the drop target at the image's size and places a media object there, labelled "{Name} · Media", listed under "Media" in the left panel; after a reload it is still there. `[U]`
- AC-MEDIA-02 A media object is selected by a click, moved by dragging and removed with Delete through a dialog with no checkbox; double-click and Enter do not enter edit; its settings show the image's pixel size and only "Remove from board". `[U]`
- AC-MEDIA-03 The server accepts a media object with exactly its fields and rejects one with a device or without a width; a media object whose image no longer exists is removed from the board on load. `[N]`

## NOTE

- AC-NOTE-01 With no artboard in edit, pressing "Add note" and then clicking over an artboard places a Yellow note there, drawn above the artboard, selected, with its text field focused; "Add note" is no longer pressed. Esc after arming places nothing. `[U]`
- AC-NOTE-02 Text typed in a note, line breaks included, is on the board after a reload without any save, and is listed under "Notes" in the left panel by its first line. `[U]`
- AC-NOTE-03 A note is selected by a click, moved by dragging, moved together with a selected artboard after Cmd/Ctrl + click, and taken off the board by Delete with no dialog; Undo brings it back. `[U]`
- AC-NOTE-04 Choosing Green in the right panel recolours the selected note, and the colour is kept after a reload. `[U]`
- AC-NOTE-05 The server accepts a layout without `notes` and one whose notes have exactly their fields, and rejects a note with an unknown colour, a missing field or an extra one. `[N]`

## STYLE

- AC-STYLE-01 Styles is shown only in the right panel and only when no artboard, or more than one, is selected (D41). `[U]`
- AC-STYLE-02 Changing a colour token repaints every Preview and Live artboard without saving, and adds Styles to Review. `[B7]`
- AC-STYLE-03 One style change triggers exactly one style generation (counter exposed in test builds), whatever the number of artboards. `[B7]`
- AC-STYLE-04 Blocks tab lists blocks, shows change counts, and opens the stock styles panel for a block. `[B7]`
- AC-STYLE-05 History lists revisions; picking one shows the banner and repaints the board; Restore makes it the edited styles; Stop previewing reverts the board. `[U]`
- AC-STYLE-06 "Style applies to" set to "All {block}" changes that block's global style and every such block on the board; "This block" changes only the selected block. `[B7]`
- AC-STYLE-07 Choosing a variation from the menu repaints the board once and adds Styles to Review. `[U]`

## INDEX

- AC-INDEX-01 Each token row shows a use count equal to the number of referencing blocks across the board's entities plus global styles references. `[U]`
- AC-INDEX-02 Selecting a token shows the banner with correct counts, adds the count to labels of artboards that use it, and outlines the referencing blocks on Preview artboards. `[D:Styles]`
- AC-INDEX-03 Counts are correct for an artboard whose tier is `ghost`. `[U]`
- AC-INDEX-04 Editing a block's colour in one artboard updates the counts without any other entity being re-parsed (parse counter exposed in test builds). `[U]`

## SAVE

- AC-SAVE-01 The Review button counts changed entities, including global styles and new templates and parts. `[U]`
- AC-SAVE-02 The drawer lists each changed item with its second line and change lines. `[D:Review]`
- AC-SAVE-03 Save with one item unchecked saves the others and leaves that one changed. `[U]`
- AC-SAVE-04 When a save request fails, the item stays with the error notice and the button reads "Retry 1 change". `[U]`
- AC-SAVE-05 Saving a template changes the template on the front end at once; saving a draft page leaves it a draft. `[U]`
- AC-SAVE-06 Discard all, after confirmation, reverts every edited record as one step that Undo and Redo act on, and removes unsaved new templates and parts from the board. `[N]` `[U]`
- AC-SAVE-07 Closing the tab with unsaved changes triggers the browser's leave warning; with none it does not. `[U]`
- AC-SAVE-08 Discard on one item, after confirmation, reverts that record alone as one step that Undo and Redo act on, or removes that unsaved new template or part from the board; the other items stay changed. `[U]`
- AC-SAVE-09 Each item's Discard control shows "Discard" and has the accessible name "Discard changes to {name}". `[U]`

## STATE

- AC-STATE-01 A board with no artboards shows the empty state and its button opens the Add artboard menu. `[U]`
- AC-STATE-02 An inserter search with no match shows the "No results" state. `[U]`
- AC-STATE-03 Review with no changes shows its empty state. `[U]`
- AC-STATE-04 The Boards screen with no boards shows its empty state. `[U]`
- AC-STATE-05 An artboard whose entity request fails shows the error state; Retry loads it once the request succeeds. `[U]`
- AC-STATE-06 An artboard whose entity no longer exists is removed from the board on load. `[N]`

## A11Y

- AC-A11Y-01 Every icon-only control has an accessible name equal to the label in `screens/`. `[D:Main]`
- AC-A11Y-02 A keyboard-only user can select an artboard, enter edit, type, leave edit, open Review and save. `[U]`
- AC-A11Y-03 The automated accessibility scan used by WordPress's end-to-end utilities reports no violations on the Overview, Main, Styles and Review states. `[N]`
