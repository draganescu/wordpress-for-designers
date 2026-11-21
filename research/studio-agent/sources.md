# Sources

Read on 2026-11-21. Web pages were read through a fetch tool that summarises; where a page was long, part of it may not have been seen.

## Given in the brief

| Source | Used for | Notes |
|---|---|---|
| https://paper.design/docs/mcp | Paper transport, clients, permissions, workflows | Names no tools |
| https://docs.pencil.dev/getting-started/ai-integration | Pencil's two integration paths, current tool list, setup | Lists tool names without descriptions |
| https://github.com/GravityKit/block-mcp | Block MCP architecture, tools, benchmarks, limits | Benchmarks are the project's own. The page gives two different test counts |
| https://github.com/WordPress/ai | AI plugin features and experiments, roadmap | README level |
| https://make.wordpress.org/playground/2026/09/05/wordpress-playground-and-webmcp-bringing-ai-agents-into-your-browser-workflow/ | Playground's WebMCP tools, the proxy, the ChatGPT browser | The last 1,500 characters of the page were not read |

## Followed from those

| Source | Used for |
|---|---|
| https://github.com/WordPress/ai/pull/1081 | The 14 WebMCP tools and how they are built. Described there as a draft milestoned for 1.5.0; the 1.5.0 notes confirm it shipped |
| https://github.com/WordPress/ai/pull/224 | The earlier abilities-based WebMCP adapter and reviewer feedback |
| https://make.wordpress.org/ai/2026/11/02/whats-new-in-ai-1-5-0/ | MCP Access, WebMCP, core abilities updated for 7.2 |
| https://wordpress.org/plugins/ai/ | Changelog line for the WebMCP experiment |
| https://github.com/WordPress/wordpress-playground/pull/3290 | Playground MCP server and bridge |
| https://github.com/WordPress/wordpress-playground/pull/4301 | The WebMCP proxy |
| https://github.com/wpscholar/agentic-editor | Client abilities bridged to WebMCP, chat panel design |
| https://docs.pencil.dev/ai-integration | Pencil's older tool list with descriptions |
| https://docs.pencil.dev/for-developers/the-pen-format | The `.pen` format |
| https://github.com/WordPress/mcp-adapter and its WordPress.org listing | Default server, three tools, transports (search results) |
| https://developer.wordpress.org/news/2026/02/from-abilities-to-ai-agents-introducing-the-wordpress-mcp-adapter/ | MCP Adapter introduction (search result) |
| https://make.wordpress.org/core/2026/03/24/client-side-abilities-api-in-wordpress-7-0/ | Client-side abilities (search result) |
| https://developer.wordpress.org/block-editor/reference-guides/packages/packages-abilities/ and `packages-core-abilities/` | The two packages (search results) |
| https://core.trac.wordpress.org/ticket/64455 | Proposed core post abilities (search result) |
| https://github.com/code-atlantic/webmcp-abilities | Front-end abilities bridge (search result) |

## Third-party, for tool lists and WebMCP status

| Source | Used for |
|---|---|
| https://azukiazusa.dev/blog/ai-agent-design-tool-paper | Paper tool list and working loop |
| https://piazr.github.io/the-agentic-designer/chapters/05.html and `B.html` | Paper tool reference (22 tools) |
| https://lzwjava.github.io/paper-design-mcp-server-en | Paper tool count (24) |
| Paper skills on claudskills.com, clawhub.ai, openskillindex.com | `start_working_on_nodes`, `finish_working_on_nodes`, `write_html` behaviour |
| Pencil skills on skills.sh, skillsmp.com, lullabot.github.io | Pencil tool names and limits; some claim `.pen` is encrypted, which Pencil's format page contradicts |
| martianlee.github.io, spronta.com, mcpplaygroundonline.com, glippy.dev, alekseialeinikov.com, botmonster.com, topuzas.medium.com | WebMCP timeline, API location, origin trial. They agree on Chrome 146 preview, 149 to 156 trial, and the move to `document`. Only botmonster gives the Chrome 157 plan |
| https://www.therepository.email/wordpress-ai-1-5-0-adds-text-to-speech-image-provenance-checks-and-two-ai-agent-experiments | AI 1.5.0 coverage |

## Local checkouts

| Repository | At | Read |
|---|---|---|
| `~/Sites/wordpress-studio` | `trunk` `cad01762b` | `AGENTS.md`, `docs/design-docs/studio-apps-and-surfaces.md`, `studio-serve.md`, `packages/agent/README.md`, `node/host.ts`, `node/system-prompt.ts`, `node/tools/index.ts` and several tools, `node/pages.ts`, skills `visual-design` and `block-content` (first part of each), `apps/cli/ai/runtimes/mcp/index.ts`, `docs/user/.../mcp-on-studio.md`, `plugins/README.md`, preview surface files, `apps/ui/src/data/core/types.ts` (capabilities); from history, `bf2717f88^:apps/static` README, `src/agent/host.ts` and `src/playground.ts` (first part of each) |
| `~/Sites/wordpress-for-designers` | `master` `90e3a26` | `CLAUDE.md`, `README.md`, `spec/data-model.md`, `spec/architecture.md`, `spec/constraints.md`, `spec/out-of-scope.md`, `docs/state.md` (first part), `includes/post-type.php` (registration), `src/board-store/index.js` (selectors), `tools/package.sh` |

## Not read

- Paper's tool descriptions from a live server, and Pencil's from its client tool list. Both vendors point there for the current set.
- The WebMCP specification and Chrome's own documentation.
- The MCP Adapter's guides and the Abilities API handbook in full.
- Gutenberg issues on editor-level abilities in core.
- Figma's MCP server, which also writes to a canvas now.
- Studio's `add-studio-on-the-web` branch beyond the removed README, and any discussion of why it was removed.
- `spec/decisions.md` and `spec/open-questions.md` in this repository, beyond the decisions that other files cite.
