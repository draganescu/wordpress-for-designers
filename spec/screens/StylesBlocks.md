# Styles: Blocks tab

![Styles: Blocks tab](images/StylesBlocks.png)

**State.** Nothing selected, Blocks tab.

**Source.** [U] [B7]

## Regions used (defined in README.md)

- Header
- Left panel, artboards by kind
- Canvas
- Right panel, Styles

## Elements specific to this screen

| Element | Components and text | Behaviour |
|---|---|---|
| Blocks tab | `wpc.SearchControl` placeholder "Search blocks"; a row per registered block type that supports styles: `be.BlockIcon`, title, a brand-coloured "{n} changes" / "1 change" when the user styles differ from the theme for that block, `chevronRight`. Help `Text`: "Each block opens the same styles panel the Site Editor uses." | Choosing a row shows `gs.GlobalStylesUI` at that block's path. Its stock header has the block's title and a Back control, and the plugin adds neither; Back returns to the list (D58). If the stock screen throws, `ed.ErrorBoundary` shows its stock notice in its place; switching to another tab closes it, and the list is back on return (D60). |
| Element groups (D53) | Before the block rows, three groups with a heading-sm heading each: "Elements" with rows "Link", "Caption", "Citation"; "Headings" with "All headings", "Heading 1" to "Heading 6"; "Form controls" with "Input", "Select", "Button (element)". These are the titles of the stock screens in the bundled release of the stock package (D59). The block rows follow under the heading "Blocks". An element row is built like a block row: an icon for the element in `be.BlockIcon` (OQ-34), title, change count, `chevronRight`. | Choosing a row shows `gs.GlobalStylesUI` at `/blocks/elements/{element}`, as a block row does for a block. The search matches an element's title, its name and its group's title; a group with no match is not shown. `[U]` |

## Acceptance criteria

AC-STYLE-04, AC-STYLE-09
