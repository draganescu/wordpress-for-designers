# Decisions, 21 November 2026

This file closes the research. Files 01 to 06 and `sources.md` are findings and stand as written. Files 07 to 09 and the "Direction" section of the README are proposals from before the decisions below, and where they differ from this file they are superseded. The binding text is in `spec/`, from decision D65 on, and in `adapters/studio/`; this folder specifies nothing.

| Decided | Where it is specified |
|---|---|
| The spec opens to an agent surface, in the main plugin | `spec/decisions.md` D65, `spec/agent/` |
| One uniform surface; an adapter per harness, distributed separately, holding no tools | D66, `adapters/` |
| Nothing changes in Studio. The route where Studio's inspector asks the page (option 1 of `08-annotation.md`) is parked | D67 |
| The relay: `wp wfd`, a queue, the board polling | D68, `spec/agent/relay.md`, `spec/agent/cli.md` |
| The queue lives in options, with cleanup by WP-Cron | D69 |
| The agent changes blocks only in the artboard in edit | D70 |
| Anything can be annotated in any state; a block's path comes from the rendered artboard | D71, `spec/agent/surface.md` |
| The agent can do what the UI can, global styles included, through a closed and minimal list of tools | D72, `spec/agent/tools.md` |
| Changes show as if the designer made them, with marks for the agent | D73 |
| Tools are shaped for WebMCP from the first day; WebMCP, abilities and the MCP Adapter come later as ways in | D74 |
| Annotation comes through the harness only; no inbox or annotate mode of the board's own | D75 |
| A site no agent has used pays nothing | D76, C27 |

What replaced what:

- `08-annotation.md` chose option 1. The built route is the pick layer of `adapters/studio/spec/pick-layer.md`, which needs nothing from Studio.
- `09-packaging.md` proposed a companion plugin holding the agent module. The module is in the main plugin; the separate plugins are the adapters.
- `07-buildables.md` sketched tool names and `wp wfd` subcommands. The names and shapes that count are in `spec/agent/tools.md` and `spec/agent/cli.md`.

Design artefacts: the whiteboard "Agent on a board" (https://claude.ai/artifact/LjApsWvjT8TbmqfPSNMqyf), the parked route (https://claude.ai/artifact/KArmaAgayC2QcFjgrVB2Rh), and the mockups of a designer's session (https://claude.ai/artifact/18RDmyJeZxkgvddAR73Att).

## Pick layer, first check by hand (21 November 2026)

A throwaway version of the pick layer, pasted into the console of the board page in Studio's preview, was tried by the product owner with Annotate on. Three things held, read from Studio's own console bridge:

- The page heard `__studio-inspector-command` and the layer turned on and off with Annotate.
- A click on an Image block inside a page artboard was picked as the layer's element, with the selector `#wfd-ref-a_{artboard id}_b_1_0_3_0_0`.
- Studio recorded the element's classes (`image`, `page-desktop`) and its text ("Image · page-desktop · " and the block's caption) as the note's label and nearby text.

The product owner then reported that the rest works as well: the agent receives the selector, a marker follows its block when the board moves, the board ignores clicks while Annotate is on, and the same block gives the same selector in a preview and in the artboard in edit. This was one board on one machine with a throwaway script; the built adapter is still checked with `adapters/studio/spec/studio-check.md`. One thing learned for the build: Studio sends the command event again on every change to its notes, and a layer that reports a change when nothing moved makes Studio recompute its markers in a loop, so the layer must compare rectangles by value (`adapters/studio/spec/pick-layer.md`, Keeping up).
