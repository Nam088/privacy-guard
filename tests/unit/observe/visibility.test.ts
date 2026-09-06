import { describe, expect, it, vi } from 'vitest';
import { installVisibilityHook } from '@/observe/visibility';

interface FakeDoc {
  hidden: boolean;
  visibilityState: string;
  hasFocus: () => boolean;
  addEventListener: (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) => void;
  removeEventListener: (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) => void;
}

function makeDoc(overrides: Partial<FakeDoc> = {}): FakeDoc {
  return {
    hidden: false,
    visibilityState: 'visible',
    hasFocus: () => true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    ...overrides,
  };
}

function makeWin(doc: FakeDoc, overrides: Record<string, unknown> = {}): Window {
  return {
    document: doc,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    ...overrides,
  } as unknown as Window;
}

describe('installVisibilityHook', () => {
  it('spoofs document.hidden, visibilityState, and hasFocus when enabled', () => {
    let blocked = true;
    const fakeDoc = makeDoc({
      hidden: true,
      visibilityState: 'hidden',
      hasFocus: () => false,
    });
    const fakeWin = makeWin(fakeDoc);

    const restore = installVisibilityHook(fakeWin, () => blocked);

    expect(fakeDoc.hidden).toBe(false);
    expect(fakeDoc.visibilityState).toBe('visible');
    expect(fakeDoc.hasFocus()).toBe(true);

    // When disabled, original values are returned
    blocked = false;
    expect(fakeDoc.hidden).toBe(true);
    expect(fakeDoc.visibilityState).toBe('hidden');
    expect(fakeDoc.hasFocus()).toBe(false);

    restore();
  });

  it('registers tab-switching listeners for real but swallows them while enabled', () => {
    let blocked = true;
    const registered = new Map<string, EventListener>();
    const originalWinAdd = vi.fn(
      (type: string, listener: EventListener) => {
        registered.set(type, listener);
      },
    );
    const fakeDoc = makeDoc();
    const fakeWin = makeWin(fakeDoc, { addEventListener: originalWinAdd });

    const restore = installVisibilityHook(fakeWin, () => blocked);

    const seen: string[] = [];
    const listener = (event: Event) => {
      seen.push(event.type);
    };

    fakeWin.addEventListener('visibilitychange', listener);
    fakeWin.addEventListener('blur', listener);
    fakeWin.addEventListener('focus', listener);

    // The page keeps its registration: the listener reaches the real target.
    expect(originalWinAdd).toHaveBeenCalledTimes(3);
    expect(registered.get('blur')).toBeDefined();
    expect(registered.get('blur')).not.toBe(listener);

    registered.get('blur')?.({ type: 'blur' } as Event);
    expect(seen).toEqual([]);

    // Turning the feature off hands the page its events back, no reload needed.
    blocked = false;
    registered.get('blur')?.({ type: 'blur' } as Event);
    expect(seen).toEqual(['blur']);

    restore();
  });

  it('leaves pagehide and pageshow alone so queued sends still flush', () => {
    const registered = new Map<string, EventListener>();
    const originalWinAdd = vi.fn((type: string, listener: EventListener) => {
      registered.set(type, listener);
    });
    const fakeDoc = makeDoc();
    const fakeWin = makeWin(fakeDoc, { addEventListener: originalWinAdd });

    const restore = installVisibilityHook(fakeWin, () => true);

    const seen: string[] = [];
    const listener = (event: Event) => {
      seen.push(event.type);
    };

    fakeWin.addEventListener('pagehide', listener);
    fakeWin.addEventListener('pageshow', listener);

    // Passed straight through, not even wrapped.
    expect(registered.get('pagehide')).toBe(listener);
    expect(registered.get('pageshow')).toBe(listener);

    registered.get('pagehide')?.({ type: 'pagehide' } as Event);
    expect(seen).toEqual(['pagehide']);

    restore();
  });

  it('passes unrelated window events straight through', () => {
    const originalWinAdd = vi.fn();
    const fakeDoc = makeDoc();
    const fakeWin = makeWin(fakeDoc, { addEventListener: originalWinAdd });

    const restore = installVisibilityHook(fakeWin, () => true);

    const listener = () => {};
    fakeWin.addEventListener('resize', listener);

    expect(originalWinAdd).toHaveBeenCalledTimes(1);
    expect(originalWinAdd).toHaveBeenCalledWith('resize', listener);

    restore();
  });

  it('removes the wrapper when the page removes its own listener', () => {
    const registered: Array<{ type: string; listener: EventListener }> = [];
    const removed: Array<{ type: string; listener: EventListener }> = [];
    const originalWinAdd = vi.fn((type: string, listener: EventListener) => {
      registered.push({ type, listener });
    });
    const originalWinRemove = vi.fn((type: string, listener: EventListener) => {
      removed.push({ type, listener });
    });
    const fakeDoc = makeDoc();
    const fakeWin = makeWin(fakeDoc, {
      addEventListener: originalWinAdd,
      removeEventListener: originalWinRemove,
    });

    const restore = installVisibilityHook(fakeWin, () => true);

    const listener = () => {};
    fakeWin.addEventListener('blur', listener);
    fakeWin.removeEventListener('blur', listener);

    expect(removed).toHaveLength(1);
    expect(removed[0]?.listener).toBe(registered[0]?.listener);
    expect(removed[0]?.listener).not.toBe(listener);

    restore();
  });

  it('keeps capture and bubble registrations of one listener apart', () => {
    const registered: Array<{ listener: EventListener; capture: unknown }> = [];
    const originalWinAdd = vi.fn(
      (_type: string, listener: EventListener, options?: unknown) => {
        registered.push({ listener, capture: options });
      },
    );
    const fakeDoc = makeDoc();
    const fakeWin = makeWin(fakeDoc, { addEventListener: originalWinAdd });

    const restore = installVisibilityHook(fakeWin, () => true);

    const listener = () => {};
    fakeWin.addEventListener('blur', listener, true);
    fakeWin.addEventListener('blur', listener, false);

    expect(registered).toHaveLength(2);
    expect(registered[0]?.listener).not.toBe(registered[1]?.listener);

    restore();
  });

  it('supports handleEvent listener objects', () => {
    let blocked = true;
    const registered = new Map<string, EventListener>();
    const originalDocAdd = vi.fn(
      (type: string, listener: EventListenerOrEventListenerObject) => {
        registered.set(type, listener as EventListener);
      },
    );
    const fakeDoc = makeDoc({ addEventListener: originalDocAdd });
    const fakeWin = makeWin(fakeDoc);

    const restore = installVisibilityHook(fakeWin, () => blocked);
    registered.clear();

    const handled: string[] = [];
    const listenerObject = {
      handleEvent(event: Event) {
        handled.push(event.type);
      },
    };

    fakeDoc.addEventListener('visibilitychange', listenerObject);
    const wrapper = registered.get('visibilitychange');
    expect(wrapper).toBeDefined();

    wrapper?.({ type: 'visibilitychange' } as Event);
    expect(handled).toEqual([]);

    blocked = false;
    wrapper?.({ type: 'visibilitychange' } as Event);
    expect(handled).toEqual(['visibilitychange']);

    restore();
  });

  it('defuses document visibilitychange while allowing standard DOM listeners', () => {
    const registered: Array<{ type: string; listener: EventListener }> = [];
    const originalDocAdd = vi.fn(
      (type: string, listener: EventListenerOrEventListenerObject) => {
        registered.push({ type, listener: listener as EventListener });
      },
    );
    const fakeDoc = makeDoc({ addEventListener: originalDocAdd });
    const fakeWin = makeWin(fakeDoc);

    const restore = installVisibilityHook(fakeWin, () => true);

    // Drop the hook's own capture-phase registration from the record.
    registered.length = 0;

    const listener = () => {};
    fakeDoc.addEventListener('click', listener);

    expect(registered).toHaveLength(1);
    expect(registered[0]?.listener).toBe(listener);

    restore();
  });

  it('stops immediate propagation of visibilitychange during capture phase when enabled', () => {
    let blocked = true;
    let captureHandler: ((event: Event) => void) | undefined;

    const fakeDoc = makeDoc({
      addEventListener: (
        type: string,
        handler: EventListenerOrEventListenerObject,
        useCapture?: boolean | AddEventListenerOptions,
      ) => {
        if (type === 'visibilitychange' && useCapture === true) {
          captureHandler = handler as (event: Event) => void;
        }
      },
    });
    const fakeWin = makeWin(fakeDoc);

    const restore = installVisibilityHook(fakeWin, () => blocked);

    expect(captureHandler).toBeDefined();

    const stopMock = vi.fn();
    const fakeEvent = {
      stopImmediatePropagation: stopMock,
    } as unknown as Event;

    captureHandler?.(fakeEvent);
    expect(stopMock).toHaveBeenCalledTimes(1);

    // When disabled, does not stop propagation
    blocked = false;
    stopMock.mockClear();
    captureHandler?.(fakeEvent);
    expect(stopMock).not.toHaveBeenCalled();

    restore();
  });

  it('restores all original properties and methods upon cleanup', () => {
    const origFocus = () => false;
    const fakeDoc = makeDoc({
      hidden: true,
      visibilityState: 'hidden',
      hasFocus: origFocus,
    });
    const origWinAdd = fakeDoc.addEventListener;
    const fakeWin = makeWin(fakeDoc, { addEventListener: origWinAdd });
    const origWinRemove = fakeWin.removeEventListener;

    const restore = installVisibilityHook(fakeWin, () => true);

    expect(fakeDoc.hidden).toBe(false);
    expect(fakeDoc.visibilityState).toBe('visible');
    expect(fakeDoc.hasFocus()).toBe(true);

    restore();

    expect(fakeDoc.hidden).toBe(true);
    expect(fakeDoc.visibilityState).toBe('hidden');
    expect(fakeDoc.hasFocus).toBe(origFocus);
    expect(fakeWin.addEventListener).toBe(origWinAdd);
    expect(fakeWin.removeEventListener).toBe(origWinRemove);
  });
});
