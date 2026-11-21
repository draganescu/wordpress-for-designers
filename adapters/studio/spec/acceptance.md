# Acceptance criteria

Each criterion is one end-to-end test whose title starts with its ID, in `tests/studio.spec.ts` of this folder. The tests run in the main plugin's test environment with the adapter added as a second plugin, on the main plugin's fixture. `[N]`

Studio itself is not part of the tests. A stand-in does, in the test's page, what `pick-layer.md` says Studio does, and no more:

- it dispatches `__studio-inspector-command` on `window` with a `detail` of `{ active, tool: "select", notes: [], editingId: null }`;
- while active it listens for `click` on `document` in the capture phase, stops the event, and takes the event's target;
- for that element it returns `#` plus `CSS.escape( id )` when it has an `id`, otherwise `null`; its tag name; its class list; and the first 200 characters of its `innerText` with white space collapsed.

The stand-in is test code written from this description. `[V]` for the behaviours it stands for.

- AC-STUDIO-01 On a site where no `wp wfd` command has run, with the adapter active and Annotate never turned on, the board page has no element with the id `wfd-studio-pick-layer`, the agent chunk is not requested, and no request goes to `wfd/v1/agent`. `[U]`
- AC-STUDIO-02 After a command with `active: true`, the layer exists, the header chip G1 reads "Annotating", and the layer has one child for each entry of `targets()`, with that entry's `ref` as its `id`. `[U]`
- AC-STUDIO-03 A click on a Heading inside a page artboard that is not in edit is picked by the stand-in as an element whose selector is `#` plus a block reference. `wp wfd call blocks-get --ref=` with that selector returns a `core/heading` whose text is the heading clicked. `[U]`
- AC-STUDIO-04 The same click in the artboard in edit gives a reference that `blocks-get` resolves to the block clicked. `[U]`
- AC-STUDIO-05 A click on an artboard whose tier is Ghost gives an artboard reference; a click on a note gives a note reference; with the Tokens tab shown, a click on a colour row gives a token reference that `token-show-uses --ref=` accepts. `[U]`
- AC-STUDIO-06 A picked block's element has at most two classes, made from its label and its place as `pick-layer.md` says, and its text starts with `{label} · {where}`. `[N]`
- AC-STUDIO-07 A click on a header control of the board is picked as that control, with no reference: the layer does not cover the board's own interface. `[U]`
- AC-STUDIO-08 After the board is panned, every child's rectangle matches `targets()` again and one `resize` event was dispatched; when nothing changed, none is. `[N]`
- AC-STUDIO-09 While the layer is on, clicking and dragging on it changes nothing on the board: the selection, the artboard in edit, the layout and Review are as they were. `[U]`
- AC-STUDIO-10 After a command with `active: false`, the layer is gone and G1 no longer reads "Annotating". With the main plugin deactivated, the adapter adds nothing to any page and WordPress shows no notice or error. `[U]`
- AC-STUDIO-11 `wp wfd tools` prints the runbook section of `adapter.md`, verbatim, after the main plugin's text and before `# Tools`. `[U]`
