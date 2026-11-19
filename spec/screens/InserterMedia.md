# Inserter: Media, while editing

![Inserter: Media, while editing](images/InserterMedia.png)

**State.** Inserter on, Media tab, Header in edit.

**Source.** [U]; the limit of 50 is [N]

## Regions used (defined in README.md)

- Header (H2 on, H6 present)
- Left panel, inserter
- Canvas
- Right panel, editing

## Elements specific to this screen

| Element | Components and text | Behaviour |
|---|---|---|
| Media tab | Group "Images" with count; rows: `image` icon, file name, second line "{width} × {height}". The 50 most recent images, filtered by search. `be.MediaUpload` behind a `Button` outline "Upload". Hint in edit: "Click or drag to insert as an Image block in {artboard name}."; with no artboard in edit: "Click or drag to the board to place it there." | In edit, a click inserts an Image block for that attachment at the insertion point and a drag inserts it where it is dropped in the artboard. With no artboard in edit, a click or a drag places the image on the board as a media object (D39). |

## Acceptance criteria

AC-INS-08
