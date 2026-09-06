import { describe, expect, it, vi } from 'vitest';
import { installVisibilityHook } from '@/observe/visibility';

describe('installVisibilityHook', () => {
  it('spoofs document.hidden, visibilityState, and hasFocus when enabled', () => {
    let blocked = true;
    const fakeDoc = {
      hidden: true,
      visibilityState: 'hidden',
      hasFocus: () => false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const fakeWin = {
      document: fakeDoc,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as Window;

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

  it('defuses window event listeners for tab switching events when enabled', () => {
    let blocked = true;
    const originalWinAdd = vi.fn();
    const fakeDoc = {
      hidden: false,
      visibilityState: 'visible',
      hasFocus: () => true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const fakeWin = {
      document: fakeDoc,
      addEventListener: originalWinAdd,
      removeEventListener: vi.fn(),
    } as unknown as Window;

    const restore = installVisibilityHook(fakeWin, () => blocked);

    const dummyListener = () => {};

    // Blocked tab-switching events on window
    fakeWin.addEventListener('visibilitychange', dummyListener);
    fakeWin.addEventListener('blur', dummyListener);
    fakeWin.addEventListener('focus', dummyListener);
    fakeWin.addEventListener('pagehide', dummyListener);
    fakeWin.addEventListener('pageshow', dummyListener);

    expect(originalWinAdd).not.toHaveBeenCalled();

    // Allowed window events
    fakeWin.addEventListener('resize', dummyListener);
    expect(originalWinAdd).toHaveBeenCalledTimes(1);
    expect(originalWinAdd).toHaveBeenCalledWith('resize', dummyListener);

    // When disabled, tab-switching events are allowed
    blocked = false;
    fakeWin.addEventListener('focus', dummyListener);
    expect(originalWinAdd).toHaveBeenCalledTimes(2);
    expect(originalWinAdd).toHaveBeenCalledWith('focus', dummyListener);

    restore();
  });

  it('defuses document visibilitychange listener while allowing standard DOM listeners', () => {
    let blocked = true;
    const originalDocAdd = vi.fn();
    const fakeDoc = {
      hidden: false,
      visibilityState: 'visible',
      hasFocus: () => true,
      addEventListener: originalDocAdd,
      removeEventListener: vi.fn(),
    };
    const fakeWin = {
      document: fakeDoc,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as Window;

    const restore = installVisibilityHook(fakeWin, () => blocked);

    // Clear initial registration of captureStopper
    originalDocAdd.mockClear();

    const dummyListener = () => {};

    // Blocked visibilitychange on document
    fakeDoc.addEventListener('visibilitychange', dummyListener);
    expect(originalDocAdd).not.toHaveBeenCalled();

    // Normal DOM events on document are allowed
    fakeDoc.addEventListener('click', dummyListener);
    expect(originalDocAdd).toHaveBeenCalledTimes(1);
    expect(originalDocAdd).toHaveBeenCalledWith('click', dummyListener);

    // When disabled, visibilitychange is allowed
    blocked = false;
    fakeDoc.addEventListener('visibilitychange', dummyListener);
    expect(originalDocAdd).toHaveBeenCalledTimes(2);
    expect(originalDocAdd).toHaveBeenCalledWith('visibilitychange', dummyListener);

    restore();
  });

  it('stops immediate propagation of visibilitychange during capture phase when enabled', () => {
    let blocked = true;
    let captureHandler: ((event: Event) => void) | undefined;

    const fakeDoc = {
      hidden: false,
      visibilityState: 'visible',
      hasFocus: () => true,
      addEventListener: (type: string, handler: (event: Event) => void, useCapture?: boolean) => {
        if (type === 'visibilitychange' && useCapture === true) {
          captureHandler = handler;
        }
      },
      removeEventListener: vi.fn(),
    };
    const fakeWin = {
      document: fakeDoc,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as Window;

    const restore = installVisibilityHook(fakeWin, () => blocked);

    expect(captureHandler).toBeDefined();

    const stopMock = vi.fn();
    const fakeEvent = {
      stopImmediatePropagation: stopMock,
    } as unknown as Event;

    if (captureHandler) {
      captureHandler(fakeEvent);
    }
    expect(stopMock).toHaveBeenCalledTimes(1);

    // When disabled, does not stop propagation
    blocked = false;
    stopMock.mockClear();
    if (captureHandler) {
      captureHandler(fakeEvent);
    }
    expect(stopMock).not.toHaveBeenCalled();

    restore();
  });

  it('restores all original properties and methods upon cleanup', () => {
    const origFocus = () => false;
    const fakeDoc = {
      hidden: true,
      visibilityState: 'hidden',
      hasFocus: origFocus,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const origWinAdd = vi.fn();
    const fakeWin = {
      document: fakeDoc,
      addEventListener: origWinAdd,
      removeEventListener: vi.fn(),
    } as unknown as Window;

    const restore = installVisibilityHook(fakeWin, () => true);

    expect(fakeDoc.hidden).toBe(false);
    expect(fakeDoc.visibilityState).toBe('visible');
    expect(fakeDoc.hasFocus()).toBe(true);

    restore();

    expect(fakeDoc.hidden).toBe(true);
    expect(fakeDoc.visibilityState).toBe('hidden');
    expect(fakeDoc.hasFocus).toBe(origFocus);
  });
});
