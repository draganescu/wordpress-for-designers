# Studio adapter: build instructions

You are building a small WordPress plugin, "WordPress for Designers: Studio adapter", from the specification in `spec/` of this folder. It lets a designer who works in WordPress Studio point at things on a WordPress for Designers board with Studio's own Annotate tool, and tells Studio's agent how to act on what was pointed at. Read this file fully, then `spec/adapter.md`, `spec/pick-layer.md` and `spec/acceptance.md`.

This is a separate goal from the main plugin. Start it only when Milestones 13 to 18 of the main plugin pass (`../../spec/build-order.md`).

## Binding rules

1. **Invent nothing.** What the adapter does, its file names, its one string for agents and its checks are in `spec/`. If something you need is not there, apply rule 4.
2. **What you may decide yourself.** Private function names and algorithms, as long as every rule and acceptance criterion holds. Nothing a designer or an agent can see.
3. **Precedence.** The main plugin's `spec/` > this folder's `spec/`. The adapter uses the agent surface as `../../spec/agent/surface.md` defines it and may not ask more of it. If the adapter needs something the surface does not give, that is an open question, not a change to the main plugin.
4. **Stop rule.** When the spec is silent, ambiguous or contradictory, append an entry to `spec/open-questions.md` (ID, file, question, what it blocks), leave that item unbuilt, and continue with work it does not block.
5. **Studio is not yours to change.** Do not edit, patch, configure or write to WordPress Studio, its files, its settings or anything under the user's `.studio` folder. Do not copy Studio's code: the three behaviours the adapter leans on are described in `spec/pick-layer.md` in words, and that description is all you use.
6. **No tools, no UI.** The adapter adds no tool, no command, no REST route, no option, no admin screen, no notice and no visible element. Its only string is the runbook section of `spec/adapter.md`, which agents read.
7. **No dependencies and no build.** One PHP file and one plain script. No npm package, no bundler, no WordPress script handle as a dependency.
8. **The last check is a person's.** The harness cannot drive the Studio app. You build against a stand-in for Studio's inspector (`spec/acceptance.md`), and you stop there. `spec/studio-check.md` is filled in by a person with Studio open. Do not mark the adapter done on their behalf, and do not work around a failed check: report it.

## Definition of done, for the harness

- Every criterion in `spec/acceptance.md` has a passing end-to-end test with the name given there.
- `plugin/` holds exactly `wfd-studio.php`, `pick-layer.js` and `readme.txt`.
- With the adapter active and the main plugin inactive, WordPress shows no notice and no error, and the adapter does nothing.
- `spec/open-questions.md` lists everything you could not build, or is empty.
- You have reported that `spec/studio-check.md` is waiting for a person.
