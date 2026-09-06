/**
 * Visibility and Feed Auto-Refresh Interceptor.
 *
 * In modern single-page web applications like Facebook Comet, automatic feed
 * reloading and loss of reading position are driven by tab inactivity signals:
 * 1. The Page Visibility API (`document.visibilityState === 'hidden'`, `document.hidden === true`).
 * 2. Focus state tracking (`document.hasFocus() === false`).
 * 3. Window blur/focus and document visibilitychange events.
 *
 * This interceptor preserves reading position by spoofing an active foreground state
 * and defusing tab-switching event listeners when feed auto-refresh blocking is enabled.
 */

const BLOCKED_WINDOW_EVENTS = new Set([
  'visibilitychange',
  'blur',
  'focus',
  'pagehide',
  'pageshow',
]);

const BLOCKED_DOCUMENT_EVENTS = new Set(['visibilitychange']);

export function installVisibilityHook(
  win: Window,
  isBlocked: () => boolean,
): () => void {
  const undoList: Array<() => void> = [];

  const doc = win.document;
  if (!doc) {
    return () => {};
  }

  // 1. Intercept document.hidden
  let origHiddenDesc = Object.getOwnPropertyDescriptor(doc, 'hidden');
  if (!origHiddenDesc && typeof Document !== 'undefined' && Document.prototype) {
    origHiddenDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');
  }

  try {
    Object.defineProperty(doc, 'hidden', {
      configurable: true,
      enumerable: true,
      get() {
        if (isBlocked()) {
          return false;
        }
        if (origHiddenDesc) {
          if (typeof origHiddenDesc.get === 'function') {
            return origHiddenDesc.get.call(this);
          }
          if ('value' in origHiddenDesc) {
            return Boolean(origHiddenDesc.value);
          }
        }
        return false;
      },
    });
    undoList.push(() => {
      if (origHiddenDesc) {
        Object.defineProperty(doc, 'hidden', origHiddenDesc);
      } else {
        delete (doc as unknown as Record<string, unknown>).hidden;
      }
    });
  } catch {
    // Safely ignore if descriptor cannot be set
  }

  // 2. Intercept document.visibilityState
  let origVisibilityDesc = Object.getOwnPropertyDescriptor(
    doc,
    'visibilityState',
  );
  if (!origVisibilityDesc && typeof Document !== 'undefined' && Document.prototype) {
    origVisibilityDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');
  }

  try {
    Object.defineProperty(doc, 'visibilityState', {
      configurable: true,
      enumerable: true,
      get() {
        if (isBlocked()) {
          return 'visible';
        }
        if (origVisibilityDesc) {
          if (typeof origVisibilityDesc.get === 'function') {
            return origVisibilityDesc.get.call(this);
          }
          if ('value' in origVisibilityDesc) {
            return String(origVisibilityDesc.value);
          }
        }
        return 'visible';
      },
    });
    undoList.push(() => {
      if (origVisibilityDesc) {
        Object.defineProperty(doc, 'visibilityState', origVisibilityDesc);
      } else {
        delete (doc as unknown as Record<string, unknown>).visibilityState;
      }
    });
  } catch {
    // Safely ignore if descriptor cannot be set
  }

  // 3. Intercept document.hasFocus()
  const origHasFocus = doc.hasFocus;
  if (typeof origHasFocus === 'function') {
    doc.hasFocus = function (this: Document): boolean {
      if (isBlocked()) {
        return true;
      }
      return origHasFocus.call(this);
    };
    undoList.push(() => {
      doc.hasFocus = origHasFocus;
    });
  }

  // 4. Wrap win.addEventListener to defuse window-level tab switching events
  const origWinAdd = win.addEventListener;
  if (typeof origWinAdd === 'function') {
    win.addEventListener = function (
      this: Window,
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ): void {
      if (isBlocked()) {
        if (BLOCKED_WINDOW_EVENTS.has(type)) {
          return;
        }
      }
      if (typeof options === 'undefined') {
        return origWinAdd.call(this, type, listener);
      }
      return origWinAdd.call(this, type, listener, options);
    };
    undoList.push(() => {
      win.addEventListener = origWinAdd;
    });
  }

  // 5. Wrap doc.addEventListener to defuse document visibilitychange
  const origDocAdd = doc.addEventListener;
  if (typeof origDocAdd === 'function') {
    doc.addEventListener = function (
      this: Document,
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ): void {
      if (isBlocked()) {
        if (BLOCKED_DOCUMENT_EVENTS.has(type)) {
          return;
        }
      }
      if (typeof options === 'undefined') {
        return origDocAdd.call(this, type, listener);
      }
      return origDocAdd.call(this, type, listener, options);
    };
    undoList.push(() => {
      doc.addEventListener = origDocAdd;
    });
  }

  // 6. Deep defense: Stop immediate propagation during capture phase for visibilitychange
  const captureStopper = function (event: Event): void {
    if (isBlocked()) {
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
    }
  };

  const addEvent = origDocAdd || doc.addEventListener;
  if (typeof addEvent === 'function') {
    addEvent.call(doc, 'visibilitychange', captureStopper, true);
    undoList.push(() => {
      const removeEvent = doc.removeEventListener;
      if (typeof removeEvent === 'function') {
        removeEvent.call(doc, 'visibilitychange', captureStopper, true);
      }
    });
  }

  return () => {
    for (let i = undoList.length - 1; i >= 0; i -= 1) {
      const undo = undoList[i];
      if (undo) {
        undo();
      }
    }
    undoList.length = 0;
  };
}
