# Adapters

An adapter connects one agent harness to the agent surface of WordPress for Designers (`spec/agent/`, decisions D65 to D67). It is a separate WordPress plugin, built from this repository and distributed on its own. It holds no tools: the tools, and the way changes are shown, are the main plugin's and are the same for every harness. The abilities adapter's four abilities for finding and making a board and for batches are the one exception (D96, D103).

Each adapter has its own handout, with its own `CLAUDE.md` and `spec/`, and is built as its own goal, after the main plugin's Milestones 13 to 18 pass.

| Adapter | Folder | State |
|---|---|---|
| WordPress Studio | `studio/` | Specified |
| Abilities, for agents that reach the site through MCP | `abilities/` | Specified (D95 to D99). Needs Milestone 19 of the main plugin. |
| Others | none yet | Not specified. An agent that reads skills from the site folder needs its own decision first. |

The main plugin's package never contains this folder (`tools/package.sh`).
