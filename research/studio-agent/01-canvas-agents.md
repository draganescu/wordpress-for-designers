# Canvas tools that agents design on

Two reference products. Both are desktop design tools whose canvas an external agent reads and writes through MCP.

## Paper (paper.design)

### How the agent connects `[doc]`

- Paper Desktop starts an MCP server in the background and installs a `paper` CLI. Agents connect over stdio by running `paper mcp`. This is the recommended setup.
- An older Streamable HTTP endpoint at `http://127.0.0.1:29979/mcp` is still served while a file is open. The docs ask people to move to stdio and remove the old entry so two servers don't run.
- A remote server at `https://mcp.paper.design` is in early access. It needs a Paper sign-in and works with the laptop closed, for cloud agents and unattended runs. It is metered like the local one.
- With stdio a chat can start while Desktop is closed; reads and writes go to the open file once Desktop runs.
- Supported clients: Claude (an `.mcpb` extension for chat, a plugin for Claude Code), Codex and the ChatGPT app, Cursor, OpenCode, Antigravity, VS Code, the GitHub Copilot app, and any client that takes a stdio config.

### What the designer sees `[doc]`

- The agent works on the selection. To aim it at a frame, the designer selects the frame before prompting.
- Paper shows visual feedback on a frame while the agent examines it.
- Agents ask before calling Paper tools. Read-only tools can be set to always allow; write tools are reviewed per file.

### Tools `[3p]`

Paper's own page names no tools. Third-party write-ups list 22 to 24, depending on the date. The ones that recur:

| Group | Tools |
|---|---|
| Orient | `get_basic_info` (file, page, artboard list, fonts), `get_selection`, `get_tree_summary`, `get_children`, `get_node_info` |
| Read detail | `get_jsx` (Tailwind or inline styles), `get_computed_styles` (batched), `get_fill_image`, `get_font_family_info`, `get_guide` (a named workflow, such as a Figma import) |
| See | `get_screenshot` (a node, optional scale) |
| Write | `create_artboard`, `write_html` (modes `insert-children` and `replace`), `update_styles` (batched), `set_text_content` (batched), `rename_layer`, `duplicate_node` |
| Working state | `start_working_on_nodes` (locks the artboard and shows progress to the user), `finish_working_on_nodes` |
| Out | `export` (PNG, JPG, SVG, MP4) |

### Working loop `[3p]`

Orient with `get_basic_info` and the selection, create or pick an artboard, mark it as being worked on, write HTML, take a screenshot and review it, correct, release. `write_html` replaces the whole content of its target, so partial edits target a child node. The write primitive is HTML and CSS because models write those well; Paper parses the HTML into its own nodes.

### Documented workflows `[doc]`

- Sync design tokens from Figma, with the Figma MCP server connected in the same agent.
- Fill a selected frame with content from a Notion database, with the Notion MCP server connected.
- Design to code: select a frame and ask for React and Tailwind. Other selected frames serve as responsive breakpoints.
- Known trouble: long agent sessions degrade; restarting the session is the first fix.

## Pencil (pencil.dev; its docs call the app pen.dev)

### How the agent connects `[doc]`

- Two paths. An integrated agent runs inside the desktop app with a model the user picks. An external MCP client connects to the running app or IDE extension.
- The external client talks to the MCP server over stdio. The server reaches the running app over a local Unix socket, or a named pipe on Windows. A host must be running with a `.pen` document open.
- External clients named: Claude Code, ChatGPT, Codex. The integrated agent takes custom providers and can itself be given other MCP servers.
- Advice to users: put the document's full path in the prompt, and have the agent confirm the active document before editing.

### The document `[doc]`

- A `.pen` file is JSON holding a tree of objects, committed to Git beside the code. Some third-party skills still say the format is encrypted; the format page says otherwise.
- Top level: `version`, `variables`, `themes`, `imports` (other `.pen` files), `children` (the top-level objects on the infinite canvas).
- Node types include `frame`, `group`, `text`, shapes, `ref` (a component instance), and also `note` and `browser`.
- Layout is flexbox-like (`layout`, `gap`, `padding`, sizes `fit_content` and `fill_container`). Components are nodes marked `reusable`; instances override by id path.
- Variables are typed and themed (`$color.text`, with values per theme axis).

### Tools

Two generations appear in the documentation.

The current getting-started page `[doc]` lists:

| Tool | Available |
|---|---|
| `get_style`, `read_skill`, `get_app_state`, `execute` | Always |
| `save` | Unless the server starts with `--disable_save_tool` |
| `browser` | When the server targets the desktop app |
| `spawn_agents` | Only when started with `--enable_spawn_agents` |

The older AI integration page `[doc]` and third-party skills `[3p]` list:

| Group | Tools |
|---|---|
| Orient | `get_editor_state` (active file, selection, optionally the schema), `open_document` |
| Read | `batch_get` (node trees, search by pattern), `get_variables`, `search_all_unique_properties`, `get_guidelines`, `get_style_guide` |
| See and check | `get_screenshot`, `snapshot_layout` (computed boxes, overlaps and other layout problems) |
| Write | `batch_design` (insert, copy, update, replace, move, delete, generate image; about 25 operations a call), `set_variables`, `replace_all_matching_properties` |
| Place | `find_empty_space_on_canvas` |
| Out | `export_nodes` |

`[inf]` The move from many tools to `execute` plus `read_skill` is a move from a fixed tool list to a small surface with instructions loaded on demand. Studio does the same with `studio_instructions`.

### Working loop `[doc]` `[3p]`

Read the editor state, read the relevant nodes, write a batch, check with `snapshot_layout`, confirm with a screenshot. Changes appear on the canvas at once. The stated model is that the agent proposes and the designer approves by looking at the canvas and the layers panel. Typical prompts: build a screen, restyle every primary button, build a component with variants, apply a spacing grid, sync variables with CSS, recreate the components of a code folder.

## What the two share

| Trait | Paper | Pencil |
|---|---|---|
| Where the server runs | On the designer's machine, beside the open app | Same |
| What the agent edits | The file open in the app | The `.pen` document open in the app |
| Selection as context | Yes, the default target | Yes, in the editor state |
| Write primitive | HTML parsed into nodes | Batched operations on nodes |
| Seeing the result | Screenshot of a node | Screenshot, plus a layout check that needs no vision |
| Tokens | Synced from Figma through the agent | Read and written as variables |
| Signal to the designer | Artboard marked as being worked on | Changes appear live |
| Approval | Per tool, in the agent app | The designer reviews the canvas; Git holds history |
| Unattended use | Remote MCP, early access | `spawn_agents`, opt-in |

Five things an agent needs from a canvas, in the order it uses them: where am I (document, selection), what is here (tree, tokens), change this (small, addressable writes), show me (image or measured layout), I am working here (a visible claim on an artboard).
