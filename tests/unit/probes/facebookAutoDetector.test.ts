import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const PROBE_SOURCE = readFileSync(
  resolve(process.cwd(), 'tools/probes/facebook-auto-detector.js'),
  'utf8',
);

interface FbDetector {
  getCaptured(): Array<{
    category: string;
    channel: string;
    method: string;
    url: string;
    detail: string;
    payload: unknown;
  }>;
  getSignatures(): Record<string, unknown[]>;
  clear(): void;
  stop(): void;
}

function loadDetector(): FbDetector {
  new Function(PROBE_SOURCE)();
  return (globalThis as unknown as { __fbDetector: FbDetector }).__fbDetector;
}

describe('the Facebook auto detector', () => {
  afterEach(() => {
    const detector = (globalThis as unknown as { __fbDetector?: FbDetector }).__fbDetector;
    detector?.stop();
    delete (globalThis as unknown as { __fbDetector?: FbDetector }).__fbDetector;
  });

  it('installs cleanly without rendering any UI DOM elements', () => {
    const detector = loadDetector();
    expect(detector.getCaptured()).toEqual([]);
  });

  it('detects outbound message via WebSocket send', () => {
    class MockWebSocket {
      url: string;
      constructor(url: string) {
        this.url = url;
      }
      send(): void {}
    }
    const origWs = globalThis.WebSocket;
    try {
      globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
      const detector = loadDetector();
      const ws = new WebSocket('wss://gateway.facebook.com/ws/realtime');
      ws.send(JSON.stringify({ action: 'sendMessage', body: 'hello fb' }));
      const captured = detector.getCaptured();
      expect(captured.some((c) => c.category === 'OUTBOUND_MESSAGE')).toBe(true);
    } finally {
      globalThis.WebSocket = origWs;
    }
  });

  it('detects read receipt via DGW LightSpeed WebSocket binary frame', () => {
    class MockWebSocket {
      url: string;
      constructor(url: string) {
        this.url = url;
      }
      send(): void {}
    }
    const origWs = globalThis.WebSocket;
    try {
      globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
      const detector = loadDetector();
      const ws = new WebSocket('wss://gateway.facebook.com/ws/lightspeed');
      const prefix = new Uint8Array([0x00, 0x01, 0x02, 0x00]);
      const jsonStr = JSON.stringify({
        epoch_id: 123456,
        tasks: [{ label: '21', payload: JSON.stringify({ thread_id: '999', last_read_watermark_ts: 1725624000 }) }],
      });
      const encodedJson = new TextEncoder().encode(jsonStr);
      const combined = new Uint8Array(prefix.length + encodedJson.length);
      combined.set(prefix, 0);
      combined.set(encodedJson, prefix.length);
      ws.send(combined);

      const captured = detector.getCaptured();
      expect(captured.some((c) => c.category === 'READ_RECEIPT')).toBe(true);
    } finally {
      globalThis.WebSocket = origWs;
    }
  });

  it('detects typing indicator via DGW LightSpeed WebSocket binary frame', () => {
    class MockWebSocket {
      url: string;
      constructor(url: string) {
        this.url = url;
      }
      send(): void {}
    }
    const origWs = globalThis.WebSocket;
    try {
      globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
      const detector = loadDetector();
      const ws = new WebSocket('wss://gateway.facebook.com/ws/lightspeed');
      const prefix = new Uint8Array([0x00, 0x00]);
      const jsonStr = JSON.stringify({
        label: 3,
        payload: JSON.stringify({ thread_key: 12345, is_typing: 1 }),
      });
      const encodedJson = new TextEncoder().encode(jsonStr);
      const combined = new Uint8Array(prefix.length + encodedJson.length);
      combined.set(prefix, 0);
      combined.set(encodedJson, prefix.length);
      ws.send(combined);

      const captured = detector.getCaptured();
      expect(captured.some((c) => c.category === 'TYPING_INDICATOR')).toBe(true);
    } finally {
      globalThis.WebSocket = origWs;
    }
  });

  it('restores hooks upon stop()', () => {
    const origFetch = globalThis.fetch;
    const detector = loadDetector();
    expect(globalThis.fetch).not.toBe(origFetch);

    detector.stop();
    expect(globalThis.fetch).toBe(origFetch);
  });
});
