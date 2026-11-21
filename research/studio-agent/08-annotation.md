# Annotation: pointing at a board for the agent

> Superseded in part by `10-decisions.md` (21 November 2026). The binding text is in `spec/` from D65 on.

Added 2026-11-21. The product owner's model has two ways to work with the agent:

1. **Chat.** A message in Studio's chat, for general or large requests: make a new page, add a single template for the "jamaica" tag.
2. **Annotation.** A tool that selects anything on the board, an artboard or something inside one, keeps a reference to what was clicked, and sends it with a message, so the agent and the `wp wfd` tools know where to make the change.

An earlier idea, notes addressed to the agent with their position as the target, is dropped: position between artboards says nothing a person can read. Board notes stay what they are.

Studio already has an annotation tool. This file records how it works (`[repo]`, Studio at `trunk` `cad01762b`) and what reusing it for a board takes (`[inf]`).

## Studio's annotation tool

### Where it runs

- **Desktop preview.** The `site` surface is an Electron `<webview>`. After each load Studio evaluates `INSPECTOR_PAGE_SCRIPT` in it with `executeJavaScript()` (`apps/ui/src/features/sites/site-preview/preview-surface/webview-surface.tsx`). The front end and wp-admin share that surface, so the tool works on admin pages too.
- **CLI and outside agents.** `open_annotation_browser` opens a headed Playwright browser, injects the same script, and waits until the user presses Send (`packages/agent/node/inspector/inspector-inject.ts`, the `annotate` skill).
- **Not in a browser.** In `studio ui` and Studio Cloud the preview is a cross-origin iframe, the connector's `annotatePreview` is false and Annotate is hidden.
- **Two surfaces Studio renders itself**, the design system page and the email view, do their own picking and produce the same records with their own target (`designToken`, `email`) and a `targetKey`.

### The split between page and host

`packages/agent/protocol/inspector/page-script.ts`, from its header:

- The page script handles geometry only: the hover highlight, picking, and the numbered markers.
- The host draws the note editor and keeps the note text and pasted images.
- Host to page: a `__studio-inspector-command` custom event on `window`, whose detail is the whole annotation state (`active`, `tool`, `notes`, `editingId`, colours, `busy`).
- Page to host: `console.log( '__studio-inspector__:' + JSON )`, read from the webview's `console-message` events. Event types: `pick`, `selection`, `annotation-tool`, `edit`, `anchor`, `escape`, `browser-command`.
- Elements with a `data-studio-inspector` attribute are the host's own UI and are ignored.

### Tools

Select (click an element), area (drag a rectangle), draw (pen strokes). Each has a keyboard shortcut. While active the script takes every click in the capture phase and stops it from reaching the page.

### What a pick records

`metadata( el, event )` builds a `VisualAnnotationTarget`:

| Field | Value |
|---|---|
| `selector` | `#id`, or up to six ancestors as `tag.class.class:nth-of-type(n)` |
| `tag`, `classes` | The element's tag and up to ten classes |
| `nearbyText` | The element's text, 200 characters |
| `url`, `path` | The page |
| `viewport`, `documentRect`, `point` | Window size, the element's box, where the click landed inside it |
| `computedStyles` | Twelve properties: colour, background, font, line height, padding, margin, border, display, width, height |

Area and drawing targets carry a rectangle or strokes and no element.

### From pick to agent

- Notes are numbered, staged in the composer, and sent with the next message. Each becomes its own bubble in the transcript, with its images (`apps/ui/src/features/annotations/submission.ts`).
- `formatVisualAnnotationsPrompt` (`packages/agent/protocol/visual-annotations.ts`) turns them into the agent's text: for each, the element, the page, the comment, the selector, the viewport, the styles. It tells the agent to address them in order and to name elements by what is visible.
- The `annotate` skill tells the agent to find the element "from the annotation's selector, nearby text and `wp-block-*` classes, which name its block type", then change the site through `edit-manage-site`.
- Limits: 100 annotations a message, 10,000 characters a comment.

So the tool can select anything in the main document of whatever the preview shows, and what it hands over is a description of a DOM element. The agent works back from that description to a file or a post.

## On a board today

| Clicked | What happens | Why |
|---|---|---|
| A Preview or Snapshot artboard | The pick lands on the artboard's frame element in the board's document | Their iframes take no pointer input; the board handles selection on the frame |
| Something inside the Live artboard | Nothing is picked | The editor canvas is an iframe. The script runs in the main frame and never sees events inside it |
| A browser artboard being browsed | Nothing is picked | Same |
| A note, a panel row, a token | Picked as a wp-admin element | They are in the main document |

And the record is the wrong kind. A selector such as `div.wfd-artboard:nth-of-type(3)` in an admin page tells the agent nothing it can act on. The selector builder reads ids and classes only, so the board's own `data-wfd-artboard`, `data-wfd-kind`, `data-wfd-device` and `data-wfd-note` attributes are lost.

## What the board knows that the inspector doesn't

- Every artboard frame carries its id, kind and device as data attributes; the store maps the id to the entity.
- Inside an editor canvas each block element carries `data-block` (its clientId) and `data-type`.
- The board can reach into its own artboard iframes. They are same-origin and it already forwards wheel, key and touch events from them.
- It knows the token rows in Styles, the notes, and which artboard is in edit.

## Reuse: what to keep, what the board supplies

Keep from Studio:

- The host side: note editor, image paste, numbered markers, staging in the composer, one bubble per note, Send.
- The record type. `VisualAnnotationTarget` already has targets that are not DOM elements (`designToken`, `email`) with a `targetKey`, added for the two surfaces Studio renders itself. A board target follows that pattern.
- The prompt builder, with a branch for board targets as there is one for the design system and for email.

Supplied by the board:

- **Picking.** While annotation is on, the board does the hit test: an artboard, a block inside any mounted artboard, a note, a token. It draws the highlight with its own selection language.
- **The reference**, in place of a selector:

```json
{
  "board": 12,
  "artboard": "a1f0…",
  "entity": { "kind": "page", "id": 7, "title": "Home" },
  "device": "desktop",
  "block": { "name": "core/heading", "path": [0, 1], "clientId": "…", "text": "Tomorrow tastes better." }
}
```

`block` is absent for an artboard-level pick. `clientId` is valid for as long as the page lives, which is enough when the tool call that follows runs in that same page through the relay (07, section 3). `path` and `text` let the reference be resolved again after a reload, and for artboards that are not Live, whose preview blocks have clientIds of their own.

- **The same reference in tool calls.** `wp wfd call block-update-text --ref=<annotation id>` or the fields above. The annotation is where the agent gets its target; it never searches by selector.

## How the two meet

Three shapes, cheapest first.

1. **The page answers the inspector.** Studio's script stays the tool. On a pick it asks the page for a semantic target (a cancellable event the board answers with the reference and a rectangle), and the board, seeing annotation switch on, takes over hit testing inside its iframes. Small change on each side. Desktop only, because injection is.
2. **The board owns the tool and speaks Studio's protocol.** The board has its own annotate mode, entered from the agent chip, and emits records Studio's host accepts. Studio's Annotate button and the chip switch the same state. Needs the two message formats (command event, console bridge) to become a contract a plugin may use; today they are internal.
3. **The board owns the tool and the message, and the relay carries it.** A small popover on the board takes the message; the annotation goes to the server queue, where the agent reads it (`wp wfd annotations`). Works on every surface, a browser tab included, and without Studio's UI. Costs a second note editor, and something on the Studio side has to start a turn when an annotation arrives, which is new Studio code.

In all three, the tool belongs in or beside the "agent connected" chip, and is absent when no agent is connected.

## Open

- Whether one click picks the block under the pointer or the artboard, and how to get from one to the other (click again to go deeper, or a modifier). The Live artboard already has block selection; Preview artboards have none.
- Whether annotation should make an artboard Live.
- Several annotations before sending, as Studio allows, or one at a time.
- Area and drawing on a board: they produce a rectangle or strokes in screen space, which would need mapping to board units and the artboards underneath.
- Pan and zoom while annotating. Studio's script blocks scrolling only during a gesture or with a pending selection.
