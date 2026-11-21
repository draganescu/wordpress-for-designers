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
| Element groups | None on this release line: the list has the block rows only, under no heading, and the image's element groups are not built (D80). | The search matches a block's title. `[U]` |

## Acceptance criteria

AC-STYLE-04, AC-STYLE-09
