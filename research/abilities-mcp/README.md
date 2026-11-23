# Abilities over MCP: state on 22 November 2026

The record behind decisions D92 to D99 and `adapters/abilities/`. This folder specifies nothing (`CLAUDE.md`, rule 12).

## Findings

- **Abilities API, WordPress 7.2** (release planned for 8 December 2026). An ability can declare `required_capabilities`, checked before any permission callback. Input is validated and then sanitized against the schema, and callbacks get the converted value; a `number` arrives as a float. An empty PHP array is encoded as `[]` unless the result is prepared with `wp_prepare_json_value_for_client()` and an output schema. Source: https://make.wordpress.org/core/2026/11/19/abilities-api-updates-in-wordpress-7-2/
- **MCP Adapter 0.7.2** (19 November 2026). The default server offers three tools (discover, describe, execute) and reaches an ability whose `meta.mcp.public` is true. Using the adapter as a bundled library is deprecated since 0.7.0. A server with no permission callback admits any logged-in user. Nothing is said about execute callbacks that wait. Keeping an error's code through the execute tool is an open pull request (374). Sources: https://wordpress.org/plugins/mcp-adapter/ and the `docs/` folder of https://github.com/WordPress/mcp-adapter
- **AI plugin 1.5.0, MCP Access.** No MCP server of its own: it installs the MCP Adapter and writes the site owner's choice per ability into `meta.mcp.public` through `wp_register_ability_args`. Read from the pull request, not from the code. Source: https://github.com/WordPress/ai/pull/992
- **OAuth.** Not shipped. Pull request 437 of the MCP Adapter is open: clients registered by an admin, tokens that are application passwords and do not expire. Draft 448 adds sign-in from the MCP URL alone and one-hour tokens, and reports a tool call from a hosted agent. Core's own is aimed at WordPress 7.3. Sources: https://github.com/WordPress/mcp-adapter/pull/437, https://github.com/WordPress/mcp-adapter/pull/448, https://make.wordpress.org/ai/2026/10/28/wordpress-for-the-agentic-web/
- **A hosted agent's connector** reaches the site from its provider's servers, so the site must be public over HTTPS, and gives a tool call 300 seconds. Source: https://claude.com/docs/connectors/building

## What the design had to settle

- The tools run in the board page, and an ability runs in PHP, so an ability hands its call to the queue the board polls (D92).
- A remote agent starts with no board open, and an ability cannot open a tab: it returns the address and the agent's browser opens it (D96).
- A board page does not ask while hidden, so the board has to be in view in the agent's browser.
- The agent has no WordPress commands, so the route of D77 for a template of any slug is not available over MCP.
- An agent that controls a browser could press Save. Only the guide tells it not to.

## Design artefacts

- Whiteboard "Agent on a board", section 7: https://claude.ai/artifact/LjApsWvjT8TbmqfPSNMqyf
- Mockups, the row "abilities over MCP": https://claude.ai/artifact/18RDmyJeZxkgvddAR73Att

Where they differ from `spec/`, `spec/` is right.
