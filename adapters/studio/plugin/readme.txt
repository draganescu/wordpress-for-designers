=== WordPress for Designers: Studio adapter ===
Requires at least: 7.2
Requires PHP: 7.4
Stable tag: 0.5.0

Lets a designer point at things on a WordPress for Designers board with the Annotate tool of WordPress Studio.

== Description ==

With this adapter active, the Annotate tool of WordPress Studio picks the artboards, blocks, notes and style tokens of a WordPress for Designers board, and Studio's agent is told how to act on what was picked.

It needs two things:

* The WordPress for Designers plugin, active on the same site.
* WordPress Studio, with the site open in its preview.

Without WordPress for Designers the adapter does nothing.

== Installation ==

Add this line to the global instructions of WordPress Studio:

On a site that has the WordPress for Designers plugin, when a task is about a board, an artboard or the Designer screen, run `wp wfd tools` first and follow what it prints.
