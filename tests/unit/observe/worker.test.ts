import { beforeEach, describe, expect, it, vi } from 'vitest';
import { observeWorkers } from '@/observe/worker';
import type { ObservedEvent } from '@/observe/types';

class FakeWorker {
  posted: unknown[] = [];
  constructor(public url: string | URL) {}
  postMessage(data: unknown): void {
    this.posted.push(data);
  }
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

  it('survives a scope missing SharedWorker entirely', () => {
    const partial = { Worker: FakeWorker, MessagePort: FakePort } as unknown as {
      Worker: typeof Worker;
      SharedWorker: typeof SharedWorker;
      MessagePort: typeof MessagePort;
    };
    expect(() => observeWorkers(partial, () => {})()).not.toThrow();
  });

  it('drops port.postMessage when interceptor returns drop', () => {
    const interceptor = vi.fn().mockReturnValue('drop');
    const uninstall = observeWorkers(scope, (e) => events.push(e), undefined, interceptor);
    const port = new scope.MessagePort();
    const fake = port as unknown as FakePort;
    fake.postMessage({ task: 'secret' });
    expect(interceptor).toHaveBeenCalledWith({ task: 'secret' });
    expect(fake.posted).toHaveLength(0);
    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe('port.suppressed');
    uninstall();
  });

  it('allows port.postMessage when interceptor returns pass', () => {
    const interceptor = vi.fn().mockReturnValue('pass');
    const uninstall = observeWorkers(scope, (e) => events.push(e), undefined, interceptor);
    const port = new scope.MessagePort();
    const fake = port as unknown as FakePort;
    fake.postMessage({ task: 'visible' });
    expect(interceptor).toHaveBeenCalledWith({ task: 'visible' });
    expect(fake.posted).toHaveLength(1);
    expect(events[0]?.kind).toBe('port.postMessage');
    uninstall();
  });

  it('drops worker.postMessage when interceptor returns drop', () => {
    const interceptor = vi.fn().mockReturnValue('drop');
    const uninstall = observeWorkers(scope, (e) => events.push(e), undefined, interceptor);
    const worker = new scope.Worker('https://example.test/w.js');
    const fake = worker as unknown as FakeWorker;
    fake.postMessage({ command: 'drop-me' });
    expect(fake.posted).toHaveLength(0);
    expect(events.some((e) => e.kind === 'worker.suppressed')).toBe(true);
    uninstall();
  });
});
