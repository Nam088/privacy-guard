import { describe, expect, it, vi } from 'vitest';
import { readReplayManager } from '@/observe/replayBuffer';

describe('readReplayManager', () => {
  it('registers socket and replays cached receipt', () => {
    readReplayManager.clear();

    const mockSend = vi.fn();
    const fakeSocket = {
      url: 'wss://gateway.messenger.com/ws/lightspeed',
    } as WebSocket;

    readReplayManager.registerSocket(fakeSocket, mockSend);

    readReplayManager.cacheSuppressedReceipt(
      'wss://gateway.messenger.com/ws/lightspeed',
      'fake-frame-data',
      'thread_123',
    );

    expect(readReplayManager.getPendingCount()).toBe(1);

    const replayed = readReplayManager.replay('thread_123');
    expect(replayed).toBe(true);
    expect(mockSend).toHaveBeenCalledWith('fake-frame-data');
    expect(readReplayManager.getPendingCount()).toBe(0);
  });

  it('unregisters socket when close event fires', () => {
    readReplayManager.clear();

    const mockSend = vi.fn();
    const closeListeners: (() => void)[] = [];
    const fakeSocket = {
      url: 'wss://gateway.messenger.com/ws/lightspeed',
      addEventListener: vi.fn((event: string, cb: () => void) => {
        if (event === 'close') closeListeners.push(cb);
      }),
    } as unknown as WebSocket;

    readReplayManager.registerSocket(fakeSocket, mockSend);

    readReplayManager.cacheSuppressedReceipt(
      'wss://gateway.messenger.com/ws/lightspeed',
      'fake-frame-data',
      'thread_456',
    );

    // Trigger close
    for (const cb of closeListeners) cb();

    // Replay should fail because socket was closed
    const replayed = readReplayManager.replay('thread_456');
    expect(replayed).toBe(false);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
