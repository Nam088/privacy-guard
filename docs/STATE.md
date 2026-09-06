# Where this project is, and what to do next

Last updated: 2026-09-06. Update this file whenever the answer to "what next" changes.

## Read these first, in this order

1. `docs/superpowers/specs/2026-09-05-privacy-guard-design.md`, the design. Sections 3.4.1, 3.4.2
   and 3.7 carry the findings that contradict the original research and matter most.
2. `docs/findings/2026-09-05-messenger-transport.md`, what a live session actually sends.
3. `docs/MANUAL_QA.md`, the browser checks nobody has run yet.

Skip the plans under `docs/superpowers/plans/` unless implementing them. They are long.

## What is built

**M1 and M2 are merged to `main`.** The extension installs on Chrome, Edge and Firefox, blocks
Meta tracking pixels, and strips `fbclid` behind a permission requested at the moment of use.

**M3b is built, on `feat/m3b-suppress-read-and-typing`, and has not been manually tested.** Read
receipt suppression ships: frames on `/ws/lightspeed` whose every task is label **21, 72 or 235**
are withheld from the socket, mixed frames pass through and are reported as `websocket.mixed`, and
`Hide read receipts` is the first feature with `status: 'active'`. Items 24 to 30 of
`docs/MANUAL_QA.md` have never been run, and item 26, that Messenger still works, is the one that
decides whether this ships or comes back out.

**M3a is merged.** An observer runs in the MAIN world of every frame on Facebook, Messenger,
Instagram and fbsbx.com, watching `WebSocket`, `Worker`, `SharedWorker` and `MessagePort`, and
changing nothing. Capture mode records scrubbed payloads and is off by default with no interface.

Every other Facebook and Instagram feature is still `status: 'planned'`, renders disabled with a
`Soon` badge, and `isFeatureOn` returns false for it whatever is stored. That is deliberate: the
extension must never advertise protection it has not built.

**Label 21 is the one that carries `last_read_watermark_ts`**, and it was nearly missed. It arrives
in the single task envelope while 72 and 235 arrive in the array envelope, so the first controlled
comparison's parser read it as carrying nothing, which is precisely the failure the transport
findings warned about. Suppressing 72 and 235 without it would have protected nothing while
reporting itself as working. Written up in
`docs/findings/2026-09-05-label-21-the-one-that-mattered.md`.

**Known gap: end to end encrypted threads are not covered**, because their receipt is encrypted
before it reaches this socket, and nothing in the extension detects that it is doing nothing there.
Manual QA item 31 measures it, and the popup has to say so before this ships.

Instagram gets nothing, including its own `hideReadReceipts`, which stays planned. Which site may
suppress what is decided by a table in `src/core/suppressionConfig.ts` rather than by a condition,
because a condition there was untestable while every unlisted site was also planned, and an
untestable guard looks like protection without being any.

Current branch is `feat/m3b-suppress-read-and-typing`, which holds a bug fix, the console probe
described below, and its findings. No M3b behaviour yet.

264 unit tests, 4 end to end tests, `pnpm lint`, `pnpm compile`, `pnpm test`, `pnpm test:e2e` and
`pnpm build:all` all pass.

## What was learned from a live session

Messenger sends over `wss://gateway.messenger.com/ws/lightspeed`, in frames that are a twelve byte
binary header followed by JSON. The header contains the bytes `7b 7d`, an ASCII `{}`, so a parser
scanning for the first brace parses that and reports success on a frame it never read.

| Signal | Task label | Envelope |
| :-- | :-- | :-- |
| Read receipt | **72** and **235** | `{ epoch_id, tasks, version_id }`, an array |
| Typing | **3** | `{ label, payload, version }`, a single task |

Two envelope shapes on one socket. A parser written for one passes the other through while
reporting itself healthy.

The sockets are created in the **top frame**, not in a worker, so a content script reaches them.
All three tasks carry `thread_key` and no timestamp, so dropping a frame should be enough and
nothing needs rewriting.

Instagram uses `gateway.instagram.com`, a different host. No Instagram task label was ever
observed, and the Instagram module must not inherit 3, 72 or 235.

## The next thing to do

**Run items 24 to 30 of `docs/MANUAL_QA.md`.** M3b is written and every automated check passes, but
nothing has watched it work in a real browser, and this is the first code in the project that
withholds something a page tried to send.

Item 26 is the one that matters: send, receive, scroll, switch threads. A dropped frame that should
not have been dropped shows up as a freeze or a message that never arrives, and no unit test can
see it. If that fails, the feature comes back out rather than shipping degraded.

Item 30 is worth reading even when everything passes. `websocket.mixed` in the background console
means read receipts are being batched with unrelated tasks and leaking through by design. Four
observed signal frames were all pure, but four is four, and the counter is there because that
sample is small.

## Then

Plan M3b from what that answers. Its shape is already constrained:

- One frame decoder that locates the JSON rather than seeking past a fixed header, and a task
  extractor handling both envelopes. Do not build `mqtt.ts`; that transport was never observed.
- A frame is dropped only when every task in it is a signal task. Mixed frames pass through and
  are counted. See the findings for why this replaces the batching question rather than answering
  it.
- Task labels belong in each site module's `signatures.ts` as an array. These are three numbers
  from one account on one day, and the original research's numbers did not survive contact with
  this build.
- Consider narrowing permissions. `fbsbx.com` and `all_frames` were requested because the socket
  might have lived in that iframe. It does not.
- Typing is parked. Resume with the typing transport probe, not with more gateway runs.
  Instagram still needs a full controlled comparison of its own: exercise one action, exercise a
  neighbouring action that should not produce the signal, keep only what differs.

## How this project works

Plans live in `docs/superpowers/plans/` and are executed task by task, each by a fresh subagent,
with a review after. Reviews have repeatedly found real defects, including two ways to defeat the
payload scrubber and a step in a plan that claimed to break something and did not.

Two habits are worth keeping. Every verification step breaks something on purpose first, because a
passing run cannot distinguish a working check from an absent one. And a plan is a draft written in
advance: when the code disagrees with it, the code is right and the plan gets corrected.
