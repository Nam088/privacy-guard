import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const PROBE_SOURCE = readFileSync(
  resolve(process.cwd(), 'tools/probes/typing-transport-probe.js'),
  'utf8',
);

interface WindowSummary {
  window: string;
  total: number;
  byKind: Record<string, number>;
  byPath: Record<string, number>;
  carryingMarkers: {
    kind: string;
    path: string;
    method?: string;
    markers: string[];
    names: Record<string, string>;
  }[];
  graphqlNames: Record<string, number>;
}

interface Probe {
  mark(name: string): string;
  describeBody(body: unknown): {
    bodyType: string;
    bytes: number | null;
    markers: string[];
    names: Record<string, string>;
  };
  summarize(): { verdict: string; totalEvents: number; windows: WindowSummary[] };
  stop(): void;
}

function loadProbe(): Probe {
  new Function(PROBE_SOURCE)();
  return (globalThis as unknown as { __typingProbe: Probe }).__typingProbe;
}

describe('the typing transport probe', () => {
  afterEach(() => {
    const probe = (globalThis as unknown as { __typingProbe?: Probe }).__typingProbe;
    probe?.stop();
    delete (globalThis as unknown as { __typingProbe?: Probe }).__typingProbe;
  });

  it('says the probe is not installed when nothing at all was observed', () => {
    const probe = loadProbe();

    expect(probe.summarize().verdict).toContain('NOTHING OBSERVED');
  });

  it('asks for a typing mark rather than guessing which window is which', () => {
    const probe = loadProbe();
    probe.mark('idle');
    void fetch('https://www.messenger.com/api/graphql/', { method: 'POST', body: 'x=1' }).catch(
      () => undefined,
    );

    expect(probe.summarize().verdict).toContain('NO TYPING WINDOW');
  });

  it('reads a graphql operation name out of a urlencoded body', () => {
    const probe = loadProbe();
    const described = probe.describeBody(
      'av=100012345&fb_api_req_friendly_name=useTypingIndicatorMutation&doc_id=987654321&variables=%7B%22is_typing%22%3A1%7D',
    );

    expect(described.names.fb_api_req_friendly_name).toBe('useTypingIndicatorMutation');
    expect(described.names.doc_id).toBe('987654321');
  });

  // Found by a failing test: the key sits first in a real body, with no delimiter in front of it.
  it('reads the name when the key is the first thing in the body', () => {
    const probe = loadProbe();
    const described = probe.describeBody('fb_api_req_friendly_name=LSPlatformTypingMutation&av=1');

    expect(described.names.fb_api_req_friendly_name).toBe('LSPlatformTypingMutation');
  });

  // And out of json, which is the other shape these bodies come in.
  it('reads the name out of a json body', () => {
    const probe = loadProbe();
    const described = probe.describeBody('{"fb_api_req_friendly_name":"TypingMutation","x":1}');

    expect(described.names.fb_api_req_friendly_name).toBe('TypingMutation');
  });

  // The operation name is a name. Everything around it in that body is an identifier, and none of
  // it may be recorded.
  it('records the name and the markers but never the values around them', () => {
    const probe = loadProbe();
    const body = 'av=100012345678&fb_api_req_friendly_name=useTypingIndicatorMutation&thread_key=6152';
    const described = probe.describeBody(body);

    expect(described.markers).toEqual(['thread_key']);
    expect(Object.values(described.names)).toEqual(['useTypingIndicatorMutation']);
    expect(JSON.stringify(described)).not.toContain('100012345678');
    expect(JSON.stringify(described)).not.toContain('6152');
  });

  it('names a candidate when something sent while typing carries a marker', async () => {
    const probe = loadProbe();
    probe.mark('idle');
    probe.mark('typing');
    await fetch('https://www.messenger.com/api/graphql/', {
      method: 'POST',
      body: 'fb_api_req_friendly_name=useTypingIndicatorMutation&variables=%7B%22is_typing%22%3A1%7D',
    }).catch(() => undefined);

    const summary = probe.summarize();
    const typingWindow = summary.windows.find((window) => window.window === 'typing');

    expect(summary.verdict).toContain('CANDIDATES FOUND');
    expect(typingWindow?.carryingMarkers[0]?.path).toBe('/api/graphql/');
    expect(typingWindow?.carryingMarkers[0]?.markers).toContain('is_typing');
    expect(typingWindow?.graphqlNames).toEqual({ useTypingIndicatorMutation: 1 });
  });

  // The useful negative. A typing window with traffic but no marker still narrows things, so the
  // probe must not report it as a failure.
  it('tells the reader to compare paths when nothing carries a marker', async () => {
    const probe = loadProbe();
    probe.mark('typing');
    await fetch('https://www.messenger.com/ajax/bootloader/', {
      method: 'POST',
      body: 'nothing=here',
    }).catch(() => undefined);

    const summary = probe.summarize();

    expect(summary.verdict).toContain('NO CANDIDATE');
    expect(summary.windows.find((w) => w.window === 'typing')?.byPath).toEqual({
      'fetch /ajax/bootloader/': 1,
    });
  });

  it('separates what happened while typing from what happened while idle', async () => {
    const probe = loadProbe();
    probe.mark('idle');
    await fetch('https://www.messenger.com/ajax/heartbeat/', { method: 'POST', body: 'a=1' }).catch(
      () => undefined,
    );
    probe.mark('typing');
    await fetch('https://www.messenger.com/api/graphql/', {
      method: 'POST',
      body: 'is_typing=1',
    }).catch(() => undefined);

    const summary = probe.summarize();

    expect(summary.windows.find((w) => w.window === 'idle')?.byPath).toEqual({
      'fetch /ajax/heartbeat/': 1,
    });
    expect(summary.windows.find((w) => w.window === 'typing')?.byPath).toEqual({
      'fetch /api/graphql/': 1,
    });
  });

  it('notices a socket opened after the probe installed', () => {
    const probe = loadProbe();
    probe.mark('typing');
    try {
      new WebSocket('wss://gateway.messenger.com/ws/lightspeed?x=1');
    } catch {
      // jsdom may refuse the connection; the open was still recorded before it tried.
    }

    expect(probe.summarize().windows.find((w) => w.window === 'typing')?.byPath).toEqual({
      'ws.open /ws/lightspeed': 1,
    });
  });

  it('restores every channel it patched', () => {
    const before = {
      send: WebSocket.prototype.send,
      socket: globalThis.WebSocket,
      fetch: globalThis.fetch,
      open: XMLHttpRequest.prototype.open,
      xhrSend: XMLHttpRequest.prototype.send,
    };
    const probe = loadProbe();

    expect(globalThis.fetch).not.toBe(before.fetch);

    probe.stop();

    expect(WebSocket.prototype.send).toBe(before.send);
    expect(globalThis.WebSocket).toBe(before.socket);
    expect(globalThis.fetch).toBe(before.fetch);
    expect(XMLHttpRequest.prototype.open).toBe(before.open);
    expect(XMLHttpRequest.prototype.send).toBe(before.xhrSend);
  });
});
