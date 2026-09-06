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

  it('does not throw when reading the global itself throws', () => {
    const hostile = {} as { WebSocket: typeof WebSocket };
    Object.defineProperty(hostile, 'WebSocket', {
      get() {
        throw new Error('poisoned');
      },
    });
    expect(() => observeWebSocket(hostile, () => {})()).not.toThrow();
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

describe('observeWebSocket, intercepting', () => {
  // Suppression is the only thing in this extension that changes what a page sends, so the two
  // directions are asserted separately and neither is inferred from the other.
  function scopeWithSpy() {
    const sent: unknown[] = [];
    class FakeSocket {
      url = 'wss://gateway.messenger.com/ws/lightspeed';
      send(data: unknown): void {
        sent.push(data);
      }
    }
    return { scope: { WebSocket: FakeSocket as unknown as typeof WebSocket }, sent };
  }

  it('withholds a frame the intercept drops', () => {
    const { scope, sent } = scopeWithSpy();
    const events: ObservedEvent[] = [];
    const undo = observeWebSocket(scope, (event) => events.push(event), undefined, () => 'drop');
    const socket = new scope.WebSocket!('wss://gateway.messenger.com/ws/lightspeed');

    socket.send('frame');

    expect(sent).toEqual([]);
    expect(events.at(-1)?.kind).toBe('websocket.suppressed');
    undo();
  });

  it('sends a frame the intercept passes, unchanged', () => {
    const { scope, sent } = scopeWithSpy();
    const undo = observeWebSocket(scope, () => {}, undefined, () => 'pass');
    const socket = new scope.WebSocket!('wss://gateway.messenger.com/ws/lightspeed');

    socket.send('frame');

    expect(sent).toEqual(['frame']);
    undo();
  });

  // A leak has to be visible. A suppressor that silently fails open cannot be told from one that
  // works, which is the failure this project keeps designing around.
  it('sends a mixed frame and reports it as a mixed frame, not as an ordinary send', () => {
    const { scope, sent } = scopeWithSpy();
    const events: ObservedEvent[] = [];
    const undo = observeWebSocket(scope, (event) => events.push(event), undefined, () => 'mixed');
    const socket = new scope.WebSocket!('wss://gateway.messenger.com/ws/lightspeed');

    socket.send('frame');

    expect(sent).toEqual(['frame']);
    expect(events.at(-1)?.kind).toBe('websocket.mixed');
    undo();
  });

  // Withholding a frame the extension failed to understand would break somebody's Facebook, so a
  // throwing intercept must send.
  it('sends the frame when the intercept throws', () => {
    const { scope, sent } = scopeWithSpy();
    const undo = observeWebSocket(scope, () => {}, undefined, () => {
      throw new Error('boom');
    });
    const socket = new scope.WebSocket!('wss://gateway.messenger.com/ws/lightspeed');

    socket.send('frame');

    expect(sent).toEqual(['frame']);
    undo();
  });

  it('sends every frame when no intercept is given at all', () => {
    const { scope, sent } = scopeWithSpy();
    const undo = observeWebSocket(scope, () => {});
    const socket = new scope.WebSocket!('wss://gateway.messenger.com/ws/lightspeed');

    socket.send('frame');

    expect(sent).toEqual(['frame']);
    undo();
  });
});
