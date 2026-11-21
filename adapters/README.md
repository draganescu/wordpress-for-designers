# Adapters

An adapter connects one agent harness to the agent surface of WordPress for Designers (`spec/agent/`, decisions D65 to D67). It is a separate WordPress plugin, built from this repository and distributed on its own. It holds no tools: the tools, and the way changes are shown, are the main plugin's and are the same for every harness.

Each adapter has its own handout, with its own `CLAUDE.md` and `spec/`, and is built as its own goal, after the main plugin's Milestones 13 to 18 pass.

| Adapter | Folder | State |
|---|---|---|
| WordPress Studio | `studio/` | Specified |
| Claude, and others | none yet | Not specified. An agent that reads skills from the site folder, or reaches the site through an MCP server, needs its own decision first. |

The main plugin's package never contains this folder (`tools/package.sh`).
