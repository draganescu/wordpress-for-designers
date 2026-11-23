# The Studio adapter

A WordPress plugin installed on a site that also has WordPress for Designers, for designers who open that site in WordPress Studio. `[U]` for an adapter per harness that carries what makes that harness work with the uniform surface (D66), and for using Studio exactly as it is (D67). `[N]` for names and wording, unless a line says otherwise. Tags are those of `../../../spec/sources.md`; `[V]` here means checked in Studio's repository at commit `cad01762b`.

## What Studio gives, unchanged `[V]`

- Studio's agent, Studio Code, works on a site by running `wp` commands. It reads no skill, instruction file or plugin from the site. It does read the user's global instructions, a text the user sets in Studio.
- Studio's desktop app shows the site in a preview and has an Annotate tool. With it on, the designer clicks an element of the page, writes a note, and sends the notes to the agent with a message.
- For each note the agent receives the clicked element's selector, its tag, and up to 200 characters of its text. An element that has an `id` gets the selector `#` followed by that id.
- The chat shows each note with a label made of the element's tag and its first two classes, for example `div.heading.home-desktop`.
- Studio's inspector works in the page it is injected into and cannot reach inside the iframes a board draws its artboards in. Left alone, a click on an artboard lands on the frame around it and says nothing about the block under the pointer.

## What the adapter does `[U]` `[A]`

Two things, and nothing else.

1. **It makes the board's contents clickable for Studio's Annotate.** While Annotate is on, the adapter lays an invisible element over each thing the agent surface lists as a target: each artboard, each block, each note, each style token. The element's `id` is the target's reference. Studio's inspector picks that element like any other, records the `id` as the selector, and the reference reaches the agent untouched. This is the pick layer, `pick-layer.md`.
2. **It tells the agent what such a selector is.** It adds one section to the runbook that `wp wfd tools` prints, through the main plugin's `wfd_agent_runbook` filter.

The runbook section is this text, verbatim, added after the main plugin's text with one blank line between:

```text
Annotations from Studio:
- When the designer annotates a board with Studio's Annotate tool, the selector of an annotation on an artboard, a block, a note or a style token is a reference: `#wfd-ref-` and more. Pass it to a tool with `--ref`.
- The text that comes with it starts with what the thing is and where, for example "Heading · Home · Desktop", then what it reads.
- Read the block with `blocks-get --ref=<reference>` before changing it.
- A selector that does not start with `#wfd-ref-` is on the board's own interface or on a normal page of the site, and is handled as Studio always handles one.
```

## What the user does once

Studio Code learns about `wp wfd` from the user's global instructions, which only the user can set. The adapter's `readme.txt` gives this line, verbatim, for the user to add to Studio's global instructions:

```text
On a site that has the WordPress for Designers plugin, when a task is about a board, an artboard or the Designer screen, run `wp wfd tools` first and follow what it prints.
```

The adapter does not write this anywhere itself (`CLAUDE.md`, rule 5).

## The plugin

| File | Holds |
|---|---|
| `plugin/wfd-studio.php` | The plugin header (name "WordPress for Designers: Studio adapter", text domain `wfd-studio`, the main plugin's WordPress and PHP minimums), the `wfd_board_enqueue_assets` action that enqueues `pick-layer.js` on the board page, and the `wfd_agent_runbook` filter. |
| `plugin/pick-layer.js` | The pick layer. A plain script with no imports. |
| `plugin/readme.txt` | What the adapter is, that it needs WordPress for Designers and WordPress Studio, and the line above. |

- The adapter's version is the main plugin's version it was built with.
- If the main plugin is not active, or is a version without the agent surface, neither hook fires and the adapter does nothing. It checks nothing itself and shows nothing.
- It is packaged as `wfd-studio.zip`, holding one folder `wfd-studio/` with the three files, by a script `package.sh` in this folder. It is never part of the main plugin's package.

## Rules

| ID | Rule | Reason | Check |
|---|---|---|---|
| SC1 | The adapter uses only `window.wfdAgent` and the two hooks of `../../../spec/agent/surface.md`, For adapters. It reads no store, element or global of the main plugin's. | D66: one public surface. | AC-STUDIO-10 |
| SC2 | It leans on three behaviours of Studio and on no other: the command event and its `active` field, the selector of an element with an `id`, and the inspector picking the element under the pointer. | D67. These are not promised by Studio, so they are kept few and are checked with every Studio release (`studio-check.md`). | `pick-layer.md` |
| SC3 | Outside an Annotate session the adapter adds nothing to the page: no element, no listener other than the one for the command event, no request, and it does not load the agent surface. | C27 of the main plugin. | AC-STUDIO-01 |
| SC4 | It never changes the board: it calls no tool. | D66: adapters hold no tools. | AC-STUDIO-09 |
| SC5 | Annotation in Studio's browser app and in Studio Cloud, which have no Annotate tool, is not served. | D75 of the main plugin: no annotate mode of the board's own. | None |
