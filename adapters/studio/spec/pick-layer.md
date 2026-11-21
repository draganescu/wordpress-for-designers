# The pick layer

How `plugin/pick-layer.js` makes artboards, blocks, notes and style tokens clickable for Studio's Annotate tool. `[A]` for the mechanism; `[V]` for the three behaviours of Studio, checked at commit `cad01762b`; `[N]` for every name and value.

## The three behaviours of Studio it leans on `[V]`

| # | Behaviour | Used for |
|---|---|---|
| S1 | When the designer turns Annotate on or off, or anything about the notes changes, Studio dispatches a `CustomEvent` named `__studio-inspector-command` on the page's `window`. Its `detail` is an object with a boolean `active`. A `detail` that has a string `clearSelection` is a different message and carries no `active`. | Knowing when Annotate is on |
| S2 | While active, Studio's inspector listens on the `document` in the capture phase. Hovering and clicking act on the event's target, the element under the pointer. It skips elements inside one that has the attribute `data-studio-inspector`, which are Studio's own. | Being what gets picked |
| S3 | For the element picked, the inspector records `#` plus the CSS-escaped `id` when the element has an `id`; the tag name; the class list; and up to 200 characters of the element's `innerText`. To place a note's marker again later it looks the selector up with `document.querySelector`, and it places markers again when the window gets a `resize` event. | Carrying the reference, a readable label and a marker that follows |

Nothing else about Studio is assumed. In particular the adapter does not read or write Studio's notes, does not log to Studio's console bridge, and does not use `data-studio-inspector`.

## Behaviour

**Listening.** From page load the script has one listener, for `__studio-inspector-command` on `window`. A `detail` that is missing, or has a string `clearSelection`, is ignored. Otherwise `detail.active === true` means on and anything else means off. An event that repeats the current state changes nothing.

**Turning on.** The script calls `window.wfdAgent.ready()`, then `setAnnotating( true )`, builds the layer from `targets()`, and subscribes with `subscribe`. If `window.wfdAgent` does not exist, it does nothing, now and on later events.

**The layer.** One container element, the last child of `document.body`:

- `id` `wfd-studio-pick-layer`; fixed to the window's four edges; `pointer-events: none`; `z-index: 2147483000`, which is above the board and below Studio's own overlay.
- One child `div` per target, in the order `targets()` gives them, so that a block lies above its artboard and an inner block above the block that holds it.

Each child:

| Property | Value |
|---|---|
| `id` | The target's `ref` |
| Position and size | The target's `rect`, as `position: absolute` in window pixels |
| `class` | Two classes at most, in this order: the target's `label`, then its `where`, each made lower-case with every run of characters other than letters and digits turned into one `-` and `-` trimmed from both ends. An empty result is left out. So a Heading in Home on Desktop gets `heading home-desktop`, and Studio's chat shows `div.heading.home-desktop`. |
| Text | `{label} · {where}`, then ` · {text}` when the target has text. With no `where`: `{label}`, then the text the same way. |
| Style | `pointer-events: auto`; the text takes no visible form: transparent colour, a font size of 1 px, `overflow: hidden`, not selectable. No background, border, outline or shadow: the highlight a designer sees is Studio's own. |

The container and its children carry no other attribute, and never `data-studio-inspector`.

**Keeping up.** When the subscription fires, the script brings the children in line with `targets()`: a child whose `ref` is still listed keeps its element and gets its new rectangle, classes and text; others are removed; new ones are added; the order is made the order of `targets()`. If any child was added, removed or moved by this, the script dispatches one `resize` event on `window`, so Studio places its markers again (S3). It dispatches at most one per animation frame, and none when nothing changed, so a `resize` it caused cannot start another. Whether something changed is judged from the targets' values (reference, rounded rectangle, classes, text), never from an element's style text, which the browser rewrites. Studio sends the command event again each time its notes change; those repeats rebuild nothing and dispatch nothing.

**Turning off.** The script removes the container, unsubscribes, and calls `setAnnotating( false )`.

## What the designer gets

- With Annotate on, moving over the board highlights the block under the pointer, in any artboard whose content is drawn, whether or not it is in edit. Over an artboard that is far out of view or not yet drawn, the whole artboard highlights. A click starts Studio's note for that thing.
- Rows of colours, font sizes and font families in the Styles panel, and notes on the board, are picked the same way.
- Everything else on the page (the header, the panels, dialogs) is picked by Studio as on any page, with an ordinary selector.
- A note's numbered marker stays on its block while the board moves or the artboard changes tier, for as long as the block's path is the same. If the block moves to another path, or the artboard leaves the board, the reference no longer resolves and Studio treats the note as off the page, as it does for any element that is gone.
- The board does not react to the clicks: Studio's inspector takes them before the page does, and the layer is not part of the board.

## Known limits `[N]`

- The reference names a place in an artboard, not a block's identity (`../../../spec/agent/surface.md`, Block paths). The runbook tells the agent to read the block before changing it.
- Studio's area selection and drawing tools work over the layer as over any page, and their notes carry no reference.
- If a future Studio stops doing S1, S2 or S3, the layer stops working without an error. `studio-check.md` is how that is found.
