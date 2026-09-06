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
