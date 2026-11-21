# What can be built

> Superseded in part by `10-decisions.md` (21 November 2026). The binding text is in `spec/` from D65 on.

Added 2026-11-21, after the first pass. Files 01 to 06 describe what exists. This file turns that into three things to build and the order to build them in. Everything here is a proposal (`[inf]`), drawn from the product owner's direction and the facts in the other files. Tool and command names are placeholders.

The three buildables:

1. Block tools for the artboard editors, exposed through WebMCP, modelled on the WordPress AI plugin.
2. Board tools, so an agent can work a loop like the one Paper and Pencil offer.
3. A WP-CLI path with a server relay, so the Studio agent drives the open board from the server side.

One set of tool definitions serves all three. The carriers differ.

## 1. Block tools for artboard editors

The AI plugin's 14 tools (02, section 4) are the model: plain functions that dispatch into the editor's stores, each registered with `document.modelContext.registerTool()`, each call one undo step. The board keeps the tool list and changes what the tools are bound to.

| AI plugin | On a board |
|---|---|
| Page-wide `core/block-editor` store | The block-editor registry of the artboard the call names |
| One document per page | Every call takes an artboard id, or defaults to the artboard in edit |
| `editor-get-document` | An artboard's block outline with clientIds |
| `editor-get-block-types` | What a position in that artboard allows; one type's attribute schema |
| `editor-insert-block`, `-update-block-text`, `-update-block-attributes`, `-move-block`, `-duplicate-block`, `-transform-block`, `-remove-block`, `-select-block` | The same, in the named artboard |
| `editor-set-title` | Rename a page or pattern (D62) |
| `editor-undo` | Content undo, while the artboard is Live |
| `editor-save`, `editor-publish` | Nothing direct. Edits wait in Review; see board tools |

Additions worth taking from the other references:

- `insert-pattern` and pattern listing, from Agentic Editor.
- A batch call that applies several operations as one undo step. The AI plugin left batches out and Agentic Editor names their absence as a limit. Over WP-CLI a batch also saves a process per operation.
- Markup input checked before it is applied. A tool that takes block markup parses it and refuses invalid blocks, which is what Studio's `validate_blocks` rule asks for.

The open choice from 05 stays: a tool call on an artboard that is not Live either makes it Live first (the designer watches the editor work, one artboard at a time, C8), or edits the entity's blocks through core-data without mounting an editor (several artboards can change while the designer keeps theirs). The first is the AI plugin's behaviour carried over unchanged. The second needs the spike in 06.

## 2. Board tools

The loop from 01: where am I, what is here, change this, show me, I am working here.

| Step | Tools |
|---|---|
| Orient | `board-get`: title, artboards (id, kind, entity, device, position, size), notes. `board-get-selection`: selected artboards and notes, the artboard in edit, the selected block |
| Read the site | List pages, patterns, templates and parts that could become artboards; list boards |
| Tokens | Read global styles presets with their use counts from the usage index; set a preset; list and switch style variations |
| Lay out | Add an artboard for an existing entity at a device; create a page, pattern, template or part as a new artboard; add a browser artboard at a path; move; change device; remove from the board; tidy up; find clear space |
| Notes | Add, edit, recolour and remove notes. Read notes near an artboard as instructions |
| Show me | Focus the view on an artboard. A layout snapshot of an artboard: rendered boxes of its blocks, with no image |
| Working here | Mark an artboard as being worked on and release it. Take the post lock for pages and patterns |
| Review | List unsaved items as Review does; save named items; discard named items |

These dispatch to the `wfd/board` store, core-data and the styles code the shell already uses, so the canvas, the panels and the layout undo history follow without extra work.

Pictures are the one gap. A layout snapshot covers models without vision and many checks. For an image, the browser artboard and the D57 preview already render unsaved work on the front end, which Studio's `take_screenshot` can capture (spike below).

## 3. The WP-CLI path and the server relay

### Why

`wp_cli` is the one channel the Studio agent has on every surface: Desktop, `studio ui`, Studio Cloud and `studio mcp`. A `wp wfd` command set plus a Studio skill asks for no change to Studio's code and does not depend on the preview being a `<webview>` or an iframe (04).

A PHP twin of the block tools is the thing to avoid. Regenerating a static block's saved HTML after an attribute change needs the block's JavaScript `save`, and doing without it is the failure Block MCP spends most of its effort on (02, section 5). The server therefore relays to the page that has the editor.

### How a call travels

1. The agent runs `wp wfd call <tool> --board=<id> --args='<json>'`.
2. The command writes the call to a queue for that board and waits for its result.
3. The open board, polling the server, takes the call and runs it through the same function its WebMCP tool uses.
4. The board posts the result. The command prints it and exits.

```
Studio agent ── wp_cli ──▶ wp wfd call ──▶ queue (per board, per user)
                                  ▲               │ poll
                                  │ result        ▼
                                  └────────── open board page ──▶ stores
```

### Presence

With each poll the board reports what it is: board id, the user, selected artboards, the artboard in edit, the selected block. `wp wfd status` returns the boards that are connected and that state. This is the agent's "selection as context", and it is how the agent learns whether a board is open at all.

### What runs where

| Command group | Board open | No board open |
|---|---|---|
| Boards and layout (create a board, add artboards, notes, tidy up) | Relayed, so the open board stays the single writer of its layout and the autosave race in 05 does not arise | Runs on the server against the `wfd_board` post, through the same validation as REST |
| Entities (create a page, pattern, template, part) | Relayed; they appear as new artboards and unsaved items | Runs on the server, as the Studio agent does today |
| Block edits | Relayed | Fails with a message asking for the board to be opened, or runs in a board the agent opens itself (below) |
| Styles | Relayed; every artboard repaints | Server write to the global styles entity |
| Review (list, save, discard) | Relayed | Nothing to review |

### The agent's own board

When the designer has no board open, the Studio agent can open one in its Playwright Chromium, signed in as the administrator, and that page becomes the executor. Its edits are unsaved in a tab nobody watches, so the session has to end by saving through the Review tools. This keeps one implementation of block editing for unattended work. It needs Studio to hold a page open across tool calls, which its tools do not do today.

### Commands

| Command | Does |
|---|---|
| `wp wfd status` | Connected boards and their state |
| `wp wfd tools` | The tool list with schemas, for the agent to read once |
| `wp wfd call <tool>` | One tool call, relayed or run on the server |
| `wp wfd batch` | Several calls in one process, applied in order, optionally as one undo step |
| `wp wfd board list / create / get` | Convenience over the board tools, usable with no board open |

Output is JSON. Errors name what to do next ("no board is open for board 12").

### Abilities as the definition

Registering each tool as a server ability (`wp_register_ability`) whose callback relays or runs gives `wp wfd call` its list and schemas, and exposes the same tools to outside agents through the MCP Adapter's stdio and HTTP transports with no further code (02, sections 1 and 3). In the page, the same names registered with `@wordpress/abilities` give WebMCP and the relay one function to call.

## Carriers

| Carrier | Reaches | Needs |
|---|---|---|
| WebMCP in the board page | Agent browsers; Playground through its proxy (03) | A browser with `document.modelContext` |
| `wp wfd` and the relay | The Studio agent on every surface; any agent with a shell on the site | The board open, or the agent's own board |
| Server abilities over the MCP Adapter | Outside agents such as Claude Code or Cursor, without Studio | The MCP Adapter plugin |

## The Studio side

- A skill, `wordpress-for-designers`, loaded when the plugin is active on the site: check `wp wfd status`, read `wp wfd tools`, prefer the board over writing files when a board is open, leave work in Review unless told to save, use notes and selection as instructions.
- A line of skill routing in the prompt, gated on the plugin being present, in the way tools are gated on `host.ui`.
- `refresh_browser` is unnecessary for relayed work. The canvas updates itself.
- Evals for the new behaviour, as `AGENTS.md` requires for any change to prompt, tools or skills.
- Later, and optional: the preview opening the board when the agent starts board work; chat artifacts that point at an artboard.

## Costs and unknowns

- **Polling.** A poll every half second or so while an agent session is active, slower or none otherwise. Long polling holds a PHP worker; Studio's native PHP runs several, and the count needs checking.
- **Process per call.** Each `wp_cli` call starts PHP and loads WordPress. Batches matter.
- **Timeouts.** The board may be in a background tab that the browser throttles. The command needs a timeout and a clear error.
- **Who may queue.** Calls are queued for a user and run with that user's rights in their own browser. WP-CLI on a Studio site runs as the administrator; on a shared site the queue must stay per user.
- **Two writers.** The designer and the agent edit the same registries. One artboard marked as the agent's at a time is the simplest rule; what the designer may do there meanwhile is a UX question.
- **Scope.** All of this reopens "Agent or AI features" in `spec/out-of-scope.md` and adds `@wordpress/abilities` to `spec/api-allowlist.md`. The relay is a new REST route and stored state, which `spec/data-model.md` would have to describe.

## Order

1. Board tools and block tools as plain functions in the page, callable from the console. This is where the non-Live question is settled.
2. WebMCP registration of those functions. Check in Chrome with the flag and through Playground's proxy.
3. The relay: queue, poll, presence, `wp wfd status` and `wp wfd call`.
4. The Studio skill, tried with Studio Code on the Morrow demo site.
5. Server-side versions of the board and layout commands for when no board is open, then abilities and the MCP Adapter.

## Spikes, added to those in 06

- A poll loop from the board to a REST route on a Studio site: latency of one relayed call end to end, and worker use.
- `take_screenshot` on a front-end URL carrying the D57 preview argument, from Studio's Chromium, to see unsaved work.
- A board held open in Studio's Chromium across several tool calls.
