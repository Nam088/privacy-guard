# What a live Messenger session actually sends

Date: 2026-09-05
Method: the M3a observer, loaded unpacked into Chrome on a logged in Messenger account, plus a
temporary probe installed from the page console for the parts capture mode could not reach.
All payload inspection was scrubbed inside the page. No message text and no identifier left the
browser, and none appears below.

> **Corrected in part by a later run.** See
> `2026-09-05-lightspeed-frame-cardinality.md`. Three claims below did not hold on a second
> session: the twelve byte header is not a fixed length, labels 72 and 235 arrive in separate
> frames rather than together, and label 21 does appear. The observations here were real; they
> were one session, and a second session disagreed.

## The question this was run to answer

Whether the socket carrying read receipts is reachable from a content script at all. If it lived
inside a `SharedWorker`, no extension could ever reach it and the Facebook and Instagram read
receipt features would have to be abandoned.

**It is reachable.** Every `websocket.send` observed carried a `frameUrl` on the top level
messenger.com origin, not a worker and not a subframe. Patching `WebSocket.prototype.send` in the
MAIN world sees these frames.

## What was confirmed

**The observer works as built.** `page-observer.js` was found injected in the page, the content
script ran at `document_start`, and observations flowed across the `CustomEvent` bridge. The
manifest wiring that Task 8 asserted on is correct in a real browser, not only in the build output.

**The fbsbx proxy iframe is real.** A hidden iframe at `https://www.fbsbx.com/maw_proxy_page/`
appears shortly after load. It was absent immediately at load and present a few seconds later, so
anything hoping to observe its creation has to be listening from `document_start`.

**A SharedWorker exists, but does not own the sockets we need.** Telemetry frames carry a
`shared_worker_infra` key, so one is running. It is not where the messaging sockets live.

**Four sockets, all on `gateway.messenger.com`:**

| Path | Carries |
| :-- | :-- |
| `/ws/lightspeed` | messaging tasks, the interesting one |
| `/ws/realtime` | telemetry and analytics batches |
| `/ws/rpsignaling` | signalling |
| `/ws/streamcontroller` | stream control |

Each URL carries `x-dgw-*` query parameters, confirming the Device Gateway framing the research
described. Values are omitted here because several are device and account identifiers.

## The lightspeed frame format

Frames are binary but almost entirely printable: a short binary header followed by JSON.

Observed header, twelve bytes:

```
0f 7d 00 02 00 00 7b 7d 0d 7d 00 b1
   ^^                ^^ ^^    ^^
   sequence          '{' '}'  sequence again
```

The second byte increments frame to frame, so it is a sequence number. Bytes seven and eight are
`7b 7d`, which is `{}` in ASCII. That empty object inside the header is worth knowing about: a
naive scan for the first `{` finds it and parses an empty object, which looks like a successfully
parsed frame carrying nothing. The JSON that matters starts after the header.

Nesting, three levels, each an ordinary JSON string containing more JSON:

```
{ app_id, payload, request_id, type }
        payload -> { epoch_id, tasks, version_id }
                          tasks[] -> { label, payload }
                                            payload -> the task's own fields
```

## Task labels seen, and what each carried

Only field names are listed. No values were read.

| Label | Payload fields |
| :-- | :-- |
| 54 | `thread_key` |
| 117 | `thread_key` |
| 145 | `is_after`, `parent_thread_key`, `reference_thread_key`, `reference_activity_timestamp`, `additional_pages_to_fetch`, `cursor`, `messaging_tag`, `sync_group` |
| 207 | `contact_id` |
| 209 | `thread_fbid`, `force_upsert`, `use_open_messenger_transport`, `sync_group`, `metadata_only`, `preview_only` |
| 751 | `thread_key`, `message_id`, `pinned_message_state` |
| 767 | `thread_key` |

## The read receipt tasks, identified by controlled comparison

A second pass opened one genuinely unread conversation, then one that had already been read, and
compared what each produced.

| Action | Task labels sent |
| :-- | :-- |
| Open a thread with unread messages | **72** and **235**, each carrying `thread_key` alone |
| Open a thread already read | **145** only, the pagination task |

Labels 72 and 235 appear only when there is something to mark as read, and neither appeared in any
of the earlier navigation between already read threads. That is the signal M3b has to drop.

Two labels rather than one, so an implementation that drops only the first will still leak. Both
carry `thread_key` and nothing else, which suggests the server derives the watermark from arrival
time rather than being told a timestamp. Nothing here establishes what distinguishes 72 from 235,
and nothing needs to: both are sent together on the same action and both should be dropped.

## The typing signal, and why it needs its own parser branch

Typing was exercised by focusing the composer and typing, without ever sending. It produces a
`/ws/lightspeed` frame of about 299 bytes carrying task **label 3**, whose payload fields are
`thread_key`, `is_typing`, `is_group_thread`, `attribution`, `sync_group` and `thread_type`.

The important part is not the number. **Typing uses a different inner shape from read receipts.**

```
read receipt   payload -> { epoch_id, tasks, version_id }   tasks is an array
typing         payload -> { label, payload, version }       one task, no array
```

A parser written against the read receipt frames looks for `tasks`, finds nothing in a typing
frame, and reports it as unrecognised. It would then pass every typing indicator straight through
while appearing to work, which is the failure this project keeps having to design around. Both
shapes have to be handled, and the fact that two features on one socket disagree about their own
envelope is worth more than either label number.

## Instagram, partially exercised

Instagram was opened logged in, with the observer running. It uses a different gateway host:
`gateway.instagram.com`, not `gateway.messenger.com`. The site modules therefore cannot share a
host list, and the registry's separation of the two is doing real work.

Nothing further was learned. The inbox held no conversation that could be opened, so no task label
was observed on Instagram at all. **The Instagram module must not inherit labels 3, 72 or 235.**
They are Messenger observations. Whether Instagram uses the same numbers is unknown, and assuming
it does because both are Meta is exactly the reasoning that produced the wrong numbers in the
original research.

## What was not confirmed, and why

**Neither label 21 nor label 389 appeared, in any pass.** The research report named 21 for the
older transport and 389 for the read watermark on end to end encrypted threads. Neither was seen.
The read receipt labels this account actually sends are 72 and 235.

**One false lead, recorded so nobody chases it again.** An early probe reported a `read` marker at
byte 189, two bytes after `thread_key` at 187. That is not a field. The word `read` sits inside
`thread_key` itself, as `th` plus `read` plus `_key`.

## What this changes

**The architecture is sound.** M3b can patch `WebSocket.prototype.send` in the MAIN world and will
see the frames. No worker interception is needed and the feature does not have to be abandoned.

**The spec's host is wrong.** It says `gateway.facebook.com`; the observed host is
`gateway.messenger.com`.

**The parser is not a JSON parser.** It must skip a binary header, then unwrap three levels of
JSON nested as strings. The header's embedded `{}` will silently satisfy a naive implementation.

**M3b has what it needs to start, on Messenger.** Drop tasks 72 and 235 for read receipts, and
task 3 for typing, all on `/ws/lightspeed`, handling both envelope shapes. Instagram still needs
its own session, using the same controlled comparison this document demonstrates: exercise one
action, exercise a neighbouring action that should not produce the signal, and keep only what
differs.

**Put 72 and 235 in the site module's signature file as an array, not as literals in the parser.**
They are two numbers observed on one account on one day. The research report's numbers were also
observed by someone, and they did not survive contact with this build.
