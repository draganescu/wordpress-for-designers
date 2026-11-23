# WordPress Studio, as it is in the local checkout

Everything here is `[repo]`: read in `~/Sites/wordpress-studio` at `trunk` `cad01762b` (last commit 2026-11-20), unless marked otherwise. Paths are relative to that repository.

## One product, four surfaces

`docs/design-docs/studio-apps-and-surfaces.md` is the map.

| Surface | Runs as | UI | Who drives the tools |
|---|---|---|---|
| Desktop | Electron (`apps/studio`) | `apps/ui` over the `ipc` connector | Studio Code |
| CLI | `studio` (`apps/cli`), native PHP site servers | Terminal (`studio code`) | Studio Code |
| Local web | `studio ui`: `apps/local` (Express + SSE) inside the CLI | `apps/ui` over the `local` connector, in a browser | Studio Code |
| External agents | `studio mcp`: an MCP server over stdio | The agent app's chat, plus MCP Apps pages (`apps/mcp-ui`) | The other agent's model (Claude Code, Codex in the ChatGPT app, Cursor, Grok Build) |

The CLI is the execution engine for all of them. The Desktop app and `studio ui` fork it for site and agent work.

### Studio Cloud

`studio serve` (`docs/design-docs/studio-serve.md`, added in #6099, hidden from `--help` until launch) runs the `apps/local` server on a hosted machine, one per user, with the same `apps/ui` built as `build:cloud` and served centrally. Sites run natively on that machine at public addresses and are private behind a site-access cookie. The agent's Playwright and shell reach them over loopback. The `local` connector's `localMachine` capability is off there.

### Studio on the web: merged, then removed

- #5520 (2026-11-11), "Studio on the web: Run Studio Code in the page over Playground", added `apps/static`: Studio as a static web app with no Studio process behind it. Sites ran in WordPress Playground (a `remote.html` iframe from playground.wordpress.net, files in OPFS), the preview was a plain iframe on the site's scoped URL, and Studio Code ran in the page through `createBrowserAgent` from `@studio/agent/browser`, over a host that mapped files, WP-CLI (a `wp-cli.phar` in the runtime) and pages (off-screen frames) onto Playground. Screenshots used a DOM-to-image library in the page.
- #6100 (2026-11-20), "Remove Studio on the web", took `apps/static` and the `static` connector out of `trunk`. #6099, the commit before it, added `studio serve` and the Studio Cloud UI.
- The work is still on `origin/add-studio-on-the-web`, with related branches `add-studio-web-live-preview`, `add-studio-web-poc` and others.
- Read the removed README with `git show bf2717f88^:apps/static/README.md`.

`[inf]` Whether the browser agent over Playground continues outside this repository, or Studio Cloud replaces it, is not answered by the checkout. It decides whether "Studio web with a Playground preview" is a target for this integration or a prototype to learn from.

## The agent (`packages/agent`)

- `createAgent( { host } )` gives turns for a conversation (`runTurn`) and the bare tools for an agent that runs them itself (`agent.tools()`, used by `studio mcp`).
- The host (`node/host.ts`, `StudioAgentHost`) is everything the agent gets from the app: `sites` (resolve, create, start, stop, `wpCli`, import, export), `previews`, `sync`, `wpcom`, `tracks`, `sitesRoot`. Optional members switch tools on: `ui` (`showArtifact`, `reloadPreview`), `imagesDirectory`, `selectSite`, `imageGenerator`, `sendFeedback`.
- Files and pages are outside the host: the agent reads and writes the site's files itself and opens pages in a shared Playwright Chromium (`node/pages.ts`). `openPage( { url, signIn: true } )` goes through `/studio-auto-login`, so the page is the site's administrator.
- Guidance is split three ways: the system prompt holds what is always true and the skill routing; procedures are skills (`node/skills/`); facts about one tool sit in its description. `studio mcp` hands the same prompt and skills to outside agents through `studio_instructions`.
- A tool or prompt line that only makes sense with a UI attached is gated on `host.ui`. `refresh_browser` is the example.

### Tools

`site_create`, `site_list`, `site_info`, `site_start`, `site_stop`, `site_delete`, `site_import`, `site_export`, `site_push`, `site_pull`, `site_connected_remote_sites`, `preview_create`, `preview_list`, `preview_update`, `preview_delete` (preview sites on WordPress.com), `wp_cli`, `wpcom_request`, `scaffold_theme`, `pick_design`, `present_design_options`, `validate_blocks`, `take_screenshot`, `inspect_design`, `generate_images`, `open_annotation_browser`, `refresh_browser`, `need_for_speed`, `rank_me_up`, `install_taxonomy_scripts`, `send_feedback`, a question tool, the skill loader, and `studio_instructions` for outside agents.

The ones that matter for a canvas:

| Tool | What it does | Canvas analogue |
|---|---|---|
| `wp_cli` | Runs WP-CLI on the site, with no shell | Server-side read and write |
| File tools | Read, write and edit files under the sites root | Theme files, `theme.json`, scratch content files |
| `validate_blocks` | A static `core/html` policy check, then validation in the site's real block editor in Chromium; fixes safe serialization issues in the file and returns a diff | A write guard |
| `take_screenshot` | Captures a URL at desktop (1040×1248) or mobile (390×844), light or dark; shows in the chat when a UI is attached | `get_screenshot` |
| `inspect_design` | Opens a URL and returns computed styles, boxes and ancestors for selectors, at the same viewports; works for models without vision | `snapshot_layout`, `get_computed_styles` |
| `refresh_browser` | Reloads the preview in the Studio app | The only push into the user's view |
| `open_annotation_browser` | Opens a headed browser for the user to click elements and leave notes, and waits | Selection as context, by other means |
| `pick_design`, `present_design_options` | Settle an artistic direction and a layout concept from catalogs; show rendered options as a picker | Design options |

### How the agent builds today

- Skill routing in the prompt: `build-site` for a new site, `edit-manage-site` for an existing one, `visual-design` before any look or layout work, `block-content` before writing markup, `imagery` before markup that needs images, `visual-polish` to check the result.
- Block content is written as files or passed to WP-CLI and must pass `validate_blocks` before it reaches the site. Theme `templates/*.html` and `parts/*.html` are live once written.
- The prompt's order of preference for a change: a block's own attributes, then `theme.json` or global styles, then a registered block style variation, then custom CSS.
- The `block-content` skill forbids inline styles and block `style` attributes for styling, and asks for palette and font-size slugs over raw values.
- The look is recorded once in `DESIGN.md` at the site root: front matter with colors, typography, radii, spacing and components, then sections. `scaffold_theme` writes its tokens into `theme.json` under the same slugs. Studio renders it as a design-system board (`node/design-board.ts`) and as a "design" surface in the preview.
- Design options are standalone HTML "sneak peeks", 1200×900, shown for the user to pick from and never ported into the theme.
- One file per turn in a Studio Code conversation.

`[inf]` The agent designs through files and the saved site, then looks at rendered pages. It has no notion of an unsaved edit, a selection in an editor, or an artboard.

## The preview the user looks at

- `apps/ui/src/features/sites/site-preview/`. Surfaces: `site` (front end and wp-admin share one, with one login), `database`, `email`, `design`.
- On Desktop the site surface is an Electron `<webview>` (`partition="persist:site-preview"`). Studio runs scripts in it with `executeJavaScript()` after each load. The annotation inspector is such a script (`@studio/agent/protocol/inspector/page-script`), commanded by custom events and answering over a bridge.
- In `studio ui` and Studio Cloud the site surface is a cross-origin `<iframe>`. Scripts cannot be injected, so the connector's `annotatePreview` capability is false and Annotate is hidden.
- Annotations reach the agent as `VisualAnnotation` records: selector, tag, classes, nearby text, URL, viewport, rectangle, click point, computed styles, a comment and images (`packages/agent/protocol/visual-annotations.ts`).
- Tool results reach the conversation as chat artifacts (`host.ui.showArtifact`), typed widgets such as a site preview or an image.
- The preview can open wp-admin, so a board (`/wp-admin/admin.php?page=wfd-boards`) opens in it like any admin page. `[inf]`

## `studio mcp`

- `apps/cli/ai/runtimes/mcp/index.ts`: a low-level MCP `Server` over stdio, tools from `agent.tools()`, schemas in typebox.
- What it offers depends on the client, known after `initialize`: MCP Apps support, whether file links show images, whether the client makes its own images, whether `wpcom_request` is offered.
- MCP Apps pages, each one self-contained HTML served as a `ui://` resource: the design picker under `present_design_options`, and the WordPress library tab. They talk to the host over JSON-RPC on `postMessage` and get data in tool results' `_meta`.
- Installed into agent apps as the `wp-studio` plugin (`plugins/wp-studio`), from Settings → Agents.
- Tool annotations tell the client which calls only read or only change the local machine, so it asks for fewer approvals.
- Changing the prompt, a tool, a tool's result shape or a skill requires running the affected evals (`scripts/eval/`).

## What Studio lacks for a canvas agent `[inf]`

- A way to call into the page the user is viewing. On Desktop the `<webview>` injection used for annotations is the nearest mechanism. In a browser there is none.
- A tool that addresses one block of a saved post. Content is written whole, as files.
- Any use of Abilities, the MCP Adapter or WebMCP on the site. The only mentions of `modelContext` in the repository are MCP protocol code.
- Knowledge of plugins on the site beyond what skills say. A skill for WordPress for Designers would be the place for its procedures.
