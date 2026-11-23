# WordPress Playground: MCP and WebMCP

Playground runs WordPress in the browser. It offers the same 16 tools over two protocols and proxies tools that plugins register.

## MCP server (`@wp-playground/mcp`, pull request 3290) `[doc]`

- An MCP server run by the agent app over stdio. It starts a WebSocket bridge server bound to `127.0.0.1`. The Playground website, open in a browser tab, runs a bridge client that connects to it, registers its sites and forwards commands to the `PlaygroundClient` API.
- Data flow: agent (stdio) → MCP server → WebSocket → the browser tab running Playground.
- Several tabs can connect. Sites are deduplicated by slug and a command goes to the tab most recently active for that site. The client reconnects every 5 seconds.
- Security: the WebSocket handshake checks the origin against Playground's list; a random token per session is served from an origin-checked endpoint and required on connect; the port is dynamic.
- Tool definitions are plain data so that WebMCP can reuse them.
- Limits stated: ChatGPT is unsupported because it needs a public HTTP server; prompt injection through tool output is not mitigated. Follow-ups planned then: page content as Markdown, WP-CLI, Blueprint tools, WebMCP.

## Built-in tools (post of 2026-09-05) `[doc]`

| Group | Tools |
|---|---|
| Sites | `playground_get_website_url`, `playground_list_sites`, `playground_rename_site`, `playground_save_in_browser` |
| PHP and requests | `playground_execute_php`, `playground_request` |
| Navigation and info | `playground_navigate`, `playground_get_current_url`, `playground_get_site_info` |
| Files | `playground_read_file`, `playground_write_file`, `playground_list_files`, `playground_mkdir`, `playground_delete_file`, `playground_delete_directory`, `playground_file_exists` |

These are site-level tools: files, PHP, requests, navigation. None edits a block.

## WebMCP in Playground `[doc]`

- The same tools are registered on the Playground page through WebMCP (pull request 3298), so a browser with an agent finds them with no MCP setup.
- The post shows the ChatGPT desktop app's built-in browser: "Site tools" in the address bar lists them. Availability depends on the model and the workspace.
- That browser looks for tools on the top-level page only. WordPress sits in a nested iframe, so tools registered inside WordPress were invisible.

## The WebMCP proxy (pull request 4301, merged 2026-09-03) `[doc]`

- A Playground mu-plugin provides `document.modelContext` in every WordPress document: `registerTool` (withdrawn through an AbortSignal), `provideContext`, `clearContext`, `tools`. It announces the document's tool list to its parent.
- The remote frame mirrors the list and forwards calls back. On `PlaygroundClient` this is `onWebMCPToolsChanged()` and `callWebMCPTool()`.
- The outer page registers the site's tools again under the same names. A name that collides with a `playground_*` tool is skipped with a warning.
- Call path: agent → `document.modelContext` on the Playground page → `PlaygroundClient.callWebMCPTool()` → remote frame → the WordPress document, where the plugin's `execute()` runs.
- Tools belong to the document that registered them. Every navigation starts from an empty list, and a tool registered late is picked up when it appears.
- A plugin that hooks only `wp_head` has no tools in wp-admin; `admin_head` is needed there. The login screen proxies nothing.
- `navigator.modelContext` is kept as a deprecated alias returning the same object. An earlier polyfill for browsers without WebMCP was dropped, since a browser agent reads the browser's own implementation.
- Registering a WordPress Ability does not make it appear as a tool. Agents reach abilities through `playground_request`.
- A reviewer asked whether the WordPress AI plugin's WebMCP work would conflict; the proxy is described as relaying whatever is registered.

`[inf]` A board that registers WebMCP tools in its wp-admin page is proxied by Playground as it stands, including from the "Try it in WordPress Playground" button in this repository's README, which opens the Boards screen in Playground.

## WebMCP in browsers, November 2026 `[3p]`

- A W3C Web Machine Learning Community Group draft, edited by people from Google and Microsoft. Pages register tools with a name, description, JSON Schema and an `execute` function; there is also a declarative form using attributes on a `<form>`.
- The API moved from `navigator.modelContext` to `document.modelContext` in mid-2026. Chrome 150 deprecated the old location and still serves it.
- Chrome: preview behind `chrome://flags/#enable-webmcp-testing` since 146; an origin trial from 149 through 156. One source says Chrome planned to turn it on for everyone in 157, due November 2026; this was not confirmed against Chrome's own notes. Edge has it behind a flag or trial. No other engine implements it, and one source reports Apple opposing it.
- Agents that call WebMCP tools: Gemini in Chrome was announced; the ChatGPT desktop app's built-in browser has "Site tools". Sources from the third quarter of 2026 say most consumer agents did not call them yet.
- For a tool that needs no agent browser: Chrome exposes `getTools()` and `executeTool()` on the same object, and the AI plugin exposes `wpai.webmcp.getTools()`. A script in the page, or a controlling process such as Playwright, can call a registered tool directly. `[inf]`
