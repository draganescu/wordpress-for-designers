# Acceptance criteria

Each criterion is one end-to-end test whose title starts with its ID, in `tests/abilities.spec.ts` of this folder. `[N]`

The tests run on a site of their own, as the Studio adapter's do: the main plugin, its test helper plugin and its test theme by path, the adapter's `plugin/` mapped as `wfd-abilities`, and the MCP Adapter plugin, version 0.7.2, from WordPress.org. The fixture is the main plugin's and the user is an administrator with an application password.

No agent product is part of the tests. A stand-in speaks MCP to `/wp-json/mcp/mcp-adapter-default-server` over HTTP with the application password, and does no more than a client must: it starts a session, lists what the default server's discovery tool returns, and runs an ability through its execute tool. The board is opened by the test in a Playwright page, which stands for the browser the agent controls. The stand-in is test code written from this description.

Unless a criterion says otherwise, `wfd/board-open` has run for the fixture board and that board is open in one page.

- AC-ABIL-01 The discovery tool lists 25 abilities in the category `wfd`: `wfd/boards-list`, `wfd/board-open`, `wfd/board-new`, `wfd/batch` and one `wfd/{name}` for each tool of `includes/agent-tools.json`. `[U]`
- AC-ABIL-02 For every tool, the ability's description equals the declaration's, and its input schema equals the declaration's `input` with `board` added. `[U]`
- AC-ABIL-03 With no board open, `wfd/boards-list` returns every board of the fixture with `listening` false and an address; opening that address in the page shows the board. With the board open, its `listening` is true. `[U]`
- AC-ABIL-04 `wfd/board-open` returns the board's entry and the guide of `abilities.md`, verbatim. A board opened after it shows G1 within 5 seconds of loading. For an id that is no board it fails with `not_found`. `[U]`
- AC-ABIL-05 `wfd/board-get` returns what `window.wfdAgent`'s `call( 'board-get', {} )` returns in the page. `[U]`
- AC-ABIL-06 `wfd/block-update` on a Heading of a page artboard changes its text in the page; the artboard shows G2 while the call runs, and the item is recorded as the agent's in `wfd/review-list`. `[U]`
- AC-ABIL-07 A tool ability whose input names an artboard that is not on the board fails with the code `not_found` and the tool's message. One whose input breaks the schema fails before any call is queued. `[U]`
- AC-ABIL-08 With no board open, a tool ability fails with `no_board` and the adapter's message in under 2 seconds. With two boards open it fails with `several_boards` and the adapter's message; with `board` it answers for the board named, and the page's input holds no `board`. `[U]`
- AC-ABIL-09 `wfd/batch` with three calls runs them in order and returns `ok` true with three envelopes. When the second fails, `ok` is false, the third is `skipped` and the first stays done. A call named `wfd/board-get` runs as `board-get`; one named `boards-list` fails with `unknown_tool`. `[U]`
- AC-ABIL-10 After every ability has been run once with valid input, nothing on the site is saved: the entities' saved content, global styles and the board's layout are as before, apart from what the board itself saves with no agent and the board `wfd/board-new` made. `[U]`
- AC-ABIL-11 On a site where no way in has been used, with the adapter active, `wfd/boards-list` leaves `wfd_agent_seen` absent and an open board sends no request to `wfd/v1/agent` in 30 seconds. `[U]`
- AC-ABIL-12 For a user without `edit_theme_options`, every ability is refused. With the main plugin deactivated, the discovery tool lists no ability in `wfd`, and WordPress shows no notice or error. `[U]`
- AC-ABIL-13 A call made through an ability has `"source": "abilities"` in its record, and `wfd_agent_sources` holds a time for `abilities`. `[U]`
- AC-ABIL-14 `wfd/board-new` with no input makes a board titled "Untitled board" and returns its entry and the guide; with `title` the board has that title. The new board is in `wfd/boards-list`, its address opens it in the page with no artboards, and the page shows G1 within 5 seconds of loading. `[U]`
