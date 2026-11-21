# WordPress for Designers: build instructions

You are building a WordPress plugin, "WordPress for Designers", from the specification in `spec/`. Read this file fully before any other, then read `spec/` in the order given below.

## What you are building

A plugin that opens an infinite canvas (a board) inside WordPress. Each artboard on the board shows one page, template, template part or pattern of the site, rendered with real blocks. One artboard at a time can be edited with a block editor built from WordPress's public parts. Global styles are edited from the same screen and repaint every artboard.

## Binding rules

1. **Invent nothing.** Every screen, control, label, behaviour, data field and import is defined in `spec/`. If something you need is not there, apply rule 4.
2. **What you may decide yourself.** Internal code structure, file layout below the top-level folders named in `spec/architecture.md`, private function names, and algorithms, as long as every constraint, allowlist and acceptance criterion holds. You may not decide anything a user can see or anything stored in the database.
3. **Precedence when files disagree.** `constraints.md` > `decisions.md` > `data-model.md` and `architecture.md` > the component maps in `screens/*.md` > the images in `screens/images/`. Report the disagreement under rule 4 as well.
4. **Stop rule.** When the spec is silent, ambiguous or contradictory, append an entry to `spec/open-questions.md` (ID, file, question, what it blocks), leave that item unbuilt, and continue with work it does not block. Never fill the gap with a guess, a placeholder UI or a TODO that changes behaviour.
5. **Imports are a closed list.** Import only what `spec/api-allowlist.md` names. No other npm runtime dependency. No private WordPress API anywhere except through the adapter files that list defines.
6. **Images are layout references.** `spec/screens/images/*.png` show layout, content and states. `spec/screens/reference-markup/*.html` produced those images from hand-styled boxes. Do not port, copy or adapt that markup or its inline styles. Build each element from the component named in the screen's component map.
7. **UI text is verbatim.** Use the strings given in `spec/screens/*.md` exactly. Site content shown in the images (The Slow Margin, its pages and colours) is fixture data, not UI text.
8. **No scope additions.** Do not add features, settings, onboarding, telemetry, shortcuts or screens. `spec/out-of-scope.md` lists things that were considered and cut; they stay cut.
9. **Milestones are gated.** Follow `spec/build-order.md`. Do not start a milestone until the gate of the one before it passes. If a Milestone 0 spike fails, stop and report; do not work around it.

## Definition of done

- Every criterion in `spec/acceptance.md` has a passing end-to-end test with the name given there.
- The lint rules named in `spec/constraints.md` pass with no disabled lines.
- `spec/open-questions.md` lists everything you could not build, or is empty.
- The plugin activates on a clean WordPress 7.1 with a block theme and no other plugins, with no PHP notices and no console errors.

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

## Environment

- WordPress 7.1 or later, PHP 7.4 or later, a block theme. This branch, `wp-7.1`, is the release line for WordPress 7.1; `master` is the line for 7.2 (D80).
- The Gutenberg plugin is not required and must not be assumed.
- API names in this spec were checked against Gutenberg commit `e77b5057a91` (plugin version 24.4.1) and WordPress core `7.2-beta5`. If an allowlisted export is missing in the WordPress you build against, apply rule 4.
