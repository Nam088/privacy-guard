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
const RECEIPT_TTL_MS = 10 * 60 * 1000; // 10 minutes

class ReadReplayManager {
  private buffer: CachedReceipt[] = [];
  private activeSocket: WebSocket | null = null;
  private originalSend: ((data: unknown) => void) | null = null;

  registerSocket(socket: WebSocket, originalSend: (data: unknown) => void): void {
    if (
      socket &&
      typeof socket.url === 'string' &&
      (socket.url.includes('/ws/lightspeed') || socket.url.includes('/ws/realtime'))
    ) {
      this.activeSocket = socket;
      this.originalSend = originalSend;

      if (typeof socket.addEventListener === 'function') {
        socket.addEventListener(
          'close',
          () => {
            if (this.activeSocket === socket) {
              this.activeSocket = null;
              this.originalSend = null;
            }
          },
          { once: true },
        );
      }
    }
  }

  cacheSuppressedReceipt(url: string, data: unknown, threadId?: string | number): void {
    const now = Date.now();
    // Prune stale receipts older than TTL
    this.buffer = this.buffer.filter((r) => now - r.timestamp < RECEIPT_TTL_MS);

    this.buffer.push({
      threadId,
      url,
      data,
      timestamp: now,
    });
    if (this.buffer.length > MAX_BUFFER_SIZE) {
      this.buffer.shift();
    }
  }

  replay(threadId?: string | number): boolean {
    if (!this.activeSocket || !this.originalSend) {
      return false;
    }

    if (
      typeof this.activeSocket.readyState === 'number' &&
      typeof WebSocket !== 'undefined' &&
      this.activeSocket.readyState !== WebSocket.OPEN
    ) {
      return false;
    }

    const now = Date.now();
    this.buffer = this.buffer.filter((r) => now - r.timestamp < RECEIPT_TTL_MS);

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
    try {
      const custom = event as CustomEvent<{ threadId?: string | number }>;
      const threadId = custom.detail?.threadId;
      readReplayManager.replay(threadId);
    } catch {
      // Safe fail-open
    }
  };

  try {
    target.addEventListener('privacy-guard:replay-read', handler);
  } catch {
    // Target might not accept event listener
  }

  // Expose global helper for console or popup script
  const scope = target as unknown as Record<string, unknown>;
  if (scope && typeof scope === 'object') {
    try {
      scope.__pgReplayRead = (threadId?: string | number) => readReplayManager.replay(threadId);
    } catch {
      // Ignore
    }
  }

  return () => {
    try {
      target.removeEventListener('privacy-guard:replay-read', handler);
    } catch {
      // Ignore
    }
    if (scope && typeof scope === 'object') {
      try {
        delete scope.__pgReplayRead;
      } catch {
        // Ignore
      }
    }
  };
}
