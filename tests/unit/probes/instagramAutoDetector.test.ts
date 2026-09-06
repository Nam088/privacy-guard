import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const PROBE_SOURCE = readFileSync(
  resolve(process.cwd(), 'tools/probes/instagram-auto-detector.js'),
  'utf8',
);

interface Detector {
  getCaptured(): Array<{
    category: string;
    channel: string;
    method: string;
    url: string;
    snippet: string;
    payload: unknown;
  }>;
  getSignatures(): Record<string, unknown[]>;
  clear(): void;
  stop(): void;
}

function loadDetector(): Detector {
  new Function(PROBE_SOURCE)();
  return (globalThis as unknown as { __igDetector: Detector }).__igDetector;
}

describe('the Instagram auto detector', () => {
  afterEach(() => {
    const detector = (globalThis as unknown as { __igDetector?: Detector }).__igDetector;
    detector?.stop();
    delete (globalThis as unknown as { __igDetector?: Detector }).__igDetector;
  });

  it('installs cleanly without rendering any UI DOM elements', () => {
    const detector = loadDetector();
    expect(document.getElementById('instagram-auto-detector-hud')).toBeNull();
    expect(detector.getCaptured()).toEqual([]);
  });

  it('automatically detects fetch requests carrying read receipts', async () => {
    const detector = loadDetector();

    await fetch('https://www.instagram.com/api/v1/direct_v2/threads/123/seen/', {
      method: 'POST',
      body: JSON.stringify({ thread_id: '123' }),
    }).catch(() => undefined);

    const captured = detector.getCaptured();
    expect(captured.length).toBeGreaterThan(0);
    expect(captured[0]?.category).toBe('READ_RECEIPT');
  });

  it('automatically detects typing indicators on fetch', async () => {
    const detector = loadDetector();

    await fetch('https://www.instagram.com/api/v1/direct_v2/threads/123/activity_status_indication/', {
      method: 'POST',
      body: 'activity_status=1',
    }).catch(() => undefined);

    const captured = detector.getCaptured();
    expect(captured.some((c) => c.category === 'TYPING_INDICATOR')).toBe(true);
  });

  it('automatically detects story seen requests', async () => {
    const detector = loadDetector();

    await fetch('https://www.instagram.com/api/v1/stories/reel/seen/', {
      method: 'POST',
      body: JSON.stringify({ reel_id: '456' }),
    }).catch(() => undefined);

    const captured = detector.getCaptured();
    expect(captured.some((c) => c.category === 'STORY_SEEN')).toBe(true);
  });

  it('automatically detects DGW WebSocket binary frames carrying read receipts', () => {
    const detector = loadDetector();

    class MockWebSocket {
      url: string;
      constructor(url: string) {
        this.url = url;
      }
      send(): void {}
    }
    const origWs = globalThis.WebSocket;
    try {
      detector.stop();
      globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
      const wsDetector = loadDetector();

      const ws = new WebSocket('wss://gateway.instagram.com/ws/lightspeed?x-dgw-appid=936619743392459');
      // DGW binary payload: prefix bytes + balanced JSON with task label 72 (read receipt)
      const prefix = new Uint8Array([0x00, 0x01, 0x02, 0x00]);
      const jsonStr = JSON.stringify({
        epoch_id: 123456,
        tasks: [{ label: '72', payload: JSON.stringify({ thread_id: '999', watermark: 1725624000 }) }],
      });
      const encodedJson = new TextEncoder().encode(jsonStr);
      const combined = new Uint8Array(prefix.length + encodedJson.length);
      combined.set(prefix, 0);
      combined.set(encodedJson, prefix.length);

      ws.send(combined);

      const captured = wsDetector.getCaptured();
      expect(captured.some((c) => c.category === 'READ_RECEIPT')).toBe(true);
    } finally {
      globalThis.WebSocket = origWs;
    }
  });

  it('automatically detects DGW WebSocket binary frames carrying typing indicator', () => {
    const detector = loadDetector();

    class MockWebSocket {
      url: string;
      constructor(url: string) {
        this.url = url;
      }
      send(): void {}
    }
    const origWs = globalThis.WebSocket;
    try {
      detector.stop();
      globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
      const wsDetector = loadDetector();

      const ws = new WebSocket('wss://gateway.instagram.com/ws/lightspeed?x-dgw-appid=936619743392459');
      // DGW binary payload with task label 3
      const prefix = new Uint8Array([0x00, 0x00]);
      const jsonStr = JSON.stringify({
        label: 3,
        payload: JSON.stringify({ thread_id: '999', is_typing: 1 }),
      });
      const encodedJson = new TextEncoder().encode(jsonStr);
      const combined = new Uint8Array(prefix.length + encodedJson.length);
      combined.set(prefix, 0);
      combined.set(encodedJson, prefix.length);

      ws.send(combined);

      const captured = wsDetector.getCaptured();
      expect(captured.some((c) => c.category === 'TYPING_INDICATOR')).toBe(true);
    } finally {
      globalThis.WebSocket = origWs;
    }
  });

  it('restores all global hooks upon stop()', () => {
    const origFetch = globalThis.fetch;
    const detector = loadDetector();
    expect(globalThis.fetch).not.toBe(origFetch);

    detector.stop();
    expect(globalThis.fetch).toBe(origFetch);
  });
});
