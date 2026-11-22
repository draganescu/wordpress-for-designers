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
- AC-SHELL-10 A board opened in a window narrower than 1180 px shows "Designing needs more space" with its text over the whole window, and no header or artboard exists; at 1180 px wide the message goes and the board opens. `[U]`
- AC-SHELL-11 Narrowing the window below 1180 px while an artboard is in edit shows the message over the whole window; Esc and Cmd/Ctrl + \ do nothing, focus cannot reach the board, and after widening the same artboard is still in edit with both panels shown. `[U]`
- AC-SHELL-12 At 1180 × 820, 1440 × 900 and 1600 × 900, with a block selected in an artboard in edit, the header controls are in order H1 to H5, H10, H13, H6, H7, H12, H8, H11, H9 inside the window with none overlapping the next, and H14 is at the end of H6; H1 and the tool buttons have the widths they have with nothing in edit; the block toolbar is shown whole; of the document bar only the back button shows, next to H14; with the toolbar's room made smaller than the toolbar, the wheel scrolls the toolbar to its end. At 1180 px the left panel is narrower than 280 px, the right panel narrower than 360 px and the canvas area at least 600 px wide. `[U]`
- AC-SHELL-13 With a block selected in an artboard in edit, H14 is labelled "Hide block tools" and the document bar's title is not shown; pressing H14 hides the block toolbar, shows the title and changes the label to "Show block tools"; pressing it again shows the toolbar and hides the title; with the toolbar hidden, selecting another block shows it again. With no block selected H14 is not shown and the title is. "Back to the board" is visible in each of these states. `[U]`

## CANVAS

- AC-CANVAS-01 Each artboard shows the label "{Name} · {Kind} · {Device}". `[D:Overview]`
- AC-CANVAS-02 Click selects one artboard; clicking empty board clears selection; dragging an artboard moves it and the move is undoable. `[B1]` `[U]`
- AC-CANVAS-03 Cmd/Ctrl + wheel zooms around the pointer; Space + drag pans; both work with the pointer over an artboard, including the Live one. `[B8]` `[U]`
- AC-CANVAS-04 The H8 menu items change zoom as named; "Fit all" shows every artboard. `[N]`
- AC-CANVAS-05 Cmd/Ctrl + click on an artboard adds it to the selection and a second one takes it out; with several selected the right panel shows Styles, and dragging one of them or pressing an arrow key moves them all as one undoable step; while an artboard is in edit, Cmd/Ctrl + click on another artboard leaves edit and selects only that one. `[U]`
- AC-CANVAS-06 Dragging from empty board draws a rectangle and selects every artboard it touches while it is dragged, and one it no longer touches is deselected; Cmd/Ctrl + drag adds to the selection; Esc during the drag removes the rectangle and puts the selection back as it was; while an artboard is in edit the drag leaves edit and selects. `[U]`
- AC-CANVAS-07 "Tidy up" (H12) puts the seeded board in one row per kind, Pages above Templates above Template parts above Patterns, each row top-aligned and in left-panel order with no two items overlapping; Undo, whose tooltip reads "Undo tidy up, on the board", puts every item back where it was. The control is disabled while an artboard is in edit. `[U]`

- AC-CANVAS-08 On a touch screen, two fingers dragged on the canvas area pan the board by as much as they move, and pinching them zooms the board, no further than its limits, with the board point midway between them staying there; over empty board and over an artboard, which is neither selected nor moved. The page's own zoom and scroll stay as they were. `[U]`
- AC-CANVAS-09 With an artboard in edit, two fingers inside it pan and pinch the board as elsewhere and it stays in edit; it also stays in edit when the two fingers start on empty board or on another artboard, which is not selected. `[U]`
- AC-CANVAS-10 One finger: a tap selects an artboard and a tap on empty board clears the selection; dragging an artboard moves it and the move is undoable; dragging from empty board selects the artboards the rectangle touches; a double tap on an artboard edits it. `[U]`; that the drag from empty board selects and does not pan is `[N]`
- AC-CANVAS-11 A second finger landing while one finger drags an artboard puts the artboard back where it was, and landing while one finger draws the selection rectangle removes the rectangle and puts the selection back as it was; in both cases the two fingers then pan the board. A one-finger drag of an artboard that the browser cancels puts the artboard back in the same way, and nothing is left to undo. `[U]`; the cancelled drag is `[N]`

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
- AC-TIER-11 After a global style change, an artboard that is `snapshot` shows the new style without becoming `preview`; its old copy is shown until the new one is ready (D51). `[U]`
- AC-TIER-12 Below 20% zoom an artboard that was never rendered gets its frozen copy without becoming `preview`; no `Skeleton` is left once every such artboard has one. `[U]`
- AC-TIER-13 An artboard whose content is taller than 2000 px shows all of it as a Preview and as a Snapshot, at the height it has in edit. `[U]`

## PERF

- AC-PERF-01 During a pan or zoom gesture the app commits no React render (measured with a render counter exposed in test builds); the canvas transform changes each frame. `[B5]`
- AC-PERF-02 Wheel events from inside artboard iframes produce at most one viewport update per animation frame. `[B8]`
- AC-PERF-03 Editor scripts and styles are requested once per session, not per artboard. `[B4]`
- AC-PERF-04 A two-finger pan or pinch commits no React render and changes the canvas transform at most once per animation frame. `[B5]` `[U]`

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

- AC-NEW-01 With no artboard in edit the inserter's Pages tab begins with "New page" and "New browser" (D55), its Patterns tab with "New pattern", and its Templates tab with the group "New template for" and the row "New template part"; with an artboard in edit none of these rows is shown; the left panel has no "Add artboard" control. `[U]`
- AC-NEW-02 After clicking a New row, a placement ghost follows the pointer; Esc cancels and nothing is created. `[U]`
- AC-NEW-03 Placing a Page creates a draft page titled "Untitled page" whose template is the theme's `blank` template, or else its `page-no-title` template, when the theme has one; placing a Pattern creates a draft synced pattern titled "Untitled pattern". `[U]`
- AC-NEW-04 Placing a Template or Template part creates no post until it is saved from Review, where it is listed as "New". `[U]`
- AC-NEW-05 No control changes an artboard's kind. `[U]`
- AC-NEW-06 A new template's first tab shows the caution notice about having no draft. `[U]`
- AC-NEW-07 A new template part is saved with the General area. `[U]`
- AC-NEW-08 A purpose whose template exists is absent from "New template for" and that template is listed in the "Templates" group. `[U]`

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
- AC-INS-03 With no artboard in edit the inserter has no Blocks tab: its tabs are Pages, Patterns, Templates and Media, and Pages is selected. Entering edit brings the Blocks tab back and takes the Pages tab away. `[U]`
- AC-INS-04 With no artboard in edit, dragging a pattern, template or part to empty board shows the drop target and opens it as a Desktop artboard at the drop point; clicking one opens it as a Desktop artboard in view that covers no other artboard. `[U]`
- AC-INS-05 Clicking a pattern inserts its blocks into the artboard in edit; dragging one onto the artboard in edit inserts its blocks where it is dropped; dragging one to empty board while in edit adds nothing. `[U]`
- AC-INS-06 No inserter row contains a rendered preview or iframe. `[U]`
- AC-INS-07 With an artboard in edit, clicking a template part row inserts a Template Part block and clicking a template row does nothing. `[U]`
- AC-INS-08 Media tab lists images with dimensions; with an artboard in edit clicking one inserts an Image block for it and dragging one onto the artboard inserts an Image block where it is dropped; Upload adds a file and lists it. `[U]`
- AC-INS-09 Search filters all tabs. `[U]`
- AC-INS-10 The Pages tab lists every page of the site that is not in the trash, each with "On this board" or "Not on this board"; clicking a page opens it as a Desktop artboard in view, and dragging one to empty board shows the drop target and opens it at the drop point; either way it is selected and not in edit. `[U]`

## NAME

- AC-NAME-01 Double-clicking the label of a page or pattern artboard puts its name in a text field; Enter keeps the new name, which shows in the label and the left panel at once and in Review with the line "Title: changed"; saving from Review writes it to the site. `[U]`
- AC-NAME-02 F2 with one page or pattern artboard selected renames it on its label; Esc leaves the name as it was, an empty name is not kept, and a click elsewhere keeps the new name. `[U]`
- AC-NAME-03 The label of a page artboard in edit is renamed by a double-click, and edit goes on; a double-click on the label of a template or template part artboard, and F2 with one selected, rename nothing. `[U]`

## MEDIA

- AC-MEDIA-01 With no artboard in edit, clicking an image in the Media tab places a media object in view, and dragging one to empty board shows the drop target at the image's size and places a media object there, labelled "{Name} · Media", listed under "Media" in the left panel; after a reload it is still there. `[U]`
- AC-MEDIA-02 A media object is selected by a click, moved by dragging and removed with Delete through a dialog with no checkbox; double-click and Enter do not enter edit; its settings show the image's pixel size and only "Remove from board". `[U]`
- AC-MEDIA-03 The server accepts a media object with exactly its fields and rejects one with a device or without a width; a media object whose image no longer exists is removed from the board on load. `[N]`

## BROWSER

- AC-BROWSER-01 "New browser" in the inserter's Pages tab arms placement; a click on the board places a Desktop browser there showing the homepage, labelled "/ · Browser · Desktop", selected and not browsing, with a window 900 board units tall, listed under "Browsers" in the left panel; after a reload it is still there. `[U]`
- AC-BROWSER-02 Outside browsing, a click on a browser's page selects the browser and follows no link, and a drag moves it; Delete opens the remove dialog with no checkbox and Remove takes it off the board. `[U]`
- AC-BROWSER-03 Double-click starts browsing: following a link in the page changes the address field and the document bar; typing an address of the site and pressing Enter goes there; Esc pressed inside the page ends browsing with the browser selected; after a reload of the board the browser shows the last address. `[U]`
- AC-BROWSER-04 A change to a page made in an artboard is not shown in a browser on that page set to "Saved site" (D57) until it is saved from Review; after the save the browser shows it without Reload being pressed. `[U]`
- AC-BROWSER-05 The server accepts a browser with exactly its fields and rejects one with an `entityId`, one without a `path`, one whose `path` does not start with "/", one without a `height`, one whose `height` is below 200 and one whose `shows` is not "unsaved" or "saved". `[N]`
- AC-BROWSER-06 Dragging a browser's bottom edge down by 200 board units makes its window 200 units taller, and the height is kept after a reload; Undo, whose tooltip reads "Undo resize browser, on the board", puts it back; dragging it up past 200 stops at 200 (D56). `[U]`
- AC-BROWSER-07 A page scrolled while browsing stays scrolled where it was after Esc ends browsing (D56). `[U]`
- AC-BROWSER-08 A browser showing unsaved changes shows a change typed into a page's artboard, without a save and without Reload being pressed, and keeps showing it on a link followed to another page and back; a browser on the same page set to "Saved site" does not show it until Review saves it. The page requested without signing in shows the saved content even with that browser's `wfd_preview` argument, and so does the signed-in user's own request with another value (D57). `[U]`
- AC-BROWSER-09 A browser showing unsaved changes shows an unsaved change to global styles and to a template part (D57). `[U]`
- AC-BROWSER-10 With a browser showing unsaved changes, when the preview route fails the canvas shows one notice reading "We're having a problem saving."; it is still one notice after the send has been tried again and has failed again; it goes away when a send succeeds (D61). `[U]`

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
- AC-STYLE-08 In the Tokens tab, "Edit" on Colors, Typography and Spacing and the "Background" and "Shadows" rows each open the stock styles screen for it; a change made there repaints the board and adds Styles to Review; the screen's Back control returns to the tokens (D52). `[U]`
- AC-STYLE-09 The Blocks tab lists the elements in the groups "Elements", "Headings" and "Form controls" before the blocks; an element row opens the stock styles screen for that element; a change made there repaints the board, shows as the row's change count and adds Styles to Review (D53). `[U]`
- AC-STYLE-10 The variation menu reads "Variation: Default" for the theme's own styles, "Variation: {name}" when the styles are exactly a variation and "Variation: Custom" after any further change; its first item, "Default", returns the styles to the theme's (D54). `[U]`
- AC-STYLE-11 With "Style applies to" on "All {block}", the stock styles screen's Back control sets it back to "This block" (D58). `[U]`
- AC-STYLE-12 A stock styles screen that throws shows WordPress's stock error notice in its place; the board, the other tabs and the other stock screens keep working; switching to another tab closes the screen that threw, so its tab shows its list again, and leaves open a screen that did not (D60). `[U]`

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

- AC-STATE-01 A board with no artboards shows the empty state and its button turns the inserter on. `[U]`
- AC-STATE-02 An inserter search with no match shows the "No results" state. `[U]`
- AC-STATE-03 Review with no changes shows its empty state. `[U]`
- AC-STATE-04 The Boards screen with no boards shows its empty state. `[U]`
- AC-STATE-05 An artboard whose entity request fails shows the error state; Retry loads it once the request succeeds. `[U]`
- AC-STATE-06 An artboard whose entity no longer exists is removed from the board on load. `[N]`

## A11Y

- AC-A11Y-01 Every icon-only control has an accessible name equal to the label in `screens/`. `[D:Main]`
- AC-A11Y-02 A keyboard-only user can select an artboard, enter edit, type, leave edit, open Review and save. `[U]`
- AC-A11Y-03 The automated accessibility scan used by WordPress's end-to-end utilities reports no violations on the Overview, Main, Styles and Review states. `[N]`

## Agent surface (D65)

The five groups below cover `agent/`. Unless a criterion says otherwise: the fixture is loaded, the user is an administrator, one `wp wfd status` has already run on the site, and the fixture board is open in one page. "Runs" a `wp wfd` command means running it in the test environment's WP-CLI container (`api-allowlist.md`). A criterion that calls a tool "through the page" uses `window.wfdAgent.ready()` and `call`, with no `wp wfd` command. Marks are read from the attributes named in `agent/surface.md`, Marks. `[N]` for these conventions

## AGENT

- AC-AGENT-01 On a site where no `wp wfd` command has ever run, an open board sends no request to `wfd/v1/agent` in 30 seconds, requests no agent chunk and shows no G1. `[U]`
- AC-AGENT-02 After a `wp wfd` command, an open board requests the agent chunk within 15 seconds and from then on asks the poll route every second. Once the session has ended (the test ends it by making `wfd_agent_seen` old) it asks every 10 seconds again. While the page is hidden it does not ask. `[U]`
- AC-AGENT-03 `wp wfd status` with no board open prints an empty `boards` and the hint, with exit code 0. With the fixture board open in two pages it lists that board once, with its id and title, and no hint. `[N]`
- AC-AGENT-04 `wp wfd call board-get` prints an `ok` envelope holding the fixture's artboards, with exit code 0, and the call's option is gone afterwards. `[U]`
- AC-AGENT-05 With two different boards open, `wp wfd call board-get` fails with `several_boards` naming both; with `--board` it answers for the board named. `[N]`
- AC-AGENT-06 With no board open, `wp wfd call board-get` fails with `no_board` in under 2 seconds. A call to a board whose page was closed after it last asked fails with `timeout` after `--timeout=2`, with exit code 1, and its option is gone. `[N]`
- AC-AGENT-07 For an editor (no `edit_theme_options`) both relay routes return a permission error. `[U]`
- AC-AGENT-08 Running the `wfd_agent_cleanup` event deletes a call record past its `expires` and a listener record more than 60 seconds old, and leaves fresh ones. Deactivating the plugin unschedules the event. Uninstalling deletes every `wfd_agent_` option. `[U]`
- AC-AGENT-09 With the fixture board open in two pages, one `board-get` call is handed to one page only: exactly one of the two sends a result, and the command prints one envelope. `[N]`

## CLI

- AC-CLI-01 `wp wfd tools --format=json` prints the content of `includes/agent-tools.json`; it has the 21 tools of `agent/tools.md` in that file's order; and `tools` of `window.wfdAgent` is equal to it. `[U]`
- AC-CLI-02 `wp wfd tools` prints the runbook of `agent/cli.md` verbatim, then `# Tools` with every tool in the stated form. Text added through the `wfd_agent_runbook` filter is printed before `# Tools`. `[N]`
- AC-CLI-03 The same call given with `--<field>=<value>` flags, with `--input`, and with `--ref` in place of `--artboard` has the same effect and prints the same result. `[N]`
- AC-CLI-04 `wp wfd call nothing-here` fails with `unknown_tool` and exit code 1, also with no board open. `[N]`
- AC-CLI-05 A call whose input breaks the tool's schema fails with `invalid_args`, its message names the field, and nothing on the board changes. `[U]`
- AC-CLI-06 `wp wfd batch` runs its calls in order on one board and prints one envelope per call. When the second of three fails, the third is `skipped`, the first stays done, and the exit code is 1. `[N]`
- AC-CLI-08 `wp wfd call blocks-get --artboard=<id> --block='[0]'` reaches the board and returns that block: no field of any tool is a global parameter of WP-CLI (D80). `[U]`
- AC-CLI-07 The standard output of `status`, `call` and `batch` is one JSON document and nothing else. `[N]`

## TOOL

- AC-TOOL-01 `board-get` returns the board's id and title, every artboard and note in left-panel order with the fields of `agent/tools.md`, the selection, the artboard in edit and the zoom. `[N]`
- AC-TOOL-02 `board-select` with one artboard selects it and brings it into view; with two it selects both and fits them. With an artboard in edit, edit ends first. `[N]`
- AC-TOOL-03 After a page's title is changed on the site with `wp post update`, `board-refresh` makes its artboard's label show the new title, and an unsaved change to another item is still listed in Review. `[N]`
- AC-TOOL-04 `artboard-add` opens an existing page as an artboard where its inserter row's click would, and a browser at a given address. With an artboard in edit, edit ends first and the page is not inserted into that artboard. An unknown `entityId` fails with `not_found`. `[U]`
- AC-TOOL-05 `artboard-new` for a page creates a draft "Untitled page" at once; for a template part nothing exists on the site until it is saved from Review; `x` and `y` place the artboard there; a template purpose that exists already fails with `invalid_args`. `[U]`
- AC-TOOL-06 `artboard-update` changes the device, and the position, each as one layout undo step named "change device" and "move artboard". `[U]`
- AC-TOOL-07 `artboard-remove` takes artboards off the board, opens no dialog and leaves their items on the site; the header's Undo brings them back. `[U]`
- AC-TOOL-08 `artboard-edit` makes the artboard Live, sets the zoom as D37 says when the board is below 30%, and changes nothing when it is in edit already. A media object fails with `not_editable`. An item locked by another user fails with `locked`, stays a Preview, and no lock dialog opens. `edit-leave` leaves edit and keeps the artboard selected. `[U]`
- AC-TOOL-09 A block tool that names an artboard which is not in edit puts it in edit first, and the artboard that was in edit leaves edit. At no time does a block change in an artboard that is not Live (C29). `[U]`
- AC-TOOL-10 `blocks-get` returns the artboard's blocks with their paths, names, titles, text and attributes, to the depth asked. For a page artboard the template's blocks have `editable` false and the page's own have true. `[N]`
- AC-TOOL-11 `block-update` on a Heading's `content` changes the text in the canvas and in every other artboard that shows the same item, the item is listed in Review, and Cmd/Ctrl + Z in the artboard undoes it as one step. `[U]`
- AC-TOOL-12 `blocks-insert` inserts parsed markup at the parent and index given, a pattern of the active theme by name and a pattern of the site by id; the inserted blocks are that pattern's. A pattern the inserter does not list fails with `not_found`. A block the editor does not allow there fails with `not_allowed` and nothing is inserted. A block whose editing mode is disabled cannot be changed: `block-update` on it fails with `not_allowed`. `[U]`
- AC-TOOL-13 `blocks-remove` removes the blocks at the paths given; when one of them cannot be removed, none is. `[N]`
- AC-TOOL-14 `blocks-move` moves a block to another parent and index and returns its new path. `[N]`
- AC-TOOL-15 `styles-get` returns the rows of the Tokens tab with the same names, values and use counts, and the variation the menu shows. `[U]`
- AC-TOOL-16 `token-set` on a colour repaints every mounted artboard that uses it without anything being saved, with one style compile for the change (AC-STYLE-03's counter), and Styles is listed in Review. A value that is not a hex colour fails with `invalid_args`. `[U]`
- AC-TOOL-17 `styles-set` with `kind` `style` changes a style for the site and, with `block`, for one block type; with `kind` `setting` it changes a setting. Each shows in the edited `globalStyles` record and in the artboards. `[U]`
- AC-TOOL-18 `styles-set-variation` makes the variation menu read that variation, and `Default` makes it read "Variation: Default". An unknown name fails with `not_found`. `[U]`
- AC-TOOL-19 `token-show-uses` with a token shows the banner, the label counts and the outlines that a click on its row shows, and returns the banner's numbers; with no fields it clears them. `[U]`
- AC-TOOL-20 After every tool has been called at least once, nothing on the site has been saved, published, trashed or deleted: every item that existed before has the same saved content and status, and the only new items are the drafts `artboard-new` creates for a page and a pattern (C28). `[U]`
- AC-TOOL-21 `review-list` returns the items of the Review drawer with the same names and lines, each with its author. `[U]`
- AC-TOOL-22 `review-discard` discards an item only the agent changed, as the card's Discard does. On an item the designer also changed it fails with `not_agents` and the item stays. `[N]`
- AC-TOOL-23 While the Review drawer is open, and while the window is narrower than 1180 px, every tool fails with `unavailable` and changes nothing, also when its input is wrong. `[N]`
- AC-TOOL-24 For every fixture artboard, and for a template the test seeds that holds a Query Loop showing three posts, a Comment Template, a synced pattern and a Navigation block that points at a menu, the tree read from the Preview's document equals the Live editor's tree read block by block (the same paths, names and order), and the same holds for a Snapshot. No preview copy has a path, a reference or a target (`agent/surface.md`, Block paths; D79). `[U]` for the equality, `[N]` for the seeded cases
- AC-TOOL-25 `targets()` lists every artboard and note, the blocks of mounted artboards and, with the Tokens tab shown, its colour, font-size and font-family rows. Each `rect` is within 1 px of the element's box in the window. Reading targets changes no artboard's tier. `[N]`
- AC-TOOL-27 A block tool called on an artboard that is not in edit returns the artboard's whole tree, with the blocks of its template parts and of a page's content, on the first call. A style tool returns after the mounted artboards have the new stylesheet. No tool waits on a fixed pause. When loading is held back past the safety limit (the test delays a REST answer), the tool fails with `not_ready` (D82). `[U]`
- AC-TOOL-28 `artboard-remove` takes a never-saved new template part off the board when only the agent changed it. After the designer has typed in it, the tool fails with `not_agents` and the artboard and its content stay (D83). `[U]`
- AC-TOOL-26 A reference given by `board-get`, `blocks-get` or `styles-get` is accepted by the tools in place of an artboard, a path or a slug, with or without a leading `#`. A string that does not parse fails with `invalid_args`; one that names nothing fails with `not_found`. `[U]`

## MARK

- AC-MARK-01 G1 appears within 15 seconds of a `wp wfd` command and goes after the poll that finds the session ended. It reads "Agent connected" during a session, "Agent working" while a call runs and for one second after, "Annotating" while `setAnnotating( true )` is in force and no call runs, and is not shown otherwise. `[U]` `[D:AgentConnected]`
- AC-MARK-02 While a call that names an artboard runs, and for one second after, that artboard's label ends in "· Agent working" and it has the dashed outline; no other artboard has either. `[U]` `[D:AgentWorking]`
- AC-MARK-03 After the agent changes a block, every artboard that shows that item has "· Changed by agent" in its label. The designer's own typing gives no such label. The label goes when the item is saved or discarded. `[U]` `[D:AgentWorking]`
- AC-MARK-04 In the Review drawer an item only the agent changed has the badge "Agent", one both changed has "Agent and you", and one only the designer changed has none. `[U]` `[D:AgentReview]`
- AC-MARK-05 `changed` in `board-get` and `author` in `review-list` say the same as the marks. `[N]`
- AC-MARK-08 The designer typing in an artboard right after `blocks-get` or `artboard-edit` on it is recorded as the designer's. The designer typing within a second after `block-update` on it makes the item `both`. A block that sets its own attributes just after `blocks-insert`, with no input from the designer, leaves the item the agent's (D81). `[U]`
- AC-MARK-06 A tool called through the page, on a site with no session, checks its input, records authorship and shows G2, G3 and G4 exactly as one called with `wp wfd` (C31). `[U]`
- AC-MARK-07 Nothing of the agent surface is put inside the editing canvas: with marks showing, the Live artboard's canvas document holds no element, attribute or style of the plugin's that it did not hold before (C6). `[U]`

## FLOW

The designed flows, each driven by `wp wfd` commands alone and checked on the board. They use the fixture's content in place of the demo site's. `[U]` `[A]`

- AC-FLOW-01 Reading: `status`, then `board-get`. The answer names the fixture's artboards and notes, and Review has nothing to save.
- AC-FLOW-02 Pointing at blocks: the references of a Heading and a Button inside a page artboard that is not in edit, and of that page's Mobile artboard, are taken from `targets()`. One `batch` reads the Heading, changes its text and changes the Button's colour, by reference. Both changes show at every width of that page, and the page is listed once in Review with the author `agent`.
- AC-FLOW-03 Two references, one ask: `blocks-get` by the reference of a block on one artboard, then `blocks-insert` of a pattern after a referenced block on a second artboard. The second artboard ends in edit with the pattern in place; the first is unchanged and no longer in edit.
- AC-FLOW-04 A token: `token-set` by a colour's reference, then `token-show-uses`. Every artboard that uses the colour is repainted, the banner shows the uses, and nothing is saved.
- AC-FLOW-05 A change made outside the board: a page is created with `wp post create`, then `board-refresh` and `artboard-add` put it on the board, and a block change to it waits in Review.
- AC-FLOW-06 Review: `review-list`, then `review-discard` of the Styles item the agent changed. The designer then saves from the drawer; what the agent changed and did not discard reaches the site, and no `wp wfd` command took part in the save.
