# Console probes

Temporary instruments, pasted into a page console, that answer one question each about what a live
session sends. They observe and never block, so a probe cannot protect anything and is not part of
the extension. Nothing here ships.

Every probe is covered by a unit test that evaluates the pasteable file verbatim, so a probe that
reports nothing can be told apart from a probe that is broken. Run `pnpm test` before trusting a
result.

## `gateway-frame-probe.js`

**What does the page send on each gateway socket, and when?**

It began as a lightspeed only probe answering **does a single frame carry one task or several**,
which it did. It now decodes every gateway path, names the shape of envelopes it does not
recognise, and groups everything into windows between marks, because three runs produced label
lists that could not be tied to the action that caused them.

This is the question blocking M3b, and it decides the whole shape of the feature:

- **One task per frame**, or read receipt tasks only ever batched with each other, and dropping the
  frame is enough. M3b stays a decoder plus a label check.
- **A read receipt batched with an unrelated task**, and dropping the frame kills the innocent one
  and breaks the app. The frame then has to be rewritten, which runs straight into the oversized
  identifier problem in spec section 3.4.2 and makes M3b a much larger piece of work.

The probe decodes each frame, counts the tasks in it, and reports whether any frame carrying a
signal label (3, 72 or 235) also carried something else.

### Before you run it

**Opening an unread conversation really does send a read receipt to the other person.** Nothing is
being blocked yet; the probe only watches. Use a thread where that does not matter.

The extension does not need to be loaded. The probe patches `WebSocket.prototype.send` itself, and
fewer moving parts makes a null result easier to read.

### Running it

1. Open `https://www.messenger.com` logged in, with at least one genuinely unread conversation.
2. Open DevTools on that tab, Console. Confirm the context dropdown says `top`.
3. Paste the contents of `gateway-frame-probe.js`. Chrome refuses the first console paste until
   you type `allow pasting`, so do that first, then paste again.
4. **Mark every action before you do it**, with `__gwProbe.mark('idle')`, `mark('open unread')`,
   `mark('typing')` and so on. Without marks nothing in the report is attributable to anything,
   which is how three runs in a row produced numbers that could not be interpreted.
4. Confirm it printed `[lsProbe] watching /ws/lightspeed`.
5. **The control first.** Open a conversation that is already read. Run `__gwProbe.report()`.
   Expect label 145 alone and no signal frames. If a signal label shows up here, the labels do not
   mean what the last session concluded and everything below is void.
6. **Then the measurement.** Open the conversation with unread messages. Run `__gwProbe.report()`
   again.
7. **Then typing**, since it is on the same socket and uses the other envelope. Focus the composer
   of an already read thread and type a few characters without sending. Run `__gwProbe.report()`.
8. `__gwProbe.stop()` restores `send`. Close the tab.

### Reading the result

`verdict` is the answer. The fields behind it are worth checking rather than trusting:

| Field | What it tells you |
| :-- | :-- |
| `blockers` | Every reason the verdict cannot be trusted. Empty is the only good value. |
| `sentByPath` | Whether the probe saw any traffic at all. All zeros means it is not installed, not that the app is quiet. |
| `undecoded.containingTaskMarkers` | **The number that decides the run.** Undecodable frames whose raw bytes contain `"tasks"` or `"label"`. Above zero means task frames were missed and no verdict is possible. Zero means the holes are probably acks. |
| `undecoded.byteLengths` / `undecoded.headHex` | What the unread frames look like, for working out what they are. |
| `headerBytesSeen` | More than one value means the header length moves and M3b cannot seek to a constant. Three different values have now been seen across two sessions. |
| `envelopes` | Counts of `array`, `single` and `unknown`. Any `unknown` is a frame shape nobody has accounted for. Any run without a `single` means typing was not captured. |
| `taskCountPerFrame` | The raw distribution. Frames of 20 and 34 tasks have been observed. |
| `signalFrames[].taskFields` | Field names per task, which is how a repeated label is told apart from two different things wearing one number. |
| `byWindow` | What arrived in each marked window. Anything present in one window and no other is the lead, with or without a label. |
| `unknownShapes` | Key names of envelopes neither shape explains, per path. The `/ws/streamcontroller` frames live here. |
| `labelsByPath` | Which labels arrive on which socket, so a label is never attributed to the wrong transport. |

A verdict of `NO SIGNAL SEEN` is not a negative result, it is a failed run: either the action was
not exercised or this account uses different labels. The unit test rules out the probe itself.

`INCONCLUSIVE` is also a failed run, not a soft yes. It means the sample has a hole in it, and the
signal frames that were seen say nothing about the ones that were not.

The first live run, on 2026-09-05, reported `SAFE` while 71 percent of the socket had gone unread,
because the verdict did not consult its own diagnostics. That is fixed and covered by tests. It is
the reason `blockers` exists and the reason to read it before the verdict.

### Afterwards

Record what came back in `docs/findings/`, alongside the transport findings from 2026-09-05, using
the same discipline: field names and label numbers only, never a value. Then update the next step
in `docs/STATE.md`.

## `typing-transport-probe.js`

**When the typing indicator reaches the other person, what actually left the browser?**

The lightspeed probe was run during a session where the recipient definitely saw the typing
indicator, and it captured two one byte pings and nothing else. So typing is not a
`WebSocket.send` on the top frame lightspeed socket, whatever the 2026-09-05 transport findings
recorded. Label 3 has never appeared on this account.

Rather than guess where it went instead, this probe watches every outbound channel a page has:
`WebSocket.prototype.send` on **all** paths, the `WebSocket` constructor, `fetch`,
`XMLHttpRequest`, `sendBeacon`, and the `Worker` and `SharedWorker` constructors. A channel that
stays silent while typing rules itself out, which is worth as much as the one that fires.

From bodies it reads sizes, path names, whether a small set of structural words appear
(`is_typing`, `typing`, `"tasks"`, `"label"`, `thread_key`), and the GraphQL operation name and
query id. Those two name a request rather than describing a person. Nothing else is recorded, and
a test asserts the identifiers surrounding them do not survive.

### Running it

Everything is reported per window between marks, so the comparison is built into the run.

1. Paste the probe. Open the thread you will type into, but do not touch the composer yet.
2. `__typingProbe.mark('idle')` then wait about ten seconds, touching nothing.
3. `__typingProbe.mark('typing')` then focus the composer and type continuously for about ten
   seconds. **Do not send.** Confirm on the other account that the indicator appeared.
4. `__typingProbe.mark('stopped')` then wait about ten seconds.
5. `__typingProbe.report()`, and `__typingProbe.stop()` when finished.

### Reading the result

Look at `windows`, and compare the `typing` window against `idle` and `stopped`.

| What you see | What it means |
| :-- | :-- |
| `carryingMarkers` is non empty | The candidates. Whatever is listed carried a structural word while typing. |
| `graphqlNames` names an operation | Typing is an http call, and the operation name says so outright. |
| `byPath` has an entry present only in the `typing` window | The lead, even with no marker: something is sent only while typing. |
| `worker.create` or `sharedworker.create` appears | The signal may live in a worker, which a page console cannot reach. That would mean going back to the extension's MAIN world observer. |
| Every window looks alike | Typing left by a channel this probe does not watch, or the socket carrying it was captured into a closure before the patch. |

`NOTHING OBSERVED AT ALL` means the console is attached to the wrong context. Check the dropdown
says `top`.

## `extension-doctor.js`

**With the extension installed, what did it actually just do?**

Unlike the other probes, this one is not for finding a signal. It is for checking the extension
against a real session once a signal has been found, so a question like "is Hide typing working"
gets answered with the extension's own record instead of an inference.

Most of what it prints is the extension talking about itself: `page-observer.js` broadcasts a
`privacy-guard:observed` event for every send it sees, including `websocket.suppressed`,
`fetch.suppressed`, `xhr.suppressed` and `websocket.mixed`. The doctor listens, tallies, and groups
by mark. It changes nothing, never calls `require`, and runs no timer.

### Running it

1. Reload the extension at `chrome://extensions`, then reload the Messenger tab.
2. Paste the script. It prints which channels are patched straight away.
3. Mark each action before doing it: `mark('idle')`, `mark('read')`, `mark('typing')`.
4. `__pgDoctor.report()`.

To see the configuration, toggle any switch in the popup while the doctor is listening. The content
script rebroadcasts on every settings change, and the doctor captures it.

### Reading the result

| Field | What it tells you |
| :-- | :-- |
| `installed` | Which channels are patched. Judged by the absence of `[native code]`, because minification renames every function. All false means the extension is not running here. |
| `suppressedByPath` | What was actually withheld, and on which socket or endpoint. This is the proof a feature works. |
| `leaksByPath` | `websocket.mixed`. Suppressible content that was let through because it shared a frame with something else. Every entry is a deliberate leak. |
| `byWindow` | The same, split by mark, so a signal can be tied to the action that caused it. |
| `bridge.callsByAction` | Calls to `MAWBridgeFireAndForget`, the E2EE typing path. |

### The one thing it cannot tell you

`src/observe/mawBridge.ts` reports nothing when it cancels a typing call, so the doctor can only
show that the composer made the call, never that the extension stopped it. A count there is not
proof of protection, and the report says so in place of implying otherwise.

Until the bridge reports through the observation bridge like every other channel, the only way to
settle it is the A/B: turn Hide typing off, type, ask the other account; turn it on, type, ask
again. The difference is the evidence.
