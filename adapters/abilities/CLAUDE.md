# Abilities adapter: build instructions

You are building a small WordPress plugin, "WordPress for Designers: Abilities", from the specification in `spec/` of this folder. It registers WordPress abilities through which an agent that reaches the site over MCP works on a WordPress for Designers board that is open in the browser the agent controls. Read this file fully, then `spec/adapter.md`, `spec/abilities.md` and `spec/acceptance.md`.

This is a separate goal from the main plugin. Start it only when Milestone 19 of the main plugin passes (`../../spec/build-order.md`).

## Binding rules

1. **Invent nothing.** Every ability, field, result, message and the guide's text are in `spec/`. If something you need is not there, apply rule 4.
2. **What you may decide yourself.** Private function names and algorithms, as long as every rule and acceptance criterion holds. Nothing an agent or a site owner can see.
3. **Precedence.** The main plugin's `spec/` > this folder's `spec/`. The adapter uses the agent surface as `../../spec/agent/surface.md`, For adapters, defines it and may not ask more of it. If the adapter needs something the surface does not give, that is an open question, not a change to the main plugin.
4. **Stop rule.** When the spec is silent, ambiguous or contradictory, append an entry to `spec/open-questions.md` (ID, file, question, what it blocks), leave that item unbuilt, and continue with work it does not block.
5. **Spikes first.** `spec/adapter.md`, Spikes, lists three proofs. Run them before anything else and write what you found to `spec/spike-report.md`. If one fails, stop and report; do not work around it.
6. **No tool logic.** A tool ability does nothing but hand its call to `wfd_agent_relay` and return what comes back. The adapter reads no option, post or store of the main plugin's and calls only the four functions of `../../spec/agent/surface.md`.
7. **No MCP code, no sign-in code, no product names.** The adapter registers abilities and nothing else: no MCP server, no REST route, no option, no admin screen, no notice, no script. It holds no code for OAuth or any other sign-in, and no string or identifier naming an agent product.
8. **No dependencies and no build.** One PHP file. No Composer package, no npm package.
9. **The last check is a person's.** The harness can drive the MCP Adapter's endpoint with an application password; it cannot drive a hosted site with a real agent signed in. You build against the test environment of `spec/acceptance.md` and stop there. `spec/agent-check.md` is filled in by a person. Do not mark the adapter done on their behalf.

## Definition of done, for the harness

- `spec/spike-report.md` records the three spikes as passed.
- Every criterion in `spec/acceptance.md` has a passing test with the name given there.
- `plugin/` holds exactly `wfd-abilities.php` and `readme.txt`.
- With the adapter active and the main plugin inactive, or on a WordPress without `wp_register_ability`, WordPress shows no notice and no error, and the adapter does nothing.
- `spec/open-questions.md` lists everything you could not build, or is empty.
- You have reported that `spec/agent-check.md` is waiting for a person.
