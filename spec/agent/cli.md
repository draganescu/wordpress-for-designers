# `wp wfd`

The WP-CLI command an agent harness runs. It is registered with `WP_CLI::add_command( 'wfd', … )` only when WordPress runs under WP-CLI. It has four subcommands and no others. `[U]` for the command and for its two jobs, telling an agent what it can do and carrying its calls (D68); `[N]` for every name, flag and output below unless a line says otherwise.

Every subcommand first sets `wfd_agent_seen` (`relay.md`, Session). Every subcommand prints one JSON document to standard output, except `tools` in its default format. Nothing else is printed to standard output. The exit code is 0 on success and 1 on failure.

## `wp wfd status`

Prints what an agent needs before it starts. It does not reach the board page.

```json
{
  "plugin": "the plugin's version",
  "boards": [ { "id": 12, "title": "Site map" } ],
  "hint": "No board is listening. Open a board in WordPress for Designers; if one is open, reload it once."
}
```

`boards` lists the listening boards (`relay.md`), each once however many pages show it, by id. `hint` is present only when `boards` is empty. Exit code 0 in both cases.

## `wp wfd tools [--format=<format>]`

Tells an agent what it can do.

- `--format=runbook`, the default: prints the runbook below as plain text, then the tool list.
- `--format=json`: prints the declarations (`surface.md`), exactly as `includes/agent-tools.json` holds them.

The runbook is this text, verbatim, passed through the `wfd_agent_runbook` filter before the tool list is added:

```text
# Working on a WordPress for Designers board

A board is a canvas of artboards. Each artboard shows one page, template, template part or pattern of this site with real blocks, at one device width. The designer has a board open in a browser and sees what you do as you do it.

How to work:
1. Run `wp wfd status`. If no board is listening, ask the designer to open one.
2. Run `wp wfd call board-get` to see the board's artboards, notes and selection.
3. Make changes with `wp wfd call <tool>`. Several changes that belong together go in one `wp wfd batch`.
4. Say what you changed and on which artboards.

Rules:
- Nothing you change is saved. Every change waits in Review, where the designer saves or discards it. Never offer to save.
- Blocks are changed in the artboard in edit. The block tools put the artboard in edit for you, and only one artboard is in edit at a time.
- Read a block with `blocks-get` before you change it. A block is named by its place, and the block at that place may have changed.
- A reference is a string that starts with `wfd-ref-`. Pass it wherever a tool takes an artboard, a block or a token. `board-get`, `blocks-get` and `styles-get` give the reference of everything they list.
- Templates and template parts have no draft. Tell the designer when a change to one will reach the live site once saved.
- If you change the site with other commands, run `wp wfd call board-refresh` afterwards so the board shows it.

Calling a tool:
  wp wfd call <tool> --<field>=<value> ...
  wp wfd call <tool> --input='<json object>'
A value that is valid JSON is read as JSON, so arrays and numbers can be passed as `--block='[0,2]'`. Anything else is read as a string.
The answer is one JSON object: {"ok":true,"result":...} or {"ok":false,"error":{"code":"...","message":"..."}}.
```

The tool list follows a blank line and the heading `# Tools`, with one entry per tool in declaration order, in this form:

```text
## board-select
Select artboards on the board and bring them into view.
Input:
- artboards (array, required)
```

One `- {field} ({type}, required)` or `- {field} ({type})` line per property of the tool's `input` schema, in schema order, `{type}` being the schema's `type` (the values joined by ` | ` when the schema has an `enum`). A tool with no fields has the line `Input: none` in place of the list.

## `wp wfd call <tool> [--<field>=<value>…] [--input=<json>] [--board=<id>] [--timeout=<seconds>]`

Runs one tool on a listening board and prints its envelope.

- The tool's input is the JSON object given as `--input`, with each `--<field>=<value>` set on top of it. A value that parses as JSON is used as parsed; any other value is used as a string. `--board`, `--timeout` and `--input` are the command's own and are never fields.
- `--ref=<reference>` is shorthand: the reference is put in the tool's `artboard` field when the tool has one, else in its `slug` field. A tool with neither fails with `invalid_args`.
- `--board` names the board to call when several are listening.
- `--timeout` is a whole number of seconds from 1 to 120. Default 30.
- The command checks the tool's name against the declarations and fails with `unknown_tool` without reaching the board. The input is checked in the page (`surface.md`).

Output: the envelope, `{"ok":true,"result":…}` with exit code 0, or `{"ok":false,"error":{"code":"…","message":"…"}}` with exit code 1. The relay's own failures use the same envelope.

## `wp wfd batch [--calls=<json>] [--board=<id>] [--timeout=<seconds>]`

Runs several calls in order, in one round trip.

- `--calls` is a JSON array of `{ "tool": "…", "input": { … } }`, 1 to 50 entries. Without `--calls` the array is read from standard input.
- The entries run in order on one board. After the first failure the rest are skipped (`relay.md`).

Output: `{"ok":true,"results":[ envelope, … ]}` with exit code 0 when every entry succeeded; `{"ok":false,"results":[ … ]}` with exit code 1 when one failed. A failure of the relay itself prints the single-envelope form of `wp wfd call`.
