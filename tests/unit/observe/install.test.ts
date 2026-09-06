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

  it('tags every event with the frame url it was given', () => {
    const events: ObservedEvent[] = [];
    const scope = makeScope();
    const uninstall = installObservers(scope, (e) => events.push(e), { frameUrl: 'https://a.test/frame' });
    new (scope as unknown as { WebSocket: typeof FakeSocket }).WebSocket('wss://a.test/');
    expect(events[0]?.frameUrl).toBe('https://a.test/frame');
    uninstall();
  });

  it('does not throw on a global missing everything', () => {
    const empty = {} as Parameters<typeof installObservers>[0];
    expect(() => installObservers(empty, () => {})()).not.toThrow();
  });

  it('installs and uninstalls feed declutter hook when option is provided', () => {
    const scope = Object.assign(makeScope(), {
      document: window.document,
    }) as unknown as Parameters<typeof installObservers>[0];
    const uninstall = installObservers(scope, () => {}, {
      isFeedDeclutterActive: () => true,
    });
    expect(window.document.getElementById('fb-security-declutter-style')).not.toBeNull();
    uninstall();
    expect(window.document.getElementById('fb-security-declutter-style')).toBeNull();
  });
});
