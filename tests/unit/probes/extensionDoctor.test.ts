import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const SOURCE = readFileSync(resolve(process.cwd(), 'tools/probes/extension-doctor.js'), 'utf8');

interface Summary {
  verdict: string;
  installed: Record<string, boolean>;
  config: { detail: unknown } | null;
  byKind: Record<string, number>;
  suppressedByPath: Record<string, number>;
  leaksByPath: Record<string, number>;
  byWindow: { window: string; byKind: Record<string, number>; bridgeCalls: Record<string, number> }[];
  bridge: { status: string; callsByAction: Record<string, number>; note: string };
}

interface Doctor {
  mark(name: string): string;
  summarize(): Summary;
  stop(): void;
}

function load(): Doctor {
  new Function(SOURCE)();
  return (globalThis as unknown as { __pgDoctor: Doctor }).__pgDoctor;
}

function observe(kind: string, target: string): void {
  document.dispatchEvent(
    new CustomEvent('privacy-guard:observed', {
      detail: { kind, target, at: Date.now(), value: { type: 'string', byteLength: 10 } },
      bubbles: true,
    }),
  );
}

describe('the extension doctor', () => {
  afterEach(() => {
    const doctor = (globalThis as unknown as { __pgDoctor?: Doctor }).__pgDoctor;
    doctor?.stop();
    delete (globalThis as unknown as { __pgDoctor?: Doctor }).__pgDoctor;
  });

  // jsdom implements these in javascript, so a clean browser has to be simulated: a real one
  // reports [native code] for all four, which is the only signal available once minification has
  // renamed every function.
  function withCleanBrowser(run: () => void): void {
    const nativeLooking = (name: string) => {
      const fn = function () {};
      fn.toString = () => `function ${name}() { [native code] }`;
      return fn as unknown as never;
    };
    const saved = {
      ws: WebSocket.prototype.send,
      fetch: globalThis.fetch,
      xhr: XMLHttpRequest.prototype.send,
      port: MessagePort.prototype.postMessage,
    };
    WebSocket.prototype.send = nativeLooking('send');
    globalThis.fetch = nativeLooking('fetch');
    XMLHttpRequest.prototype.send = nativeLooking('send');
    MessagePort.prototype.postMessage = nativeLooking('postMessage');
    try {
      run();
    } finally {
      WebSocket.prototype.send = saved.ws;
      globalThis.fetch = saved.fetch;
      XMLHttpRequest.prototype.send = saved.xhr;
      MessagePort.prototype.postMessage = saved.port;
    }
  }

  // The one answer a reader must not get wrong: an extension that is not running should never
  // look like an extension that found nothing to do.
  it('says the extension is not active when no channel is patched and nothing arrives', () => {
    withCleanBrowser(() => {
      expect(load().summarize().verdict).toContain('EXTENSION NOT ACTIVE');
    });
  });

  it('does not say that when a channel is patched, even with no events', () => {
    expect(load().summarize().verdict).not.toContain('EXTENSION NOT ACTIVE');
  });

  it('detects a patched channel by its source, not by its function name', () => {
    const real = WebSocket.prototype.send;
    // Minification renames functions, so the check may not depend on this name.
    WebSocket.prototype.send = function anonymousAfterMinification() {} as typeof real;

    try {
      expect(load().summarize().installed['WebSocket.send']).toBe(true);
    } finally {
      WebSocket.prototype.send = real;
    }
  });

  it('counts what the extension withheld, per path', () => {
    const doctor = load();
    observe('websocket.suppressed', 'wss://gateway.messenger.com/ws/lightspeed?x=1');
    observe('websocket.suppressed', 'wss://gateway.messenger.com/ws/lightspeed?x=2');
    observe('websocket.send', 'wss://gateway.messenger.com/ws/realtime');
    const summary = doctor.summarize();

    expect(summary.suppressedByPath).toEqual({ 'websocket.suppressed /ws/lightspeed': 2 });
    expect(summary.byKind).toEqual({ 'websocket.suppressed': 2, 'websocket.send': 1 });
    expect(summary.verdict).toContain('2 requests were withheld');
  });

  // A mixed frame is a deliberate leak. It has to read as one.
  it('reports a mixed frame as a leak in plain words', () => {
    const doctor = load();
    observe('websocket.mixed', 'wss://gateway.messenger.com/ws/lightspeed');

    expect(doctor.summarize().leaksByPath).toEqual({ '/ws/lightspeed': 1 });
    expect(doctor.summarize().verdict).toContain('LEAKED');
  });

  it('does not let a busy but unsuppressed session read as protection', () => {
    const doctor = load();
    observe('websocket.send', 'wss://gateway.messenger.com/ws/lightspeed');

    expect(doctor.summarize().verdict).toContain('nothing has been withheld');
  });

  it('separates what happened in each marked window', () => {
    const doctor = load();
    doctor.mark('idle');
    observe('websocket.send', 'wss://gateway.messenger.com/ws/realtime');
    doctor.mark('read');
    observe('websocket.suppressed', 'wss://gateway.messenger.com/ws/lightspeed');
    const windows = doctor.summarize().byWindow;

    expect(windows.map((w) => w.window)).toEqual(['idle', 'read']);
    expect(windows[1]?.byKind).toEqual({ 'websocket.suppressed': 1 });
  });

  it('captures the configuration the content script broadcasts', () => {
    const doctor = load();
    document.dispatchEvent(
      new CustomEvent('privacy-guard:configure', {
        detail: { capture: false, readReceiptLabels: ['21', '72', '235'], hideTyping: true },
      }),
    );

    expect(doctor.summarize().config?.detail).toMatchObject({ hideTyping: true });
  });

  // The bridge cannot be observed cancelling anything, and a zero there must not read as safety.
  it('never presents a bridge call count as proof of suppression', () => {
    const doctor = load();
    const note = doctor.summarize().bridge.note;

    expect(note).toContain('not');
    expect(note.toLowerCase()).toContain('turn hide typing off');
  });

  it('stops listening when told to', () => {
    const doctor = load();
    doctor.stop();
    observe('websocket.suppressed', 'wss://gateway.messenger.com/ws/lightspeed');

    expect(doctor.summarize().byKind).toEqual({});
  });
});
