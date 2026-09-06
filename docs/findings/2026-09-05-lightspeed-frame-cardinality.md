# One frame, how many tasks: a run that answered less than it claimed

Date: 2026-09-05
Method: `tools/probes/lightspeed-frame-probe.js` pasted into the messenger.com page console on a
logged in account. Labels, field names, byte lengths and counts only. No value was read.

## What the probe said, and why it was wrong to say it

It reported `DROPPING THE FRAME IS SAFE`. **That verdict is void.** It was computed over 45 of the
157 frames the socket sent. The other 112, seventy one percent of the traffic, the decoder could
not read, and it announced a healthy result anyway.

This is the same failure the project has now hit three times: a parser reporting confidence about
frames it never parsed. The probe recorded `lightspeedFramesUndecoded` correctly and then ignored
its own number. It has since been changed so that an incomplete sample forces `INCONCLUSIVE`, and
four deliberate mutations confirm the guard fires. Re-run before trusting any verdict below.

## What the run did establish

These do not depend on the undecoded frames, so they survive.

**Frames are heavily batched.** Task counts per frame:

| Tasks in frame | Frames |
| :-- | :-- |
| 0 | 1 |
| 1 | 19 |
| 2 | 15 |
| 3 | 3 |
| 4 | 4 |
| 5 | 1 |
| 20 | 1 |
| 34 | 1 |

A frame carrying thirty four tasks exists. Any design that drops whole frames is gambling that a
read receipt never lands in one of those, and two observed signal frames is nowhere near enough to
say it does not.

**72 and 235 do not travel together, and each arrives doubled.**

| Frame | Tasks | Labels |
| :-- | :-- | :-- |
| 132 | 2 | `72`, `72` |
| 133 | 2 | `235`, `235` |

The 2026-09-05 transport findings say the two labels are "sent together on the same action". Same
action, yes. Same frame, no. They are separate frames, and each frame carries its label twice.
Whether the two copies differ in their payload is unknown: the probe did not report task fields on
that run. It does now.

**The header is not twelve bytes, and not a fixed length.** Observed offsets to the start of real
JSON were 16 on 44 frames and 8 on one. The earlier session recorded 12. Three different numbers
across two sessions means M3b must locate the JSON, never seek to a constant.

**Label 21 exists after all.** It appeared once. The earlier findings recorded it as never seen in
any pass, and treated the research report naming it as discredited. Partly reinstated.

**Four labels nobody has seen before:** 170, 192, 228 and 436. Full frequency for the run:

| Label | Count | | Label | Count |
| :-- | :-- | :-- | :-- | :-- |
| 21 | 1 | | 207 | 69 |
| 54 | 12 | | 209 | 5 |
| 72 | 2 | | 228 | 2 |
| 117 | 12 | | 235 | 2 |
| 145 | 10 | | 436 | 3 |
| 170 | 1 | | 751 | 1 |
| 192 | 1 | | 767 | 12 |

**One decoded frame used an envelope matching neither known shape.** Reported as `unknown`, which
is the correct behaviour and also an open question.

**Typing was not captured.** Label 3 does not appear anywhere in the run, and no `single` envelope
was decoded. Either the composer was not exercised or those frames are among the 112. The typing
half of M3b remains unmeasured.

## Second run, same day, with the fixed probe

The re-run answered what the first could not, mostly by accounting for its own gaps.

**The control was clean.** Opening an already read thread produced **no `/ws/lightspeed` frames at
all**, not merely no signal frames. Read receipt traffic is not buried inside routine navigation.

**Every undecodable frame is accounted for, and none could have carried a task.** 35 frames sent,
9 decoded, 26 not. Those 26 are 1, 3 and 8 bytes long. A task envelope does not fit in 8 bytes.
Their leading bytes group cleanly:

| Shape | Count | What it is |
| :-- | :-- | :-- |
| `0e <seq> 00`, 3 bytes | 9 | one per data frame, sequences `70` to `78` |
| `0c <seq> 00 02 00 00 00 00`, 8 bytes | 9 | one per data frame, same sequences |
| `0c 0a ...` and `0c 06 ...`, 8 bytes | 7 | control traffic on two other sequence streams |
| `09`, 1 byte | 1 | a ping |

The nine decoded data frames carry sequences `70` through `78`, and each has exactly one 3 byte
and one 8 byte companion on the same sequence number. The accounting is exhaustive with nothing
left over, so **the socket was fully observed** and the sample has no hole in it.

**The header is 16 bytes, and structured.** All nine decoded frames had exactly 16.

```
0f 70 00 02 00 00 7b 7d 0d 70 00 2c 02 00 00 80
   ^^                ^^ ^^    ^^    ^^^^^^^^ ^^
   sequence          '{' '}'  seq   length   flag
```

Bytes 11 to 13 read as a little endian length: 556 on frame `70`, 206 on frame `72`. That explains
the "twelve byte header" in the earlier transport findings. That reading stopped at the first byte
of the length field and mistook it for the end of the header. **The header has been 16 bytes both
times this probe has measured it.** M3b should still locate the JSON rather than seek to 16, since
the cost is nothing, but the earlier alarm about a moving header was mine and was wrong.

**The signal pattern reproduced exactly.**

| Frame | Tasks | Labels | Fields |
| :-- | :-- | :-- | :-- |
| 16 | 2 | `72`, `72` | `thread_key`, `thread_key` |
| 17 | 2 | `235`, `235` | `thread_key`, `thread_key` |

Same shape as frames 132 and 133 of the first run: 72 and 235 in **separate** frames, each doubled,
each task carrying `thread_key` alone, and **never sharing a frame with anything else**. Four
signal frames across two independent sessions, all pure.

**Typing still has no label.** A `single` envelope frame did appear, one of them, so the typing
transport is real. But **label 3 never appeared in either run**. The single envelope frame carries
one of 6, 21, 192, 209 or 389, and this run could not say which because the probe reported labels
without saying which envelope they arrived in. It does now.

**Two labels from the discredited research report came back.** Label **21** appeared in both runs,
and label **389**, named in the research for the read watermark on end to end encrypted threads,
appeared here for the first time. The earlier findings recorded both as never seen. Neither is
understood, and neither should be acted on.

## What this means for M3b's design

The batching question has a better answer than either option it was posed with. **M3b does not need
to know in advance whether frames are batched, because it can check at the moment it matters.**

Drop a frame only when **every** task in it is a signal task. Pass through any frame that mixes
one with something else, and count those pass throughs so a leak is visible rather than silent.
That inverts the risk: the observation that signal frames are pure stops being a bet the design
rests on, and becomes the reason the feature will work in the common case.

The failure directions are then both acceptable. A mixed frame passes through, so a read receipt
leaks and the counter says so. No innocent task is ever dropped, so the app never breaks. Given
that the first run saw frames of 20 and 34 tasks, a design that could not do this would have been
gambling.

## Third run: typing is not on this socket at all

A run dedicated to typing, with the recipient confirming the indicator appeared on their side,
captured **two `/ws/lightspeed` frames, both one byte pings**. Nothing else. Other paths were busy
(`/ws/streamcontroller` 15, `/ws/realtime` 8, `/ws/rpsignaling` 3) but lightspeed carried no data
frame at all while typing was visibly working.

**Typing does not travel as a `WebSocket.send` on the top frame lightspeed socket.** The transport
findings record a 299 byte lightspeed frame with label 3 from an earlier session. Whatever that
was, it is not reproducible here, and label 3 has now failed to appear across three runs.

That run also exposed a defect in the probe: with nothing decoded there was no size to calibrate
against, so it reported two one byte pings as "large enough to have carried a task". Fixed with a
fallback floor, reported as `floorWasCalibrated` so a calibrated threshold is never confused with
an assumed one.

The open hypotheses, which `tools/probes/typing-transport-probe.js` was written to separate:

| Hypothesis | What would show it |
| :-- | :-- |
| Typing is an http call | a `fetch` or `xhr` during the typing window, most likely with a GraphQL operation name saying so |
| Typing rides another socket | a `ws.send` on `/ws/realtime` or `/ws/streamcontroller` present only while typing |
| Typing lives in a worker | a `worker.create` or `sharedworker.create`, and a page console that cannot reach it |
| Typing uses a channel nobody watched | every window looking alike |

Nothing about the read receipt findings depends on this. 72 and 235 were observed on lightspeed
across two runs and are unaffected.

## Fourth run: every path decoded, and still no attribution

A run watching all four gateway paths, with no marks.

| Path | Sent | Decoded | Labels seen |
| :-- | :-- | :-- | :-- |
| `/ws/lightspeed` | 39 | 9 | 308, 389, 308, 389, 6, 6, 21, 308, 389 |
| `/ws/realtime` | 39 | 19 | none, frames of 6 to 7 KB, telemetry batches |
| `/ws/streamcontroller` | 9 | 3 | none, a shape no envelope explains |
| `/ws/rpsignaling` | 4 | 0 | none |

**Label 308 is new**, and it arrives paired with 389: three `308, 389` pairs in sequence. 389 is
the label the discredited research report named for the read watermark on encrypted threads. Both
are now observed repeatedly. Neither is understood, and **no run so far has marked its actions**,
so nothing here can be tied to typing or to anything else.

**`/ws/streamcontroller` runs a different protocol.** Its frames carry a 14 byte header and an
outer object holding a single `payload` key, where lightspeed carries four. Sample header:

```
0d 02 00 bb 00 00 10 80 3c 16 1e 18 b1 01 | {"payload"
```

**It is probably not typing.** The frames arrive in a strict repeating cycle of 193, 2928 and 192
bytes, interleaved with the realtime telemetry batches. A typing indicator repeats, but it does not
lock into a fixed three frame cycle alongside a 2.9 KB companion. This looks like periodic
machinery. It is recorded as a candidate rather than dismissed, because the probe had no marks and
could not prove it either way.

**The lesson from four runs is about method, not about Meta.** Every run produced label lists that
could not be attributed to an action, because no run marked what the person was doing. The probe
now takes marks and reports per window, which is what the controlled comparison in the transport
findings was always supposed to be.

## Fifth run: the first with marks, and the first that narrows typing

Windows were marked `idle`, `typing`, `stopped`. What arrived in each:

| Window | `/ws/lightspeed` | `/ws/realtime` | `/ws/streamcontroller` |
| :-- | :-- | :-- | :-- |
| idle | pings only | 8 telemetry frames | pings only |
| **typing** | **pings only** | 2 telemetry frames | **193b + 2928b** |
| stopped | pings only | 2 telemetry frames | **193b** |

**Typing sends nothing on `/ws/lightspeed`. Confirmed twice now, this time with marks.** Whatever
the transport findings recorded as a 299 byte label 3 frame, it is not what this account does.

**The candidate is `presenceReportingAmendment` on `/ws/streamcontroller`.** Five streamcontroller
frames decoded, in three sizes, and the shapes reported were `presenceReportingAmendment` three
times and `additionalContacts` twice. Three small frames of 192 and 193 bytes, two large ones of
2928. The counts force the mapping: the small frames are the presence amendments, the large ones
are contact lists.

Those presence frames appeared once before any mark, once while typing, and once after stopping,
and **never while idle**. One at the start of typing and one at the end is what a typing indicator
looks like, since it has to be turned off as well as on. It is equally what an activity state
change looks like.

**This is not yet proof, and the name argues against it.** `presenceReportingAmendment` reads as
online status, and the extension has no active status feature to attach it to: the planned Facebook
list is read receipts, typing, story views, feed refresh and suggested posts. Presence and typing
being carried by one message is plausible but unestablished.

**The shape reader was too shallow to settle it.** It reported the payload as the single word
`presenceReportingAmendment`, because it only descended into json hiding inside a string and
stopped at a plainly nested object. Fixed, and it now descends three levels and names the shape of
array elements. One more run will say whether that object contains a typing field.

**Three envelopes on lightspeed, not two.** A third shape appeared five times:
`database, epoch_id, failure_count, last_applied_cursor, sync_params, version`. That is sync state,
not tasks, and it accounts for many of the frames earlier runs filed as unknown.

**A single frame carried 100 tasks**, and another 44, all label 207. That is contact sync, and it
is the strongest evidence yet that frame level batching is real and large. The runtime purity check
is not a precaution against a hypothetical.

**The header is variable length by design.** Lengths of 8, 14, 15 and 16 were seen, and the leading
bytes show protobuf style field tags before the json. That is four framings across four sockets,
not one inconsistent framing, and it is a decoder concern rather than a reason to distrust a
signal. It moved from `blockers` to `notes` for that reason: it says nothing about whether a signal
frame was pure.

## Sixth run: presence ruled out, and typing parked

The deeper shape reader named it:

```
presenceReportingAmendment{reportingArguments{availability,capabilities,foregrounded,mutationId}}
```

**It is not typing.** There is no thread reference of any kind. A typing indicator has to say which
conversation it belongs to, and this cannot. `availability` and `foregrounded` are online status
and whether the tab is in front. It fires when typing starts and again when it stops for the
obvious reason: typing makes you active, stopping makes you idle again. It is a real privacy
signal, but it is active status, and the extension has no feature for it.

The same run exposed a second blind spot, found by arithmetic rather than by inspection. 35 frames
had an unrecognised envelope and only 11 produced a shape. The missing 24 were exactly the 24
decoded `/ws/realtime` frames: they have no `payload` key, so shaping only the inner made every one
of them decode and then vanish from the report while still counting as decoded. Fixed by falling
back to the outer shape, marked `outer:` so the two levels are never confused.

### Typing is parked, deliberately

Six browser sessions have established where typing is **not**: not on `/ws/lightspeed`, confirmed
twice with marks; not `presenceReportingAmendment`; not label 3, which has never appeared. What
remains is `/ws/realtime`, now visible for the first time, and the non socket channels that
`tools/probes/typing-transport-probe.js` was built for and which have never been exercised.

That is a further afternoon of somebody's time for **one of five** planned Facebook features, while
read receipts have been ready to build for four runs. The cost is no longer worth it in this
sitting. Everything needed to resume cheaply is written down: run the typing transport probe first,
since an http answer would come back with a GraphQL operation name and end the search in one pass.

## What has to happen before M3b can be planned

**Read receipts are ready to build**, with the runtime purity check above rather than an assumption.
Labels 72 and 235 go in the Facebook module's `signatures.ts` as an array. They are still four
frames from one account on two runs, which is why the check exists.

**Typing is parked**, with the negative results recorded above so the next attempt starts from them
rather than repeating them. M3b covers read receipts alone.

**Instagram remains entirely unmeasured**, on a different host, with no label ever observed. It
must not inherit 72, 235 or whatever typing turns out to be.
