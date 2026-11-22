# Agent tools

The closed list of tools an agent can call on an open board. No other tool is built, and none of these is changed, without a decision in `decisions.md`. `[U]` for the list being closed and minimal (D72); `[N]` applies to every name, field, result and error code in this file unless a row says otherwise.

Read `surface.md` first for what a reference is, how a tool call runs and how its effect is shown.

## Rules for every tool

- A tool is one entry of the declaration file (`surface.md`, Declarations): a `name`, a `description`, an `input` JSON Schema and a function. The schema of each tool is an object with exactly the fields listed for it below, `additionalProperties: false`, and the fields marked "yes" under Required in `required`. `[U]` for the shape (D74)
- A tool does what the named control of the UI does, through the same function the control calls, and nothing more. The "Same as" column names that control or decision; its rules apply to the tool unchanged, including undo: a tool's change is a step of the history the control's change would be a step of. `[U]` (D72, D73, C26)
- Where the block editor joins changes into one undo step, a tool's changes are joined too: two changes in a row to the same attribute of the same block are one step, as typing is. `[V]` by Milestone 13, spike (c)
- A tool returns a JSON value, in one piece, when its effect is in the stores and the board has settled on it (Settling, below). It never waits for a save or for the designer. `[U]` (C30, D82)
- No tool saves, publishes, deletes or trashes anything on the site, takes over a lock, or opens or answers a dialog (C28). `[U]`
- Where a field is called an *artboard*, its value is an artboard's `id` or a reference string that names an artboard or a block in it (`surface.md`, References). Where a field's type is *path*, its value is a block path (`surface.md`, Block paths).
- No field is named `path`, or after any other global parameter of WP-CLI (`url`, `user`, `context`, `debug`, `quiet`, `color`, `prompt`, `require`, `exec`, `ssh`, `http`, `skip-plugins`, `skip-themes`, `skip-packages`), because WP-CLI takes those flags before `wp wfd` sees them (D80). `[U]`
- While the board cannot be used, a tool fails with `unavailable` before its input is looked at.
- A tool that names an artboard which is not on the open board fails with `not_found`.
- While the board cannot be used by the designer either, every tool fails with `unavailable` and changes nothing: the window is narrower than 1180 px (D49), or a dialog or the Review drawer is open.
- The `description` of each tool in the declaration file is the text in the Description column, verbatim. It is not translated: agents read it, designers never see it.

## Errors

A failed tool returns `{ "code": "...", "message": "..." }`. The codes are these nine and no others. Messages are the ones given here, verbatim, in English, with the named value put in.

| Code | When | Message |
|---|---|---|
| `unknown_tool` | The name is not in the declaration file | `There is no tool named {name}.` |
| `invalid_args` | The input does not match the tool's schema, or breaks a rule stated for a field | `{what is wrong, naming the field}` |
| `not_found` | An artboard, block path, note, token, variation, pattern, entity or Review item named in the input does not exist | `{Thing} {value} was not found.` |
| `not_editable` | `artboard-edit` or a block tool names a media object or a browser | `{Name} cannot be edited.` |
| `locked` | Entering edit needs a post lock that another user holds (D31) | `{Name} is being edited by {user name}.` |
| `not_allowed` | The block editor does not allow the change: the block cannot be inserted there, moved or removed, or its editing mode is disabled, as the template around a page is | `The editor does not allow this change.` |
| `not_agents` | `review-discard` names an item the designer has also changed | `{Name} also has changes made by the designer.` |
| `unavailable` | The board cannot be used right now (see the rules above) | `The board cannot be used right now.` |
| `not_ready` | The board did not settle within the safety limit (Settling) | `{Name} did not finish loading.` for an artboard; `The styles did not finish updating.` for a style tool |

The relay adds four codes of its own: `no_board`, `several_boards`, `timeout` and `skipped` (`relay.md`).

## Settling

Some effects take a moment that the tool does not control: an artboard that has just entered edit fills in the blocks of its template parts, synced patterns and page content, and a style change is compiled and handed to the artboards. A tool waits for these, so that what it returns and what the next call reads are the real state. It waits on what the board itself reports and never on a fixed pause or on "nothing changed for a while". `[U]` (D82)

| Tool | Waits until |
|---|---|
| `artboard-edit`, `artboard-new` when it ends in edit, and every block tool, after putting an artboard in edit | That artboard's editor is mounted and has its settings; the page's `core` data store reports no selector still resolving, as every `@wordpress/data` store reports for itself; every block that takes its inner blocks from a record of the site (a template part, a synced pattern, a Navigation block that points at a menu, the Content of the page a page artboard shows) holds as many blocks as that record, and a Content block anywhere else holds none; and every block of the tree has its element in the canvas (D87). The tool looks again once a frame until all of these hold. A block tool then reads the tree. A tool called on the artboard already in edit, with nothing resolving, does not wait. |
| `token-set`, `styles-set`, `styles-set-variation` | The `styles` part reports that the compile for this change has finished and its stylesheet has been given to the mounted artboards. The part reports this itself; the Styles panel being drawn is not the signal. |

One safety limit covers both: 10 seconds. A tool that has waited that long fails with `not_ready`, and what it had already changed stays changed. `[N]` for the limit

## Board

| Tool | Description | Same as |
|---|---|---|
| `board-get` | Read the open board: its artboards, notes, selection and which artboard is in edit. | The left panel's artboard list (L3, L4) and the board store |
| `board-select` | Select artboards on the board and bring them into view. | A click on an artboard's row (L4); with several, the rows selected together (D41) and then "Fit selection" (H8) |
| `board-refresh` | Read the site again after something outside the board changed it. | Reloading the board, with unsaved changes kept |

### `board-get`

Input: no fields.

Result:

```json
{
  "board": { "id": 12, "title": "Site map" },
  "artboards": [
    {
      "id": "the artboard's id",
      "ref": "its reference string",
      "kind": "page | template | template-part | pattern | media | browser",
      "name": "the name shown in its label (A1)",
      "entityId": "as in the layout; absent for a browser",
      "address": "a browser's address; absent otherwise",
      "device": "desktop | tablet | mobile; absent for media",
      "x": 0, "y": 0, "width": 1440, "height": 900,
      "tier": "ghost | snapshot | preview | live | warm; absent for media and browsers",
      "changed": "agent | you | both; absent when it has no unsaved change"
    }
  ],
  "notes": [ { "id": "…", "ref": "…", "text": "…", "color": "yellow", "x": 0, "y": 0 } ],
  "selection": [ "ids of the selected artboards and notes" ],
  "edit": "id of the artboard in edit or the browser being browsed, or null",
  "zoom": 0.3
}
```

Artboards and notes are in left-panel order. `width` is the device's render width, or a media object's width. `changed` is the authorship of the unsaved changes of the artboard's entity (`surface.md`, Authorship).

### `board-select`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `artboards` | array of artboard, at least one | yes | What to select |

Result: `{ "selection": [ ids ] }`. If an artboard is in edit, edit ends first, as a click on another artboard ends it (D38).

### `board-refresh`

Input: no fields. Result: `{ "refreshed": true }`.

Every saved record the board shows (the entities of its artboards, the parts and patterns they use, global styles) and every inserter list is read from the site again. Unsaved changes stay as they are, on top of what was read. An artboard whose entity no longer exists leaves the board, as on load (`data-model.md`, Removing). Browsers reload.

## Artboards

| Tool | Description | Same as |
|---|---|---|
| `artboard-add` | Open something that exists on the site as an artboard on the board, or add a browser. | A click on its inserter row with no artboard in edit (D39); for a browser, "New browser" then a click (D55) |
| `artboard-new` | Create a new page, pattern, template part or template and place its artboard. | A "New" row of the inserter and the click that places it (D63), with the creation rules of `data-model.md`, Creating entities |
| `artboard-update` | Change an artboard's device or position. | The device control (E6) and dragging the artboard (A3) |
| `artboard-remove` | Take artboards off the board. Nothing on the site is deleted. | Delete with several artboards selected (D41): no confirmation, no entity changed |
| `artboard-edit` | Put an artboard in edit. | A click on its row (L4), then Enter (D6), with the zoom rule of D37 and the lock rule of D31 |
| `edit-leave` | Leave edit and keep the artboard selected. | Esc with nothing left to dismiss, or the back button (H7) |

### `artboard-add`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `kind` | `page`, `pattern`, `template`, `template-part`, `media` or `browser` | yes | What it is |
| `entityId` | number for page, pattern and media; string (`theme//slug`) for template and template part | for every kind but `browser` | The item on the site |
| `address` | string starting with `/` | for `browser` only | The browser's address, stored as `path` in the layout (`data-model.md`, Board) |
| `device` | `desktop`, `tablet` or `mobile` | no | Set after placing, as E6 sets it. Not allowed for `media` |

The artboard is placed where the row's click places it. If an artboard is in edit, edit ends first, because a row clicked in edit inserts into the artboard and does not open one (D39). Result: the new artboard, in the form `board-get` gives.

### `artboard-new`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `kind` | `page`, `pattern`, `template-part` or `template` | yes | The "New" row |
| `purpose` | `archive`, `search`, `404`, `singular` or `custom` | for `template` only | The row of "New template for" |
| `x`, `y` | numbers, board units | no, but both or neither | Where the placing click lands. With neither, the place a row's click uses (D39) |

A purpose whose template already exists on the site fails with `invalid_args`, as that row is not offered (`data-model.md`). A template for any other slug cannot be made by a tool (D77). Result: the new artboard, in the form `board-get` gives. It is left as the "New" row leaves it: in edit when the row puts it in edit.

### `artboard-update`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `artboard` | artboard | yes | |
| `device` | `desktop`, `tablet` or `mobile` | no | Not allowed for media |
| `x`, `y` | numbers, board units | no, but both or neither | The new top-left corner |

At least one of `device` and `x`, `y` is required. Result: the artboard, in the form `board-get` gives.

### `artboard-remove`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `artboards` | array of artboard, at least one | yes | |

Result: `{ "removed": [ ids ] }`. If one of them is in edit, edit ends first.

A new template or template part that has never been saved exists only on the board, so taking it off the board loses it with every change made to it. The tool removes such an artboard only when its item is recorded as the agent's alone (`surface.md`, Authorship). If one of the artboards named is such an item that the designer has also changed, the tool fails with `not_agents` and removes none of them (D83). `[U]`

### `artboard-edit`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `artboard` | artboard | yes | |

Result: `{ "edit": id }`, once the store names it as the artboard in edit. If it is already in edit the tool changes nothing and returns the same. A media object fails with `not_editable`; a browser starts browsing, as Enter does. When another user holds the lock the tool fails with `locked`, the artboard stays as it was and the lock dialog is not shown.

### `edit-leave`

Input: no fields. Result: `{ "edit": null }`. With nothing in edit it changes nothing.

## Blocks

Blocks are changed only in the artboard in edit (C29). Each tool below names an artboard and first puts it in edit exactly as `artboard-edit` does, unless it is in edit already, and fails as `artboard-edit` fails. It then waits for that editor to settle (Settling) and acts on the block editor of that artboard (`surface.md`, Seams). The artboard stays in edit afterwards. `[U]` (D70)

| Tool | Description | Same as |
|---|---|---|
| `blocks-get` | Read the blocks of an artboard: names, text, attributes and paths. | The list view (L6) and the block inspector (E2, E4) |
| `block-update` | Change the attributes of one block, its text included. | Typing in a block, the block toolbar (H6) and the block inspector (E4) with "This block" |
| `blocks-insert` | Insert blocks, given as block markup, or insert a pattern. | Pasting block markup; for a pattern, its inserter row in edit (D39) |
| `blocks-remove` | Remove blocks. | Delete on selected blocks |
| `blocks-move` | Move a block to another place in the artboard. | Dragging a block (D40) or moving it in the list view |

### `blocks-get`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `artboard` | artboard | yes | A block reference also gives the block, when `block` is absent |
| `block` | path | no | The block to start from. Absent: the whole artboard |
| `depth` | integer, 0 to 10 | no | How many levels of inner blocks to list under each returned block. Default 2 |

Result:

```json
{
  "artboard": "id",
  "blocks": [
    {
      "path": [ 0, 2 ],
      "ref": "the block's reference string",
      "name": "core/heading",
      "title": "Heading",
      "text": "the block's text without markup, at most 200 characters",
      "attributes": { "level": 1, "content": "Tomorrow tastes better." },
      "editable": true,
      "innerCount": 0,
      "inner": [ "the same shape, down to depth" ]
    }
  ]
}
```

With `block`, `blocks` holds that one block. `editable` is false for a block whose editing mode is disabled. `text` is the block's serialized content with tags removed and white space collapsed.

### `block-update`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `artboard` | artboard | yes | A block reference also gives the block, when `block` is absent |
| `block` | path | yes, unless `artboard` is a block reference | The block to change |
| `attributes` | object, at least one key | yes | Merged into the block's attributes. Text is the attribute that holds it, for example `content` of a Paragraph or Heading |

Result: the block, in the form `blocks-get` gives with depth 0.

### `blocks-insert`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `artboard` | artboard | yes | |
| `parent` | path | no | The block to insert into. Absent or `[]`: the top level of the artboard |
| `index` | integer, 0 or more | no | Position among the parent's blocks. Absent: after the last |
| `markup` | string of block markup | exactly one of `markup` and `pattern` | Parsed with `parse`. Markup that yields no block fails with `invalid_args` |
| `pattern` | string | exactly one of `markup` and `pattern` | A pattern the inserter lists in edit: a pattern of the site, by its id as a string of digits, or a pattern of the active theme, by its `name`. It is inserted as its inserter row inserts it (D39). A pattern the inserter does not list, such as one registered by WordPress itself or by a plugin, is `not_found` (D84) |

A block the editor does not allow at that place fails the whole call with `not_allowed`, and nothing is inserted. Result: `{ "inserted": [ paths of the new top-level blocks ] }`.

### `blocks-remove`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `artboard` | artboard | yes | |
| `blocks` | array of path, at least one | yes, unless `artboard` is a block reference | The blocks, as their paths are before the call |

Result: `{ "removed": n }`. If one of them cannot be removed, none is.

### `blocks-move`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `artboard` | artboard | yes | |
| `block` | path | yes, unless `artboard` is a block reference | The block to move |
| `parent` | path | no | Where it goes. Absent or `[]`: the top level |
| `index` | integer, 0 or more | yes | Its position among the new parent's blocks, counted after it has left its old place |

Result: `{ "path": the block's new path }`.

## Styles

Global styles are changed as the Styles panel changes them: one edit of the `globalStyles` record, compiled once, shown at once on every artboard and unsaved until Review (C14, D73). `[U]`

| Tool | Description | Same as |
|---|---|---|
| `styles-get` | Read the site's style tokens, their use counts and the style variations. | The Tokens tab (S4 to S6) and the variation menu (S2) |
| `token-set` | Change a colour of the palette. | The picker of a colour row (S4) |
| `styles-set` | Change any global style or setting, for the site or for one block type. | The stock styles screens (S8, D52, D53) |
| `styles-set-variation` | Switch the site to one of the theme's style variations, or back to the theme's own styles. | The variation menu (S2, D54) |
| `token-show-uses` | Show on the board where a token is used, or stop showing it. | A click on a token's row (S4, S5): the banner, the label counts and the outlines |

### `styles-get`

Input: no fields. Result:

```json
{
  "variation": "Default | Custom | a variation's name, as S2 shows it",
  "variations": [ "the theme's variation names" ],
  "colors": [ { "slug": "ember", "name": "Ember", "value": "#E4572E", "uses": 3, "ref": "…" } ],
  "fontSizes": [ { "slug": "large", "name": "Large", "value": "1.5rem", "uses": 4, "ref": "…" } ],
  "fontFamilies": [ { "slug": "body", "name": "Body", "value": "Inter, sans-serif", "uses": 1, "ref": "…" } ],
  "spacing": [ { "slug": "40", "name": "4", "value": "1rem" } ],
  "changed": "agent | you | both; absent when styles have no unsaved change"
}
```

The rows and their use counts are the ones the Tokens tab shows.

### `token-set`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `kind` | `color` | yes | The only kind edited in a row (S4, S5) |
| `slug` | string | yes | The colour, or a colour reference string in its place |
| `value` | string, `#` and 6 or 8 hexadecimal digits | yes | The new colour |

Result: the colour, in the form `styles-get` gives. The name and the slug are kept.

### `styles-set`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `kind` | `setting` or `style` | yes | Which of `setSetting` and `setStyle` of `@wordpress/global-styles-engine` is used |
| `property` | string of keys joined by `.` | yes | The path that function takes, for example `typography.fontSize` or `color.background` |
| `value` | any JSON value | yes | The value that function takes |
| `block` | a registered block name | no | The block type the change is for. Absent: the site |

Result: `{ "changed": true }`.

### `styles-set-variation`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `name` | string | yes | `Default`, or one of `variations` from `styles-get` |

Result: `{ "variation": name }`.

### `token-show-uses`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `kind` | `color`, `font-size` or `font-family` | no, but with `slug` or not at all | |
| `slug` | string | no | A token reference string may be given as `slug`, with `kind` absent |

With a token: it is selected as its row's click selects it, without opening the colour picker, and the result is `{ "places": n, "artboards": [ ids of the artboards on this board that use it ] }`, the numbers of the banner. With no fields: the selected token is cleared and the result is `{ "places": 0, "artboards": [] }`. The Styles panel shows what is selected when it is shown (C15); the tool does not change the selection of artboards to show it.

## Review

The agent can read what is waiting and take back its own changes. It cannot save (C28).

| Tool | Description | Same as |
|---|---|---|
| `review-list` | List the unsaved changes waiting in Review, and who made each. | The cards of the Review drawer |
| `review-discard` | Discard one unsaved item that only the agent changed. | "Discard" on a card (D48), with its confirmation taken as given |

### `review-list`

Input: no fields. Result:

```json
{
  "items": [
    {
      "key": "postType/wp_template_part/morrow//header",
      "type": "styles | site | page | pattern | template | template-part | navigation",
      "name": "the item name on its card",
      "isNew": false,
      "lines": [ "the change lines of its card" ],
      "author": "agent | you | both"
    }
  ]
}
```

The items, their order, names and lines are those of the drawer (`screens/Review.md`).

### `review-discard`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `key` | string | yes | An item's `key` from `review-list` |

The item must have `"author": "agent"`; otherwise the tool fails with `not_agents`. It does what the card's Discard does after its confirmation (D48), including removing an unsaved new template or part from the board. Result: `{ "discarded": key }`.

## What has no tool

These are done by the designer, or by the agent with WordPress's own commands outside the board, and stay that way in this version. `[U]` for the first row, `[N]` for the rest

| Not a tool | Why |
|---|---|
| Saving from Review, checking or unchecking its items | Saving is the designer's (C13, C28) |
| Deleting, trashing or resetting an item of the site | Not undoable; the remove dialog's checkbox is the designer's (D26) |
| Taking over a lock | The lock dialog is the designer's (D31) |
| Notes: adding, editing, colouring, removing | Readable through `board-get`. Writing them waits for a flow that needs it (D72) |
| Renaming on the label, changing a page's template, a browser's address, height and "Shows", Tidy up, pan and zoom | The same |
| Undo and redo | The designer undoes the agent's steps with the header's Undo, like any other step |
| A template for a slug the inserter does not offer | D77 |
