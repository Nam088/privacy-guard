import { describe, expect, it } from 'vitest';
import { observeWebSocket } from '@/observe/websocket';
import { scrub } from '@/observe/scrub';
import type { ObservedEvent } from '@/observe/types';

class FakeSocket {
  constructor(public url: string) {}
  send(data?: unknown): void {
    void data;
  }
}

describe('the raw value reaches the reporter', () => {
  it('hands the reporter the value it can scrub', () => {
    const seen: Array<{ event: ObservedEvent; raw: unknown }> = [];
    const scope = { WebSocket: FakeSocket } as unknown as { WebSocket: typeof WebSocket };
    const uninstall = observeWebSocket(scope, (event, raw) => seen.push({ event, raw }));

    const socket = new scope.WebSocket('wss://a.test/');
    (socket as unknown as FakeSocket).send('{"tasks":[{"label":"389"}]}' as never);

    const send = seen.find((s) => s.event.kind === 'websocket.send');
    expect(send?.raw).toBe('{"tasks":[{"label":"389"}]}');
    expect(JSON.stringify(scrub(JSON.parse(String(send?.raw))))).toContain('389');
    uninstall();
  });

  it('still reports the event when no raw value is passed', () => {
    const seen: ObservedEvent[] = [];
    const scope = { WebSocket: FakeSocket } as unknown as { WebSocket: typeof WebSocket };
    const uninstall = observeWebSocket(scope, (event) => seen.push(event));
    new scope.WebSocket('wss://a.test/');
    expect(seen).toHaveLength(1);
    uninstall();
  });
});
