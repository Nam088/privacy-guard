import { describe, expect, it, vi } from 'vitest';
import { observeMawBridge } from '@/observe/mawBridge';

describe('observeMawBridge', () => {
  it('intercepts MAWBridgeFireAndForget when resolved via passive require', () => {
    let suppressed = true;
    const fireMock = vi.fn();
    const rawBridge = { fireAndForget: fireMock };
    const rawRequire = vi.fn((name: string) => {
      if (name === 'MAWBridgeFireAndForget') {
        return rawBridge;
      }
      return {};
    });

    const scope = { require: rawRequire };
    const restore = observeMawBridge(scope, () => suppressed);

    const req = scope.require as unknown as (name: string) => {
      fireAndForget: (destination: string, action: string, payload?: unknown) => unknown;
    };
    const resolved = req('MAWBridgeFireAndForget');

    resolved.fireAndForget('backend', 'sendChatStateFromComposer', {
      chatJid: '123@msgr',
      state: 'TYPING',
    });

    expect(fireMock).not.toHaveBeenCalled();

    suppressed = false;
    resolved.fireAndForget('backend', 'sendChatStateFromComposer', {
      chatJid: '123@msgr',
      state: 'TYPING',
    });

    expect(fireMock).toHaveBeenCalledTimes(1);
    expect(fireMock).toHaveBeenCalledWith('backend', 'sendChatStateFromComposer', {
      chatJid: '123@msgr',
      state: 'TYPING',
    });

    restore();
  });

  it('allows unrelated actions to pass through even when typing is suppressed', () => {
    const fireMock = vi.fn();
    const rawBridge = { fireAndForget: fireMock };
    const rawRequire = vi.fn((name: string) => {
      if (name === 'MAWBridgeFireAndForget') {
        return rawBridge;
      }
      return {};
    });

    const scope = { require: rawRequire };
    const restore = observeMawBridge(scope, () => true);

    const req = scope.require as unknown as (name: string) => {
      fireAndForget: (destination: string, action: string, payload?: unknown) => unknown;
    };
    const resolved = req('MAWBridgeFireAndForget');

    resolved.fireAndForget('backend', 'sendMessage', { text: 'Hello' });

    expect(fireMock).toHaveBeenCalledTimes(1);
    expect(fireMock).toHaveBeenCalledWith('backend', 'sendMessage', { text: 'Hello' });

    restore();
  });

  it('never asks the page to resolve a module during installation', () => {
    const requireMock = vi.fn();
    const requireLazyMock = vi.fn();
    const scope = {
      require: requireMock,
      requireLazy: requireLazyMock,
    };

    const restore = observeMawBridge(scope, () => true);

    expect(requireMock).not.toHaveBeenCalled();
    expect(requireLazyMock).not.toHaveBeenCalled();

    restore();
  });

  it('intercepts MAWBridgeFireAndForget when registered via __d', () => {
    const suppressed = true;
    type Factory = (
      global: unknown,
      require: unknown,
      importDefault: unknown,
      importAll: unknown,
      module: { exports?: unknown },
      exports: unknown,
      define: unknown,
    ) => void;

    let registeredFactory: Factory | undefined;
    const originalD = (
      name: string,
      deps: string[],
      factory: Factory,
    ) => {
      if (name === 'MAWBridgeFireAndForget') {
        registeredFactory = factory;
      }
    };

    const scope = {
      __d: originalD,
    };

    const restore = observeMawBridge(scope, () => suppressed);

    const fireMock = vi.fn();
    const moduleExports = { fireAndForget: fireMock };
    const moduleObj = { exports: moduleExports };

    // Simulate Meta __d defining MAWBridgeFireAndForget
    scope.__d(
      'MAWBridgeFireAndForget',
      [],
      (_g, _r, _i, _a, m) => {
        m.exports = moduleExports;
      },
    );

    // Call registered factory
    expect(registeredFactory).toBeDefined();
    if (registeredFactory) {
      registeredFactory(null, null, null, null, moduleObj, moduleExports, null);
    }

    // Call fireAndForget with sendChatStateFromComposer
    moduleExports.fireAndForget('backend', 'sendChatStateFromComposer', { state: 'TYPING' });
    expect(fireMock).not.toHaveBeenCalled();

    // Call fireAndForget with normal action
    moduleExports.fireAndForget('backend', 'otherAction', {});
    expect(fireMock).toHaveBeenCalledWith('backend', 'otherAction', {});

    restore();
  });

  it('intercepts MAWBridgeFireAndForget when resolved via passive requireLazy', () => {
    const suppressed = true;
    const fireMock = vi.fn();
    const rawBridge = { fireAndForget: fireMock };
    const rawRequireLazy = vi.fn((deps: string[], cb: (...args: unknown[]) => void) => {
      cb(rawBridge);
    });

    const scope = { requireLazy: rawRequireLazy };
    const restore = observeMawBridge(scope, () => suppressed);

    const reqLazy = scope.requireLazy as unknown as (
      deps: string[],
      cb: (b: { fireAndForget: (...args: unknown[]) => unknown }) => void,
    ) => void;
    reqLazy(['MAWBridgeFireAndForget'], (bridge) => {
      bridge.fireAndForget('backend', 'sendChatStateFromComposer', { state: 'TYPING' });
    });
    expect(fireMock).not.toHaveBeenCalled();

    restore();
  });

  it('immediately patches module if already exported via getModuleIfExported', () => {
    const fireMock = vi.fn();
    const rawBridge = { fireAndForget: fireMock };
    const rawRequire = Object.assign(vi.fn(), {
      getModuleIfExported: vi.fn((name: string) => {
        if (name === 'MAWBridgeFireAndForget') {
          return rawBridge;
        }
        return null;
      }),
    });

    const scope = { require: rawRequire };
    const restore = observeMawBridge(scope, () => true);

    rawBridge.fireAndForget('backend', 'sendChatStateFromComposer', { state: 'TYPING' });
    expect(fireMock).not.toHaveBeenCalled();

    restore();
  });

  it('forwards the composer stop signal even while typing is suppressed', () => {
    const fireMock = vi.fn();
    const rawBridge = { fireAndForget: fireMock };
    const chatState = { TYPING: 1, IDLE: 0 };
    const rawRequire = vi.fn((name: string) => {
      if (name === 'MAWBridgeFireAndForget') {
        return rawBridge;
      }
      if (name === 'WAChatState') {
        return chatState;
      }
      return {};
    });

    const scope = { require: rawRequire };
    const restore = observeMawBridge(scope, () => true);

    const req = scope.require as unknown as (name: string) => unknown;
    // The page resolves both modules itself, exactly as the composer does.
    req('WAChatState');
    const resolved = req('MAWBridgeFireAndForget') as {
      fireAndForget: (destination: string, action: string, payload?: unknown) => unknown;
    };

    resolved.fireAndForget('backend', 'sendChatStateFromComposer', {
      chatJid: '123@msgr',
      state: chatState.TYPING,
    });
    expect(fireMock).not.toHaveBeenCalled();

    resolved.fireAndForget('backend', 'sendChatStateFromComposer', {
      chatJid: '123@msgr',
      state: chatState.IDLE,
    });
    expect(fireMock).toHaveBeenCalledTimes(1);
    expect(fireMock).toHaveBeenCalledWith('backend', 'sendChatStateFromComposer', {
      chatJid: '123@msgr',
      state: chatState.IDLE,
    });

    restore();
  });

  it('still drops every chat state when WAChatState was never observed', () => {
    const fireMock = vi.fn();
    const rawBridge = { fireAndForget: fireMock };
    const rawRequire = vi.fn((name: string) => {
      if (name === 'MAWBridgeFireAndForget') {
        return rawBridge;
      }
      return {};
    });

    const scope = { require: rawRequire };
    const restore = observeMawBridge(scope, () => true);

    const req = scope.require as unknown as (name: string) => {
      fireAndForget: (destination: string, action: string, payload?: unknown) => unknown;
    };
    const resolved = req('MAWBridgeFireAndForget');

    resolved.fireAndForget('backend', 'sendChatStateFromComposer', { state: 7 });
    expect(fireMock).not.toHaveBeenCalled();

    restore();
  });

  it('leaves an inbound typing subscription alone', () => {
    const fireMock = vi.fn();
    const rawBridge = { fireAndForget: fireMock };
    const rawRequire = vi.fn((name: string) => {
      if (name === 'MAWBridgeFireAndForget') {
        return rawBridge;
      }
      return {};
    });

    const scope = { require: rawRequire };
    const restore = observeMawBridge(scope, () => true);

    const req = scope.require as unknown as (name: string) => {
      fireAndForget: (destination: string, action: string, payload?: unknown) => unknown;
    };
    const resolved = req('MAWBridgeFireAndForget');

    resolved.fireAndForget('backend', 'subscribeToTypingState', { threadKey: '9' });

    expect(fireMock).toHaveBeenCalledTimes(1);

    restore();
  });

  it('forwards every argument, including ones past the payload', () => {
    const fireMock = vi.fn();
    const rawBridge = { fireAndForget: fireMock };
    const rawRequire = vi.fn((name: string) => {
      if (name === 'MAWBridgeFireAndForget') {
        return rawBridge;
      }
      return {};
    });

    const scope = { require: rawRequire };
    const restore = observeMawBridge(scope, () => true);

    const req = scope.require as unknown as (name: string) => {
      fireAndForget: (...args: unknown[]) => unknown;
    };
    const resolved = req('MAWBridgeFireAndForget');
    const trailing = { timeoutMs: 500 };

    resolved.fireAndForget('backend', 'sendMessage', { text: 'Hello' }, trailing);

    expect(fireMock).toHaveBeenCalledWith('backend', 'sendMessage', { text: 'Hello' }, trailing);

    restore();
  });

  it('lets the call through when the suppression predicate throws', () => {
    const fireMock = vi.fn();
    const rawBridge = { fireAndForget: fireMock };
    const rawRequire = vi.fn((name: string) => {
      if (name === 'MAWBridgeFireAndForget') {
        return rawBridge;
      }
      return {};
    });

    const scope = { require: rawRequire };
    const restore = observeMawBridge(scope, () => {
      throw new Error('settings gone');
    });

    const req = scope.require as unknown as (name: string) => {
      fireAndForget: (destination: string, action: string, payload?: unknown) => unknown;
    };
    const resolved = req('MAWBridgeFireAndForget');

    expect(() => {
      resolved.fireAndForget('backend', 'sendChatStateFromComposer', { state: 'TYPING' });
    }).not.toThrow();
    expect(fireMock).toHaveBeenCalledTimes(1);

    restore();
  });

  it('puts the original fireAndForget back when undone', () => {
    const fireMock = vi.fn();
    const rawBridge = { fireAndForget: fireMock };
    const rawRequire = vi.fn((name: string) => {
      if (name === 'MAWBridgeFireAndForget') {
        return rawBridge;
      }
      return {};
    });

    const scope = { require: rawRequire };
    const restore = observeMawBridge(scope, () => true);

    const req = scope.require as unknown as (name: string) => unknown;
    req('MAWBridgeFireAndForget');

    restore();

    expect(rawBridge.fireAndForget).toBe(fireMock);
    expect(scope.require).toBe(rawRequire);
  });

  it('keeps non-enumerable properties on the require it replaces', () => {
    const fireMock = vi.fn();
    const rawBridge = { fireAndForget: fireMock };
    const rawRequire = vi.fn(() => ({}));
    Object.defineProperty(rawRequire, 'getModuleIfExported', {
      value: (name: string) => (name === 'MAWBridgeFireAndForget' ? rawBridge : null),
      enumerable: false,
      configurable: true,
      writable: true,
    });

    const scope = { require: rawRequire };
    const restore = observeMawBridge(scope, () => true);

    expect(typeof (scope.require as unknown as Record<string, unknown>).getModuleIfExported).toBe(
      'function',
    );
    rawBridge.fireAndForget('backend', 'sendChatStateFromComposer', { state: 'TYPING' });
    expect(fireMock).not.toHaveBeenCalled();

    restore();
  });

  it('gives require and __r the same wrapper when the page shares one function', () => {
    const rawRequire = vi.fn(() => ({}));
    const scope = { require: rawRequire, __r: rawRequire };

    const restore = observeMawBridge(scope, () => true);

    expect(scope.__r).toBe(scope.require);

    restore();
  });

  it('never learns a stop value from anything but the module itself', () => {
    // A module factory is handed the page globals alongside its own module object. Reading a
    // chat state vocabulary out of those globals could teach the wrong value, and a wrong value
    // means a typing signal walks straight through.
    type Factory = (global: unknown, require: unknown, module: { exports?: unknown }) => void;

    const scope: {
      __d: (name: string, deps: string[], factory: Factory) => void;
      require?: (name: string) => unknown;
    } = {
      __d: () => {},
    };

    const registered = new Map<string, Factory>();
    scope.__d = (name: string, _deps: string[], factory: Factory) => {
      registered.set(name, factory);
    };

    const restore = observeMawBridge(scope, () => true);

    const chatState = { TYPING: 1, IDLE: 0 };
    // Values that collide with TYPING, sitting on an unrelated object the factory receives.
    const pageGlobals = { typingDebounce: 1, idleTimeoutMs: 1, stopDelay: 1 };

    scope.__d('WAChatState', [], (_g, _r, m) => {
      m.exports = chatState;
    });
    const chatStateFactory = registered.get('WAChatState');
    expect(chatStateFactory).toBeDefined();
    const chatStateModule: { exports?: unknown } = {};
    chatStateFactory?.(pageGlobals, null, chatStateModule);

    const fireMock = vi.fn();
    const bridgeExports = { fireAndForget: fireMock };
    scope.__d('MAWBridgeFireAndForget', [], (_g, _r, m) => {
      m.exports = bridgeExports;
    });
    const bridgeFactory = registered.get('MAWBridgeFireAndForget');
    expect(bridgeFactory).toBeDefined();
    bridgeFactory?.(pageGlobals, null, { exports: bridgeExports });

    bridgeExports.fireAndForget('backend', 'sendChatStateFromComposer', {
      state: chatState.TYPING,
    });
    expect(fireMock).not.toHaveBeenCalled();

    bridgeExports.fireAndForget('backend', 'sendChatStateFromComposer', {
      state: chatState.IDLE,
    });
    expect(fireMock).toHaveBeenCalledTimes(1);

    restore();
  });

  it('safely handles missing or throwing globals', () => {
    const emptyScope = {};
    expect(() => {
      const restore = observeMawBridge(emptyScope, () => true);
      restore();
    }).not.toThrow();

    const throwingScope = {
      get require(): never {
        throw new Error('access denied');
      },
    };
    expect(() => {
      const restore = observeMawBridge(throwingScope, () => true);
      restore();
    }).not.toThrow();
  });
});
