# Studio agent and WordPress for Designers: research

Researched on 2026-11-21. This folder collects what is known about letting an agent, the Studio agent first, work on a WordPress for Designers board the way agents work on the Paper and Pencil canvases. It is input for UX explorations. It specifies nothing and is outside `spec/`.

`spec/out-of-scope.md` lists "Agent or AI features from the gutenberg-canvas concept" as cut. Anything built from this research needs that decision reopened by the product owner first.

## Files

| File | Holds |
|---|---|
| [01-canvas-agents.md](01-canvas-agents.md) | How Paper and Pencil let agents design on a canvas: transport, tools, working loop |
| [02-wordpress-agent-surfaces.md](02-wordpress-agent-surfaces.md) | Abilities API, MCP Adapter, the WordPress AI plugin's WebMCP and MCP Access experiments, Block MCP, Agentic Editor |
| [03-playground.md](03-playground.md) | WordPress Playground's MCP server, its WebMCP tools and the WebMCP proxy; the state of WebMCP in browsers |
| [04-studio.md](04-studio.md) | Studio as read from the local checkout: surfaces, the agent, its tools and host, the preview, `studio mcp`, Studio on the web, Studio Cloud |
| [05-designers-today.md](05-designers-today.md) | What WordPress for Designers already has that an agent could use, and the constraints that bear on it |
| [06-integration-map.md](06-integration-map.md) | The ways the pieces can connect, what each needs, and the questions the UX work has to answer |
| [07-buildables.md](07-buildables.md) | What to build: block tools for artboard editors over WebMCP, board tools, and a WP-CLI path with a server relay for the Studio agent |
| [08-annotation.md](08-annotation.md) | The two ways to work with the agent, how Studio's annotation tool works, and what reusing it on a board takes |
| [09-packaging.md](09-packaging.md) | How Studio loads skills, what can ship from this repository, and the seams-plus-companion split |
| [10-decisions.md](10-decisions.md) | What was decided on 21 November 2026, where each decision is specified, and what it replaced in files 07 to 09 |
| [sources.md](sources.md) | Every source, with how far each was read |

## How statements are marked

- `[doc]` read on the project's own page on 2026-11-21.
- `[3p]` from a third party describing the project. Tool lists for Paper and Pencil come from these and disagree with each other in places.
- `[repo]` read in a local checkout: Studio at `trunk` `cad01762b`, WordPress for Designers at `master` `90e3a26`.
- `[inf]` an inference from the above. Check it before relying on it.

## Direction

> Superseded in part by `10-decisions.md` (21 November 2026). The binding text is in `spec/` from D65 on.

Three things are buildable from what was found, and [07-buildables.md](07-buildables.md) sets them out:

1. The plugin registers its own WebMCP tools for the editors in its artboards, built the way the WordPress AI plugin builds its 14.
2. The plugin adds board tools (orient, lay out, tokens, notes, review), which gives agents the loop Paper and Pencil offer.
3. The designer works with the agent in two ways: chat for general or large requests, and annotation for pointing at an artboard or a block (08).
4. The Studio agent reaches both through WP-CLI. `wp wfd` commands queue calls on the server, the open board runs them and answers, and the designer sees the work happen and approves it in Review. Studio needs a skill and no new code.

## Findings in short

1. Paper and Pencil follow one loop: read the document and the selection, write in small batches, take a screenshot, look, correct. Both run a local MCP server that talks to the open desktop app, so the agent's changes appear on the canvas the designer is looking at. Paper's write primitive is HTML; Pencil's is a batch of operations on its own node tree.
2. WordPress has three layers an agent can reach. On the server, Abilities (`wp_register_ability`) exposed over MCP by the MCP Adapter, over HTTP or over WP-CLI on stdio. In the page, client-side abilities (`@wordpress/abilities`, WordPress 7.0) and WebMCP tools on `document.modelContext`. The WordPress AI plugin 1.5.0 ships 14 WebMCP tools that edit the open post through the editor's stores, with every change visible as it happens.
3. Those 14 tools load on `post.php` and `post-new.php` and dispatch into the page's `core/editor` and `core/block-editor` stores. A board mounts neither the post editor nor the site editor and gives each artboard editor its own block-editor registry, so the board registers its own copies bound to its artboards (07, section 1). `[inf]`
4. Block MCP shows what block-level editing needs to be reliable for an agent: an addressable tree, stable block references, attribute changes that keep the saved HTML in step, atomic batches, and a revision per write.
5. Playground exposes 16 tools both over MCP (stdio server, WebSocket bridge to the browser tab) and over WebMCP, and since 2026-09-03 proxies WebMCP tools that a plugin registers inside WordPress to the outer page. A plugin that registers tools on `document.modelContext` in wp-admin is picked up there with no Playground-specific code.
6. The Studio agent runs in the CLI and reaches a site through WP-CLI, the site's files and its own Playwright Chromium, signed in as the administrator. It has no direct channel into the preview the user is looking at. WP-CLI is the channel it has everywhere, and a relay through the site turns it into one (07, section 3). `[repo]` `[inf]`
7. Studio on the web (the agent in the page, sites in Playground) was merged on 2026-11-11 and removed from `trunk` on 2026-11-20, in the commit after `studio serve` and the Studio Cloud UI were added. The code is still on the `add-studio-on-the-web` branch. `[repo]`
8. WordPress for Designers already has most of what a canvas agent's read side needs: boards as REST resources with a validated layout, artboards as references to entities, a store for selection and layout, a usage index, and Review as the single gate before anything reaches the site. It has no screenshot of an artboard, and bitmap snapshots are cut.
