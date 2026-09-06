# Privacy Guard M3a: Observe and Capture

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get code running in every frame Messenger uses, watch what leaves the browser without changing any of it, and turn a real session into anonymised fixtures that say which context owns the socket and which transports carry read receipts.

**Architecture:** A content script at `document_start` in all frames injects an observer into the MAIN world. The observer wraps `WebSocket`, `Worker`, `SharedWorker` and `MessagePort.prototype.postMessage`, records metadata about everything that passes, and forwards nothing but that metadata to the extension through a `CustomEvent` bridge. A capture mode, off by default and never shipped enabled, additionally records scrubbed payloads so they can be exported as fixtures.

**Tech Stack:** Unchanged from M1 and M2. TypeScript strict, WXT, Preact with signals, zod, vitest, ESLint, Playwright, pnpm.

**Scope:** Milestone M3a. The parsing and blocking work is M3b, and it is deliberately not planned yet, because what it should parse is the question this plan exists to answer.

---

## Why this plan stops where it does

Spec section 3.4.1 says a parser gets written only for a transport a captured frame proves is in use. That rule makes this plan the prerequisite for the next one, and it also makes it impossible to write the next one honestly today.

Two things are genuinely unknown, and each sends the implementation somewhere different.

**Which context owns the socket.** The research suggests the messaging socket lives behind an iframe on `fbsbx.com`, and separately that a worker is involved. Those are not the same problem. If the socket is created in the iframe's document, running in all frames is enough and wrapping `WebSocket` works exactly as it does in the top frame. If it is created inside a `SharedWorker`, no content script can ever reach it, in any world, because a worker has its own global scope and extensions cannot inject into one. The interception point then has to move to where the page hands the intent to the worker, which is `postMessage` over the port.

**Which transports are still in use.** Meta finished the default end to end encryption rollout across Messenger during 2024, so the older binary transport is probably dead for ordinary chats. Probably is not something to write a parser against in either direction.

Guessing either one wrong means rewriting rather than adjusting. So this plan observes, and the plan after it acts on what was observed.

---

## What this plan must not do

**It must not change a single byte that leaves the browser.** Every wrapper here calls through to the original with the original arguments. A bug that drops or mutates a frame at this stage would break someone's messenger while we are supposedly only watching, and it would be very hard to attribute. Task 4 exists specifically to prove that pass through is intact.

**It must not capture message content by default.** Metadata means the socket URL, the byte length, the type of the object, the name of the method. It does not mean payloads. Capture mode, which does record payloads, is off by default, must be turned on deliberately, and scrubs identifiers and text before anything is stored. Task 7 tests the scrubber against realistic input, and a fixture that still contains a readable message is a failed test, not a cosmetic problem.

**It must not ship capture mode enabled.** Task 9 asserts this in the build output.

---

## File structure after this plan

```
privacy-guard/
  src/
    observe/                          pure, no extension APIs, no browser globals at import time
      types.ts                        ObservedEvent and the record shapes
      websocket.ts                    wrap WebSocket, report, pass through
      worker.ts                       wrap Worker, SharedWorker and MessagePort.postMessage
      scrub.ts                        strip identifiers and text from a payload
      install.ts                      apply every wrapper to a given global, returns an uninstall
    entrypoints/
      page-observer.ts                unlisted script, runs in the MAIN world in every frame
      messenger.content/index.ts      isolated world: inject, bridge, forward to background
    core/
      capture/
        schema.ts                     zod schema for a stored capture record
        storage.ts                    ring buffer in storage.local, export as JSON
  tests/
    unit/observe/websocket.test.ts
    unit/observe/worker.test.ts
    unit/observe/scrub.test.ts
    unit/observe/install.test.ts
    unit/capture/storage.test.ts
    fixtures/                         populated by Task 8, not by hand
```

`src/observe` runs in the MAIN world, so the existing ESLint boundary that forbids extension APIs must cover it. Task 1 extends that rule rather than adding a new one.

---

## Task 1: Extend the MAIN world boundary to the observer

The rule added in M1 names `src/interceptors` and `src/protocol`, directories the redesign never created. The code that actually runs in the MAIN world is about to live in `src/observe`, and nothing currently stops it importing an extension API.

An import like that compiles cleanly and fails only on a real page, which is the reason this rule exists at all.

**Files:**
- Modify: `eslint.config.js`

- [ ] **Step 1: Point the rule at the directory that will exist**

In `eslint.config.js`, change the second block's `files` array from the two directories that were never built to the one that is about to be:

```javascript
    files: ['src/observe/**/*.ts', 'src/protocol/**/*.ts'],
```

`src/protocol` stays because M3b will create it for the parsers, and a rule that is already in place when the directory appears cannot be forgotten.

- [ ] **Step 2: Prove the rule fires on the new directory**

Run:
```bash
mkdir -p src/observe
cat > src/observe/boundary-probe.ts <<'PROBEEOF'
import { storage } from '#imports';

export const probe = storage;
PROBEEOF
pnpm exec eslint src/observe/boundary-probe.ts; echo "exit=$?"
rm -f src/observe/boundary-probe.ts
```
Expected: an error naming `no-restricted-imports` with the MAIN world message, and `exit=1`.

If it exits 0 the rule is decoration. Fix the pattern until it fires.

- [ ] **Step 3: Verify and commit**

Run: `pnpm lint && pnpm compile && pnpm test`
Expected: all pass, still 118 unit tests.

```bash
git add eslint.config.js
git commit -m "chore: point the MAIN world lint boundary at src/observe"
```

---

## Task 2: The observation record

One shape describes everything the observer reports, so the bridge, the storage and the analysis all speak the same language. Getting it wrong here is felt in every later task.

**Files:**
- Create: `src/observe/types.ts`
- Test: `tests/unit/observe/types.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/observe/types.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { describeValue, newEvent } from '@/observe/types';

describe('newEvent', () => {
  it('stamps a monotonic sequence so ordering survives transport', () => {
    const first = newEvent('websocket.send', 'wss://example.test/');
    const second = newEvent('websocket.send', 'wss://example.test/');
    expect(second.seq).toBeGreaterThan(first.seq);
  });

  it('records the kind and the target', () => {
    const event = newEvent('worker.create', 'https://example.test/w.js');
    expect(event.kind).toBe('worker.create');
    expect(event.target).toBe('https://example.test/w.js');
  });

  it('carries no payload unless one is attached', () => {
    expect(newEvent('websocket.send', 'wss://example.test/').payload).toBeUndefined();
  });

  it('records the frame it came from', () => {
    expect(newEvent('websocket.send', 'wss://example.test/', 'https://a.test/x').frameUrl).toBe(
      'https://a.test/x',
    );
  });
});

describe('describeValue', () => {
  it('reports a string by length, never by content', () => {
    const described = describeValue('a very secret message');
    expect(described.type).toBe('string');
    expect(described.byteLength).toBe(21);
    expect(JSON.stringify(described)).not.toContain('secret');
  });

  it('reports an ArrayBuffer by length', () => {
    const described = describeValue(new ArrayBuffer(64));
    expect(described.type).toBe('ArrayBuffer');
    expect(described.byteLength).toBe(64);
  });

  it('reports a typed array by byte length, not element count', () => {
    const described = describeValue(new Uint16Array(8));
    expect(described.type).toBe('Uint16Array');
    expect(described.byteLength).toBe(16);
  });

  it('reports a Blob by size', () => {
    const described = describeValue(new Blob(['abcd']));
    expect(described.type).toBe('Blob');
    expect(described.byteLength).toBe(4);
  });

  it('survives a value it does not recognise', () => {
    const described = describeValue({ weird: true } as unknown as string);
    expect(described.type).toBe('unknown');
    expect(described.byteLength).toBe(0);
  });

  it('survives null and undefined without throwing', () => {
    expect(describeValue(null as unknown as string).type).toBe('unknown');
    expect(describeValue(undefined as unknown as string).type).toBe('unknown');
  });
});
```

The assertion that a described string does not contain its own content is the important one. It is
the difference between a metadata record and a wiretap.

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm test tests/unit/observe/types.test.ts`
Expected: FAIL, cannot resolve `@/observe/types`.

- [ ] **Step 3: Write the minimal implementation**

`src/observe/types.ts`:

```typescript
export type ObservedKind =
  | 'websocket.create'
  | 'websocket.send'
  | 'worker.create'
  | 'sharedworker.create'
  | 'port.postMessage';

export interface DescribedValue {
  type: string;
  byteLength: number;
}

export interface ObservedEvent {
  seq: number;
  at: number;
  kind: ObservedKind;
  target: string;
  frameUrl?: string;
  value?: DescribedValue;
  payload?: string;
}

export type Report = (event: ObservedEvent) => void;

let sequence = 0;

export function newEvent(
  kind: ObservedKind,
  target: string,
  frameUrl?: string,
): ObservedEvent {
  sequence += 1;
  return {
    seq: sequence,
    at: Date.now(),
    kind,
    target,
    frameUrl,
  };
}

export function describeValue(value: unknown): DescribedValue {
  if (typeof value === 'string') {
    return { type: 'string', byteLength: new TextEncoder().encode(value).length };
  }
  if (value instanceof ArrayBuffer) {
    return { type: 'ArrayBuffer', byteLength: value.byteLength };
  }
  if (ArrayBuffer.isView(value)) {
    return { type: value.constructor.name, byteLength: value.byteLength };
  }
  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    return { type: 'Blob', byteLength: value.size };
  }
  return { type: 'unknown', byteLength: 0 };
}
```

`Report` lives here rather than in each observer, because three copies of the same function type
drift apart the moment one of them gains a parameter, and nothing would fail until the call sites
disagreed at runtime.

`describeValue` returns a length and a type name and nothing else. The `payload` field on
`ObservedEvent` exists for capture mode alone, and Task 7 is what fills it, after scrubbing.

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm test tests/unit/observe/types.test.ts`
Expected: 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/observe/types.ts tests/unit/observe/types.test.ts
git commit -m "feat: the observation record, metadata only by construction"
```

---

## Task 3: Wrap WebSocket

**Files:**
- Create: `src/observe/websocket.ts`
- Test: `tests/unit/observe/websocket.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/observe/websocket.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from 'vitest';
import { observeWebSocket } from '@/observe/websocket';
import type { ObservedEvent } from '@/observe/types';

class FakeSocket {
  static instances: FakeSocket[] = [];
  sent: unknown[] = [];
  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }
  send(data: unknown): void {
    this.sent.push(data);
  }
}

function makeGlobal() {
  FakeSocket.instances = [];
  return { WebSocket: FakeSocket } as unknown as {
    WebSocket: typeof WebSocket;
  };
}

describe('observeWebSocket', () => {
  let events: ObservedEvent[];
  let scope: ReturnType<typeof makeGlobal>;

  beforeEach(() => {
    events = [];
    scope = makeGlobal();
  });

  it('reports each socket as it is created', () => {
    const uninstall = observeWebSocket(scope, (e) => events.push(e));
    new scope.WebSocket('wss://example.test/chat');
    expect(events.map((e) => e.kind)).toContain('websocket.create');
    expect(events[0]?.target).toBe('wss://example.test/chat');
    uninstall();
  });

  it('reports each send with a description of the value', () => {
    const uninstall = observeWebSocket(scope, (e) => events.push(e));
    const socket = new scope.WebSocket('wss://example.test/chat');
    (socket as unknown as FakeSocket).send('hello');
    const send = events.find((e) => e.kind === 'websocket.send');
    expect(send?.value).toEqual({ type: 'string', byteLength: 5 });
    uninstall();
  });

  it('never records the sent content', () => {
    const uninstall = observeWebSocket(scope, (e) => events.push(e));
    const socket = new scope.WebSocket('wss://example.test/chat');
    (socket as unknown as FakeSocket).send('a very secret message');
    expect(JSON.stringify(events)).not.toContain('secret');
    uninstall();
  });

  it('passes the value through to the original send, byte for byte', () => {
    const uninstall = observeWebSocket(scope, () => {});
    const socket = new scope.WebSocket('wss://example.test/chat');
    const payload = new Uint8Array([1, 2, 3]);
    (socket as unknown as FakeSocket).send(payload);
    expect(FakeSocket.instances[0]?.sent[0]).toBe(payload);
    uninstall();
  });

  it('still sends when the reporter throws', () => {
    const uninstall = observeWebSocket(scope, () => {
      throw new Error('reporter exploded');
    });
    const socket = new scope.WebSocket('wss://example.test/chat');
    expect(() => (socket as unknown as FakeSocket).send('x')).not.toThrow();
    expect(FakeSocket.instances[0]?.sent).toEqual(['x']);
    uninstall();
  });

  it('restores the original constructor on uninstall', () => {
    const original = scope.WebSocket;
    const uninstall = observeWebSocket(scope, () => {});
    expect(scope.WebSocket).not.toBe(original);
    uninstall();
    expect(scope.WebSocket).toBe(original);
  });

  it('does nothing and does not throw when the global has no WebSocket', () => {
    expect(() => observeWebSocket({}, () => {})()).not.toThrow();
  });

  it('installs only once even if called twice', () => {
    const first = observeWebSocket(scope, (e) => events.push(e));
    const second = observeWebSocket(scope, (e) => events.push(e));
    const socket = new scope.WebSocket('wss://example.test/chat');
    (socket as unknown as FakeSocket).send('x');
    expect(events.filter((e) => e.kind === 'websocket.send')).toHaveLength(1);
    second();
    first();
  });
});
```

Two of these carry the weight. The pass through test asserts identity, not equality, so a wrapper
that helpfully copies a buffer fails it. The reporter throwing test guarantees that a bug in the
observation path can never stop a message being sent.

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm test tests/unit/observe/websocket.test.ts`
Expected: FAIL, cannot resolve `@/observe/websocket`.

- [ ] **Step 3: Write the minimal implementation**

`src/observe/websocket.ts`:

```typescript
import {
  describeValue,
  newEvent,
  type ObservedEvent,
  type Report,
} from './types';

interface SocketScope {
  WebSocket?: typeof WebSocket;
}

const INSTALLED = new WeakSet<object>();

export function observeWebSocket(
  scope: SocketScope,
  report: Report,
  frameUrl?: string,
): () => void {
  const Original = scope.WebSocket;
  if (typeof Original !== 'function' || INSTALLED.has(scope)) {
    return () => {};
  }
  INSTALLED.add(scope);

  const safely = (build: () => ObservedEvent): void => {
    try {
      report(build());
    } catch {
      // Observation must never affect the page.
    }
  };

  const originalSend = Original.prototype.send;

  function patchedSend(this: WebSocket, data: unknown): void {
    safely(() => {
      const event = newEvent('websocket.send', this.url, frameUrl);
      event.value = describeValue(data);
      return event;
    });
    return originalSend.call(this, data as never);
  }

  Original.prototype.send = patchedSend as typeof originalSend;

  const Wrapped = new Proxy(Original, {
    construct(target, args: [string, ...unknown[]], newTarget) {
      safely(() => newEvent('websocket.create', String(args[0]), frameUrl));
      return Reflect.construct(target, args, newTarget);
    },
  });

  scope.WebSocket = Wrapped;

  return () => {
    Original.prototype.send = originalSend;
    scope.WebSocket = Original;
    INSTALLED.delete(scope);
  };
}
```

A `Proxy` on the constructor rather than a subclass keeps every static property and the prototype
identity intact, which matters because page code frequently compares against `WebSocket` or reads
`WebSocket.OPEN`.

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm test tests/unit/observe/websocket.test.ts`
Expected: 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/observe/websocket.ts tests/unit/observe/websocket.test.ts
git commit -m "feat: observe WebSocket creation and sends without touching them"
```

---

## Task 4: Prove pass through is byte exact

Task 3 asserts pass through for one send. This task asserts it for a stream of varied values, and
it is the safety net for the whole plan. If observation ever alters what leaves the browser, this
is what should catch it.

**Files:**
- Create: `tests/unit/observe/passthrough.test.ts`

- [ ] **Step 1: Write the test**

`tests/unit/observe/passthrough.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { observeWebSocket } from '@/observe/websocket';

class RecordingSocket {
  static last: RecordingSocket | undefined;
  sent: unknown[] = [];
  constructor(public url: string) {
    RecordingSocket.last = this;
  }
  send(data: unknown): void {
    this.sent.push(data);
  }
}

const VALUES: unknown[] = [
  '',
  'plain text',
  'unicode nghiêng 日本語 🙂',
  new ArrayBuffer(0),
  new ArrayBuffer(1024),
  new Uint8Array([0, 1, 2, 255]),
  new Uint16Array([65535, 0]),
  new DataView(new ArrayBuffer(8)),
];

describe('observation never alters what is sent', () => {
  it('passes every value through by identity', () => {
    const scope = { WebSocket: RecordingSocket } as unknown as {
      WebSocket: typeof WebSocket;
    };
    const uninstall = observeWebSocket(scope, () => {});
    const socket = new scope.WebSocket('wss://example.test/chat');

    for (const value of VALUES) {
      (socket as unknown as RecordingSocket).send(value);
    }

    const sent = RecordingSocket.last?.sent ?? [];
    expect(sent).toHaveLength(VALUES.length);
    for (const [index, value] of VALUES.entries()) {
      expect(sent[index]).toBe(value);
    }
    uninstall();
  });

  it('sends the same number of times as it is asked to', () => {
    const scope = { WebSocket: RecordingSocket } as unknown as {
      WebSocket: typeof WebSocket;
    };
    const uninstall = observeWebSocket(scope, () => {});
    const socket = new scope.WebSocket('wss://example.test/chat');
    for (let i = 0; i < 100; i += 1) {
      (socket as unknown as RecordingSocket).send(`frame ${i}`);
    }
    expect(RecordingSocket.last?.sent).toHaveLength(100);
    uninstall();
  });
});
```

- [ ] **Step 2: Confirm it passes, then prove it would catch a regression**

Run: `pnpm test tests/unit/observe/passthrough.test.ts`
Expected: 2 tests PASS.

Now break pass through deliberately. In `src/observe/websocket.ts`, change the final line of
`patchedSend` so the wrapper defensively copies a buffer before forwarding it:

```typescript
    return originalSend.call(
      this,
      (ArrayBuffer.isView(data) ? (data as Uint8Array).slice() : data) as never,
    );
```

Run the file again.
Expected: FAIL on the identity assertion, for the typed array and `DataView` entries, because a
copied buffer holds the same bytes but is a different object.

Restore the original line and confirm it passes. Quote both outputs. A pass through test that
would not notice a copy is not testing pass through.

Copying a buffer is the realistic version of this mistake. Someone adds a `.slice()` to avoid a
wrapper accidentally mutating a caller's array, the bytes still look right in every log, and the
page starts sending a different object than it built. Note that copying a *string* is not a way to
break this test: `String(x)` on a primitive string returns that same primitive, and identity
comparison on primitives is value comparison, so it would pass and tell you nothing.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/observe/passthrough.test.ts
git commit -m "test: assert observation passes every value through by identity"
```

---

## Task 5: Wrap Worker, SharedWorker and MessagePort

This is the task that answers the architectural question. If the socket turns out to live inside a
worker, no wrapper on `WebSocket` will ever see it, and the only thing an extension can watch is
the moment the page hands work to the worker.

**Files:**
- Create: `src/observe/worker.ts`
- Test: `tests/unit/observe/worker.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/observe/worker.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from 'vitest';
import { observeWorkers } from '@/observe/worker';
import type { ObservedEvent } from '@/observe/types';

class FakeWorker {
  constructor(public url: string | URL) {}
}

class FakePort {
  posted: unknown[] = [];
  postMessage(data: unknown): void {
    this.posted.push(data);
  }
}

class FakeSharedWorker {
  port = new FakePort();
  constructor(public url: string | URL) {}
}

function makeScope() {
  return {
    Worker: FakeWorker,
    SharedWorker: FakeSharedWorker,
    MessagePort: FakePort,
  } as unknown as {
    Worker: typeof Worker;
    SharedWorker: typeof SharedWorker;
    MessagePort: typeof MessagePort;
  };
}

describe('observeWorkers', () => {
  let events: ObservedEvent[];
  let scope: ReturnType<typeof makeScope>;

  beforeEach(() => {
    events = [];
    scope = makeScope();
  });

  it('reports a Worker as it is created, with its script url', () => {
    const uninstall = observeWorkers(scope, (e) => events.push(e));
    new scope.Worker('https://example.test/w.js');
    const created = events.find((e) => e.kind === 'worker.create');
    expect(created?.target).toBe('https://example.test/w.js');
    uninstall();
  });

  it('reports a SharedWorker separately, since it cannot be reached at all', () => {
    const uninstall = observeWorkers(scope, (e) => events.push(e));
    new scope.SharedWorker('https://example.test/shared.js');
    const created = events.find((e) => e.kind === 'sharedworker.create');
    expect(created?.target).toBe('https://example.test/shared.js');
    uninstall();
  });

  it('reports messages posted over a port, described not quoted', () => {
    const uninstall = observeWorkers(scope, (e) => events.push(e));
    const port = new scope.MessagePort();
    (port as unknown as FakePort).postMessage('a very secret message');
    const posted = events.find((e) => e.kind === 'port.postMessage');
    expect(posted?.value?.type).toBe('string');
    expect(JSON.stringify(events)).not.toContain('secret');
    uninstall();
  });

  it('passes a posted message through by identity', () => {
    const uninstall = observeWorkers(scope, () => {});
    const port = new scope.MessagePort();
    const payload = { task: 1 };
    (port as unknown as FakePort).postMessage(payload);
    expect((port as unknown as FakePort).posted[0]).toBe(payload);
    uninstall();
  });

  it('accepts a URL object as well as a string', () => {
    const uninstall = observeWorkers(scope, (e) => events.push(e));
    new scope.Worker(new URL('https://example.test/w.js'));
    expect(events[0]?.target).toBe('https://example.test/w.js');
    uninstall();
  });

  it('still posts when the reporter throws', () => {
    const uninstall = observeWorkers(scope, () => {
      throw new Error('reporter exploded');
    });
    const port = new scope.MessagePort();
    expect(() => (port as unknown as FakePort).postMessage('x')).not.toThrow();
    expect((port as unknown as FakePort).posted).toEqual(['x']);
    uninstall();
  });

  it('restores everything on uninstall', () => {
    const worker = scope.Worker;
    const shared = scope.SharedWorker;
    const uninstall = observeWorkers(scope, () => {});
    uninstall();
    expect(scope.Worker).toBe(worker);
    expect(scope.SharedWorker).toBe(shared);
  });

  it('survives a scope missing SharedWorker entirely', () => {
    const partial = { Worker: FakeWorker, MessagePort: FakePort } as unknown as {
      Worker: typeof Worker;
      SharedWorker: typeof SharedWorker;
      MessagePort: typeof MessagePort;
    };
    expect(() => observeWorkers(partial, () => {})()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm test tests/unit/observe/worker.test.ts`
Expected: FAIL, cannot resolve `@/observe/worker`.

- [ ] **Step 3: Write the minimal implementation**

`src/observe/worker.ts`:

```typescript
import {
  describeValue,
  newEvent,
  type ObservedEvent,
  type Report,
} from './types';

interface WorkerScope {
  Worker?: typeof Worker;
  SharedWorker?: typeof SharedWorker;
  MessagePort?: typeof MessagePort;
}

export function observeWorkers(
  scope: WorkerScope,
  report: Report,
  frameUrl?: string,
): () => void {
  const undo: Array<() => void> = [];

  const safely = (build: () => ObservedEvent): void => {
    try {
      report(build());
    } catch {
      // Observation must never affect the page.
    }
  };

  const wrapConstructor = (
    key: 'Worker' | 'SharedWorker',
    kind: 'worker.create' | 'sharedworker.create',
  ): void => {
    const Original = scope[key];
    if (typeof Original !== 'function') {
      return;
    }
    const Wrapped = new Proxy(Original, {
      construct(target, args: [string | URL, ...unknown[]], newTarget) {
        safely(() => newEvent(kind, String(args[0]), frameUrl));
        return Reflect.construct(target, args, newTarget);
      },
    });
    (scope as Record<string, unknown>)[key] = Wrapped;
    undo.push(() => {
      (scope as Record<string, unknown>)[key] = Original;
    });
  };

  wrapConstructor('Worker', 'worker.create');
  wrapConstructor('SharedWorker', 'sharedworker.create');

  const PortClass = scope.MessagePort;
  if (typeof PortClass === 'function') {
    const originalPost = PortClass.prototype.postMessage;
    function patchedPost(this: MessagePort, data: unknown, ...rest: unknown[]): void {
      safely(() => {
        const event = newEvent('port.postMessage', 'port', frameUrl);
        event.value = describeValue(data);
        return event;
      });
      return (originalPost as (...args: unknown[]) => void).call(this, data, ...rest);
    }
    PortClass.prototype.postMessage = patchedPost as typeof originalPost;
    undo.push(() => {
      PortClass.prototype.postMessage = originalPost;
    });
  }

  return () => {
    for (const step of undo.reverse()) {
      step();
    }
    undo.length = 0;
  };
}
```

`sharedworker.create` is reported under its own kind rather than folded in with `worker.create`
because the two lead to different conclusions. A `Worker` created from the page can at least be
observed at its port. A `SharedWorker` is shared across contexts and is the harder case, and
whether one appears is one of the two questions this plan exists to answer.

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm test tests/unit/observe/worker.test.ts`
Expected: 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/observe/worker.ts tests/unit/observe/worker.test.ts
git commit -m "feat: observe worker creation and port messages"
```

---

## Task 6: Install everything onto one global

**Files:**
- Create: `src/observe/install.ts`
- Test: `tests/unit/observe/install.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/observe/install.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { installObservers } from '@/observe/install';
import type { ObservedEvent } from '@/observe/types';

class FakeSocket {
  constructor(public url: string) {}
  send(): void {}
}
class FakeWorker {
  constructor(public url: string | URL) {}
}
class FakePort {
  postMessage(): void {}
}

function makeScope() {
  return {
    WebSocket: FakeSocket,
    Worker: FakeWorker,
    MessagePort: FakePort,
  } as unknown as Parameters<typeof installObservers>[0];
}

describe('installObservers', () => {
  it('observes sockets and workers through one call', () => {
    const events: ObservedEvent[] = [];
    const scope = makeScope();
    const uninstall = installObservers(scope, (e) => events.push(e));

    new (scope as unknown as { WebSocket: typeof FakeSocket }).WebSocket('wss://a.test/');
    new (scope as unknown as { Worker: typeof FakeWorker }).Worker('https://a.test/w.js');

    expect(events.map((e) => e.kind).sort()).toEqual([
      'websocket.create',
      'worker.create',
    ]);
    uninstall();
  });

  it('restores every global it touched', () => {
    const scope = makeScope();
    const before = {
      WebSocket: (scope as unknown as Record<string, unknown>).WebSocket,
      Worker: (scope as unknown as Record<string, unknown>).Worker,
    };
    installObservers(scope, () => {})();
    expect((scope as unknown as Record<string, unknown>).WebSocket).toBe(before.WebSocket);
    expect((scope as unknown as Record<string, unknown>).Worker).toBe(before.Worker);
  });

  it('tags every event with the frame url it was given', () => {
    const events: ObservedEvent[] = [];
    const scope = makeScope();
    const uninstall = installObservers(scope, (e) => events.push(e), 'https://a.test/frame');
    new (scope as unknown as { WebSocket: typeof FakeSocket }).WebSocket('wss://a.test/');
    expect(events[0]?.frameUrl).toBe('https://a.test/frame');
    uninstall();
  });

  it('does not throw on a global missing everything', () => {
    const empty = {} as Parameters<typeof installObservers>[0];
    expect(() => installObservers(empty, () => {})()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm test tests/unit/observe/install.test.ts`
Expected: FAIL, cannot resolve `@/observe/install`.

- [ ] **Step 3: Write the minimal implementation**

`src/observe/install.ts`:

```typescript
import type { Report } from './types';
import { observeWebSocket } from './websocket';
import { observeWorkers } from './worker';

type ObservableScope = Parameters<typeof observeWebSocket>[0] &
  Parameters<typeof observeWorkers>[0];

export function installObservers(
  scope: ObservableScope,
  report: Report,
  frameUrl?: string,
): () => void {
  const undoSocket = observeWebSocket(scope, report, frameUrl);
  const undoWorkers = observeWorkers(scope, report, frameUrl);
  return () => {
    undoWorkers();
    undoSocket();
  };
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm test tests/unit/observe/install.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/observe/install.ts tests/unit/observe/install.test.ts
git commit -m "feat: install every observer onto one global"
```

---

## Task 7: The scrubber

Capture mode records payloads, and a payload from a live session contains other people's messages.
Nothing leaves this machine, but a fixture file lives in a repository and gets read by people and
pasted into issues, so it must not contain anything worth protecting.

The rule is allowlist, not denylist. Structure is kept, content is replaced. A denylist that tries
to spot secrets will always miss one.

**Files:**
- Create: `src/observe/scrub.ts`
- Test: `tests/unit/observe/scrub.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/observe/scrub.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { scrub } from '@/observe/scrub';

describe('scrub', () => {
  it('keeps object keys, since the shape is what we are studying', () => {
    const out = scrub({ tasks: [{ label: '389', payload: 'x' }] });
    expect(Object.keys(out as object)).toEqual(['tasks']);
  });

  it('replaces every string value with a length marker', () => {
    const out = scrub({ text: 'see you at eight' }) as Record<string, string>;
    expect(out.text).toBe('<string:16>');
  });

  it('keeps short numeric labels, because they are the thing being identified', () => {
    const out = scrub({ label: '389' }) as Record<string, string>;
    expect(out.label).toBe('389');
  });

  it('redacts a long number that could be an account or thread id', () => {
    const out = scrub({ thread_key: 8482072268488190 }) as Record<string, string>;
    expect(out.thread_key).toBe('<number:16>');
  });

  it('keeps a small number, which carries structure not identity', () => {
    const out = scrub({ type: 4 }) as Record<string, number>;
    expect(out.type).toBe(4);
  });

  it('keeps booleans and null', () => {
    const out = scrub({ ok: true, missing: null }) as Record<string, unknown>;
    expect(out.ok).toBe(true);
    expect(out.missing).toBeNull();
  });

  it('recurses into nested objects and arrays', () => {
    const out = scrub({ a: [{ b: 'secret' }] }) as { a: Array<{ b: string }> };
    expect(out.a[0]?.b).toBe('<string:6>');
  });

  it('parses and scrubs a string that contains json, since payloads nest', () => {
    const out = scrub({ payload: '{"text":"hello there"}' }) as Record<string, unknown>;
    expect(out.payload).toEqual({ text: '<string:11>' });
  });

  it('leaves nothing readable from a realistic frame', () => {
    const frame = {
      app_id: '2220391788200892',
      payload: JSON.stringify({
        // Real Meta epoch ids are 19 digits, past Number.MAX_SAFE_INTEGER, so JavaScript
        // cannot hold this one exactly. The value is kept realistic rather than shrunk,
        // because nothing here asserts on it and the size is itself the point. See spec
        // section 3.4.2 for why this matters to M3b.
        // eslint-disable-next-line no-loss-of-precision
        epoch_id: 7501954664706356560,
        tasks: [
          {
            label: '389',
            payload: JSON.stringify({
              thread_key: 8482072268488190,
              text: 'meet me at the usual place',
            }),
          },
        ],
      }),
    };
    const serialised = JSON.stringify(scrub(frame));
    expect(serialised).not.toContain('meet me');
    expect(serialised).not.toContain('8482072268488190');
    expect(serialised).not.toContain('2220391788200892');
    expect(serialised).toContain('389');
  });

  it('caps recursion so a cyclic or vast object cannot hang the page', () => {
    const deep: Record<string, unknown> = {};
    let node = deep;
    for (let i = 0; i < 200; i += 1) {
      const next: Record<string, unknown> = {};
      node.next = next;
      node = next;
    }
    expect(() => scrub(deep)).not.toThrow();
  });
});
```

The realistic frame test is the one that matters. It is written the way an auditor would check the
work: take something that looks like the real thing and confirm nothing readable survives, while
the structural marker that makes the fixture useful does.

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm test tests/unit/observe/scrub.test.ts`
Expected: FAIL, cannot resolve `@/observe/scrub`.

- [ ] **Step 3: Write the minimal implementation**

`src/observe/scrub.ts`:

```typescript
const MAX_DEPTH = 12;
const SHORT_NUMBER_DIGITS = 6;

function scrubString(value: string, depth: number): unknown {
  const trimmed = value.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return scrubValue(JSON.parse(trimmed), depth + 1);
    } catch {
      // Not json after all, fall through to the length marker.
    }
  }
  if (/^\d{1,3}$/.test(value)) {
    return value;
  }
  return `<string:${value.length}>`;
}

function scrubValue(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) {
    return '<deep>';
  }
  if (value === null || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    const digits = Math.abs(value).toString().length;
    return digits > SHORT_NUMBER_DIGITS ? `<number:${digits}>` : value;
  }
  if (typeof value === 'string') {
    return scrubString(value, depth);
  }
  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = scrubValue(item, depth + 1);
    }
    return out;
  }
  return `<${typeof value}>`;
}

export function scrub(value: unknown): unknown {
  return scrubValue(value, 0);
}
```

Short digit strings survive because a task label is exactly that, and a fixture with the labels
removed would answer none of the questions this plan was written to answer. Anything longer than
six digits is treated as an identifier and replaced.

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm test tests/unit/observe/scrub.test.ts`
Expected: 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/observe/scrub.ts tests/unit/observe/scrub.test.ts
git commit -m "feat: scrub payloads by allowlist before anything is stored"
```

---

## Task 8: Reach every frame and report

Everything so far is pure and tested in Node. This task puts it on a real page.

**Files:**
- Create: `src/entrypoints/page-observer.ts`
- Create: `src/entrypoints/messenger.content/index.ts`
- Modify: `wxt.config.ts`

- [ ] **Step 1: Write the MAIN world entrypoint**

`src/entrypoints/page-observer.ts`:

```typescript
import { defineUnlistedScript } from '#imports';
import { installObservers } from '@/observe/install';
import type { ObservedEvent } from '@/observe/types';

export const OBSERVER_EVENT = 'privacy-guard:observed';

export default defineUnlistedScript(() => {
  const target = document.currentScript ?? document.documentElement;

  installObservers(
    window as unknown as Parameters<typeof installObservers>[0],
    (event: ObservedEvent) => {
      target.dispatchEvent(
        new CustomEvent(OBSERVER_EVENT, { detail: event, bubbles: true }),
      );
    },
    location.href,
  );
});
```

The event bubbles because `document.currentScript` is null once the script has finished executing,
and the content script listens on the document rather than holding the element.

- [ ] **Step 2: Write the isolated world content script**

`src/entrypoints/messenger.content/index.ts`:

```typescript
import { browser, defineContentScript, injectScript } from '#imports';
import { OBSERVER_EVENT } from '../page-observer';
import type { ObservedEvent } from '@/observe/types';

export default defineContentScript({
  matches: [
    '*://*.facebook.com/*',
    '*://*.messenger.com/*',
    '*://*.instagram.com/*',
    '*://*.fbsbx.com/*',
  ],
  allFrames: true,
  runAt: 'document_start',
  async main() {
    document.addEventListener(OBSERVER_EVENT, (event) => {
      const detail = (event as CustomEvent<ObservedEvent>).detail;
      void browser.runtime.sendMessage({ type: 'observed', event: detail });
    });

    await injectScript('/page-observer.js', { keepInDom: true });
  },
});
```

- [ ] **Step 3: Declare the host permission and the web accessible resource**

In `wxt.config.ts`, add `fbsbx.com` to `host_permissions`:

```typescript
    host_permissions: [
      '*://*.facebook.com/*',
      '*://*.messenger.com/*',
      '*://*.instagram.com/*',
      '*://*.fbsbx.com/*',
    ],
```

Also declare the injected script as a web accessible resource. WXT does not do this for you:
nothing in its manifest generation registers an unlisted script referenced by `injectScript`, and
without the declaration the page cannot load the observer at all.

```typescript
    web_accessible_resources: [
      {
        resources: ['page-observer.js'],
        matches: [
          '*://*.facebook.com/*',
          '*://*.messenger.com/*',
          '*://*.instagram.com/*',
          '*://*.fbsbx.com/*',
        ],
      },
    ],
```

Manifest V3 requires the object form with `matches`. A bare array of strings is rejected at build
time.

This is the failure that would be hardest to attribute: with no web accessible resource the
observer never loads, the capture comes back empty, and the obvious conclusion is that the socket
is unreachable. It would be a wrong architectural finding produced by a missing manifest key,
which is why Step 5 asserts on it.

- [ ] **Step 4: Verify the build**

Run: `pnpm lint && pnpm compile && pnpm test && pnpm build`
Expected: all pass, with 118 plus the new unit tests.

- [ ] **Step 5: Check the manifest got what this needs**

Run:
```bash
python3 -c "
import json
m = json.load(open('.output/chrome-mv3/manifest.json'))
print('hosts', m['host_permissions'])
cs = m['content_scripts'][0]
print('all_frames', cs.get('all_frames'))
print('run_at', cs.get('run_at'))
print('matches', cs['matches'])
print('war', [r['resources'] for r in m.get('web_accessible_resources', [])])
assert '*://*.fbsbx.com/*' in m['host_permissions'], 'fbsbx host permission missing'
assert cs.get('all_frames') is True, 'content script must run in all frames'
assert cs.get('run_at') == 'document_start', 'must run before the page scripts'
print('OK')
"
```
Expected: `OK`, `all_frames` true, `run_at` `document_start`, and the observer script listed as a
web accessible resource.

Any one of these three being wrong means the observer silently never reaches the frame that
matters, and nothing else in the run would tell you.

- [ ] **Step 6: Commit**

```bash
git add src/entrypoints/page-observer.ts src/entrypoints/messenger.content wxt.config.ts
git commit -m "feat: run the observer in every frame at document start"
```

---

## Task 9: Capture mode, off by default

**Files:**
- Create: `src/core/capture/schema.ts`
- Create: `src/core/capture/storage.ts`
- Modify: `src/entrypoints/background.ts`
- Test: `tests/unit/capture/storage.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/capture/storage.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  CAPTURE_LIMIT,
  appendCapture,
  clearCaptures,
  exportCaptures,
  readCaptures,
} from '@/core/capture/storage';
import type { ObservedEvent } from '@/observe/types';

function anEvent(seq: number): ObservedEvent {
  return {
    seq,
    at: 1000 + seq,
    kind: 'websocket.send',
    target: 'wss://example.test/chat',
    value: { type: 'string', byteLength: 4 },
  };
}

describe('capture storage', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('starts empty', async () => {
    await expect(readCaptures()).resolves.toEqual([]);
  });

  it('keeps what was appended, in order', async () => {
    await appendCapture(anEvent(1));
    await appendCapture(anEvent(2));
    const stored = await readCaptures();
    expect(stored.map((e) => e.seq)).toEqual([1, 2]);
  });

  it('drops the oldest once the limit is reached', async () => {
    for (let i = 1; i <= CAPTURE_LIMIT + 5; i += 1) {
      await appendCapture(anEvent(i));
    }
    const stored = await readCaptures();
    expect(stored).toHaveLength(CAPTURE_LIMIT);
    expect(stored[0]?.seq).toBe(6);
  });

  it('clears everything on request', async () => {
    await appendCapture(anEvent(1));
    await clearCaptures();
    await expect(readCaptures()).resolves.toEqual([]);
  });

  it('exports valid json that round trips', async () => {
    await appendCapture(anEvent(1));
    const json = await exportCaptures();
    expect(JSON.parse(json)).toHaveLength(1);
  });

  it('rejects a record that does not match the schema', async () => {
    await expect(
      appendCapture({ seq: 'one' } as unknown as ObservedEvent),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm test tests/unit/capture/storage.test.ts`
Expected: FAIL, cannot resolve `@/core/capture/storage`.

- [ ] **Step 3: Write the schema**

`src/core/capture/schema.ts`:

```typescript
import { z } from 'zod';

export const describedValueSchema = z.object({
  type: z.string(),
  byteLength: z.number(),
});

export const observedEventSchema = z.object({
  seq: z.number(),
  at: z.number(),
  kind: z.string(),
  target: z.string(),
  frameUrl: z.string().optional(),
  value: describedValueSchema.optional(),
  payload: z.unknown().optional(),
});

export const captureListSchema = z.array(observedEventSchema);
```

- [ ] **Step 4: Write the storage**

`src/core/capture/storage.ts`:

```typescript
import { storage } from '#imports';
import type { ObservedEvent } from '@/observe/types';
import { captureListSchema, observedEventSchema } from './schema';

export const CAPTURE_LIMIT = 500;

const capturesItem = storage.defineItem<ObservedEvent[]>('local:captures', {
  fallback: [],
  version: 1,
});

export async function readCaptures(): Promise<ObservedEvent[]> {
  const parsed = captureListSchema.safeParse(await capturesItem.getValue());
  return parsed.success ? (parsed.data as ObservedEvent[]) : [];
}

export async function appendCapture(event: ObservedEvent): Promise<void> {
  observedEventSchema.parse(event);
  const current = await readCaptures();
  const next = [...current, event];
  await capturesItem.setValue(next.slice(-CAPTURE_LIMIT));
}

export async function clearCaptures(): Promise<void> {
  await capturesItem.setValue([]);
}

export async function exportCaptures(): Promise<string> {
  return JSON.stringify(await readCaptures(), null, 2);
}
```

- [ ] **Step 5: Route observations to storage from the background**

In `src/entrypoints/background.ts`, add a listener that only stores when capture mode is on:

```typescript
import { appendCapture } from '@/core/capture/storage';
import { storage } from '#imports';

const captureEnabled = storage.defineItem<boolean>('local:captureEnabled', {
  fallback: false,
  version: 1,
});
```

and inside `defineBackground`:

```typescript
  browser.runtime.onMessage.addListener((message) => {
    if ((message as { type?: string })?.type !== 'observed') {
      return;
    }
    void (async () => {
      if (!(await captureEnabled.getValue())) {
        return;
      }
      try {
        await appendCapture((message as { event: never }).event);
      } catch (error) {
        console.warn('[privacy-guard] could not store an observation', error);
      }
    })();
  });
```

The default is false, and there is deliberately no interface for turning it on in this milestone.
Turning it on means running `browser.storage.local.set({ captureEnabled: true })` from the
extension console, which is a fine bar for something only a developer should ever do.

- [ ] **Step 6: Run the tests and prove the default holds**

Run: `pnpm test tests/unit/capture/storage.test.ts`
Expected: 6 tests PASS.

Run: `pnpm build && python3 -c "
import json, pathlib
src = pathlib.Path('src/entrypoints/background.ts').read_text()
assert 'fallback: false' in src, 'capture must default to off'
print('capture defaults to off: OK')
"`
Expected: `OK`.

- [ ] **Step 7: Commit**

```bash
git add src/core/capture tests/unit/capture src/entrypoints/background.ts
git commit -m "feat: capture mode, off by default, ring buffered and validated"
```

---

## Task 9b: Close the review findings before anything is captured

The branch review found six things. Two of them mean a captured fixture is not safe to commit, and
one means the capture would not answer the question this milestone exists to ask. All of them have
to land before Task 10 runs.

### The scrubber can be defeated two ways

**Object keys are never scrubbed.** `scrubValue` recurses into values only, so anything sitting in a
key survives verbatim. The reviewer put a readable sentence, a phone number and a token shaped
string in keys and got all three back unchanged. This is not hypothetical for this data: Meta
payloads routinely use identifiers as map keys rather than as values.

**A bare number of six digits or fewer passes through.** A six digit one time code survives intact,
and the rule contradicts the one two lines below it, which lets only one to three digit strings
through. The same short label gets two different thresholds depending on whether it arrived as a
number or a string, and the wider one leaks real entropy.

Task 10's own safety gate, a sweep for runs of ten or more digits, catches neither.

### Capture cannot answer the question it was built for

`ObservedEvent.payload` is declared and never assigned. `scrub` is never called outside its own
test. So capture mode as it stands records exactly what plain observation records, metadata, and a
fixture from Task 10 would contain no payloads at all.

Questions six and seven of Task 10 ask which transports appeared and which task labels were seen.
Neither is answerable from a byte length. The plan built a scrubber and a capture store and never
connected them, and running Task 10 in this state would burn a live session to produce a file that
cannot answer anything.

The connection goes in the MAIN world, not the background. Scrubbing at the source means
unscrubbed content never crosses out of the page's own realm, which is a stronger guarantee than
scrubbing later, and it costs nothing extra because the observer already holds the value.

### Three smaller things

`observeWorkers` has no re-entrancy guard, unlike `observeWebSocket`. Installing twice reports
every event twice, and tearing down in the order the installs were acquired leaves a stale wrapper
permanently in place of `MessagePort.prototype.postMessage`.

`observeWebSocket` reads `scope.WebSocket` outside any `try`, so a page with a poisoned global
throws straight out of `installObservers` and the frame silently gets no observer.

Two tests in `install.test.ts` pass even when `installObservers` is replaced with a function that
does nothing. The reviewer proved it by mutation.

### One thing that is deliberately not being fixed

The review notes that any script on the page can forge the `privacy-guard:observed` event, because
the injected observer and the page share one realm and one `document`.

That is true and it is not fixable from inside that realm. A nonce would be readable by the same
scripts that could forge the event, so adding one would produce the appearance of authentication
without the substance, which is worse than documenting the limit. Part F records it instead.

**Files:**
- Modify: `src/observe/scrub.ts`
- Modify: `tests/unit/observe/scrub.test.ts`
- Modify: `src/observe/websocket.ts`
- Modify: `src/observe/worker.ts`
- Modify: `tests/unit/observe/worker.test.ts`
- Modify: `tests/unit/observe/install.test.ts`
- Modify: `src/entrypoints/page-observer.ts`
- Modify: `src/entrypoints/messenger.content/index.ts`
- Modify: `docs/superpowers/specs/2026-09-05-privacy-guard-design.md`

### Part A: scrub keys, and use one threshold

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/observe/scrub.test.ts`:

```typescript
describe('scrub, object keys', () => {
  it('keeps a key that looks like a field name, since the shape is the point', () => {
    const out = scrub({ thread_key: 1, appId: 2, tasks: 3 }) as Record<string, unknown>;
    expect(Object.keys(out).sort()).toEqual(['appId', 'tasks', 'thread_key']);
  });

  it('redacts a key that is an identifier rather than a field name', () => {
    const out = scrub({ '8482072268488190': true }) as Record<string, unknown>;
    expect(Object.keys(out)).toEqual(['<key:16>']);
  });

  it('redacts a key that is readable text', () => {
    const out = scrub({ 'meet me at the docks at midnight': true }) as Record<string, unknown>;
    expect(JSON.stringify(out)).not.toContain('docks');
  });

  it('redacts a key that is a phone number', () => {
    const out = scrub({ '+15551234567': 1 }) as Record<string, unknown>;
    expect(JSON.stringify(out)).not.toContain('5551234567');
  });

  it('redacts a key that carries a token', () => {
    const out = scrub({ 'session_token=eyJhbGciOiJIUzI1NiJ9.secret.sig': 1 }) as Record<
      string,
      unknown
    >;
    expect(JSON.stringify(out)).not.toContain('secret');
  });
});

describe('scrub, numbers use the same threshold as strings', () => {
  it('redacts a six digit code, which a one time password looks like', () => {
    const out = scrub({ otp: 483920 }) as Record<string, string>;
    expect(out.otp).toBe('<number:6>');
  });

  it('still keeps a small structural number', () => {
    const out = scrub({ type: 4, version: 12 }) as Record<string, number>;
    expect(out.type).toBe(4);
    expect(out.version).toBe(12);
  });

  it('treats a number and a numeric string the same way', () => {
    const asNumber = scrub({ v: 4839 }) as Record<string, unknown>;
    const asString = scrub({ v: '4839' }) as Record<string, unknown>;
    expect(typeof asNumber.v).toBe('string');
    expect(typeof asString.v).toBe('string');
  });
});
```

The last one is the point of this part. One concept, one threshold, whichever type it arrived as.

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm test tests/unit/observe/scrub.test.ts`
Expected: FAIL. Keys come back unredacted and `otp` comes back as the number `483920`.

- [ ] **Step 3: Fix the scrubber**

In `src/observe/scrub.ts`, lower the threshold and add key handling:

```typescript
const MAX_DEPTH = 12;
const SHORT_DIGITS = 3;

// A key that reads like a field name is structure worth keeping. Anything else is treated as
// content, because this data uses identifiers as map keys as readily as it uses them as values.
const FIELD_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,39}$/;

function scrubKey(key: string): string {
  return FIELD_NAME.test(key) ? key : `<key:${key.length}>`;
}
```

Replace the number branch:

```typescript
  if (typeof value === 'number') {
    const digits = Math.abs(value).toString().length;
    return digits > SHORT_DIGITS ? `<number:${digits}>` : value;
  }
```

and the object branch:

```typescript
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[scrubKey(key)] = scrubValue(item, depth + 1);
    }
    return out;
  }
```

`SHORT_NUMBER_DIGITS` becomes `SHORT_DIGITS` and the string branch uses it too, so the rule is
written once:

```typescript
  if (/^\d{1,3}$/.test(value)) {
    return value;
  }
```

becomes

```typescript
  if (new RegExp(`^\d{1,${SHORT_DIGITS}}$`).test(value)) {
    return value;
  }
```

- [ ] **Step 4: Confirm, and confirm the existing tests still hold**

Run: `pnpm test tests/unit/observe/scrub.test.ts`
Expected: all pass, the original 10 plus the 8 new ones.

The realistic frame test must still pass with `label: "389"` surviving. If it does not, the
threshold went too far and structure is being destroyed along with content.

- [ ] **Step 5: Commit**

```bash
git add src/observe/scrub.ts tests/unit/observe/scrub.test.ts
git commit -m "fix: scrub object keys and use one threshold for numbers and strings"
```

### Part B: make the observer survive a poisoned global

- [ ] **Step 6: Write the failing test**

Append to `tests/unit/observe/websocket.test.ts`:

```typescript
  it('does not throw when reading the global itself throws', () => {
    const hostile = {} as { WebSocket: typeof WebSocket };
    Object.defineProperty(hostile, 'WebSocket', {
      get() {
        throw new Error('poisoned');
      },
    });
    expect(() => observeWebSocket(hostile, () => {})()).not.toThrow();
  });
```

- [ ] **Step 7: Run it to see it fail, then fix**

Run: `pnpm test tests/unit/observe/websocket.test.ts`
Expected: FAIL, the error propagates out.

In `src/observe/websocket.ts`, guard the read:

```typescript
  let Original: typeof WebSocket | undefined;
  try {
    Original = scope.WebSocket;
  } catch {
    return () => {};
  }
```

Apply the same guard to the constructor reads in `src/observe/worker.ts`.

- [ ] **Step 8: Confirm and commit**

Run: `pnpm test tests/unit/observe`
Expected: all pass.

```bash
git add src/observe/websocket.ts src/observe/worker.ts tests/unit/observe/websocket.test.ts
git commit -m "fix: survive a global that throws when read"
```

### Part C: stop observeWorkers installing twice

- [ ] **Step 9: Write the failing tests**

Append to `tests/unit/observe/worker.test.ts`:

```typescript
  it('installs only once even if called twice', () => {
    const first = observeWorkers(scope, (e) => events.push(e));
    const second = observeWorkers(scope, (e) => events.push(e));
    const port = new scope.MessagePort();
    (port as unknown as FakePort).postMessage('x');
    expect(events.filter((e) => e.kind === 'port.postMessage')).toHaveLength(1);
    second();
    first();
  });

  it('restores the true original even when torn down out of order', () => {
    const original = scope.MessagePort.prototype.postMessage;
    const first = observeWorkers(scope, () => {});
    const second = observeWorkers(scope, () => {});
    first();
    second();
    expect(scope.MessagePort.prototype.postMessage).toBe(original);
  });
```

The second test is the one that matters. A teardown that only works in one order is a trap for the
caller who does not know a double install happened.

- [ ] **Step 10: Run them to see them fail, then fix**

Run: `pnpm test tests/unit/observe/worker.test.ts`
Expected: FAIL on both.

In `src/observe/worker.ts`, add the same `WeakSet` guard `observeWebSocket` uses, so a second
install returns a no op teardown and cannot leave a stale wrapper behind.

- [ ] **Step 11: Confirm and commit**

Run: `pnpm test tests/unit/observe/worker.test.ts`
Expected: all pass.

```bash
git add src/observe/worker.ts tests/unit/observe/worker.test.ts
git commit -m "fix: guard observeWorkers against a second install"
```

### Part D: make the vacuous install tests mean something

- [ ] **Step 12: Strengthen the two tests**

In `tests/unit/observe/install.test.ts`, the restoration test and the empty scope test both pass
when `installObservers` does nothing at all. Rewrite the restoration test so it first proves
installation happened:

```typescript
  it('restores every global it touched', () => {
    const events: ObservedEvent[] = [];
    const scope = makeScope();
    const before = {
      WebSocket: (scope as unknown as Record<string, unknown>).WebSocket,
      Worker: (scope as unknown as Record<string, unknown>).Worker,
    };

    const uninstall = installObservers(scope, (e) => events.push(e));
    expect((scope as unknown as Record<string, unknown>).WebSocket).not.toBe(before.WebSocket);
    new (scope as unknown as { WebSocket: typeof FakeSocket }).WebSocket('wss://a.test/');
    expect(events).toHaveLength(1);

    uninstall();
    expect((scope as unknown as Record<string, unknown>).WebSocket).toBe(before.WebSocket);
    expect((scope as unknown as Record<string, unknown>).Worker).toBe(before.Worker);

    new (scope as unknown as { WebSocket: typeof FakeSocket }).WebSocket('wss://a.test/');
    expect(events).toHaveLength(1);
  });
```

- [ ] **Step 13: Prove they are no longer vacuous**

Temporarily replace the body of `installObservers` in `src/observe/install.ts` with
`return () => {};`.

Run: `pnpm test tests/unit/observe/install.test.ts`
Expected: FAIL, including the restoration test, which previously passed under this exact mutation.

Restore the body and confirm the file passes. Quote both outputs.

- [ ] **Step 14: Commit**

```bash
git add tests/unit/observe/install.test.ts
git commit -m "test: make the install tests fail when nothing is installed"
```

### Part E: connect the scrubber to capture

- [ ] **Step 15: Configure the observer from the content script**

In `src/entrypoints/page-observer.ts`, accept a configuration event and attach a scrubbed payload
only while capture is on:

```typescript
import { defineUnlistedScript } from '#imports';
import { installObservers } from '@/observe/install';
import { scrub } from '@/observe/scrub';
import type { ObservedEvent } from '@/observe/types';

export const OBSERVER_EVENT = 'privacy-guard:observed';
export const CONFIGURE_EVENT = 'privacy-guard:configure';

export default defineUnlistedScript(() => {
  const target = document.currentScript ?? document.documentElement;
  let capturing = false;

  document.addEventListener(CONFIGURE_EVENT, (event) => {
    capturing = Boolean((event as CustomEvent<{ capture?: boolean }>).detail?.capture);
  });

  installObservers(
    window as unknown as Parameters<typeof installObservers>[0],
    (event: ObservedEvent) => {
      if (capturing) {
        attachPayload(event);
      }
      target.dispatchEvent(
        new CustomEvent(OBSERVER_EVENT, { detail: event, bubbles: true }),
      );
    },
    location.href,
  );
});
```

and the helper, in the same file:

```typescript
function attachPayload(event: ObservedEvent, raw?: unknown): void {
  try {
    event.payload = JSON.stringify(scrub(raw));
  } catch {
    // A payload that cannot be described is simply not recorded.
  }
}
```

The observer must pass the raw value through for this to have anything to scrub, so extend
`Report` in `src/observe/types.ts` to take an optional second argument, and have
`observeWebSocket` and `observeWorkers` pass the value they already hold:

```typescript
export type Report = (event: ObservedEvent, raw?: unknown) => void;
```

At each call site that describes a value, pass the value as the second argument. Nothing else
changes, and every existing test still passes because the parameter is optional.

Scrubbing happens here, in the page's own realm, so an unscrubbed payload never crosses the
bridge at all. That is a stronger guarantee than scrubbing in the background would give, and it
costs nothing, because the observer is already holding the value.

- [ ] **Step 16: Send the configuration from the content script**

In `src/entrypoints/messenger.content/index.ts`, after injecting the script, read the flag and
tell the observer:

```typescript
    const capture = await storage.getItem<boolean>('local:captureEnabled');
    document.dispatchEvent(
      new CustomEvent(CONFIGURE_EVENT, { detail: { capture: Boolean(capture) } }),
    );
```

- [ ] **Step 17: Prove a payload actually arrives, and only when capture is on**

There is no browser here, so prove it at the unit level. Create
`tests/unit/observe/payload.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { observeWebSocket } from '@/observe/websocket';
import { scrub } from '@/observe/scrub';
import type { ObservedEvent } from '@/observe/types';

class FakeSocket {
  constructor(public url: string) {}
  send(): void {}
}

describe('the raw value reaches the reporter', () => {
  it('hands the reporter the value it can scrub', () => {
    const seen: Array<{ event: ObservedEvent; raw: unknown }> = [];
    const scope = { WebSocket: FakeSocket } as unknown as { WebSocket: typeof WebSocket };
    const uninstall = observeWebSocket(scope, (event, raw) => seen.push({ event, raw }));

    const socket = new scope.WebSocket('wss://a.test/');
    (socket as unknown as FakeSocket).send('{"tasks":[{"label":"389"}]}' as never);

    const send = seen.find((s) => s.event.kind === 'websocket.send');
    expect(send?.raw).toBe('{"tasks":[{"label":"389"}]}');
    expect(JSON.stringify(scrub(JSON.parse(String(send?.raw))))).toContain('389');
    uninstall();
  });

  it('still reports the event when no raw value is passed', () => {
    const seen: ObservedEvent[] = [];
    const scope = { WebSocket: FakeSocket } as unknown as { WebSocket: typeof WebSocket };
    const uninstall = observeWebSocket(scope, (event) => seen.push(event));
    new scope.WebSocket('wss://a.test/');
    expect(seen).toHaveLength(1);
    uninstall();
  });
});
```

- [ ] **Step 18: Verify and commit**

Run: `pnpm lint && pnpm compile && pnpm test && pnpm build`
Expected: all pass.

```bash
git add src/observe src/entrypoints tests/unit/observe
git commit -m "feat: record a scrubbed payload while capture is on"
```

### Part F: record what is not being fixed

- [ ] **Step 19: Write the limitation into the spec**

Add to section 3.7 of `docs/superpowers/specs/2026-09-05-privacy-guard-design.md`:

```
**The observation bridge is forgeable, and cannot be made otherwise.** The injected observer and
the page's own scripts share one realm and one `document`, so any script on the page can dispatch
the same `CustomEvent` the observer uses and have it accepted. A nonce would not help, since it
would be readable by exactly the scripts that could forge the event, and adding one would look
like authentication without being any.

The consequence is bounded but real. Observation is a research tool, so a page feeding it false
frames wastes an investigation rather than causing harm. It becomes serious the moment anything
decides what to block based on observed data, so no later milestone may treat an observed event as
trustworthy on its own.
```

- [ ] **Step 20: Strengthen Task 10's safety gate**

The gate in Task 10 Step 4 sweeps for runs of ten or more digits, which catches neither of the two
defeats the review found. Replace it with a check that the fixture is already what the scrubber
would produce, plus a sweep for readable prose:

```bash
python3 - <<'GATEEOF'
import json, re, sys, subprocess
path = 'tests/fixtures/session-<date>.json'
data = json.load(open(path))
blob = json.dumps(data)

long_digits = re.findall(r'\d{4,}', blob)
assert not long_digits, f'unscrubbed numbers survived: {long_digits[:5]}'

prose = re.findall(r'"[^"]*(?:\s+\w+){3,}[^"]*"', blob)
allowed = ('wss://', 'https://', 'http://')
prose = [p for p in prose if not any(a in p for a in allowed)]
assert not prose, f'something reads like a sentence: {prose[:3]}'

print('records:', len(data))
print('kinds:', sorted({d["kind"] for d in data}))
print('with payload:', sum(1 for d in data if d.get('payload')))
print('OK')
GATEEOF
```

The `with payload` count matters as much as the safety check. If it is zero, capture mode was not
on and the session must be run again rather than analysed.

- [ ] **Step 21: Verify everything and commit**

Run: `pnpm lint && pnpm compile && pnpm test && pnpm test:e2e && pnpm build:all`
Expected: all pass.

```bash
git add docs/superpowers
git commit -m "docs: record the forgeable bridge and strengthen the fixture gate"
```

---

## Task 10: Run a real session and record what was found

This is the task the whole plan exists for. It is not automatable and it needs a person with a
Messenger account.

**Files:**
- Create: `docs/findings/2026-XX-XX-messenger-transport.md`, dated on the day it is run
- Create: `tests/fixtures/` entries, exported from the session
- Modify: `docs/superpowers/specs/2026-09-05-privacy-guard-design.md`

- [ ] **Step 1: Load the extension and turn capture on**

```bash
pnpm build
```

Load `.output/chrome-mv3` unpacked. Open the background service worker console from
`chrome://extensions` and run:

```js
await chrome.storage.local.set({ captureEnabled: true })
```

- [ ] **Step 2: Exercise the surfaces that matter, one at a time**

Do each of these separately and note roughly when, so the sequence numbers can be read back
against them afterwards:

1. Open `messenger.com` and let it settle without opening any conversation.
2. Open a one to one conversation and read a message someone else sent.
3. Type into the box for a few seconds without sending.
4. Send a message.
5. Open a group conversation and read a message.
6. Open `instagram.com` direct messages and read one.
7. Open a story and watch it to the end.

Step 2 is the one that produces the read receipt. Step 3 produces the typing indicator.

- [ ] **Step 3: Export**

In the background console:

```js
const { exportCaptures } = await import(chrome.runtime.getURL('chunks/...'))
```

If the chunk path is awkward, read the raw value instead, which needs no import:

```js
copy(JSON.stringify((await chrome.storage.local.get('captures')).captures, null, 2))
```

Save it to `tests/fixtures/session-<date>.json`.

- [ ] **Step 4: Confirm the export is safe to commit before committing it**

The first version of this gate swept for runs of ten or more digits, and the branch review showed
it would have caught neither of the two ways the scrubber could be defeated. This version checks
what the scrubber actually promises.

Run, with the real filename substituted:

```bash
python3 - <<'GATEEOF'
import json, re
path = 'tests/fixtures/session-REPLACE-WITH-DATE.json'
data = json.load(open(path))
blob = json.dumps(data)

# Anything longer than a short structural label should already be a marker.
long_digits = re.findall(r'\b\d{4,}\b', blob)
assert not long_digits, f'unscrubbed numbers survived: {long_digits[:5]}'

# Four or more words in a row reads like prose, not like a field name. Urls are the
# expected exception, since socket and script targets are recorded deliberately.
prose = re.findall(r'"[^"]*(?:\s+\w+){3,}[^"]*"', blob)
prose = [p for p in prose if not any(a in p for a in ('wss://', 'https://', 'http://'))]
assert not prose, f'something reads like a sentence: {prose[:3]}'

with_payload = sum(1 for d in data if d.get('payload'))
print('records:', len(data))
print('kinds:', sorted({d['kind'] for d in data}))
print('frames:', sorted({d.get('frameUrl', '') for d in data}))
print('with payload:', with_payload)
assert with_payload > 0, 'no payloads captured, so capture mode was off, run the session again'
print('OK')
GATEEOF
```
Expected: `OK`, plus a summary of what was seen.

Two of those lines are gates rather than information. If unscrubbed numbers or prose survive, do
not commit the file: fix the scrubber, recapture, and run this again. If `with payload` is zero,
capture mode was not actually on, and the file cannot answer questions six and seven no matter how
carefully it is read, so the session has to be run again rather than analysed.

- [ ] **Step 5: Write the findings**

Create `docs/findings/<date>-messenger-transport.md` answering exactly these questions, each with
the evidence from the capture that supports it:

1. Which frame URLs did observations arrive from? Did anything come from `fbsbx.com`?
2. Was a `SharedWorker` created? If so, from which frame, and with what script URL?
3. Were `websocket.create` events seen at all? Which socket URLs?
4. When a message was read, which observation appeared, and in which frame?
5. If nothing appeared on read, the socket is beyond reach from a content script, and the
   conclusion is that interception must move to the port. Say so plainly.
6. Which transports were seen: binary frames, JSON envelopes, or both?
7. Which task labels appeared, and against which action?

Answer 5 honestly. A plan that discovers its assumption was wrong has done its job, and the worst
outcome available here is a findings document written to make the earlier guess look right.

- [ ] **Step 6: Update the spec with what is now known**

Rewrite spec section 3.7 so it separates what has now been observed directly from what remains
unverified, and update section 3.4 so its interception points describe the transport that was
actually seen. Delete anything the capture contradicts rather than leaving it hedged.

- [ ] **Step 7: Commit**

```bash
git add docs/findings tests/fixtures docs/superpowers/specs
git commit -m "docs: record what a real Messenger session actually sends"
```

---

## What M3b will be planned from

Once Task 10 has run, the next plan can be written against evidence rather than research:

- If read receipts appear as socket sends in a reachable frame, M3b writes one parser for the
  transport observed, a matcher fed from each site module's signatures, and the drop plus replay
  cache the spec already describes.
- If they only appear as port messages, M3b's interception point is `postMessage`, the parser
  reads structured objects rather than bytes, and the spec's layer one description needs rewriting
  before any of it is built.
- If they appear in neither, M3b starts by establishing whether any content script based approach
  can work at all, and the honest answer may be that the Facebook and Instagram read receipt
  features cannot ship and their `status` stays `planned` permanently. That would be a real
  finding, and shipping toggles that can never work would be the failure the spec forbids.
