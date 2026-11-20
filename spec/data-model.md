# Data model

## Artboard kinds

| Kind | WordPress entity (`kind`, `name`) | Rendered as | Draft state | Source |
|---|---|---|---|---|
| Page | `postType`, `page` | Page content inside its template; the template around it is shown locked. The page is given to the template's blocks through `BlockContextProvider` (`postId`, `postType`). | Draft until published | `[B3]` `[U]` |
| Template | `postType`, `wp_template` | Whole template with its parts inlined | None. Saving is live | `[B3]` `[U]` |
| Template part | `postType`, `wp_template_part` | The part alone | None. Saving is live | `[B3]` `[U]` |
| Pattern | `postType`, `wp_block` | The pattern alone | Draft until published | `[B3]` `[U]` |
| Media | `postType`, `attachment` (images only) | The image itself. Not editable, no device, not part of the tiers (D34) | None. Nothing about it is ever saved | `[U]` |

The same entity may appear on several artboards, for example Header on Desktop and on Mobile. All of them show the same content. `[B3]`

Posts and other post types are not artboard kinds in this version. `[D:AddArtboard]`

## Devices

| Device | Render width | Source |
|---|---|---|
| Desktop | 1440 px | `[U]` |
| Tablet | 780 px when the theme's tablet breakpoint is the default 782 px; otherwise the theme's tablet breakpoint minus 2 px | `[U]` `[V]` |
| Mobile | 360 px, or the theme's mobile breakpoint if that is smaller | `[U]` `[V]` |

Breakpoints are read from the merged global styles `settings.viewport` (`mobile`, `tablet`), defaults 480 px and 782 px. `[V]`

A media object is as wide as its image in pixels, up to 1440, and as high as keeps the image's proportions. Both are fixed when it is placed. `[U]` for a fixed width, `[N]` for the cap

An artboard's height is the height of its rendered content. The last measured height is cached on the board so Ghost artboards have the right size. `[B5]`

## Board

A board is a post of the custom post type `wfd_board`. `[U]` `[B3]`

Post type registration: `[N]`

- not public, no admin UI of its own, `show_in_rest` true with `rest_base` `wfd-boards`
- supports `title` only
- every capability maps to `edit_theme_options`
- `post_status` is always `publish`; a removed board goes to the trash

`post_title` is the board name. `post_content` holds the layout as a JSON string with this shape and no other fields: `[U]` for JSON storage, `[N]` for the field list

```json
{
  "version": 1,
  "artboards": [
    {
      "id": "string, a UUID made by the client",
      "kind": "page | template | template-part | pattern",
      "entityId": "number for page and pattern; string id (theme//slug) for template and template-part",
      "device": "desktop | tablet | mobile",
      "x": "number, board units",
      "y": "number, board units",
      "height": "number, last measured content height in px"
    }
  ]
}
```

A media object has `"kind": "media"`, a numeric `entityId` (the attachment), a `width` (number, board units) and no `device`:

```json
{ "id": "…", "kind": "media", "entityId": 12, "x": 0, "y": 0, "width": 1200, "height": 800 }
```

The layout may also have a `notes` list (D46). A layout without it has no notes; a board with no notes is saved without it. Each note has exactly these fields: `[U]`

```json
{ "id": "a UUID made by the client", "x": 0, "y": 0, "text": "string, plain text, may be empty", "color": "yellow | green | blue | pink" }
```

A note's height is not stored: it is the height of its text. Its width is always 240 board units. `[U]` for the width, `[N]` for the field list

One board unit is one CSS pixel at 100% zoom. Artboard order in the array is the order of creation, and so is note order. `[N]`

The viewport (pan and zoom) is not stored on the board, because boards are shared. It is kept per user and per board in `localStorage` and restored on open; with nothing stored, the board opens fitted to all artboards. `[N]`

The server validates the JSON against this shape on save and rejects anything else with a 400. `[N]`

## Creating entities

| Kind | What is created | When | Source |
|---|---|---|---|
| Page | A `page` with status `draft`, title "Untitled page" (renamed on the board, D48), empty content, and as its template the theme's `blank` template if it has one, else its `page-no-title` template if it has one, else none (D36) | At placement | `[U]` |
| Media | Nothing. The object refers to an image already in the media library | | `[U]` |
| Pattern | A `wp_block` with status `draft`, title "Untitled pattern" (renamed on the board, D48), empty content, synced | At placement | `[U]` |
| Template | A `wp_template` for the chosen purpose, with content: the theme's Header part, one empty paragraph, the theme's Footer part | At first save from Review, never before | `[U]` `[D:AddArtboard2]` |
| Template part | A `wp_template_part` titled "Untitled part", area `uncategorized` (labelled General), empty content | At first save from Review, never before | `[U]` `[V]` |

Until its first save, a new template or template part exists only in the browser session. Its artboard is not written to the board's layout until that save. Closing the tab before saving loses it; the unsaved-changes warning covers this. `[N]`

Template purposes offered, with the slug each creates: Archive `archive`, Search results `search`, Page: 404 `404`, Single item `singular`, Custom (a custom template titled "Untitled template"). A purpose whose template already exists on the site is not offered as new; that template is listed in the Templates tab's "Templates" group (D49). `[U]` `[V]`

If the theme has no Header or Footer part, the new template's content is the one empty paragraph. `[N]`

## Removing

Pressing Delete on a selected artboard, or "Remove from board", opens a confirmation. Confirming always removes the artboard from the board. The dialog has one unchecked checkbox that also acts on the entity: `[U]`

| Entity | Checkbox action | Source |
|---|---|---|
| Page, pattern | Move to trash | `[U]` |
| Template or part created by a user (`has_theme_file` false) | Delete | `[U]` `[V]` |
| Template or part that ships with the theme (`has_theme_file` true) | Reset to the theme's version (REST update with `source: "theme"`) | `[U]` `[V]` |

A media object has no checkbox: removing it only takes it off the board. `[U]`

A note is removed at once, with no confirmation, and can be brought back with Undo (D46). `[U]`

Pressing Delete with several artboards selected opens no confirmation: every selected artboard leaves the board and no entity is changed (D41). `[U]`

When the entity is deleted, trashed or reset, every other artboard on any board that references it is handled on next load: a missing entity removes the artboard from that board. `[N]`

## Saving

- Edits live in core-data as edited entity records until saved. `[B6]`
- Review changes saves the checked items, one REST request per item. `[B6]` `[U]`
- A failed save leaves the item checked and listed with its error. `[U]`
- A page's template, changed from the right panel (D35), is an edit of the page like any other: listed under the page in Review with the line "Template: changed" and saved with it. `[U]`
- A page's or pattern's name, changed on its artboard label (D48), is an edit of that page or pattern like any other: listed under it in Review with the line "Title: changed" and saved with it. `[U]`
- Saving never changes a page's or pattern's status. Publishing drafts is done in wp-admin. `[N]`
- Global styles save as the `globalStyles` entity of the active theme. `[B7]`
- Edits that blocks make to other records (the site's title, tagline and logo; navigation menus) are listed in Review as their own items and saved the same way. `[U]`

## Locks

When a page or pattern is about to become Live, the plugin checks the WordPress post lock through its lock route (`architecture.md`, Server). `[B8]` `[U]`

- If the lock is free, the plugin takes it, refreshes it while the artboard is Live, and releases it when the artboard leaves edit or the page unloads. `[U]`
- If another user holds it, the artboard does not become Live. It stays a Preview and the lock dialog (`screens/LockDialog.md`, first state) offers Cancel or Take over. Take over takes the lock and enters edit. `[U]`
- After Cancel the lock is checked again only on the next attempt to enter edit on that artboard. Nothing polls. `[U]`
- If a refresh finds that another user has taken the lock, the artboard leaves edit and the dialog's second state is shown. `[U]`
- Unsaved edits to an item whose lock was lost stay in Review and save normally. The lock is advisory, as in WordPress. `[U]`
- Templates and parts have no lock. `[B8]` `[V]`

## Permissions

The Designer menu, the board app and the `wfd-boards` REST routes require `edit_theme_options`. Without it the menu is absent and direct URLs return WordPress's standard permission error. `[U]`
