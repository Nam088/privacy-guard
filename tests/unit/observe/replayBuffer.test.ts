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
});
