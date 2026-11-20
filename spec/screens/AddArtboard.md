# New artboard 1: pick the kind in the inserter, then place

![New artboard 1: pick the kind from the menu, then place](images/AddArtboard.png)

**State.** The inserter is on, on its Templates tab; "Archive" under "New template for" was clicked and the pointer is over the board.

**Source.** [U] [D:AddArtboard]. The image shows the Add artboard menu that D63 removed: the kind is now picked from a New row of the inserter. The placement ghost is as drawn.

## Regions used (defined in README.md)

- Header (H2 on)
- Left panel, inserter
- Canvas
- Right panel, Styles

## Elements specific to this screen

| Element | Components and text | Behaviour |
|---|---|---|
| New rows | L12, in the Pages tab ("New page", and "New browser", D55), the Patterns tab ("New pattern") and the Templates tab ("New template for": "Archive", "Search results", "Page: 404", "Single item", "Custom", existing purposes omitted; "New": "New template part"). See `InserterPages.md`, `Library.md` and `InserterTemplates.md`. | Clicking a New row arms placement for that kind, and for a template that purpose. Clicking another New row arms that one instead. |
| Placement ghost | A dashed brand outline at the pointer, sized as the Desktop device at the current zoom, labelled "{Name} · {Kind} · Desktop" and "Click to place". | Click places the artboard there with device Desktop and enters edit (at the current zoom, or fitted first when below 30%, D37). Esc cancels. |

## Acceptance criteria

AC-NEW-01, AC-NEW-02, AC-NEW-03, AC-NEW-04
