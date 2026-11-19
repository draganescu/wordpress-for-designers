# Lock dialog

No image.

**State.** The user tried to enter edit on a page or pattern that another user is editing (first state), or another user took the lock while this user was editing it (second state).

**Source.** [U]

## Regions used (defined in README.md)

- Header
- Left panel, artboards by kind
- Canvas
- Right panel (artboard settings)

## Elements specific to this screen

| Element | Components and text | Behaviour |
|---|---|---|
| Dialog, first state | `AlertDialog`: title "This post is already being edited"; body "{user} is currently working on this post, which means you cannot make changes, unless you take over."; buttons "Cancel" (outline) and "Take over" (solid). {user} is the display name of the user holding the lock. | Cancel and Esc close the dialog; the artboard stays a Preview and selected. Take over takes the lock and enters edit. See `data-model.md`, Locks. |
| Dialog, second state | `AlertDialog`: title "Someone else has taken over this post"; body "{user} now has editing control of this post."; button "OK" (solid). | Shown after the artboard has left edit. OK and Esc close the dialog. Unsaved edits stay in Review. |

## Acceptance criteria

AC-EDIT-06
