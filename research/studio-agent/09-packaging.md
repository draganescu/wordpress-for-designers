# Packaging: keeping the plugin small

> Superseded in part by `10-decisions.md` (21 November 2026). The binding text is in `spec/` from D65 on.

Added 2026-11-21. Annotation follows option 1 of 08: Studio's inspector stays the tool and asks the page for the target. This file records how a Studio skill can ship from this repository, and a split that keeps agent work out of the plugin. Studio facts are `[repo]` (`trunk` `cad01762b`); the split is a proposal (`[inf]`).

## How Studio loads skills

- **Studio Code, the built-in agent.** Its skills are compiled in: `packages/agent/node/skills.ts` collects `./skills/**/*.{md,php}` with `import.meta.glob` when Studio is built. The runtime is created with `noSkills`, `noContextFiles`, `noExtensions` and `noPromptTemplates` set (`packages/agent/node/runtime/index.ts`), so it reads no skill, `AGENTS.md` or extension from a site folder. A skill reaches it only by being added to Studio's source, with its routing line in the system prompt.
- **What a user can add to Studio Code:** global instructions, one text file in `~/.studio` edited in Settings, appended to the system prompt.
- **Site agent files.** Studio copies its bundled skills (`wp-files/skills/`: `studio-cli`, `wp-block-development`, and others) into each site as `.agents/skills/<id>/SKILL.md`, with a link from `.claude/skills/<id>`, and writes `AGENTS.md`, `CLAUDE.md` and `STUDIO.md` at the site root (`packages/common/lib/agent-skills.ts`). These are for outside agents working in the site folder: Claude Code, Cursor, Codex. Settings → Skills manages the bundled set.
- **Agent-app plugins.** `plugins/wp-studio` is the plugin Studio installs into Claude Code, Codex, Cursor and Grok Build. Its skills are a fixed list too.
- No setting adds an outside MCP server or tool to Studio Code. Its tools are the ones in `packages/agent/node/tools/`.

## What can ship from this repository

| For | Ships as | Works today |
|---|---|---|
| Outside agents in the site folder, with or without `studio mcp` | A `SKILL.md` folder copied to `.agents/skills/wordpress-for-designers/`, linked from `.claude/skills/` | Yes `[inf]`: the folders are the ones those agents read. Studio would probably not list it in Settings |
| Studio Code | Nothing loadable. The runbook can travel as the output of `wp wfd tools`, and one line in the user's global instructions can tell the agent to run it when the plugin is active | A workaround |
| Studio Code, properly | A pull request to Studio: the skill in `packages/agent/node/skills/`, a routing line gated on the plugin being active, evals | Needs Studio |

## A split that keeps the plugin small

The plugin gets seams. Everything about the agent goes in a companion plugin built from this repository as a second zip.

Seams in the plugin:

1. Another script can reach the block-editor registry of the artboard in edit. Today each editor's registry is private to it.
2. Slots in the header and on artboard labels, for the chip and the marks.
3. The canvas of the artboard in edit can be made inert on request, for picking while annotating.
4. A Review entry can carry who made it.

The `wfd/board` store and core-data are already on the page's registry, so board-level and entity-level tools need no seam.

Companion plugin, `wordpress-for-designers-agent`:

- Page scripts: the agent tools (functions over the stores), the relay client, the resolver, the marks.
- PHP: the relay route and queue (`wfd/v1/agent`), the `wp wfd` command.
- The skill folder and `wp wfd skill install`.

Studio, one pull request:

- The inspector asks the page on a pick and for marker positions.
- A board target in the annotation record, the chat chip label and the prompt builder.
- The skill and its route.

The whiteboard "Studio agent × WordPress for Designers: flows, pieces and what to add" draws this.
