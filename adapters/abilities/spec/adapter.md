# The abilities adapter

A WordPress plugin installed on a hosted site that also has WordPress for Designers, for a designer who works with an agent that reaches the site through MCP and controls a browser. `[U]` for the adapter and what it is for (D95 to D99 of `../../../spec/decisions.md`). `[N]` for names and wording, unless a line says otherwise. Tags are those of `../../../spec/sources.md`; `[V]` here means read on 22 November 2026 in the sources `../../../research/abilities-mcp/README.md` lists.

## What the site gives, unchanged `[V]`

- WordPress 7.2 has the Abilities API: `wp_register_ability_category` on `wp_abilities_api_categories_init`, `wp_register_ability` on `wp_abilities_api_init`, with `required_capabilities` checked before an ability runs and input validated and sanitized against the ability's schema.
- The MCP Adapter plugin (0.7.2) turns abilities into MCP. Its default server, at `/wp-json/mcp/mcp-adapter-default-server`, offers three tools: one lists abilities, one describes an ability, one executes it. An ability is reachable through them when its `meta.mcp.public` is true.
- The AI plugin's MCP Access screen, where a site has it, lets the site owner switch that flag per ability.
- An MCP request runs as a WordPress user. What signs the agent in (an OAuth server, an application password) is the site's and differs from site to site.

The adapter depends on the first of these only. It calls nothing of the MCP Adapter or the AI plugin (D97, D99).

## How a session goes `[U]`

1. The agent runs `wfd/boards-list` and picks a board.
2. It runs `wfd/board-open` for that board. The adapter marks the session and returns the board's address and the guide.
3. The agent opens the address in the browser it controls, where the designer watches. That browser is signed in to WordPress on its own; the MCP connection's sign-in does not sign it in.
4. The board page finds the session on its first poll and starts asking for calls (`../../../spec/agent/relay.md`).
5. Each tool ability the agent runs is handed to that page, runs there and comes back, as a call made with `wp wfd` does.

The board must be open and visible for step 5: a board page does not ask while its document is hidden.

## What the adapter does `[U]`

- It registers the ability category and the 24 abilities of `abilities.md`: one for each of the 21 tools, and three of its own (D96).
- It holds the guide, the text of `abilities.md` that `wfd/board-open` returns.

Its label for the way in (D93) is `abilities`.

## The plugin

| File | Holds |
|---|---|
| `plugin/wfd-abilities.php` | The plugin header (name "WordPress for Designers: Abilities", text domain `wfd-abilities`, WordPress 7.2 and the main plugin's PHP minimum), the two registrations and the guide. |
| `plugin/readme.txt` | What the adapter is; that it needs WordPress for Designers and something that carries abilities to an agent, such as the MCP Adapter plugin; that the agent must control a browser signed in to the site; and that it holds no sign-in of its own. |

- The adapter's version is the main plugin's version it was built with.
- It registers nothing unless both `wp_register_ability` and `wfd_agent_relay` exist when its hooks run. It checks nothing else and shows nothing.
- It is packaged as `wfd-abilities.zip`, holding one folder `wfd-abilities/` with the two files, by a script `package.sh` in this folder, as the Studio adapter is. It is never part of the main plugin's package.

## Spikes

Three throwaway proofs, run on the test environment of `acceptance.md` before the build (`../CLAUDE.md`, rule 5).

| | Proves | Passes when |
|---|---|---|
| (a) | A held request and the board's poll do not starve each other. | An ability that calls `wfd_agent_relay` with `board-get`, executed through the MCP endpoint while the fixture board is open, returns the board in under 5 seconds, 20 times in a row. |
| (b) | A result crosses the Abilities API and the MCP Adapter unchanged. | The JSON the MCP client receives for `board-get`, and for a made-up result holding `{}`, `[]`, `0.3`, `1` and `null` at the top level and nested, equals what the board sent: an empty object stays an object and a whole number stays whole. The spike settles whether an ability needs an output schema for this, and reports it. |
| (c) | An error keeps its code. | A tool failure (`not_found`) and a relay failure (`no_board`) each reach the MCP client with the code readable, as a field or in the text. The spike reports where the code is found. |

If (b) shows that results need an output schema, or (c) that a code is lost, that is an open question for the product owner, not something to patch around. Spike (c) did show it, and the product owner decided D101: the code is at the start of the message (`spike-report.md`).

## Rules

| ID | Rule | Reason | Check |
|---|---|---|---|
| AB1 | The adapter calls only `wfd_agent_relay`, `wfd_agent_begin`, `wfd_agent_boards` and `wfd_agent_tools` of the main plugin. It reads no option, post, constant or global of the main plugin's. | D92: one public surface. | AC-ABIL-12; code review |
| AB2 | A tool ability's name, description and input fields come from `wfd_agent_tools()` when abilities are registered. The adapter holds no copy of the declarations. | D95: a tool added by a later decision appears with no change to the adapter. | AC-ABIL-02 |
| AB3 | Nothing is saved, published or deleted by an ability, and the guide tells the agent not to save through the browser either. | D78 of the main plugin: the agent never saves. An agent that controls a browser could press Save, and only the guide stands in its way. | AC-ABIL-10; `agent-check.md` |
| AB4 | On a site where no way in has been used, activating the adapter and listing abilities changes nothing for an open board: `wfd/boards-list` marks no session. | C27 of the main plugin. | AC-ABIL-11 |
| AB5 | The adapter is not for a session with no board on screen, and has no server-side version of any tool. | D95, D68. | None |
