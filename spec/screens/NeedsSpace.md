# Designing needs more space

No image.

**State.** The window is narrower than 1180 px (D48). A board may be open behind the message, in any state, or not started yet.

**Source.** [U]

## Regions used (defined in README.md)

None. The message covers the whole window, the header included.

## Elements specific to this screen

| Element | Components and text | Behaviour |
|---|---|---|
| Surface | A `dialog` element shown as a modal, as large as the window, on the weak neutral surface. Named by the title and described by the text. | Everything else on the page is inert while it shows. Esc does not close it. It goes when the window is 1180 px wide or more. Keys do not reach the board; the browser's own shortcuts still work. |
| Message | `EmptyState` centred in the surface: the illustration as its visual, title "Designing needs more space", text "A board needs a wide window to lay out your designs. Make this one wider, turn your tablet sideways or move to a bigger screen, and your board will be right here." No actions. | Not interactive. |
| Illustration | A small window drawn with the brand stroke, holding three artboards on the brand surface, between a `chevronLeft` and a `chevronRight` icon in the brand colour. | In a loop: the window is too narrow and its artboards are squeezed, the chevrons push outwards twice, the window widens and the artboards get their room, then it narrows again. With "reduce motion" set it stays still in the narrow state. Hidden from assistive technology. |

## Acceptance criteria

AC-SHELL-10, AC-SHELL-11
