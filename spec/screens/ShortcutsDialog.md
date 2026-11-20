# Keyboard shortcuts dialog

No image.

**State.** The "Keyboard shortcuts" control at the bottom left of the canvas area (A5) was pressed, or its shortcut was (D42). Any state of the board can be behind it, an artboard in edit included.

**Source.** [U]

## Regions used (defined in README.md)

- Header
- Left panel, artboards by kind
- Canvas
- Right panel

## Elements specific to this screen

| Element | Components and text | Behaviour |
|---|---|---|
| Dialog | `Dialog`: title "Keyboard shortcuts"; close button label "Close". | The close button, Esc and the dialog's own shortcut close it. Focus returns to where it was before the dialog opened: to A5 when the control opened it. Nothing behind it changes: selection, edit and hidden panels stay as they were. |
| Group heading | `Text` heading-sm: "On the board", then "While editing an artboard". | |
| Shortcut row | Two columns: the action as `Text`, then the keys, each key in its own `Badge`. Rows are given below. | Not interactive. |
| Note | `Text`, weak, under the second group: "The block editor's shortcuts work as usual." | |

In the keys, "Cmd/Ctrl" below is shown as "⌘" on a Mac and "Ctrl" elsewhere, and "Delete" as "Delete" on a Mac and "Backspace" elsewhere. The last row shows the keys for the platform only: "Ctrl + Option + H" on a Mac, "Shift + Alt + H" elsewhere. The other key names are shown as written.

"On the board":

| Action | Keys |
|---|---|
| Pan | Space + drag |
| Select artboards | Drag on empty board |
| Zoom | Cmd/Ctrl + scroll |
| Zoom in | Cmd/Ctrl + `+` |
| Zoom out | Cmd/Ctrl + `-` |
| Fit all artboards | Shift + 1 |
| Fit the selected artboards | Shift + 2 |
| Hide or show both side panels | Cmd/Ctrl + \ |
| Select the next artboard | Tab |
| Select the previous artboard | Shift + Tab |
| Edit the selected artboard | Enter |
| Rename the selected page or pattern | F2 |
| Move the selected artboards | Arrow keys |
| Move the selected artboards further | Shift + Arrow keys |
| Remove the selected artboards | Delete |
| Undo | Cmd/Ctrl + Z |
| Redo | Cmd/Ctrl + Shift + Z |
| Clear the selection | Esc |
| Keyboard shortcuts | Ctrl + Option + H on a Mac, Shift + Alt + H elsewhere |

"While editing an artboard":

| Action | Keys |
|---|---|
| Back to the board | Esc |

## Acceptance criteria

AC-KEY-04, AC-KEY-05
