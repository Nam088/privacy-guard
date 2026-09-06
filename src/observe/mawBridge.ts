/**
 * Meta Armadillo Web (MAW) Bridge Interceptor.
 *
 * In modern Facebook Messenger (including End-to-End Encrypted MAW chats),
 * typing indicators are dispatched from the UI composer via the internal
 * module `MAWBridgeFireAndForget.fireAndForget("backend", "sendChatStateFromComposer", ...)`.
 *
 * This interceptor traps Meta's module runtime (__d, require, requireLazy, __r)
 * passively and patches exports so typing indicators are dropped before reaching the
 * Armadillo encryption worker. It never actively calls `require()` or `requireLazy()`
 * on unknown modules to avoid triggering Meta's ErrorUtils.
 *
 * One action carries both directions: the composer sends `state: TYPING` when the user starts
 * and `state: IDLE` when they stop. Dropping both would strand the recipient on "typing...",
 * so the stop signal is always let through. Which value counts as a stop is learned from
 * `WAChatState` when the page resolves it, never guessed; until that module is seen, every chat
 * state is dropped, which is the behaviour this file has always had.
 */

export interface MawBridgeScope {
  __d?: (name: string, deps: string[], factory: (...args: unknown[]) => unknown, special?: unknown) => unknown;
  require?: (name: string, ...rest: unknown[]) => unknown;
  requireLazy?: (deps: string[], callback: (...args: unknown[]) => void) => unknown;
  __r?: (name: string, ...rest: unknown[]) => unknown;
  addEventListener?: (type: string, listener: EventListenerOrEventListenerObject, options?: unknown) => void;
  removeEventListener?: (type: string, listener: EventListenerOrEventListenerObject, options?: unknown) => void;
  [key: string]: unknown;
}

const BRIDGE_MODULE = 'MAWBridgeFireAndForget';
const CHAT_STATE_MODULE = 'WAChatState';
const WATCHED_MODULES = [
  BRIDGE_MODULE,
  CHAT_STATE_MODULE,
  'MAWBridge',
  'MWBridgeFireAndForget',
  'MWPArmadilloBridge',
  'MWChatState',
  'ArmadilloWebBridge',
];

const INSTALLED = new WeakSet<object>();
const WRAPPED = new WeakSet<object>();
/** Loaders this file has already wrapped, so re-assigning one back never nests a second layer. */
const WRAPPED_LOADERS = new WeakSet<object>();

/** Names a chat state enum uses for "no longer typing". Anything else is treated as a signal. */
const STOP_STATE_NAME = /idle|paus|stop|inactive|clear|gone/i;

/**
 * Prefixes that mark an action as reading someone else's state rather than publishing our own.
 * Suppressing those would cost the user the incoming "is typing" indicator without hiding
 * anything, so they are never dropped. The trailing capital keeps `on` from eating `oneTap...`.
 */
const INBOUND_ACTION = /^(?:on|(?:un)?subscribe|listen|observe|watch|receive|get|fetch|read|is|has)[A-Z_]/;

function matchesChatKeyword(val: unknown): boolean {
  if (typeof val !== 'string') {
    return false;
  }
  const lower = val.toLowerCase();
  return (
    lower.includes('chatstate') ||
    lower.includes('typing') ||
    lower.includes('send_typing_indicators')
  );
}

function isOutboundChatState(destination: unknown, action?: unknown): boolean {
  if (!matchesChatKeyword(destination) && !matchesChatKeyword(action)) {
    return false;
  }
  if (typeof action === 'string' && INBOUND_ACTION.test(action)) {
    return false;
  }
  return true;
}

function matchesReceiptKeyword(val: unknown): boolean {
  if (typeof val !== 'string') {
    return false;
  }
  const lower = val.toLowerCase();
  return (
    lower.includes('receipt') ||
    lower.includes('markread') ||
    lower.includes('markseen') ||
    lower.includes('seenstate') ||
    lower.includes('displayedreceipt')
  );
}

function isOutboundReceipt(destination: unknown, action?: unknown): boolean {
  if (!matchesReceiptKeyword(destination) && !matchesReceiptKeyword(action)) {
    return false;
  }
  if (typeof action === 'string' && INBOUND_ACTION.test(action)) {
    return false;
  }
  return true;
}

function isThenable(value: unknown): boolean {
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) {
    return false;
  }
  return typeof (value as { then?: unknown }).then === 'function';
}

/**
 * Copies a function's own properties and prototype onto its replacement.
 *
 * `Object.assign` was not enough: it skips non-enumerable properties, so Meta's
 * `require.getModuleIfExported` disappeared behind the wrapper and the "module already loaded"
 * path silently did nothing. Descriptors are copied rather than values so a lazy getter is
 * carried over without being invoked.
 */
function copyFunctionShape(from: object, to: object): void {
  try {
    Object.setPrototypeOf(to, Object.getPrototypeOf(from));
  } catch {
    // Prototype refused, the wrapper still works
  }

  const keys: Array<string | symbol> = [
    ...Object.getOwnPropertyNames(from),
    ...Object.getOwnPropertySymbols(from),
  ];

  for (const key of keys) {
    if (key === 'arguments' || key === 'caller' || key === 'prototype') {
      continue;
    }
    try {
      const descriptor = Object.getOwnPropertyDescriptor(from, key);
      if (descriptor) {
        Object.defineProperty(to, key, descriptor);
      }
    } catch {
      // A single property refusing to copy is not worth losing the wrapper over
    }
  }
}

/**
 * Attaches interception to a MAWBridgeFireAndForget module instance.
 */
function patchBridgeInstance(
  mod: unknown,
  isTypingSuppressed: () => boolean,
  isReadSuppressed: () => boolean,
  isStopState: (payload: unknown) => boolean,
  undoList: Array<() => void>,
): boolean {
  if (typeof mod !== 'object' && typeof mod !== 'function') {
    return false;
  }
  if (mod === null) {
    return false;
  }

  const candidate = mod as Record<string, unknown>;
  let targetObject: Record<string, unknown> | undefined = undefined;

  if (typeof candidate.fireAndForget === 'function') {
    targetObject = candidate;
  } else if (
    candidate.default &&
    typeof (candidate.default as Record<string, unknown>).fireAndForget === 'function'
  ) {
    targetObject = candidate.default as Record<string, unknown>;
  } else if (
    candidate[BRIDGE_MODULE] &&
    typeof (candidate[BRIDGE_MODULE] as Record<string, unknown>).fireAndForget === 'function'
  ) {
    targetObject = candidate[BRIDGE_MODULE] as Record<string, unknown>;
  }

  if (!targetObject || typeof targetObject.fireAndForget !== 'function') {
    return false;
  }

  const originalFire = targetObject.fireAndForget as (...args: unknown[]) => unknown;

  if (WRAPPED.has(originalFire)) {
    return true;
  }

  /**
   * What a real call hands back. Nothing here documents the contract of `fireAndForget`, so a
   * cancelled call mirrors whatever a forwarded one was last seen to return instead of asserting
   * a promise. Before any call has been forwarded, a resolved promise is the safer guess.
   */
  let returnsThenable: boolean | undefined = undefined;

  /**
   * A predicate reaching into extension settings can fail. Failing open keeps the composer
   * working; failing closed would silently break the user's typing indicator forever.
   */
  function shouldSuppress(args: unknown[]): boolean {
    try {
      const isChatState = isOutboundChatState(args[0], args[1]);
      if (isChatState && !isStopState(args[2]) && isTypingSuppressed()) {
        return true;
      }
      const isReceipt = isOutboundReceipt(args[0], args[1]);
      if (isReceipt && isReadSuppressed()) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  const patchedFire = function (this: unknown, ...args: unknown[]): unknown {
    if (shouldSuppress(args)) {
      return returnsThenable === false ? undefined : Promise.resolve();
    }

    const result = originalFire.apply(this, args);
    if (returnsThenable === undefined) {
      returnsThenable = isThenable(result);
    }
    return result;
  };
  WRAPPED.add(patchedFire);

  let assigned = false;
  try {
    targetObject.fireAndForget = patchedFire;
    assigned = true;
  } catch {
    // Attempt defineProperty if direct assignment fails
  }

  if (!assigned) {
    try {
      Object.defineProperty(targetObject, 'fireAndForget', {
        value: patchedFire,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } catch {
      return false;
    }
  }

  undoList.push(() => {
    try {
      targetObject.fireAndForget = originalFire;
    } catch {
      // Property refused restoration
    }
  });
  return true;
}

/**
 * Replaces one global with an accessor so later assignments can be seen and rewritten.
 */
function trapProperty(
  scope: Record<string, unknown>,
  key: string,
  onAssign: (value: unknown) => unknown,
  undoList: Array<() => void>,
): void {
  const originalDescriptor = Object.getOwnPropertyDescriptor(scope, key);

  let original: unknown = undefined;
  try {
    original = scope[key];
  } catch {
    original = undefined;
  }

  let current: unknown = original === undefined ? undefined : onAssign(original);

  try {
    Object.defineProperty(scope, key, {
      configurable: true,
      // Matching the original keeps `Object.keys(window)` unchanged. A key that did not exist
      // yet is created non-enumerable for the same reason.
      enumerable: originalDescriptor ? originalDescriptor.enumerable : false,
      get() {
        return current;
      },
      set(next: unknown) {
        current = onAssign(next);
      },
    });
  } catch {
    // No trap is possible, so wrap what is there and keep a way back to the original.
    if (current !== undefined) {
      try {
        scope[key] = current;
      } catch {
        return;
      }
      undoList.push(() => {
        try {
          scope[key] = original;
        } catch {
          // Property refused restoration
        }
      });
    }
    return;
  }

  undoList.push(() => {
    try {
      if (originalDescriptor) {
        Object.defineProperty(scope, key, originalDescriptor);
        return;
      }

      delete scope[key];
      if (current !== undefined) {
        Object.defineProperty(scope, key, {
          configurable: true,
          enumerable: true,
          writable: true,
          value: current,
        });
      }
    } catch {
      // Failed to restore descriptor
    }
  });
}

/**
 * Observes and intercepts Meta Armadillo Web typing actions passively.
 */
export function observeMawBridge(
  scope: MawBridgeScope,
  isTypingSuppressed: () => boolean,
  isReadSuppressed: () => boolean = () => false,
): () => void {
  if (typeof scope !== 'object' || scope === null) {
    return () => {};
  }

  if (INSTALLED.has(scope)) {
    return () => {};
  }
  INSTALLED.add(scope);

  const undoList: Array<() => void> = [];
  const globals = scope as unknown as Record<string, unknown>;
  const loaderWrappers = new WeakMap<object, unknown>();
  /** Values `WAChatState` gives to "stopped typing". Empty until the page resolves that module. */
  const stopStates = new Set<unknown>();
  let bridgePatched = false;

  function isStopState(payload: unknown): boolean {
    if (!payload || typeof payload !== 'object') {
      return false;
    }
    const state = (payload as Record<string, unknown>).state;
    if (state === undefined || state === null) {
      return false;
    }
    if (typeof state === 'string' && STOP_STATE_NAME.test(state)) {
      return true;
    }
    return stopStates.has(state);
  }

  /**
   * Recognises a chat state vocabulary, and refuses anything that merely resembles one.
   *
   * An enum names both ends of the state (some form of typing, some form of idle) and holds
   * nothing but plain values. Requiring all three keeps a settings bag or a globals object from
   * being mistaken for the vocabulary, because being wrong here means letting a typing signal out.
   */
  function readChatStateNames(mod: unknown): Record<string, unknown> | undefined {
    if (!mod || (typeof mod !== 'object' && typeof mod !== 'function')) {
      return undefined;
    }
    const candidate = mod as Record<string, unknown>;
    const keys = Object.keys(candidate);
    const namesAStop = keys.some((key) => STOP_STATE_NAME.test(key));
    const namesTyping = keys.some((key) => /typing|composing/i.test(key));
    const allPlain = keys.every((key) => {
      const kind = typeof candidate[key];
      return kind === 'string' || kind === 'number';
    });

    if (namesAStop && namesTyping && allPlain) {
      return candidate;
    }
    return readChatStateNames(candidate.default);
  }

  function learnChatState(mod: unknown): void {
    const source = readChatStateNames(mod);
    if (!source) {
      return;
    }
    for (const key of Object.keys(source)) {
      if (STOP_STATE_NAME.test(key)) {
        stopStates.add(source[key]);
      }
    }
  }

  /**
   * Everything this file learns about a module goes through here, inside a try/catch, because
   * every caller sits on Meta's own module resolution path where a thrown error becomes theirs.
   */
  function noticeModule(name: unknown, value: unknown): void {
    if (!value) {
      return;
    }
    try {
      if (name === CHAT_STATE_MODULE) {
        learnChatState(value);
        return;
      }
      if (typeof name === 'string' && WATCHED_MODULES.includes(name)) {
        if (patchBridgeInstance(value, isTypingSuppressed, isReadSuppressed, isStopState, undoList)) {
          bridgePatched = true;
        }
        return;
      }
    } catch {
      // Never surface an error into Meta's loader
    }
  }

  function wrapD(rawD: unknown): unknown {
    if (typeof rawD !== 'function') {
      return rawD;
    }
    if (WRAPPED_LOADERS.has(rawD)) {
      return rawD;
    }
    const cached = loaderWrappers.get(rawD);
    if (cached) {
      return cached;
    }
    const define = rawD as (...args: unknown[]) => unknown;

    const wrappedDefine = function (this: unknown, ...args: unknown[]): unknown {
      let watched: unknown = undefined;
      let factoryIndex = -1;

      for (let i = 0; i < args.length; i += 1) {
        if (typeof args[i] === 'string' && WATCHED_MODULES.includes(args[i] as string)) {
          watched = args[i];
        }
        if (typeof args[i] === 'function' && factoryIndex === -1) {
          factoryIndex = i;
        }
      }

      if (watched === undefined || factoryIndex === -1) {
        return define.apply(this, args);
      }

      const originalFactory = args[factoryIndex] as (...fArgs: unknown[]) => unknown;
      const wrappedFactory = function (this: unknown, ...factoryArgs: unknown[]): unknown {
        const result = originalFactory.apply(this, factoryArgs);
        noticeModule(watched, result);
        for (let i = 0; i < factoryArgs.length; i += 1) {
          const arg = factoryArgs[i];
          if (!arg || typeof arg !== 'object') {
            continue;
          }
          const obj = arg as Record<string, unknown>;
          if ('exports' in obj) {
            noticeModule(watched, obj.exports);
          }
          if (watched !== CHAT_STATE_MODULE && typeof watched === 'string' && WATCHED_MODULES.includes(watched)) {
            noticeModule(watched, obj);
          }
        }
        return result;
      };

      const newArgs = [...args];
      newArgs[factoryIndex] = wrappedFactory;
      return define.apply(this, newArgs);
    };

    copyFunctionShape(define, wrappedDefine);
    WRAPPED_LOADERS.add(wrappedDefine);
    loaderWrappers.set(define, wrappedDefine);
    return wrappedDefine;
  }

  function wrapRequire(rawRequire: unknown): unknown {
    if (typeof rawRequire !== 'function') {
      return rawRequire;
    }
    // `__r` and `require` are usually the same function on the page. Handing back the same
    // wrapper keeps that identity true and stops a second trap from nesting wrappers.
    if (WRAPPED_LOADERS.has(rawRequire)) {
      return rawRequire;
    }
    const cached = loaderWrappers.get(rawRequire);
    if (cached) {
      return cached;
    }

    const requireFn = rawRequire as (name: string, ...rest: unknown[]) => unknown;

    const wrappedRequire = function (this: unknown, name: string, ...rest: unknown[]): unknown {
      const result = requireFn.call(this, name, ...rest);
      noticeModule(name, result);
      return result;
    };

    copyFunctionShape(requireFn, wrappedRequire);
    WRAPPED_LOADERS.add(wrappedRequire);
    loaderWrappers.set(requireFn, wrappedRequire);
    return wrappedRequire;
  }

  function wrapRequireLazy(rawRequireLazy: unknown): unknown {
    if (typeof rawRequireLazy !== 'function') {
      return rawRequireLazy;
    }
    if (WRAPPED_LOADERS.has(rawRequireLazy)) {
      return rawRequireLazy;
    }
    const cached = loaderWrappers.get(rawRequireLazy);
    if (cached) {
      return cached;
    }

    const requireLazyFn = rawRequireLazy as (
      deps: unknown[],
      callback: (...args: unknown[]) => unknown,
      ...rest: unknown[]
    ) => unknown;

    const wrappedRequireLazy = function (
      this: unknown,
      deps: unknown[],
      callback: (...args: unknown[]) => unknown,
      ...rest: unknown[]
    ): unknown {
      const watches =
        Array.isArray(deps) &&
        typeof callback === 'function' &&
        deps.some((dep) => typeof dep === 'string' && WATCHED_MODULES.includes(dep));

      if (!watches) {
        return requireLazyFn.call(this, deps, callback, ...rest);
      }

      const originalCallback = callback;
      const wrappedCallback = function (this: unknown, ...args: unknown[]): unknown {
        for (let i = 0; i < deps.length; i += 1) {
          noticeModule(deps[i], args[i]);
        }
        return originalCallback.apply(this, args);
      };
      return requireLazyFn.call(this, deps, wrappedCallback, ...rest);
    };

    copyFunctionShape(requireLazyFn, wrappedRequireLazy);
    WRAPPED_LOADERS.add(wrappedRequireLazy);
    loaderWrappers.set(requireLazyFn, wrappedRequireLazy);
    return wrappedRequireLazy;
  }

  trapProperty(globals, '__d', wrapD, undoList);
  trapProperty(globals, 'require', wrapRequire, undoList);
  trapProperty(globals, 'requireLazy', wrapRequireLazy, undoList);
  trapProperty(globals, '__r', wrapRequire, undoList);

  /**
   * Covers the case where a module finished loading before this file ran. It reads what the page
   * already exported and never asks for anything that is not there.
   */
  function tryPatchExported(): boolean {
    try {
      const rawReq = (globals.require ?? globals.__r) as
        | { getModuleIfExported?: (name: string) => unknown }
        | undefined;
      if (!rawReq || typeof rawReq.getModuleIfExported !== 'function') {
        return false;
      }
      for (const name of WATCHED_MODULES) {
        const alreadyExported = rawReq.getModuleIfExported(name);
        if (alreadyExported) {
          noticeModule(name, alreadyExported);
        }
      }
    } catch {
      // Ignore
    }
    return bridgePatched;
  }

  if (!tryPatchExported() && typeof scope.addEventListener === 'function') {
    // A retry hook, not a poll: it stops costing anything the moment the bridge is in hand.
    let detachFocus = () => {};
    const onFocusIn = () => {
      if (tryPatchExported()) {
        detachFocus();
      }
    };
    detachFocus = () => {
      if (typeof scope.removeEventListener === 'function') {
        scope.removeEventListener('focusin', onFocusIn);
      }
    };
    scope.addEventListener('focusin', onFocusIn, { passive: true });
    undoList.push(detachFocus);
  }

  return () => {
    for (let i = undoList.length - 1; i >= 0; i -= 1) {
      const undo = undoList[i];
      if (undo) {
        undo();
      }
    }
    undoList.length = 0;
    INSTALLED.delete(scope);
  };
}
