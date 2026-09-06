import { describe, expect, it } from 'vitest';
import { observeWebSocket } from '@/observe/websocket';

class RecordingSocket {
  static last: RecordingSocket | undefined;
  sent: unknown[] = [];
  constructor(public url: string) {
    RecordingSocket.last = this;
  }
  send(data: unknown): void {
    this.sent.push(data);
  }
}

const VALUES: unknown[] = [
  '',
  'plain text',
  'unicode nghiêng 日本語 🙂',
  new ArrayBuffer(0),
  new ArrayBuffer(1024),
  new Uint8Array([0, 1, 2, 255]),
  new Uint16Array([65535, 0]),
  new DataView(new ArrayBuffer(8)),
];

describe('observation never alters what is sent', () => {
  it('passes every value through by identity', () => {
    const scope = { WebSocket: RecordingSocket } as unknown as {
      WebSocket: typeof WebSocket;
    };
    const uninstall = observeWebSocket(scope, () => {});
    const socket = new scope.WebSocket('wss://example.test/chat');

    for (const value of VALUES) {
      (socket as unknown as RecordingSocket).send(value);
    }

    const sent = RecordingSocket.last?.sent ?? [];
    expect(sent).toHaveLength(VALUES.length);
    for (const [index, value] of VALUES.entries()) {
      expect(sent[index]).toBe(value);
    }
    uninstall();
  });

  it('sends the same number of times as it is asked to', () => {
    const scope = { WebSocket: RecordingSocket } as unknown as {
      WebSocket: typeof WebSocket;
    };
    const uninstall = observeWebSocket(scope, () => {});
    const socket = new scope.WebSocket('wss://example.test/chat');
    for (let i = 0; i < 100; i += 1) {
      (socket as unknown as RecordingSocket).send(`frame ${i}`);
    }
    expect(RecordingSocket.last?.sent).toHaveLength(100);
    uninstall();
  });
});
