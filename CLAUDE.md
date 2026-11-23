# WordPress for Designers: build instructions

You are building a WordPress plugin, "WordPress for Designers", from the specification in `spec/`. Read this file fully before any other, then read `spec/` in the order given below.

## What you are building

A plugin that opens an infinite canvas (a board) inside WordPress. Each artboard on the board shows one page, template, template part or pattern of the site, rendered with real blocks. One artboard at a time can be edited with a block editor built from WordPress's public parts. Global styles are edited from the same screen and repaint every artboard.

Since decision D65 the plugin also has an agent surface: a closed set of tools through which an AI agent works on an open board, a `wp wfd` command that carries an agent's calls to the board, and marks that show the designer what the agent does. It is specified in `spec/agent/` and built in Milestones 13 to 19 on top of the finished plugin. It continues this spec: nothing above D65 is replaced by it, and every earlier constraint binds it.

## Binding rules

1. **Invent nothing.** Every screen, control, label, behaviour, data field and import is defined in `spec/`. If something you need is not there, apply rule 4.
2. **What you may decide yourself.** Internal code structure, file layout below the top-level folders named in `spec/architecture.md`, private function names, and algorithms, as long as every constraint, allowlist and acceptance criterion holds. You may not decide anything a user can see or anything stored in the database.
3. **Precedence when files disagree.** `constraints.md` > `decisions.md` > `data-model.md`, `architecture.md` and the files in `agent/` > the component maps in `screens/*.md` > the images in `screens/images/`. Report the disagreement under rule 4 as well.
4. **Stop rule.** When the spec is silent, ambiguous or contradictory, append an entry to `spec/open-questions.md` (ID, file, question, what it blocks), leave that item unbuilt, and continue with work it does not block. Never fill the gap with a guess, a placeholder UI or a TODO that changes behaviour.
5. **Imports are a closed list.** Import only what `spec/api-allowlist.md` names. No other npm runtime dependency. No private WordPress API anywhere except through the adapter files that list defines.
6. **Images are layout references.** `spec/screens/images/*.png` show layout, content and states. `spec/screens/reference-markup/*.html` produced those images from hand-styled boxes. Do not port, copy or adapt that markup or its inline styles. Build each element from the component named in the screen's component map.
7. **UI text is verbatim.** Use the strings given in `spec/screens/*.md` exactly. Site content shown in the images (The Slow Margin, its pages and colours) is fixture data, not UI text.
8. **No scope additions.** Do not add features, settings, onboarding, telemetry, shortcuts or screens. `spec/out-of-scope.md` lists things that were considered and cut; they stay cut.
9. **Milestones are gated.** Follow `spec/build-order.md`. Do not start a milestone until the gate of the one before it passes. If a Milestone 0 spike fails, stop and report; do not work around it.

10. **The agent surface is closed in the same way.** Build the 21 tools of `spec/agent/tools.md` and no other, with the names, fields, results, error codes and messages given there. Print the runbook of `spec/agent/cli.md` verbatim. Do not add a tool, a flag, a route, an option, a mark or a string because a flow seems to need it: apply rule 4.
11. **No harness in the plugin.** Nothing under `src/` or `includes/` names WordPress Studio, Claude or any other agent product, or holds code for one (C32). Adapters for harnesses are separate plugins with their own handouts under `adapters/`. Do not build an adapter as part of this plugin's milestones, and do not read `adapters/` to fill a gap in `spec/`.
12. **`research/` specifies nothing.** It is the record of how the agent surface was arrived at, and parts of it describe routes that were dropped. Where it differs from `spec/`, `spec/` is right.

## Definition of done

- Every criterion in `spec/acceptance.md` has a passing end-to-end test with the name given there.
- The lint rules named in `spec/constraints.md` pass with no disabled lines.
- `spec/open-questions.md` lists everything you could not build, or is empty.
- On a site where no way in to the agent surface has been used (D94), the plugin behaves exactly as it did before Milestone 13: every earlier criterion still passes, and the board sends nothing to the agent routes (C27).
- The plugin activates on a clean WordPress 7.2 with a block theme and no other plugins, with no PHP notices and no console errors.

## Reading order

1. `spec/sources.md` (how statements are marked)
2. `spec/constraints.md`
3. `spec/decisions.md`
4. `spec/out-of-scope.md`
5. `spec/data-model.md`
6. `spec/architecture.md`
7. `spec/api-allowlist.md`
8. `spec/screens/README.md`, then each screen file
9. `spec/acceptance.md`
10. `spec/build-order.md`
11. For Milestones 13 to 19: `spec/agent/surface.md`, `spec/agent/tools.md`, `spec/agent/relay.md`, `spec/agent/cli.md`, then `spec/screens/AgentConnected.md`, `AgentWorking.md` and `AgentReview.md`

## Environment

- WordPress 7.2 or later, PHP 7.4 or later, a block theme.
- The Gutenberg plugin is not required and must not be assumed.
- API names in this spec were checked against Gutenberg commit `e77b5057a91` (plugin version 24.4.1) and WordPress core `7.2-beta5`. If an allowlisted export is missing in the WordPress you build against, apply rule 4.
- The agent surface's tests need WP-CLI in the test environment, which `@wordpress/env` provides (`wp-env run cli`).
- Facts about WordPress Studio in `spec/agent/` and `adapters/` were checked against Studio's repository at commit `cad01762b`. The plugin itself depends on none of them.
