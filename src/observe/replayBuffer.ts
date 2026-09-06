/**
 * Manual Read Replay Buffer.
 *
 * Caches dropped read receipt frames (labels 21, 72, 235) in an in-memory buffer.
 * Allows replaying/sending the watermark frame on demand when the user chooses to "Mark as Read".
 */

export interface CachedReceipt {
  readonly threadId?: string | number;
  readonly url: string;
  readonly data: unknown;
  readonly timestamp: number;
}

const MAX_BUFFER_SIZE = 50;

class ReadReplayManager {
  private buffer: CachedReceipt[] = [];
  private activeSocket: WebSocket | null = null;
  private originalSend: ((data: unknown) => void) | null = null;

  registerSocket(socket: WebSocket, originalSend: (data: unknown) => void): void {
    if (socket.url.includes('/ws/lightspeed')) {
      this.activeSocket = socket;
      this.originalSend = originalSend;
    }
  }

  cacheSuppressedReceipt(url: string, data: unknown, threadId?: string | number): void {
    this.buffer.push({
      threadId,
      url,
      data,
      timestamp: Date.now(),
    });
    if (this.buffer.length > MAX_BUFFER_SIZE) {
      this.buffer.shift();
    }
  }

  replay(threadId?: string | number): boolean {
    if (!this.activeSocket || !this.originalSend) {
      return false;
    }

    let targetReceipt: CachedReceipt | undefined;
    if (threadId !== undefined) {
      const idx = this.buffer.findIndex((r) => String(r.threadId) === String(threadId));
      if (idx !== -1) {
        targetReceipt = this.buffer.splice(idx, 1)[0];
      }
    } else {
      targetReceipt = this.buffer.pop();
    }

    if (!targetReceipt) {
      return false;
    }

    try {
      this.originalSend.call(this.activeSocket, targetReceipt.data);
      return true;
    } catch {
      return false;
    }
  }

  getPendingCount(): number {
    return this.buffer.length;
  }

  clear(): void {
    this.buffer = [];
  }
}

export const readReplayManager = new ReadReplayManager();

export function installReadReplayBridge(target: EventTarget): () => void {
  const handler = (event: Event) => {
    const custom = event as CustomEvent<{ threadId?: string | number }>;
    const threadId = custom.detail?.threadId;
    readReplayManager.replay(threadId);
  };

  target.addEventListener('privacy-guard:replay-read', handler);

  // Expose global helper for console or popup script
  const scope = target as unknown as Record<string, unknown>;
  if (scope && typeof scope === 'object') {
    scope.__pgReplayRead = (threadId?: string | number) => readReplayManager.replay(threadId);
  }

  return () => {
    target.removeEventListener('privacy-guard:replay-read', handler);
    if (scope && typeof scope === 'object') {
      delete scope.__pgReplayRead;
    }
  };
}
