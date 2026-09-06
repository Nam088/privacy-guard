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
 *
 * Two decisions are worth stating, because the obvious implementation gets both wrong.
 *
 * Listeners are registered for real and neutralised at dispatch time, not dropped at
 * registration time. A dropped registration cannot be handed back when the user turns the
 * feature off, which leaves the page permanently deaf to its own events until a reload.
 *
 * `pagehide` and `pageshow` are left alone. A page flushes queued work on `pagehide`, message
 * sends and beacons among it, and restores state on `pageshow`. Swallowing those risks losing
 * data and buys nothing: feed reloading keys off visibility and focus, not off page transitions.
 */

const BLOCKED_WINDOW_EVENTS = new Set([
  'visibilitychange',
  'blur',
  'focus',
]);

const BLOCKED_DOCUMENT_EVENTS = new Set(['visibilitychange']);

type Listener = EventListenerOrEventListenerObject;
type ListenerOptions = boolean | AddEventListenerOptions;

/**
 * One page listener can be registered for several events and in both phases, so a single
 * wrapper per listener would not do. Keyed per (listener, type, phase), and weak so a page
 * that drops a listener without unregistering it does not leak.
 */
type WrapperRegistry = WeakMap<object, Map<string, EventListener>>;

function isCapture(options?: ListenerOptions): boolean {
  if (typeof options === 'boolean') {
    return options;
  }
  if (options && typeof options === 'object') {
    return Boolean(options.capture);
  }
  return false;
}

function wrapperKey(type: string, options?: ListenerOptions): string {
  return `${type}|${isCapture(options) ? 'capture' : 'bubble'}`;
}

function callListener(listener: Listener, thisArg: unknown, event: Event): void {
  if (typeof listener === 'function') {
    listener.call(thisArg, event);
    return;
  }
  if (listener && typeof listener.handleEvent === 'function') {
    listener.handleEvent(event);
  }
}

/**
 * The wrapper actually registered in the page's place. It swallows the event only while the
 * feature is on, so flipping the toggle takes effect on the next event with no reload.
 *
 * Known limit: a `{ once: true }` listener is spent by a swallowed dispatch, since the browser
 * retires the wrapper whether or not it passed the event on.
 */
function resolveWrapper(
  registry: WrapperRegistry,
  listener: Listener,
  type: string,
  options: ListenerOptions | undefined,
  isBlocked: () => boolean,
): EventListener {
  if (typeof listener !== 'function' && (typeof listener !== 'object' || listener === null)) {
    return listener as unknown as EventListener;
  }
  const key = wrapperKey(type, options);
  let byKey = registry.get(listener as object);
  if (!byKey) {
    byKey = new Map<string, EventListener>();
    registry.set(listener as object, byKey);
  }

  const existing = byKey.get(key);
  if (existing) {
    return existing;
  }

  const wrapper: EventListener = function (this: unknown, event: Event): void {
    try {
      if (isBlocked()) {
        return;
      }
      callListener(listener, this, event);
    } catch {
      // Don't break host page event dispatch
    }
  };
  byKey.set(key, wrapper);
  return wrapper;
}

function findWrapper(
  registry: WrapperRegistry,
  listener: Listener,
  type: string,
  options: ListenerOptions | undefined,
): EventListener | undefined {
  if (typeof listener !== 'function' && (typeof listener !== 'object' || listener === null)) {
    return undefined;
  }
  return registry.get(listener as object)?.get(wrapperKey(type, options));
}

function forgetWrapper(
  registry: WrapperRegistry,
  listener: Listener,
  type: string,
  options: ListenerOptions | undefined,
): void {
  if (typeof listener !== 'function' && (typeof listener !== 'object' || listener === null)) {
    return;
  }
  registry.get(listener as object)?.delete(wrapperKey(type, options));
}

interface HookTarget {
  addEventListener: (type: string, listener: Listener, options?: ListenerOptions) => void;
  removeEventListener: (type: string, listener: Listener, options?: ListenerOptions) => void;
}

/**
 * Swaps the target's add/remove pair for one that routes the named events through a wrapper.
 * Everything else is passed through untouched, listener reference included, so unrelated page
 * behaviour cannot be disturbed by the swap.
 */
function interceptListeners(
  target: HookTarget,
  blockedTypes: ReadonlySet<string>,
  isBlocked: () => boolean,
  undoList: Array<() => void>,
): void {
  const originalAdd = target.addEventListener;
  const originalRemove = target.removeEventListener;
  if (typeof originalAdd !== 'function') {
    return;
  }

  const registry: WrapperRegistry = new WeakMap();

  target.addEventListener = function (
    this: unknown,
    type: string,
    listener: Listener,
    options?: ListenerOptions,
  ): void {
    const receiver =
      this && typeof (this as Record<string, unknown>).addEventListener === 'function'
        ? (this as HookTarget)
        : target;

    let effective = listener;
    if (
      blockedTypes.has(type) &&
      listener &&
      (typeof listener === 'function' || typeof listener === 'object')
    ) {
      try {
        effective = resolveWrapper(registry, listener, type, options, isBlocked);
      } catch {
        effective = listener;
      }
    }

    try {
      if (typeof options === 'undefined') {
        return originalAdd.call(receiver, type, effective);
      }
      return originalAdd.call(receiver, type, effective, options);
    } catch {
      try {
        if (typeof options === 'undefined') {
          return originalAdd.call(target, type, listener);
        }
        return originalAdd.call(target, type, listener, options);
      } catch {
        // Safe fail-open: never crash host page
      }
    }
  };
  undoList.push(() => {
    try {
      target.addEventListener = originalAdd;
    } catch {
      // Ignore
    }
  });

  if (typeof originalRemove !== 'function') {
    return;
  }

  // Without this the page's own cleanup silently misses: it holds the listener it wrote, while
  // the target holds the wrapper, and the listener would keep firing after removal.
  target.removeEventListener = function (
    this: unknown,
    type: string,
    listener: Listener,
    options?: ListenerOptions,
  ): void {
    const receiver =
      this && typeof (this as Record<string, unknown>).removeEventListener === 'function'
        ? (this as HookTarget)
        : target;

    let effective = listener;
    if (
      blockedTypes.has(type) &&
      listener &&
      (typeof listener === 'function' || typeof listener === 'object')
    ) {
      try {
        const wrapper = findWrapper(registry, listener, type, options);
        if (wrapper) {
          effective = wrapper;
          forgetWrapper(registry, listener, type, options);
        }
      } catch {
        effective = listener;
      }
    }

    try {
      if (typeof options === 'undefined') {
        return originalRemove.call(receiver, type, effective);
      }
      return originalRemove.call(receiver, type, effective, options);
    } catch {
      try {
        if (typeof options === 'undefined') {
          return originalRemove.call(target, type, listener);
        }
        return originalRemove.call(target, type, listener, options);
      } catch {
        // Safe fail-open
      }
    }
  };
  undoList.push(() => {
    try {
      target.removeEventListener = originalRemove;
    } catch {
      // Ignore
    }
  });
}

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

  // 4. Neutralise window-level tab switching listeners at dispatch time
  interceptListeners(
    win as unknown as HookTarget,
    BLOCKED_WINDOW_EVENTS,
    isBlocked,
    undoList,
  );

  // 5. Neutralise document visibilitychange listeners at dispatch time
  const origDocAdd = doc.addEventListener;
  interceptListeners(
    doc as unknown as HookTarget,
    BLOCKED_DOCUMENT_EVENTS,
    isBlocked,
    undoList,
  );

  // 6. Deep defense: stop immediate propagation during capture phase for visibilitychange.
  //    This is what covers listeners the page registered before the hook was installed, which
  //    the wrapper above cannot reach. Registered through the original add so it does not
  //    wrap itself.
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
