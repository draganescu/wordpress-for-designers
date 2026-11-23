=== WordPress for Designers: Abilities ===
Requires at least: 7.2
Requires PHP: 7.4
Stable tag: 0.2.0

Lets an agent that reaches the site through abilities work on a WordPress for Designers board that is open in the browser it controls.

== Description ==

With this adapter active, the site has one ability for each tool of WordPress for Designers, and four more: one lists the site's boards, one makes a board, one gives the address of a board and a guide for working on it, and one runs several calls in one round trip. What an agent does through them happens on the open board, where the designer watches, and nothing is saved until the designer saves it.

It needs three things:

* The WordPress for Designers plugin, active on the same site.
* Something that carries abilities to an agent, such as the MCP Adapter plugin.
* An agent that controls a browser signed in to this site, with the board open and in view in it.

The adapter holds no sign-in of its own: the agent signs in with whatever the site already uses.

Without WordPress for Designers the adapter does nothing.
