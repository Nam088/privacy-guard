# Label 21, and how five runs missed the only task that carries the watermark

Date: 2026-09-05

## What was wrong

M3b shipped suppressing labels 72 and 235. That was not enough, and on its own it would have
protected nothing while reporting itself as working.

**Label 21 carries `last_read_watermark_ts`.** Observed payload:

```
thread_id, last_read_watermark_ts, sync_group, offline_threading_id
```

That field name is not an inference. Its value on the observed frame, `1788633948478`, decodes to
2026-09-05T18:45:48Z, six seconds after the fourth probe run installed, so it is a real capture
from this account and not an illustrative example.

72 and 235 carry `thread_key` and nothing else. Dropping them while letting 21 through removes the
company and leaves the message.

## Why it was missed, which matters more than the miss

**21 arrives in the single task envelope**, `{ label, payload, version }`. 72 and 235 arrive in the
array envelope, `{ epoch_id, tasks, version_id }`.

The transport findings of the same day contain this warning, written about typing:

> A parser written against the read receipt frames looks for `tasks`, finds nothing in a typing
> frame, and reports it as unrecognised. It would then pass every typing indicator straight
> through while appearing to work, which is the failure this project keeps having to design
> around.

That is exactly what happened, to the read receipt rather than to typing. The first controlled
comparison did open a thread with unread messages, and its ad hoc parser read the array envelope
and reported the single one as carrying nothing. The comparison was sound; the decoder under it
was not, and a sound method on a blind instrument produces a confident wrong answer.

Every later run decoded both envelopes and did record 21, twice. It was never acted on because
neither run was marked, so nothing could be attributed, and because the probe only reported task
field names for frames already suspected of carrying a signal. A label nobody suspected therefore
never had its fields read.

## The correction

`FACEBOOK_SIGNATURES.readReceiptLabels` is now `['21', '72', '235']`.

Adding 21 broke no test, which was its own finding: nothing pinned the list, so removing it again
would have been silent. The list is now pinned, and the watermark task has tests of its own,
including one asserting that a frame whose bytes contain `last_read_watermark_ts` is withheld.

## What is still not covered

**End to end encrypted threads.** A comprehensive report by the account holder records that E2EE
conversations do not send their read receipt over `/ws/lightspeed` in a readable form: the signal
is encrypted inside the Signal protocol payload, carried over `web-chat-e2ee.facebook.com` or
bridged through the `fbsbx.com/maw_proxy_page/` iframe. On those threads this feature does nothing,
and **nothing in the extension detects that it is doing nothing**, which is the shape of problem
this project cares most about. Manual QA item 31 exists to find out how bad it is.

## What is unresolved but not blocking

The same report names 72 as `ThreadFocusTask` and 235 as `ThreadSyncStateTask`. Those names do not
fit the controlled comparison recorded in the transport findings, which saw both labels only when
opening a thread with unread messages and neither when opening a thread already read. A pure focus
task would fire on both. Either the names are wrong or the comparison was incomplete. It does not
change what ships, because whatever they are, they appear only on the action being hidden.
