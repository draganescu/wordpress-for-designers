# Relay

How a call made on the server reaches the open board and how its result comes back. An agent harness that can only run commands (Studio Code runs `wp` commands and nothing else on a site) puts a call in a queue with `wp wfd`; the board page asks for calls, runs them and answers. `[U]` (D68)

`[N]` applies to every name and value in this file unless a line says otherwise.

## Records

All of the relay's state is in WordPress options, none of them autoloaded. `[U]` for options (D69)

| Option | Holds | Lives |
|---|---|---|
| `wfd_agent_seen` | The time of the last `wp wfd` command on this site, as a Unix timestamp | From the first command on. Removed on uninstall |
| `wfd_agent_listener_{client}` | `{ "board": 12, "title": "Site map", "seen": 1795280000 }` for one open board page | Written by that page's requests. Removed by cleanup once `seen` is more than 60 seconds old |
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
  "created": 1795280000,
  "expires": 1795280300
}
```

`calls` has one entry for `wp wfd call` and one per call for `wp wfd batch`. `results` has an envelope per entry once the status is `done`. `expires` is `created` plus 300 seconds.

The queue holds calls and their results and nothing else. It never holds a copy of site content beyond what a call's input and result carry.

## Session

A session is active while `wfd_agent_seen` is less than 120 seconds old. Every `wp wfd` command sets it to the current time, before it does anything else.

A board page is listening while its listener record's `seen` is less than 25 seconds old.

## The board's side

- A board page on a site where `wfd_agent_seen` does not exist sends nothing to the relay. The page learns this from its config when it loads (`wfdConfig.agent.seen`). `[U]` (C27, D76)
- Where it exists, the page calls the poll route every 10 seconds while no session is active and every second while one is. It does not call it while the document is hidden.
- When a poll answers that a session is active, the board loads the agent chunk (`surface.md`, Loading) and shows G1.
- A call the poll hands over is run, entry by entry in order, through the same code as `window.wfdAgent`'s `call`. After an entry fails, the remaining entries are not run and each gets `{ "ok": false, "error": { "code": "skipped", "message": "An earlier call failed." } }`. The page then sends the results to the result route.

## Routes

Both are under the REST namespace `wfd/v1`, require `edit_theme_options` (C19) and are called with the REST nonce, like the plugin's other routes.

### `POST /wfd/v1/agent/poll`

Body: `{ "board": 12, "client": "uuid", "title": "Site map" }`.

The server writes the page's listener record, then looks for the oldest call that has `status` `queued`, names this board and has not expired. If there is one it sets its `status` to `running` and its `client` to this page, and returns it. A call is handed to one page only: two pages that show the same board never both run it. The claim is one conditional write that changes the row only while it still holds the queued call that was read (D85).

Response: `{ "active": true, "call": { "id": "uuid", "calls": [ … ] } }`, with `"call": null` when there is none and `"active": false` when no session is active.

### `POST /wfd/v1/agent/result`

Body: `{ "id": "uuid", "client": "uuid", "results": [ … ] }`.

The server stores the results and sets `status` to `done`, if the call exists, is `running` and was taken by this client. Otherwise it changes nothing. Response: `{ "stored": true }` or `{ "stored": false }`.

## The command's side

`wp wfd call` and `wp wfd batch` (`cli.md`):

1. Find the listening boards. With none, fail at once with `no_board`. With several and no `--board`, fail at once with `several_boards`. With `--board`, that board must be listening, else `no_board`.
2. Write the call record with `status` `queued`.
3. Read the record again every 200 milliseconds, from the database and not from a cache, until its `status` is `done` or the timeout has passed. The timeout is 30 seconds, or `--timeout`.
4. Delete the record, and print the results or fail with `timeout`.

| Code | When | Message |
|---|---|---|
| `no_board` | No listening board, or the one named by `--board` is not listening | `No board is listening. Open a board in WordPress for Designers; if one is open, reload it once.` |
| `several_boards` | Several boards are listening and `--board` was not given | `Several boards are open: {id} "{title}", {id} "{title}". Pass --board=<id>.` |
| `timeout` | The board did not answer in time | `The board did not answer within {n} seconds.` |
| `skipped` | An earlier entry of the same batch failed | `An earlier call failed.` |

## Cleanup

`[U]` for cleaning up, with WP-Cron, what is left behind by something that broke part way (D69)

- A call record is deleted by the command that made it as soon as that command has read the result or timed out.
- The cron event `wfd_agent_cleanup` runs hourly. It deletes every call record past its `expires`, whatever its status, and every listener record whose `seen` is more than 60 seconds old. It is scheduled when the first `wp wfd` command runs on the site and unscheduled on deactivation.
- Each `wp wfd call` and `wp wfd batch` runs the same cleanup before it enqueues.
- Uninstall deletes `wfd_agent_seen`, every listener and call record, and the cron event.
