# Relay

How a call made on the server reaches the open board and how its result comes back. An agent harness that can only run commands (Studio Code runs `wp` commands and nothing else on a site) puts a call in a queue with `wp wfd`; the board page asks for calls, runs them and answers. `[U]` (D68)

`[N]` applies to every name and value in this file unless a line says otherwise.

## Records

All of the relay's state is in WordPress options, none of them autoloaded. `[U]` for options (D69)

| Option | Holds | Lives |
|---|---|---|
| `wfd_agent_seen` | The time a way in was last used on this site, as a Unix timestamp | From the first use on. Removed on uninstall |
| `wfd_agent_sources` | `{ "cli": 1795280000, "abilities": 1795280100 }`: the time each way in was last used, by its label (D93) | From the first use on. Removed on uninstall |
| `wfd_agent_listener_{client}` | `{ "board": 12, "title": "Site map", "user": 1, "seen": 1795280000 }` for one open board page. `title` is the board's title as the site holds it and `user` the id of the page's user (D104) | Written by that page's requests. Removed by cleanup once `seen` is more than 60 seconds old |
| `wfd_agent_call_{id}` | One call, below | From `wp wfd` enqueueing it until the command has read its result, or cleanup |

`{client}` is a UUID the board page makes when it loads. `{id}` is a UUID made by the command.

A call:

```json
{
  "id": "uuid",
  "board": 12,
  "calls": [ { "tool": "board-get", "input": {} } ],
  "status": "queued | running | done",
  "client": "the page that took it; absent while queued",
  "results": [ { "ok": true, "result": {} } ],
  "source": "cli",
  "user": 1,
  "created": 1795280000,
  "expires": 1795280300
}
```

`calls` has one entry for `wp wfd call` and one per call for `wp wfd batch`. `results` has an envelope per entry once the status is `done`. `expires` is `created` plus 300 seconds. The record also holds `timeout`, the caller's timeout in seconds. `source` is the label of the way in the call came by (D93). `user` is the id of the user who made the call, or 0 when it was made with none, as `wp wfd` without `--user` makes it.

A call belongs to its user (D104). A call whose `user` is not 0 is handed only to a page of that user, and only that user's result is stored for it; the listening boards its caller is told of are those with a page of that user. A call whose `user` is 0 reaches any listening page.

The queue holds calls and their results and nothing else. It never holds a copy of site content beyond what a call's input and result carry.

## Session

A session is active while `wfd_agent_seen` is less than 120 seconds old. Every `wp wfd` command sets it to the current time, before it does anything else, and so does every call of `wfd_agent_relay` and `wfd_agent_begin` (From PHP). Each of them also writes the current time under its label in `wfd_agent_sources`.

A board page is listening while its listener record's `seen` is less than 25 seconds old.

## The board's side

- A board page on a site where `wfd_agent_seen` does not exist sends nothing to the relay. The page learns this from its config when it loads (`wfdConfig.agent.seen`). `[U]` (C27, D76)
- Where it exists, the page calls the poll route every 10 seconds while no session is active and every second while one is. It does not call it while the document is hidden.
- When a poll answers that a session is active, the board loads the agent chunk (`surface.md`, Loading) and shows G1.
- The poll hands a call over with `remaining`, the seconds left of the command's timeout, worked out on the server so that no two clocks are compared. The page starts no entry once that time has passed: the entry that is running is finished, and each entry not started gets `{ "ok": false, "error": { "code": "skipped", "message": "The call ran out of time." } }` (D89).
- A call the poll hands over is run, entry by entry in order, through the same code as `window.wfdAgent`'s `call`. After an entry fails, the remaining entries are not run and each gets `{ "ok": false, "error": { "code": "skipped", "message": "An earlier call failed." } }`. The page then sends the results to the result route.

## Routes

Both are under the REST namespace `wfd/v1`, require `edit_theme_options` (C19) and are called with the REST nonce, like the plugin's other routes.

### `POST /wfd/v1/agent/poll`

Body: `{ "board": 12, "client": "uuid", "title": "Site map" }`.

The server writes the page's listener record, with the board's own title and the request's user, then looks for the oldest call that has `status` `queued`, names this board, is this user's (D104) and has not expired. `title` in the body is not used. For a `board` that is not a published board of the site it writes no record and returns `"call": null`. If there is one it sets its `status` to `running` and its `client` to this page, and returns it. A call is handed to one page only: two pages that show the same board never both run it. The claim is one conditional write that changes the row only while it still holds the queued call that was read (D85).

Response: `{ "active": true, "sources": [ "cli" ], "call": { "id": "uuid", "calls": [ … ] } }`, with `"call": null` when there is none and `"active": false` when no session is active. `sources` lists the labels whose time in `wfd_agent_sources` is less than 120 seconds old. The board keeps the list and does nothing else with it: nothing it checks, records or shows depends on the way in (D93, C31).

### `POST /wfd/v1/agent/result`

Body: `{ "id": "uuid", "client": "uuid", "results": [ … ] }`.

The server stores the results and sets `status` to `done`, if the call exists, is `running`, was taken by this client and is this user's (D104). Otherwise it changes nothing. Response: `{ "stored": true }` or `{ "stored": false }`.

## From PHP

A way in that runs in PHP reaches the board through these functions, and through nothing else of the relay (D92). They are defined whenever the plugin is active, under WP-CLI or not.

| Function | Does |
|---|---|
| `wfd_agent_relay( array $calls, array $args )` | Hands `$calls`, 1 to 50 entries of `tool` and `input`, to a listening board and waits. `$args` holds `source` (required: 1 to 20 lowercase letters, digits and dashes), `board` (optional board id) and `timeout` (optional whole seconds from 1 to 120, default 30). Returns `{ "ok": true, "results": [ envelope, … ] }` once the board has answered, whatever the envelopes hold, or `{ "ok": false, "error": { "code", "message" } }` for a failure of the relay itself. A tool name that is not in the declarations is the failure `unknown_tool`, and no record is written. |
| `wfd_agent_begin( string $source )` | Marks the session as a command does, with no call. A board opened afterwards finds the session on its first poll. |
| `wfd_agent_boards()` | Every published board, as `{ "id", "title", "address", "listening" }`, by id. `listening` is true for a board with a listening page of the current user, or of any user when there is none (D104). `address` is the URL of the board's page in wp-admin. It marks no session. |
| `wfd_agent_tools()` | The declarations, as an array. |
| `wfd_agent_board_new( string $title = '' )` | Makes a board as "Add board" does (`screens/Boards.md`): published, with the empty layout, titled `$title`, or "Untitled board" when it is empty. Returns the board as `wfd_agent_boards()` lists it, or `{ "ok": false, "error": { "code": "unavailable", "message": "The board could not be made." } }` when WordPress could not make it. It marks no session (D103). |

The caller checks that its user may use the plugin (C19); the functions do not.

`wfd_agent_relay` does this:

1. Find the listening boards of the current user, or of every user when there is none (D104). With none, fail at once with `no_board`. With several and no `board`, fail at once with `several_boards`. With `board`, that board must be listening, else `no_board`.
2. Write the call record with `status` `queued`.
3. Read the record again every 200 milliseconds, from the database and not from a cache, until its `status` is `done` or the timeout has passed.
4. Delete the record, and return the results or fail with `timeout`.

## The command's side

`wp wfd call` and `wp wfd batch` (`cli.md`) call `wfd_agent_relay` with the source `cli` and print what it returns.

| Code | When | Message |
|---|---|---|
| `no_board` | No listening board, or the one named by `--board` is not listening | `No board is listening. Open a board in WordPress for Designers; if one is open, reload it once.` |
| `several_boards` | Several boards are listening and `--board` was not given | `Several boards are open: {id} "{title}", {id} "{title}". Pass --board=<id>.` |
| `timeout` | The board did not answer in time | `The board did not answer within {n} seconds.` |
| `skipped` | An earlier entry of the same batch failed, or the command's time ran out before this entry started | `An earlier call failed.`; `The call ran out of time.` |

## Cleanup

`[U]` for cleaning up, with WP-Cron, what is left behind by something that broke part way (D69)

- A call record is deleted by the command that made it as soon as that command has read the result or timed out.
- The cron event `wfd_agent_cleanup` runs hourly. It deletes every call record past its `expires`, whatever its status, and every listener record whose `seen` is more than 60 seconds old. It is scheduled when a way in is first used on the site and unscheduled on deactivation.
- Each `wp wfd call` and `wp wfd batch` runs the same cleanup before it enqueues.
- Uninstall deletes `wfd_agent_seen`, `wfd_agent_sources`, every listener and call record, and the cron event.
