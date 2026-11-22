# Agent surface

The part of the plugin that lets an agent work on an open board. It has two jobs: making a change, with the tools of `tools.md`, and showing the change to the designer. Everything that connects an agent to it (the relay and `wp wfd` in this plugin, a harness adapter, a later WebMCP layer) is a way in and holds no tools of its own. `[U]` (D65, D66, D73)

`[N]` applies to every name, value and string in this file unless a line says otherwise.

## Parts

| Part | Where | Responsibility | Source |
|---|---|---|---|
| Declarations | `includes/agent-tools.json` | The one list of tools: `name`, `description`, `input` schema. Read by PHP and imported by the client. | `[U]` (D74) |
| `agent` | `src/agent/`, built as a chunk of its own that the board loads on demand | The tool functions, the reference resolver, authorship, the marks, the relay client, and the page interface. | `[U]` `[A]` |
| Stub | In the board's main script | `window.wfdAgent.ready()`, and the check for a session (`relay.md`). Nothing else of the surface is in the main script. | `[U]` (C27) |
| Relay routes and queue | `includes/agent.php` | `relay.md` | `[U]` (D68, D69) |
| `wp wfd` | `includes/agent-cli.php`, loaded only under WP-CLI | `cli.md` | `[U]` |

`src/agent/` and the two PHP files can be deleted together, with the stub, the declarations file and the four seams below, and the plugin works as it did before D65.

## Declarations

`includes/agent-tools.json` is an array with one object per tool of `tools.md`, in that file's order:

```json
{ "name": "board-get", "description": "Read the open board: …", "input": { "type": "object", "properties": {}, "additionalProperties": false } }
```

The client pairs each entry with its function by name. A build fails if an entry has no function or a function has no entry. Inputs are checked against `input` before a function runs, in the page, whatever the way in; a mismatch is `invalid_args`. The check covers what the schemas of `tools.md` use: types, `required`, `enum`, `additionalProperties`, array `minItems`, integer `minimum` and `maximum`, and string `pattern`. No schema library is added (C25).

This is the shape `document.modelContext` registers (`name`, `description`, `inputSchema`, a function), so a WebMCP layer can register the same entries without changing a tool. Registering them is not built (D74).

## Loading

- The agent chunk is requested the first time one of these happens, and never before: the session check finds an active session (`relay.md`), or something calls `window.wfdAgent.ready()`. `[U]` (C27)
- `window.wfdAgent` exists on every board page as `{ ready }`. `ready()` returns a promise of the interface below and always the same one.
- Once loaded the surface stays loaded until the page unloads.

## Page interface

What `ready()` resolves to. It is the public interface of the surface for scripts on the board page: a harness adapter uses it, and nothing else of the plugin's client is public.

| Member | Type | Meaning |
|---|---|---|
| `version` | `1` | Raised when a member changes meaning |
| `tools` | array | The declarations |
| `call( name, input )` | promise of an envelope | Runs one tool. Resolves, never rejects, to `{ "ok": true, "result": … }` or `{ "ok": false, "error": { "code", "message" } }` |
| `targets()` | array of target | What can be pointed at right now (Targets) |
| `subscribe( listener )` | function that unsubscribes | `listener()` is called, at most once per animation frame, when the result of `targets()` may have changed |
| `setAnnotating( isOn )` | nothing | Tells the board a harness is collecting annotations. While on, the header chip reads "Annotating" (Marks) |

A call made through `call` and a call that arrives through the relay run the same code: the same checks, the same authorship and the same marks (C31).

Calls run one at a time, in the order they arrive. A call that arrives while another runs waits for it.

## References

A reference is a string that names one thing on a board. Tools take it wherever they take an artboard, a path, a token or a note, and `board-get`, `blocks-get` and `styles-get` give one for each thing they list. It is made only of letters, digits, `-` and `_`, so it can be an element's `id`. Tools take it in their `artboard`, `artboards` and `slug` fields. `[U]` for one handle shared by chat asks and annotations (D71); `[N]` for the grammar

| Names | Form | Example |
|---|---|---|
| An artboard | `wfd-ref-a_{artboard id}` | `wfd-ref-a_3f2c…` |
| A block | `wfd-ref-a_{artboard id}_b_{path, indexes joined by _}` | `wfd-ref-a_3f2c…_b_0_2` |
| A note | `wfd-ref-n_{note id}` | |
| A token | `wfd-ref-t_{kind}_{slug}`, kind `color`, `font-size` or `font-family` | `wfd-ref-t_color_ember` |

A leading `#` is ignored, because a harness may hand the string over as a selector. A string that does not parse is `invalid_args`; one that parses and names nothing on the open board is `not_found`. A reference holds no board id: it is read against the board the call runs on.

## Block paths

A path is an array of zero-based indexes into the block tree an artboard renders: the first index picks a top-level block, each further index picks one of the previous block's inner blocks. `[]` is the artboard's top level. `[U]` for the path being worked out from what is rendered (D71)

- In the artboard in edit the tree is the block editor's own, read block by block: the top level is `getBlocks()` of that editor's `core/block-editor` store, and a block's inner blocks are `getBlocks( clientId )` for that block. The `innerBlocks` field is not used, because a block that controls its inner blocks (a template part, Content around a page) has it empty in its parent's list. Read this way the tree includes what the editor renders around and inside the entity: the template around a page, the blocks of a template part or synced pattern, and a page's content inside Content. `[V]` by Milestone 13, spike (a)
- In an artboard that is not in edit the tree is read from what is drawn: in the document of a Preview, a Snapshot or a warm editor, a block is an element with a `data-block` attribute and a `data-type` attribute that is not a preview copy, its inner blocks are the blocks whose nearest block ancestor it is, and their order is document order. Nothing is read from the entity's markup for this.
- A preview copy is an element that a block draws to show something and not to edit it: the copies of its inner blocks that a Post Template draws for each post and a Comment Template for each comment, and a post's own content drawn read-only inside a Query Loop. A preview copy is not a block, and neither is any `data-block` element inside it (D79). It has no path, no reference and no target, and it does not count as a sibling when indexes are counted. The blocks a Post Template or Comment Template really holds are in the tree once, whatever number of posts or comments is drawn, and are the ones drawn outside any copy.
- An element with `data-block` and no `data-type` is not a block either. In edit and in a warm editor the block editor draws its block appender this way, inside a block that takes inner blocks. Like a preview copy it has no path, no reference and no target, and it does not count as a sibling. `[V]` by Milestone 13, spike (a), second run
- Preview copies are told from blocks by the document alone, in every tier. WordPress draws them with its block preview, which leaves marks on them: it makes them inert, and in edit they repeat the `data-block` ids of the blocks they copy. Which marks the rule uses is the builder's to settle (`CLAUDE.md`, rule 2); what it must achieve is the next line.
- The two give the same tree: the same paths, with the same block names, in the same order, for every artboard. Milestone 13 proves it before anything is built on it (`build-order.md`), on the fixture and on the cases the fixture lacks.
- A path names a place, not a block's identity. An agent that holds a path from earlier reads the block again with `blocks-get` before changing it.

## Targets

`targets()` returns one object for each thing that can be pointed at and is at least partly inside the canvas area or the Styles panel:

```json
{
  "ref": "wfd-ref-a_3f2c…_b_0_2",
  "kind": "artboard | block | note | token",
  "rect": { "x": 512, "y": 240, "width": 380, "height": 64 },
  "label": "Heading",
  "where": "Home · Desktop",
  "text": "Tomorrow tastes better."
}
```

| Kind | Which | `label` | `where` | `text` |
|---|---|---|---|---|
| `artboard` | Every artboard, media object and browser on the board, in any tier | Its name | `{Kind} · {Device}`, as in A1 without the name | Empty |
| `block` | Every block of every artboard whose document is mounted (Live, warm, Preview, Snapshot), found as Block paths says. A preview copy is not listed; the pointer over one is over the target of the nearest block around it | The block type's title | `{artboard name} · {Device}` | The block's text, at most 200 characters |
| `note` | Every note | "Note" | Empty | Its first line |
| `token` | Each colour, font-size and font-family row of the Tokens tab, while that tab is shown | The token's name | "Styles" | Its value |

`rect` is in CSS pixels of the board page's window, after the board's zoom and pan and any scrolling inside a browser or an artboard. A block's rect is clipped to its artboard's frame; a block left with no area is not listed. Targets are ordered so that a thing comes after what contains it: artboards, then their blocks from the outside in, then notes, then tokens. Ghost artboards have a target and no block targets (C16 is not affected: nothing is counted from this).

Reading targets changes nothing on the board and mounts nothing.

## Seams

The surface reaches the rest of the client through four seams and nowhere else. Each is one small export of an existing part, added for the surface and used by it alone. `[A]`

| Seam | Part | What the surface gets |
|---|---|---|
| The editor in edit | `artboard-editor`, `shell` | The Live editor's bridge, which already gives the shell that editor's registry, and the shell's own functions for entering and leaving edit. Block tools use the registry's `core/block-editor` store. |
| Board actions | `shell`, `inserter`, `styles`, `review` | The functions the controls named in `tools.md` call: opening a row on the board, placing a new artboard, removing artboards, changing a token, a style and the variation, selecting a token for its uses, and discarding a Review item. A tool calls the function; it does not repeat what the function does. |
| Element rectangles | `artboard-frame` | For an artboard, its frame element and the document it currently draws, for Targets and Block paths. |
| Mark slots | `shell`, `artboard-frame`, `review` | The three places a mark is drawn (Marks), each taking what to show from the surface. With the surface not loaded they show nothing. |

## Authorship

The surface records who made each unsaved change, for `changed` in `board-get`, `author` in `review-list` and the marks. `[U]` for showing who changed what (D73)

- The unit is a Review item: an entity record with unsaved edits, or a new template or part.
- An item is the agent's when its edits changed during a tool call. It is the designer's when its edits changed at any other time. An item both have changed is `both`.
- One case is added to "during a tool call" (D81): a block that a tool has just changed can go on changing itself for a moment, as an inserted block does when it is first drawn. A change to an item within one second after a tool that changed that item has ended is the agent's, unless the designer has pressed a key or a pointer button in that artboard or in its chrome since the tool ended. From the designer's first such input the second is over. It never follows a tool that changed nothing, such as `blocks-get` or `artboard-edit`. `[U]` for the rule, `[N]` for the second
- An item that is saved or discarded is forgotten. Undoing a change does not change who is recorded.
- The record is kept in the page and lasts as long as the unsaved edits do, which is until the page unloads.

## Marks

What the designer sees of the agent. The change itself is shown by the board as any change is (D73); these say that an agent is there and what it touched. They are drawn outside the editing canvas (C6) and built from the design system (C4). Screens: `screens/AgentConnected.md`, `screens/AgentWorking.md`, `screens/AgentReview.md`. `[U]` for there being marks and their not depending on the way in (C31); `[A]` `[D:AgentConnected]` `[D:AgentWorking]` `[D:AgentReview]` for which ones

| ID | Mark | Component and text | When |
|---|---|---|---|
| G1 | Header chip | `Badge` in the header, just before H12. "Agent connected"; "Agent working"; "Annotating" | "Agent working" while a call runs and for one second after the last one ends. Otherwise "Annotating" while `setAnnotating` is on. Otherwise "Agent connected" while a session is active (`relay.md`). Otherwise not shown |
| G2 | Working artboard | "· Agent working" at the end of the artboard's label (A1, A2), and a dashed outline around the artboard: `--wpds-border-width-sm` dashed `--wpds-color-stroke-interactive-brand` | On each artboard a running call names, from when the call starts until one second after it ends |
| G3 | Changed artboard | "· Changed by agent" at the end of the label | On each artboard whose entity has unsaved changes recorded as `agent` or `both`. Not shown while G2 is, or while the Review drawer adds "· Changed" |
| G4 | Review author | `Badge` after the item name on its Review card: "Agent"; "Agent and you" | On items recorded as `agent`, and as `both`. Items recorded as the designer's have none |

For tests, G1 has `data-wfd-agent` with the value `connected`, `working` or `annotating`; an artboard frame has `data-wfd-agent-working="true"` while G2 shows and `data-wfd-agent-changed="true"` while its entity is recorded as `agent` or `both`.

The strings are translated like every other string of the plugin (C23).

## For adapters

Two PHP hooks let a separate plugin attach to the board page and to the runbook. They are the whole server-side interface for adapters.

| Hook | Kind | When and what |
|---|---|---|
| `wfd_board_enqueue_assets` | action, argument: the board's id | Fired on the board app page after the board's own script is enqueued. An adapter enqueues its script here. |
| `wfd_agent_runbook` | filter, argument: the runbook text | Applied to the text `wp wfd tools` prints before the tool list (`cli.md`). An adapter appends its own section. |

Nothing in this plugin names a harness or holds code for one (C32).
