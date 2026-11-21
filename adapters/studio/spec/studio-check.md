# Check in WordPress Studio

Filled in by a person. The harness builds the adapter against a stand-in for Studio's inspector and cannot open the Studio app, so whether the pick layer works in the real one is checked by hand: once before the adapter is first released, and again with each new release of Studio, because the three behaviours it leans on (`pick-layer.md`) are not promised by Studio.

If a step fails, the adapter is not released. A failure of steps 2 to 6 is the blocker named in decision D67, and the place to go back to is the parked design (the whiteboard "Parked: the path that needs changes in Studio").

Set-up: a Studio site with WordPress for Designers and the adapter active, the demo site or any board with a page shown at two widths; the line of `adapter.md` added to Studio's global instructions; the board open in Studio's preview.

| # | Do | Pass when | Result | Studio version, date |
|---|---|---|---|---|
| 1 | Ask Studio Code, in chat, what is on the board. | It runs `wp wfd tools`, then `wp wfd status` and `board-get`, and names the board's artboards. The header shows "Agent connected". | | |
| 2 | Turn Annotate on. | The header reads "Annotating". | | |
| 3 | Move over a heading inside an artboard that is not in edit. | Studio's highlight frames the heading, not the whole artboard. | | |
| 4 | Click it and write a note. | Studio's note editor opens at the heading. The note's label in Studio reads like `div.heading.home-desktop`. | | |
| 5 | Pan the board with the note placed, then zoom. | The note's marker stays on the heading. | | |
| 6 | Send the note with "Make this shorter." | Studio Code runs a `wp wfd call` with `--ref=#wfd-ref-…`, the heading changes on the board at every width of that page, and the change waits in Review marked "Agent". | | |
| 7 | With Annotate on, click and drag on the board. | Nothing on the board is selected, moved or put in edit. | | |
| 8 | Annotate a colour row in the Styles panel and ask for a cooler colour. | The agent changes that colour and every artboard that uses it repaints. | | |
| 9 | Annotate a button in the board's header. | Studio records an ordinary selector and the agent treats it as a note about the interface. | | |
| 10 | Turn Annotate off. | The header no longer reads "Annotating" and the board works as before. | | |
