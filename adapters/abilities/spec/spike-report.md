# Abilities adapter: spike report

22 November 2026. The three spikes of `adapter.md`, Spikes, run while the adapter was being written: the product owner relaxed rule 5 of `../CLAUDE.md` for this run.

**Gate result: passed after decision D101.** As first run, spike (c) failed: an error's code did not reach the MCP client. Spikes (a) and (b) passed. Nothing was patched or worked around; the product owner decided D101 (the code at the start of the message) and (c) was run again with the adapter built that way. Both runs are recorded below.

| Spike | Result |
|---|---|
| (a) A held request and the board's poll do not starve each other | Passed |
| (b) A result crosses the Abilities API and the MCP Adapter unchanged | Passed. No output schema is needed |
| (c) An error keeps its code | **Failed** as first run: only the message reaches the client, for `not_found` and for `no_board`. **Passed** on the second run, after D101: the code is in the text |

## Environment

The site of `adapters/abilities/.wp-env.json`, on port 8890, as actually running:

| | |
|---|---|
| WordPress | 7.2-RC2 |
| PHP | 8.2.36 |
| MCP Adapter | 0.7.2, from WordPress.org |
| WordPress for Designers | 0.2.0, working tree of branch `abilities-adapter` at `674f814` with uncommitted changes, built with `npm run build` |
| Theme | Twenty Twenty-Five 1.5 |
| Fixture | `wfd_test_wipe(); wfd_test_users(); wfd_test_seed();` of the test helper plugin: board 9, "Fixture board", 9 artboards |
| Board page | Headless Chromium of `playwright-core` 1.65.1, 1440 × 900, signed in as `admin`, `document.visibilityState` `visible` |
| MCP client | A throwaway script: `initialize` (protocol version `2025-06-18`), the `Mcp-Session-Id` header from its response on every later request, `notifications/initialized`, `tools/list`, `tools/call`. HTTP `POST` to `/wp-json/mcp/mcp-adapter-default-server` with an administrator's application password |

The real adapter plugin `wfd-abilities` was inactive during the spikes. The spikes used a throwaway plugin with abilities of its own, in a category `spike`, each registered as `abilities.md` registers one: `required_capabilities` `[ 'edit_theme_options' ]`, no `permission_callback`, `meta.mcp.public` true, an input schema whose top-level `default` is an empty array.

- `spike/call`: input `{ tool, input, board }`, none required. It calls `wfd_agent_relay` with one entry (`tool` defaults to `board-get`) and `{ source: 'spike', board if given, timeout: 30 }`. If the relay failed it returns `new WP_Error( code, message )` from the relay's error. If the one envelope is `ok` it returns the envelope's `result` as it is; otherwise `new WP_Error( code, message )` from the envelope's error. No output schema.
- `spike/call-schema`: the same, with `output_schema` `{ "type": "object" }`.

`wfd_agent_begin( 'spike' )` was run with WP-CLI before the board was opened. All throwaway code is deleted.

## (a) A held request and the board's poll

Run: with the fixture board open, 20 `tools/call` requests in a row in one MCP session, each `mcp-adapter-execute-ability` with `{ "ability_name": "spike/call", "parameters": {} }`. A call counted when it answered HTTP 200 with `success` true, `data.board.id` 9 and 9 artboards.

20 of 20 returned the board. Seconds per call:

`0.845, 1.061, 1.056, 1.059, 1.056, 1.056, 1.064, 1.056, 1.058, 1.055, 1.062, 1.064, 1.055, 1.056, 1.042, 1.037, 1.046, 1.031, 1.046, 1.038`

Minimum 0.845, maximum 1.064, mean 1.042. The page logged one request to the result route per call. Single calls made outside this run took 0.227 and 0.433 seconds.

**Passed.**

## (b) A result crosses unchanged

Comparison: the client's JSON was parsed and compared with the expected JSON by a type-strict walk (an object is not a list, an integer is not a float, key order is kept), and the two were also compared as compact JSON text.

**`board-get`.** The page's request to `wfd/v1/agent/result` was recorded in the Playwright page. `results[0].result` of that body was compared with `data` in what the client received, both in `content[0].text` (parsed) and in `structuredContent`. Equal in both places, type-strict and as text (2305 bytes compact), for `spike/call` and for `spike/call-schema`. The result held `"notes":[]`, `"selection":[]`, `"edit":null`, `"zoom":0.11465798045602606` and whole numbers such as `"x":3140`; all arrived as sent.

**Made-up result.** `board-get` returns no empty object, so a made-up result was sent through the same path a real one takes. A stand-in for a board page (a signed-in wp-admin page in Playwright, not a board) called `POST wfd/v1/agent/poll` every 300 ms as a listener of a board id that does not exist, 9000, with its own client id. `spike/call` was executed with `{ "tool": "board-get", "board": 9000 }`, so `wfd_agent_relay` queued a real call record for board 9000. The stand-in took the call from the poll and answered on `POST wfd/v1/agent/result` with a body written as text, `{"id":…,"client":…,"results":[{"ok":true,"result":R}]}`. The result route stored it, `wfd_agent_relay` read the record decoded as objects and returned it, and the callback returned `results[0]->result`. Nothing was injected in PHP.

Six values of `R` were sent, each through `spike/call` and `spike/call-schema`:

| `R` | `spike/call` (no output schema) | `spike/call-schema` (`{ "type": "object" }`) |
|---|---|---|
| `{"emptyObject":{},"emptyList":[],"fraction":0.3,"whole":1,"nothing":null,"nested":{"emptyObject":{},"emptyList":[],"fraction":0.3,"whole":1,"nothing":null,"list":[{},[],0.3,1,null]},"deep":{"a":{"b":{"c":{}}}}}` | Equal, bytes equal | Equal, bytes equal |
| `{}` | `"data":{}` | `"data":{}` |
| `[]` | `"data":[]` | `"data":[]` |
| `0.3` | `"data":0.3` | Error: `Ability "spike/call-schema" has invalid output. Reason: output is not of type object.` |
| `1` | `"data":1` | The same error |
| `null` | `"data":null` | The same error |

"Equal" holds for `data` in `content[0].text` and in `structuredContent` alike. Every empty object stayed an object, every empty list a list, `1` stayed `1`, `0.3` stayed `0.3`, `null` stayed `null`, at the top level and nested.

**An ability does not need an output schema for this.** An output schema changed nothing in a result that matched it, and turned a result that did not match it into an error.

**Passed.**

## (c) An error keeps its code

**Tool failure, `not_found`.** With the fixture board open, `spike/call` with `{ "tool": "blocks-get", "board": 9, "input": { "artboard": "wfd-ref-a_00000000-0000-0000-0000-000000000000" } }`. The page sent `{"ok":false,"error":{"code":"not_found","message":"Artboard wfd-ref-a_00000000-0000-0000-0000-000000000000 was not found."}}` to the result route. The callback returned `new WP_Error( 'not_found', 'Artboard … was not found.' )`. The client received, in 0.433 seconds, HTTP 200 and this whole response:

```json
{"jsonrpc":"2.0","id":2,"result":{"content":[{"type":"text","text":"Artboard wfd-ref-a_00000000-0000-0000-0000-000000000000 was not found."}],"isError":true}}
```

`spike/call-schema` gave the same response.

**Relay failure, `no_board`.** With no board open (the board page closed more than 25 seconds earlier), `spike/call` with `{}`. The callback returned `new WP_Error( 'no_board', … )` with the relay's message. The client received, in 0.018 and 0.013 seconds (two runs):

```json
{"jsonrpc":"2.0","id":2,"result":{"content":[{"type":"text","text":"No board is listening. Open a board in WordPress for Designers; if one is open, reload it once."}],"isError":true}}
```

The same response came with the board open and `board` naming a board that was not listening.

**Where the code is found: nowhere.** The response holds the `WP_Error`'s message as `content[0].text` and `isError` true, and nothing else: no `structuredContent`, no code field, no error data. The strings `not_found` and `no_board` are not in the response. They are not in `wp-content/debug.log` either.

Read in the MCP Adapter 0.7.2 source, which agrees with what was observed: `ExecuteAbilityAbility::execute` turns a `WP_Error` from the ability into `array( 'success' => false, 'error' => $result->get_error_message() )`, and `ToolsHandler` turns `{ success: false, error: string }` into `create_error_result( $result['error'] )`, which is `{ content: [ text ], isError: true }`. The code is dropped at the first step.

The message text arrives unchanged. A code would be readable by a client only if it were part of the message. Neither the tool's message for `not_found` nor the message `abilities.md` gives for `no_board` holds its code.

**Failed**, for both codes. Per `adapter.md` this is an open question for the product owner. Nothing was changed to get around it.

## (c) again, after D101

22 November 2026, same environment, with `wfd-abilities` built as D101 says: an error's message is `{code}: {message}`. Run through the execute tool with an administrator's application password. Whole responses:

- Relay failure, no board open (`wfd/board-get`):
  `{"jsonrpc":"2.0","id":4,"result":{"content":[{"type":"text","text":"no_board: No board is listening. Run wfd\/board-open and open the address it returns in your browser. If the board is open, bring it into view, or reload it once."}],"isError":true}}`
- The adapter's own `not_found` (`wfd/board-open` with `board` 99999):
  `{"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"not_found: Board 99999 was not found."}],"isError":true}}`
- Tool failure `not_found`, relay failure `several_boards` and the relay's `unknown_tool` in a batch: asserted as whole texts by the tests AC-ABIL-07, AC-ABIL-08 and AC-ABIL-09, which pass.

The code is found in the text, in `result.content[0].text`, before the first colon. There is still no code field. **Passed.**

Errors that WordPress or the MCP Adapter make themselves are not the adapter's and have no code in the text: `Permission denied` for a user without the capability, and `Ability "…" has invalid input. Reason: …` for input that breaks the schema.

## Observed along the way

Facts only. None of these is a spike.

### 1. The default server's tools and result shapes

`tools/list` returns three tools:

| Tool | Arguments (`inputSchema`) |
|---|---|
| `mcp-adapter-discover-abilities` | None: `{ "type": "object", "properties": {} }`. Called with `{}` |
| `mcp-adapter-get-ability-info` | `ability_name` (string, required) |
| `mcp-adapter-execute-ability` | `ability_name` (string, required), `parameters` (object, required) |

- The ability name is the registered name with its slash, `spike/call`. The tools' own names use dashes.
- `parameters` must be present and an object. Left out: `Ability "mcp-adapter/execute-ability" has invalid input. Reason: parameters is a required property of input.` With `null`: `… Reason: input[parameters] is not of type object.` Both are error results as below. An ability run with no input is run with `"parameters": {}`.
- Transport: every response is `application/json; charset=UTF-8`, not an event stream. `initialize` answers with the header `Mcp-Session-Id`. A request without it answers HTTP 400, `{"jsonrpc":"2.0","id":1,"error":{"code":-32600,"message":"Invalid Request: Missing Mcp-Session-Id header"}}`. `notifications/initialized` answers HTTP 202 with an empty body. A wrong password answers HTTP 401 with WordPress's `rest_forbidden` body, not JSON-RPC. A tool name that does not exist is a JSON-RPC error, `{"error":{"code":-32602,"message":"Tool not found: nope"}}`.

A successful execute result, whole:

```json
{"jsonrpc":"2.0","id":2,"result":{"content":[{"type":"text","text":"{\"success\":true,\"data\":{}}"}],"isError":false,"structuredContent":{"success":true,"data":{}}}}
```

- The ability's result is `data`, inside `{ "success": true, "data": … }`.
- It is in both places: `result.structuredContent.data`, and `result.content[0].text`, which is the same object as a JSON string. In the string, a slash is written `\/`.
- `result.isError` is `false`.

An error result, whole:

```json
{"jsonrpc":"2.0","id":2,"result":{"content":[{"type":"text","text":"There is no tool named nope."}],"isError":true}}
```

- HTTP 200, and a JSON-RPC `result`, not a JSON-RPC `error`.
- `result.isError` is `true`. `result.content[0].text` is the message, as plain text, not JSON. There is no `structuredContent`, no `success` and no code.
- The same shape was seen for: a `WP_Error` returned by the ability's callback; input that breaks the ability's schema (`Ability "spike/call" has invalid input. Reason: input[board] must be greater than or equal to 1`); an output that breaks its output schema; an ability that does not exist (`Ability 'spike/nope' not found on this WordPress site, and no ability you can call has a similar name. Call the mcp-adapter-discover-abilities tool to see what this site offers, or tell the user this site cannot do it.`); a user without the capability (`Permission denied`).

The discovery tool's result is `{ "abilities": [ { "name", "label", "description" } ] }`, in `structuredContent` and as a JSON string in `content[0].text`, with `isError` false. An entry has those three keys only: no category, no schema, no annotations. On this site it listed six `core/` abilities besides the plugin's.

The info tool's result is `{ "name", "label", "description", "input_schema", "meta" }` (and `output_schema` when the ability has one), in the same two places. `meta` came back as `{"annotations":{"readonly":true,"destructive":false,"idempotent":null},"mcp":{"public":true},"show_in_rest":false,"public":false}`. A top-level `default` registered as PHP `array()` is printed `"default":[]`; registered as `new stdClass()` it is printed `"default":{}`.

### 2. `required_capabilities` with no `permission_callback`

WordPress 7.2-RC2 accepts it. The five throwaway abilities registered and ran, and `wp-content/debug.log` held no PHP notice, warning or `_doing_it_wrong` line.

A user without the capability is refused. `wfd_editor` (role Editor, `edit_theme_options` false), with an application password of its own, executed `spike/call` and an ability that only reports its input: both answered `{"content":[{"type":"text","text":"Permission denied"}],"isError":true}` and the callback did not run. The same user's discovery tool listed the `spike/` abilities, and its info tool described them: being refused does not hide an ability.

### 3. What the callback receives

Measured with abilities that return `gettype`, `wp_json_encode` and `var_export` of their input, whose schema has `attributes` (object), `list` (array) and `name` (string), none required.

| Executed with | Schema's top-level `default` | Callback receives | `wp_json_encode` of it |
|---|---|---|---|
| `"parameters": {}` | `array()` | An empty PHP array | `[]` |
| `"parameters": {}` | `new stdClass()` | An empty PHP array | `[]` |
| `"parameters": {}` | None | An empty PHP array | `[]` |
| `{ "attributes": {}, "list": [], "name": "x" }` | Any of the three | An array; `attributes` is an empty PHP array, as `list` is | `{"attributes":[],"list":[],"name":"x"}` |
| `{ "attributes": { "a": {}, "b": [], "c": 1, "d": 0.3, "e": null } }` | Any of the three | An array; `a` and `b` are both empty PHP arrays, `c` is int 1, `d` is float 0.3, `e` is null | `{"attributes":{"a":[],"b":[],"c":1,"d":0.3,"e":null}}` |

An empty object in the input, at the top level or nested, is an empty PHP array by the time the callback gets it, and cannot be told from an empty list. Encoded again it is `[]`. `wfd_agent_relay` casts the top-level `input` of each entry to an object before it stores it (read in `includes/agent.php`); a nested one is not cast. What a board page receives for a nested empty object was not run in this spike.

### 4. The real `wfd-abilities` plugin

Activated after the spikes, with the throwaway plugin deactivated. `wp_get_abilities( array( 'category' => 'wfd' ) )` held 24. The discovery tool listed 30 abilities, 24 of them `wfd/`: one for each of the 21 tools of `includes/agent-tools.json`, and `wfd/boards-list`, `wfd/board-open`, `wfd/batch`; none missing, none extra. `wp-content/debug.log` gained no line on activation, discovery, three info calls or one `wfd/boards-list`: no PHP notice and no `_doing_it_wrong`.

The info tool printed `wfd/board-get`'s input schema as `{"type":"object","properties":{"board":{"type":"integer","minimum":1}},"additionalProperties":false,"default":{}}` and `wfd/boards-list`'s as `{"type":"object","additionalProperties":false,"default":{}}`. `wfd/boards-list` returned `{"boards":[{"id":9,"title":"Fixture board","address":"http://localhost:8890/wp-admin/admin.php?page=wfd-board&board=9","listening":false}]}`. Nothing else of the adapter was run.

### Other things seen

- With two listeners and no `board`, the relay's `several_boards` arrived the same way as the other errors, message only: `Several boards are open: 9 "Fixture board", 9000 "Fake". Pass --board=<id>.`
- A call made 24 seconds after the board page was closed did not fail with `no_board`. The page's listener record was still under 25 seconds old, so the call was queued and answered after 30.032 seconds with `The board did not answer within 30 seconds.` A call made a few seconds later failed with `no_board` in 0.018 seconds.
- The MCP Adapter writes a line to `wp-content/debug.log` for some failed tool calls, with `WP_DEBUG_LOG` on: `[ERROR] Tool permission check failed | Context: {…"error_code":"ability_invalid_input"…}` for input that breaks a schema and for an ability that does not exist, `[WARNING] Tool not found` for a tool that does not exist, and `[ERROR] Permission denied for MCP API access` for a wrong password. A `WP_Error` returned by an ability's callback wrote no line.
- The stand-in listener's first runs failed with HTTP 400: the poll route takes a `client` only in the form of a UUID.
