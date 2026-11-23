# Project documentation

Three documents about the plugin as built. They describe; they do not specify. The specification is `spec/`, and the binding rules are in `CLAUDE.md`.

| Document | Read it for |
|---|---|
| [state.md](state.md) | What exists now: what works, what is not done or not verified, where the code is, how to run it, where the build differs from the spec as received |
| [working-notes.md](working-notes.md) | How the work was done: the project's ways, the tools and commands, what cost time (gotchas), and the path the build took |
| [performance.md](performance.md) | The performance suite: what it measures, how it runs on pull requests and here, what each indicator means |

## Guides for users

Written for designers, with no WordPress or AI knowledge assumed.

| Guide | Read it for |
|---|---|
| [guides/studio.md](guides/studio.md) | Setting up WordPress Studio to work on boards with its agent, on your own computer |
| [guides/remote-mcp.md](guides/remote-mcp.md) | Setting up a hosted site so an agent can reach its boards over MCP |

The first two were written on 2026-11-19, after the manual-testing round that produced decisions D33 to D38; the third on 2026-11-20. Update them when the state changes; a stale state document is worse than none.
