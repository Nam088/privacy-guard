import { describe, expect, it, vi } from 'vitest';
import { createObservationForwarder } from '@/core/observationBridge';
import type { ObservedEvent } from '@/observe/types';

const EVENT: ObservedEvent = {
  seq: 1,
  at: 0,
  kind: 'websocket.send',
  target: 'wss://example.test/',
};

describe('createObservationForwarder', () => {
  it('forwards the observation wrapped in a typed message', () => {
    const send = vi.fn().mockResolvedValue(undefined);
    createObservationForwarder(send).handle(EVENT);
    expect(send).toHaveBeenCalledWith({ type: 'observed', event: EVENT });
  });

  it('does not throw when the send rejects', async () => {
    const send = vi.fn().mockRejectedValue(new Error('Extension context invalidated'));
    const forwarder = createObservationForwarder(send);
    expect(() => forwarder.handle(EVENT)).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
  });

  it('stops forwarding after the first rejection, rather than failing on every event', async () => {
    const send = vi.fn().mockRejectedValue(new Error('Extension context invalidated'));
    const forwarder = createObservationForwarder(send);

    forwarder.handle(EVENT);
    await Promise.resolve();
    await Promise.resolve();

    expect(forwarder.isStopped()).toBe(true);
    forwarder.handle(EVENT);
    forwarder.handle(EVENT);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('does not throw when the send throws synchronously', () => {
    const send = vi.fn(() => {
      throw new Error('Extension context invalidated');
    });
    const forwarder = createObservationForwarder(send);
    expect(() => forwarder.handle(EVENT)).not.toThrow();
    expect(forwarder.isStopped()).toBe(true);
  });

  it('reports the stop once, so a caller can detach its listener', async () => {
    const onStop = vi.fn();
    const send = vi.fn().mockRejectedValue(new Error('gone'));
    const forwarder = createObservationForwarder(send, onStop);

    forwarder.handle(EVENT);
    await Promise.resolve();
    await Promise.resolve();
    forwarder.handle(EVENT);

    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('keeps forwarding while sends succeed', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const forwarder = createObservationForwarder(send);
    forwarder.handle(EVENT);
    forwarder.handle(EVENT);
    await Promise.resolve();
    expect(send).toHaveBeenCalledTimes(2);
    expect(forwarder.isStopped()).toBe(false);
  });

  it('does not throw or leak errors if onStop throws during async rejection', async () => {
    const onStop = vi.fn(() => {
      throw new Error('Extension context invalidated');
    });
    const send = vi.fn().mockRejectedValue(new Error('Extension context invalidated'));
    const forwarder = createObservationForwarder(send, onStop);

    forwarder.handle(EVENT);
    await Promise.resolve();
    await Promise.resolve();

    expect(onStop).toHaveBeenCalledTimes(1);
    expect(forwarder.isStopped()).toBe(true);
  });
});

