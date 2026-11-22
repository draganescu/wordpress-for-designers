# Check with a real agent

The harness cannot do this. A person does it on a hosted site that an agent's provider can reach over HTTPS, with whatever sign-in for MCP the site has, and records the result here with the date, the agent, the MCP Adapter's version and the sign-in used.

1. The site has WordPress for Designers, this adapter and the MCP Adapter active, and at least two boards.
2. In an agent that controls a browser, connect the site's MCP endpoint and sign in.
3. Ask the agent to list the boards of the site. It names them.
4. Ask it to open one. The board appears in the agent's browser, signed in, and its header reads "Agent connected".
5. Ask for a change to a heading on a page artboard. The artboard shows "Agent working", the text changes as you watch, and its label then reads "Changed by agent".
6. Ask for three changes at once. The agent makes them in one `wfd/batch`.
7. Change something yourself on the board, then ask the agent what is waiting in Review. It tells your change from its own.
8. Ask the agent to save. It declines and points to Review, and it presses nothing on the board.
9. Put another window over the agent's browser and ask for a change. The agent reports that the board is not in view.
10. Ask it to switch to the other board. It opens that board's address and works there.
11. Ask it to make a new board. It runs `wfd/board-new`, opens the new board's address, and does not press "Add board".

| Date | Agent | MCP Adapter | Sign-in | Steps that failed | Notes |
|---|---|---|---|---|---|
| 23 November 2026 | Claude desktop app, Fable 5.2 | The latest released on that day; the number was not noted | OAuth, on the product owner's own site | None | Run by the product owner. A first run the same day had no ability for making a board, and the agent pressed "Add board" itself; that led to D103 and step 11. All steps were then run with `wfd/board-new` in place. |
