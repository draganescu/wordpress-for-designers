# How agents reach WordPress and the block editor

Three layers, from the server outwards, then the projects that edit blocks through them.

## 1. Abilities API (server)

- In WordPress since 6.9. `wp_register_ability( 'namespace/name', … )` on the `wp_abilities_api_init` hook declares a unit of functionality with a label, description, category, JSON Schema for input and output, a permission callback and an execute callback. `[doc]`
- Abilities are listed and run over REST under `/wp-abilities/v1/`. `[doc]`
- Core's own set is small and growing. AI 1.5.0 updated `core/content-query`, `core/users-query` and `core/settings-get` to match what WordPress 7.2 brings, and plans `core/term-*`, `core/media-*`, `core/user-*`, `core/content-*`, `core/post-types-query`, `core/settings-update` and `core/terms-query` for 1.6.0. Post abilities (`core/create-post`, `core/get-post`, `core/find-posts`, `core/update-post`) were proposed in Trac 64455. `[doc]`
- None of the core abilities found works at the level of one block. `[doc]`

## 2. Client-side abilities (the page)

- New in WordPress 7.0, in two script modules. `@wordpress/abilities` is the store: `registerAbility`, `registerAbilityCategory`, `getAbilities`, `executeAbility`, with no server dependency. `@wordpress/core-abilities` fetches the server's abilities over REST and registers them in that store with a callback that runs them over REST. `[doc]`
- A plugin that only registers its own client abilities enqueues `@wordpress/abilities` alone. Loading `@wordpress/core-abilities` costs a REST request. `[doc]` `[3p]`
- A client ability's callback runs in the page, so it can dispatch to any `@wordpress/data` store the page has. This is the layer that can act on unsaved editor state. `[inf]`

## 3. MCP Adapter (server abilities as MCP)

- An official plugin (`WordPress/mcp-adapter`, on WordPress.org). It turns abilities into MCP tools, resources and prompts. Needs WordPress 6.9 and PHP 7.4. `[doc]`
- Its default server, `mcp-adapter-default-server`, exposes three tools and no more: `mcp-adapter-discover-abilities`, `mcp-adapter-get-ability-info`, `mcp-adapter-execute-ability`. An ability is reachable through them only when its registration sets `meta.mcp.public` to true. `[doc]`
- A plugin can instead create its own MCP server and list abilities on it, where each appears as its own tool. `[doc]`
- Two transports. HTTP at `/wp-json/mcp/mcp-adapter-default-server`, usually with an application password. Stdio through WP-CLI: `wp mcp-adapter serve --user=admin --server=mcp-adapter-default-server`, with no HTTP and no password. `[doc]` `[3p]`
- The stdio transport is the one that fits a local Studio site: the Studio agent already runs WP-CLI against the site. `[inf]`

## 4. WordPress AI plugin (WordPress/ai)

The canonical plugin for AI features. One stable feature (image generation and editing) and 27 experiments, all off until enabled under Settings → AI. Block editor only. `[doc]`

### MCP Access experiment (1.5.0, 2026-10-29) `[doc]`

- Installs and activates the MCP Adapter when the site allows it.
- Adds Tools → MCP Access: the site's MCP endpoint, the registered abilities, a switch to expose or hide each one, and a reset.

### WebMCP experiment (1.5.0, pull request 1081) `[doc]`

- Registers tools on `document.modelContext`, falling back to `navigator.modelContext`. One `registerTool` call per tool; a failure on one does not stop the others. A cap of 30 tools per page (`wpai_webmcp_max_tools`).
- Loads on `post.php` and `post-new.php`. The `wpai_webmcp_screens` filter adds screens.
- Tools dispatch into the `core/editor` and `core/block-editor` stores, so each change shows in the editor as it happens. A block is referenced by its `clientId`. `canInsertBlockType` enforces the site's insertion rules. One tool call is one undo step. An attribute change re-renders through the block's own save function.
- The 14 tools:

| Group | Tools |
|---|---|
| Reading | `editor-get-document` (an outline with clientIds), `editor-get-block-types` (what a position allows, or one type's attribute schema), `editor-select-block` |
| Content | `editor-set-title`, `editor-insert-block` (top level, after a block, or inside a container), `editor-update-block-text`, `editor-update-block-attributes` |
| Structure | `editor-move-block`, `editor-duplicate-block`, `editor-transform-block`, `editor-remove-block` |
| Lifecycle | `editor-undo`, `editor-save`, `editor-publish` |

- Left out on purpose: atomic batches and path-based addressing. The author asked reviewers whether they matter.
- Testing without an agent browser: `wpai.webmcp.getTools()` in the console.
- An earlier version built on the Abilities API was removed after maintainer feedback. Pull request 224, the first attempt, exposed abilities through layered WebMCP tools; reviewers there noted that the ability shape (name, description, schema, callback) maps onto both MCP and WebMCP, and that the two are different protocols whose visibility should be set separately.

### What this means for a board `[inf]`

The 14 tools assume the post editor's page-wide stores. A board has one core-data registry and a block-editor sub-registry for each mounted artboard editor (`spec/constraints.md` C9), and never mounts the post editor (C5). The tools would have to be registered again by the board, bound to the registry of the artboard in edit, or the same operations expressed through core-data's edited records.

## 5. Block MCP (GravityKit/block-mcp)

A WordPress plugin plus a TypeScript MCP server for editing saved block content one block at a time. `[doc]`

- Agent ↔ stdio ↔ MCP server ↔ HTTPS ↔ plugin REST routes (`gk-block-api/v1`). Authenticates as a WordPress user with an application password. A connect flow creates a service account with a minimal role.
- 30 tools. Content: `get_page_blocks` (with `outline`, `search`, `block_name`, `render`), `update_block`, `update_blocks` (atomic, up to 50, one revision), `insert_blocks`, `delete_block`, `replace_block_range`, `rewrite_post_blocks`, `edit_block_tree`, `insert_pattern`, `create_pattern`, `revert_to_revision`. Also posts and terms, media upload, discovery (`list_block_types`, `list_patterns`, `get_site_usage`, `list_binding_sources`), and templates (`list_templates`, `get_template`, and the gated `update_template`, `reset_template`).
- `edit_block_tree` has nine operations: `update-attrs`, `update-html`, `replace-block`, `remove-block`, `wrap-in-group`, `unwrap-group`, `insert-child`, `duplicate`, `move`, addressed by path or by ref.
- What makes edits hold up:
  - The page is an addressable JSON tree; each block has an index, a path, a name, attributes and a text preview.
  - Each block gets a stable ref (`blk_…`) stored in its `metadata`, so a chain of edits survives siblings moving.
  - Changing certain attributes (heading level, list type, button URL, image source and alt, and others) rewrites the matching saved HTML. For other static blocks the agent must send HTML with the attributes, and a guard warns when markup may go stale.
  - Every write is a WordPress revision, returned by id, with a tool to revert. ETags reject a write against a stale revision.
  - Bound attributes are write-locked unless asked for. Namespaces are scored into tiers and low tiers are refused on insert.
- "When you actually ask an AI to edit a page": the project's own benchmark, 27 runs of one heading change across three servers and three models, reports 9 of 9 for Block MCP, 8 of 9 for AI Engine Pro and 2 of 9 for a REST wrapper that rewrites the whole page. The failures it names are block comments lost in a whole-page rewrite, and an attribute changed without its HTML. Five structural edits on the smallest model: 5 of 5, 5 of 5 and 0 of 5. Self-reported.
- Why whole-content REST editing fails, as argued there: the full body is sent again for each edit, block markers get lost, the editor reports invalid content, and nothing can be searched structurally.
- Not built on the Abilities API yet; the page expects to be exposed through the adapter later. No WebMCP.
- Works on saved content, so it does not see or change unsaved edits in an open editor. `[inf]`

## 6. Agentic Editor (wpscholar/agentic-editor)

A plugin that shows the client-ability route end to end. `[doc]`

- Registers 21 client abilities in a `block-editor` category with `@wordpress/abilities`, and passes each to `document.modelContext.registerTool()`. The tool name is the ability name with `/` replaced by `_`.
- Reading: `editor/get-editor-tree`, `editor/find-editor-blocks`, `editor/get-block-location`, `editor/get-editor-selection`, `editor/can-insert-block`, `editor/get-block-types`, `editor/get-block-type`.
- Editing: `editor/insert-block` (with nested inner blocks), `editor/move-block`, `editor/update-block`, `editor/transform-block`, `editor/remove-block`, `editor/select-block`, `editor/undo`, `editor/redo`.
- Patterns: `editor/get-patterns`, `editor/get-pattern-categories`, `editor/get-pattern`, `editor/insert-pattern`, `editor/create-pattern`. Media: `editor/search-media`, and `editor/generate-image` when the site's connector can.
- A chat panel in the editor drives the same tools. The browser sends the tool list and the conversation to a REST endpoint; PHP runs one model turn through the site's AI connector; the browser runs the tool calls on the live page and repeats, up to 25 rounds. The server keeps no session.
- Approval: calls that cannot be undone, calls from other scripts' tools and calls carrying HTML that could execute wait for the user. The rest run.
- Stated limits: one undo step per call with no batching; edits to a synced pattern are saved with the pattern; a created pattern is published at once.
- Needs WordPress 7.0 and PHP 8.0.

## 7. WebMCP Abilities (code-atlantic/webmcp-abilities)

Bridges server abilities to WebMCP on the front end, for visitor-facing agents. Uses `navigator.modelContext`, which Playground's notes say threw inside Playground before the alias was added. `[doc]` `[3p]`

## Comparison

| | Where it runs | Sees unsaved edits | Addressing | Batch | Undo | Works on |
|---|---|---|---|---|---|---|
| Core abilities + MCP Adapter | Server | No | Post id | n/a | Revisions | Saved content |
| Block MCP | Server | No | Path or stable ref | Atomic, 50 | Revision per write, revert tool | Saved posts, templates when enabled |
| AI plugin WebMCP | Page | Yes | clientId | No | One editor undo step per call | The open post in the post editor |
| Agentic Editor | Page | Yes | clientId | No | One editor undo step per call | The open post in the post editor |

`[inf]` Server tools work with no editor open and cannot show work in progress. Page tools show every step and need the page open in a browser the agent can reach.
