# Abilities

The closed list of abilities the adapter registers: one for each tool of the main plugin's `includes/agent-tools.json`, and four of its own. No other ability is registered. `[U]` for the list (D95, D96, D103); `[N]` applies to every name, label, field, result and message in this file unless a line says otherwise.

Read `../../../spec/agent/tools.md` for what each tool does and `../../../spec/agent/relay.md`, From PHP, for the functions used here.

## Category

Registered on `wp_abilities_api_categories_init`:

| Slug | Label | Description |
|---|---|---|
| `wfd` | WordPress for Designers | Work on a WordPress for Designers board that is open in a browser. |

## Every ability

Registered on `wp_abilities_api_init`, each with:

| Argument | Value |
|---|---|
| `category` | `wfd` |
| `required_capabilities` | `[ 'edit_theme_options' ]`. No `permission_callback`. `[U]` (C19) |
| `meta.mcp.public` | `true`. `meta.public` and `meta.show_in_rest` are not set, so the abilities are not offered over REST. `[U]` (D97) |
| `meta.annotations` | `readonly` and `destructive`, from the tables below |
| `output_schema` | None, unless spike (b) of `adapter.md` reports that one is needed |

Labels and descriptions are not translated: agents read them, and a site owner sees them only in a list of abilities.

An input schema none of whose fields is required has an empty object as its top-level default, so that an agent may run the ability with no input.

## Tool abilities

For each entry of `wfd_agent_tools()`, in its order (AB2):

| Argument | Value |
|---|---|
| Name | `wfd/{name}`, for example `wfd/board-get` |
| `label` | The tool's `name` |
| `description` | The tool's `description`, unchanged |
| `input_schema` | The tool's `input`, with one property added: `board`, an integer of 1 or more, not required |

`board` is the id of the board to call when several are listening (D97). The adapter takes it out of the input before the call is made; the page never sees it. If a declaration ever has a field named `board`, apply the stop rule.

Executing one:

1. Call `wfd_agent_relay` with one entry, `{ "tool": name, "input": the input without board }`, and `{ "source": "abilities", "board": board if given, "timeout": 30 }`.
2. If the relay failed, return an error with its code and the message of Relay failures below.
3. If the one envelope is `ok`, return its `result`. Otherwise return an error with the envelope's `code` and `message`, unchanged (D98).

An error is a `WP_Error` whose code is the code and whose message is the code, a colon, a space and the message: `not_found: Artboard wfd-ref-a_3f2c… was not found.` (D101). What carries abilities to an agent may pass on the message alone, so the code is in it. This holds for every error the adapter returns; the messages in this file are given without the code.

Annotations:

| Tools | `readonly` | `destructive` |
|---|---|---|
| `board-get`, `blocks-get`, `styles-get`, `review-list` | true | false |
| `artboard-remove`, `review-discard` | false | true |
| Every other tool, and any tool a later decision adds | false | false |

`destructive` is false for a tool that changes the board because nothing a tool changes is saved (D78). The two marked true lose unsaved work that the header's Undo does not bring back.

## The adapter's own abilities

### `wfd/boards-list`

| | |
|---|---|
| `label` | List boards |
| `description` | List this site's WordPress for Designers boards, with the address of each and whether it is open in a browser. |
| Input | No fields |
| Annotations | `readonly` true, `destructive` false |

Result: `{ "boards": [ { "id": 12, "title": "Site map", "address": "https://…", "listening": false } ] }`, as `wfd_agent_boards()` gives them. It marks no session (AB4).

### `wfd/board-open`

| | |
|---|---|
| `label` | Open a board |
| `description` | Get the address of a board to open in your browser, and how to work on it. Run this before any other board ability. |
| Input | `board`: integer of 1 or more, required |
| Annotations | `readonly` false, `destructive` false |

It calls `wfd_agent_begin( 'abilities' )`, then returns `{ "board": { "id", "title", "address", "listening" }, "guide": "…" }`, where `board` is that board's entry of `wfd_agent_boards()` and `guide` is the text of Guide below. A board that is not in `wfd_agent_boards()` is the error `not_found`, `Board {id} was not found.`, and no session is marked.

The ability opens nothing: the agent opens `address` in its browser (D96).

### `wfd/board-new`

| | |
|---|---|
| `label` | Make a board |
| `description` | Make a new, empty board and get its address to open in your browser, and how to work on it. |
| Input | `title`: string, not required |
| Annotations | `readonly` false, `destructive` false |

It calls `wfd_agent_board_new` with the title, then `wfd_agent_begin( 'abilities' )`, and returns `{ "board": { "id", "title", "address", "listening" }, "guide": "…" }` as `wfd/board-open` does, for the new board. With no title the board is titled "Untitled board". A failure of `wfd_agent_board_new` is an error with its code and message, and no session is marked.

The board is made at once and stays: this is the one thing an ability saves (D103, AB3).

### `wfd/batch`

| | |
|---|---|
| `label` | Run several calls |
| `description` | Run several board abilities in order on one board, in one round trip. After the first failure the rest are skipped. |
| Annotations | `readonly` false, `destructive` true: it can hold the two tools that are (D107) |

| Field | Type | Required | Meaning |
|---|---|---|---|
| `calls` | array of 1 to 50 objects, each `{ "tool": string, "input": object }` with `tool` required | yes | The calls, in order. `tool` is a tool's name as in the declarations; a leading `wfd/` is ignored. `input` is that tool's input, without `board` |
| `board` | integer of 1 or more | no | As for a tool ability |

It calls `wfd_agent_relay` with the entries and a timeout of 60. Result: `{ "ok": true, "results": [ envelope, … ] }` when every envelope is `ok`, and `{ "ok": false, "results": [ … ] }` when one failed, with the envelopes as the relay gives them (`../../../spec/agent/relay.md`). A failure of the relay itself is an error, as for a tool ability. The four abilities of this section are not tools and cannot be in a batch: naming one is the relay's `unknown_tool`.

## Relay failures

The codes are the relay's. Two messages are the adapter's, because the relay's own name the command's flags (D98); the others are the relay's, unchanged.

| Code | Message |
|---|---|
| `no_board` | `No board is listening. Run wfd/board-open and open the address it returns in your browser. If the board is open, bring it into view, or reload it once.` |
| `several_boards` | `Several boards are open: {id} "{title}", {id} "{title}". Pass board.` |
| `timeout`, `unknown_tool`, `invalid_args`, `unavailable` | The relay's message |

## Guide

The text `wfd/board-open` returns as `guide`, verbatim:

```text
# Working on a WordPress for Designers board

A board is a canvas of artboards. Each artboard shows one page, template, template part or pattern of this site with real blocks, at one device width. The board is a page in a browser, and the designer sees what you do on it as you do it.

How to work:
1. Open the address that came with this text in the browser you control, signed in to this site. Keep that page open and in view: the abilities act on it, and fail with `no_board` when it is closed or hidden.
2. Run `wfd/board-get` to see the board's artboards, notes and selection.
3. Make changes with the other `wfd/` abilities. Several changes that belong together go in one `wfd/batch`.
4. Say what you changed and on which artboards.

Rules:
- Nothing you change is saved. Every change waits in Review, where the designer saves or discards it. Never offer to save, and never press Save or any other control of the board yourself: work through the abilities.
- Blocks are changed in the artboard in edit. The block abilities put the artboard in edit for you, and only one artboard is in edit at a time.
- Read a block with `wfd/blocks-get` before you change it. A block is named by its place, and the block at that place may have changed.
- A reference is a string that starts with `wfd-ref-`. Pass it wherever an ability takes an artboard, a block or a token. `wfd/board-get`, `wfd/blocks-get` and `wfd/styles-get` give the reference of everything they list.
- Templates and template parts have no draft. Tell the designer when a change to one will reach the live site once saved.
- If you change the site in another way, run `wfd/board-refresh` afterwards so the board shows it.
- With several boards open, pass `board` with the id of the one you mean.
- To work on another board, run `wfd/board-open` for it and open its address.
- To make a new board, run `wfd/board-new` and open its address.
```
