# Out of scope for this version

Each item was considered and cut. Do not build any of them, in part or behind a flag.

| Item | Source |
|---|---|
| Comparing style variations side by side | `[U]` |
| Style guide artboard (generated specimens) | `[U]` |
| Sections or groups of artboards on the board | `[U]` |
| Multiplayer, presence, live cursors | `[B8]` `[U]` |
| Bitmap snapshots | `[B8]` |
| Custom artboard widths, drag to resize an artboard's width | `[U]` |
| Touch input other than the board gestures of D64 | `[U]` |
| Changing an artboard's kind after creation | `[U]` |
| Draft copies of templates and template parts. The unsaved content kept on the server for a user's own preview (D57) is not one: it lasts a limited time and never reaches the live site (C13) | `[U]` |
| Previews or thumbnails in the inserter lists | `[U]` |
| A per-artboard inserter, toolbar or inspector | `[B8]` `[U]` |
| A Styles mode or Styles button outside the right panel | `[U]` |
| Starter content prompts inside an artboard | `[U]` |
| A modal dialog or form for creating an artboard | `[U]` |
| Publishing a draft page or pattern from the board (done in wp-admin) | `[N]` |
| Opening an existing page or pattern as an artboard by any path other than the inserter (D39) | `[U]` |
| Creating an artboard from anywhere but the inserter's "New" rows (D63) | `[U]` |
| Renaming a template, a template part or a media object on the board (D62) | `[U]` |
| Replacing the wp-admin dashboard | `[U]` |
| Board sharing controls, per-user boards | `[U]` |
| Mounting the post editor or site editor | `[U]` |
| Changed by D65: an agent surface is specified in `agent/`, and the rows after this one say what of it stays cut. (Was:) Agent or AI features from the gutenberg-canvas concept | `[U]` |
| Registering the tools with WebMCP, exposing them as abilities, and the MCP Adapter. The tools are shaped so that each can be added later as a way in (D74) | `[U]` |
| A chat, an annotate mode, a message field, an inbox or an agent browser of the plugin's own (D75) | `[U]` |
| Server-side versions of the tools, for when no board is open (D68) | `[U]` |
| Changing blocks in an artboard that is not in edit (D70) | `[U]` |
| Any change inside a harness, and any code or wording for one harness in the main plugin (D67, C32) | `[U]` |
| A tool that saves, publishes, deletes, trashes or resets, takes over a lock or acts on Review's checkboxes (D78) | `[U]` |
| Tools for notes, renaming, a page's template, a browser's settings, Tidy up, pan and zoom, undo and redo, and a template for a slug the inserter does not offer (D72, D77) | `[N]` |
| Calling an AI model from the plugin, and any prompt in the plugin other than the runbook of `agent/cli.md` | `[N]` |
| Snapping, of a guide to anything or of an artboard to a guide (D110) | `[U]` |
| Adding a guide without a pointer (D110) | `[U]` |
| A "Guides" group in the left panel, and a list of guides in an artboard's settings (D112) | `[U]` |
| A tool that reads or changes guides or rulers, and guides in the result of `board-get` (D115) | `[U]` |
| A label, a name or a colour of a guide's own | `[N]` |
