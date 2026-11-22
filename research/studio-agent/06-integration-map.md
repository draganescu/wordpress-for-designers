# Integration map

How the pieces in files 01 to 05 can connect. These are options with their costs. The direction taken afterwards is in [07-buildables.md](07-buildables.md): route B's tools, carried to Studio by a relay through WP-CLI, which this map did not list.

## The premise

- Studio is optional. The plugin works on any WordPress 7.2 site. With Studio present, an agent can work on the board.
- Designers work locally, so the site, the agent and the browser share one machine. Nothing has to be public.
- A new site has little content, so the agent may create most of what ends up on a board.

## Two places an agent can act

| | Through the saved site | Through the open board |
|---|---|---|
| Channel | WP-CLI, files, REST, server abilities | Client abilities or WebMCP tools in the board page |
| Needs the board open | No | Yes, in a browser the agent can reach |
| Edits are | Saved at once; templates and parts are live | Unsaved, listed in Review |
| The designer sees | Nothing until reload | Each change as it happens |
| Selection as context | Unavailable | Available |
| Fits the Studio agent today | Yes, it is how it works | No channel exists |
| Reference | Block MCP, MCP Adapter | Paper, Pencil, the AI plugin's WebMCP, Agentic Editor |

Paper and Pencil are entirely the right-hand column. The Studio agent is entirely the left.

## Routes

### A. Board as data: the agent arranges boards from outside

The agent builds pages, patterns, templates and parts as it does now, then creates or updates a `wfd_board` whose layout references them: the homepage at three widths beside the header and footer, a board of the patterns it made, a browser artboard on the front page. The designer opens the board to review and continue.

- Needs: a server-side entry point with validation. A WP-CLI command, a REST call, or abilities such as "list boards", "get board", "add artboards" (names are placeholders).
- With abilities, the MCP Adapter exposes them over `wp mcp-adapter serve` for outside agents, and the Studio agent can run them through `wp_cli`.
- A Studio skill would carry the procedure: when to make a board, how to lay it out.
- Limits: layout races while a board is open (05, point 4). No view of the designer's selection. Templates and parts are written live.
- Closest to how the demo site is seeded today (`demo/plugin/wfd-demo`).

### B. Board as a live canvas: tools registered by the board page

The board registers tools that read and change what the page holds: the board (artboards, notes, selection, what is in edit), entities' blocks, global styles, and Review. Changes appear on the canvas as the agent makes them and wait in Review.

A possible vocabulary, mapped from the references `[inf]`:

| Step | Reference tools | Board equivalent |
|---|---|---|
| Orient | `get_basic_info`, `get_editor_state`, `get_selection` | Board title, artboards with kind, entity, device and position; selected ids; the artboard in edit; the selected block |
| Read | `get_tree_summary`, `batch_get`, `editor-get-document` | An entity's block outline; block types allowed at a position; patterns; templates |
| Tokens | `get_variables`, `set_variables` | Global styles presets with use counts; set a preset; switch variation |
| Write content | `write_html`, `batch_design`, `editor-insert-block` and the rest of the 14 | Insert, update, move, transform, remove blocks in an entity; insert a pattern. Block markup validated before it is applied |
| Write layout | `create_artboard`, `find_empty_space_on_canvas` | Add an artboard for an entity at a device; new page, pattern, template, part; move; tidy up; add a note; add a browser |
| See | `get_screenshot`, `snapshot_layout` | See route D |
| Claim | `start_working_on_nodes` | Some visible mark on the artboard; the post lock for pages and patterns |
| Finish | `editor-save`, Pencil's `save` | Leave everything in Review, or save named items |

How those tools reach an agent:

| Carrier | Reaches | Notes |
|---|---|---|
| WebMCP (`document.modelContext`) | Agent browsers: ChatGPT desktop's built-in browser, Gemini in Chrome; Playground's proxy | Draft API, Chromium only, origin trial or flag. Tools vanish on navigation. No Studio surface is an agent browser |
| Client abilities (`@wordpress/abilities`) | Anything in the page; a WebMCP bridge is a few lines over it, as Agentic Editor shows | Core since 7.0. One definition serves WebMCP, a Studio bridge and an in-page chat |
| Studio Desktop `<webview>` | The Studio agent | Studio already runs scripts in the preview for annotations. A similar bridge could list and call the page's abilities. Desktop only |
| A local socket from the page | The Studio agent on any surface, and outside agents through `studio mcp` | Playground MCP's design: the page connects out to a bridge on `127.0.0.1` with an origin check and a session token. Works where injection does not (`studio ui`, a normal browser tab) |
| Studio's Playwright Chromium | The Studio agent | The agent opens the board itself, signed in, and calls tools with `page.evaluate`. The designer does not see that page; its edits are unsaved in a tab nobody reviews, unless saved or handed over |

### C. Both, with a hand-off

Route A when no board is open, route B when one is. The agent asks the site whether a board page is connected and picks. This is how Paper behaves with Desktop closed (the chat starts, writes land when the app runs) and it needs a rule for the moment the designer opens a board mid-task.

### D. Seeing

The agent needs to look at what it made. Options that exist or nearly exist:

- **Front-end screenshots.** `take_screenshot` on the page's URL, as today. Shows saved content at Studio's viewports (1040, 390), which differ from the board's devices (1440, 780, 360).
- **Front end with unsaved changes.** The D57 preview layer renders a user's unsaved board changes on front-end requests. Studio's Chromium is the administrator; whether it can carry the nonce of the designer's open board page is untested.
- **The board itself in Studio's Chromium.** `take_screenshot` on the board URL, or a clip of one artboard's frame. Tiers apply: far artboards are Ghosts, small ones Snapshots, at most 12 Previews.
- **Measured layout without an image.** `inspect_design` on the front end; or a tool in the page that returns an artboard's rendered boxes, which is Pencil's `snapshot_layout`.
- **A capture by the host.** Electron can capture the `<webview>` (`capturePage`, already used for site thumbnails). Desktop only.

### E. Playground

- In Playground today: the proxy relays any WebMCP tool the board registers in wp-admin, beside `playground_execute_php`, `playground_request` and the file tools. An agent browser on the Playground page could build a site and arrange a board with no install. The README's Playground button is the entry.
- Studio on the web ran Studio Code in the page over Playground and is out of `trunk` (04). If it returns, the agent and the board share a browser tab, and `PlaygroundClient.callWebMCPTool()` is a ready channel from the agent to the board's tools.

## What each route asks of each side

| Route | In the plugin | In Studio | In neither |
|---|---|---|---|
| A | Server abilities or a WP-CLI command with layout validation; care for layout races | A skill; nothing else | MCP Adapter, if outside agents should reach it without Studio |
| B over WebMCP | Client abilities and a WebMCP registration in the board page | Nothing | An agent browser |
| B over a Studio bridge | Client abilities; for the socket variant, a bridge client | A bridge (webview or socket), tools gated on it, a skill, evals | |
| D | Possibly a layout-snapshot tool | Board-aware screenshot options | |

All of route B and the abilities in route A touch `spec/out-of-scope.md` (agent features) and `spec/api-allowlist.md` (`@wordpress/abilities`). A companion plugin that holds the agent surface would leave this plugin's scope as it is, at the cost of reaching into its store from outside.

## Questions for the UX explorations

1. **Where does the conversation live?** In Studio beside the preview, with the board in the preview pane; in the board's own shell (C6 keeps it out of artboards, C7 keeps the shell familiar); or in an outside agent app with the board in a browser. The board needs 1180 px.
2. **How does the designer point?** Selection on the board (artboards, a block, a note, a token), Studio's annotations, or naming things in text. Paper and Pencil use selection.
3. **What marks the agent's work while it happens?** An artboard being worked on, a block just changed, a queue of what is next. The lock dialog is the only existing language for "someone else is here".
4. **Is Review the approval step for agent edits?** It fits the references' "agent proposes, designer approves". It lists by entity; whether it should tell the agent's edits from the designer's is open.
5. **Whose undo?** Content undo is core-data's and active only while an artboard is Live; layout undo is the board's. Page tools elsewhere make one undo step per call, and their authors name the lack of batching as a limit.
6. **May the agent edit an artboard that is not Live, or several at once?** One Live artboard is a performance rule for editors; agent writes through entity records would not mount editors.
7. **What does the agent do with templates and parts?** In route A they are live when written. In route B they wait in Review like everything else.
8. **Does the agent create artboards, or only fill ones the designer placed?** Options and alternatives as artboards side by side is what a canvas offers over a chat. "Comparing style variations side by side" is cut today.
9. **Notes as instructions.** A note beside an artboard is already a place to write what should change. Studio's annotations are the same idea on a rendered page.
10. **How does Studio's design language meet the board's?** `DESIGN.md`, `pick_design`, sneak peeks and the design-system surface on one side; global styles, tokens with use counts and variations on the other. `scaffold_theme` already writes `DESIGN.md` tokens into `theme.json` under the same slugs.
11. **What happens with no Studio?** The same tools could serve an agent browser through WebMCP or an outside agent through the MCP Adapter, or the agent surface could exist only when Studio is detected.
12. **Which Studio surface first?** Desktop has the `<webview>` and local files. `studio ui` and Studio Cloud have a cross-origin iframe. The Playground-based web app is out of `trunk`.

## Spikes that would settle facts

- Edit a non-Live artboard's blocks through `editEntityRecord` and watch tiers, Previews, the usage index, Review and undo.
- Register two client abilities in the board page, bridge them to `document.modelContext`, and call them in Chrome with the WebMCP flag and through Playground's proxy.
- From Studio's Chromium, open a board signed in, read the `wfd/board` store and capture one artboard.
- Write a board's layout from WP-CLI while the board is open, to confirm the race.
- Check whether the D57 preview can serve Studio's Chromium.
