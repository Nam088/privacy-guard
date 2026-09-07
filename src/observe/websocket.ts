import {
  describeValue,
  newEvent,
  type ObservedEvent,
  type Report,
} from './types';
import { readReplayManager } from './replayBuffer';

interface SocketScope {
  WebSocket?: typeof WebSocket;
}

/**
 * What to do with one outbound frame. Returning `drop` withholds it from the socket.
 */
export type SendVerdict = 'pass' | 'drop' | 'mixed';

export interface SendDecision {
  readonly action: SendVerdict;
  readonly modifiedData?: unknown;
}

export type InterceptSend = (
  url: string,
  data: unknown,
) => SendVerdict | SendDecision;

export type InterceptReceive = (url: string, data: unknown) => 'pass' | 'drop';

const INSTALLED = new WeakSet<object>();

export function observeWebSocket(
  scope: SocketScope,
  report: Report,
  frameUrl?: string,
  intercept?: InterceptSend,
  interceptReceive?: InterceptReceive,
): () => void {
  let Original: typeof WebSocket | undefined;
  try {
    Original = scope.WebSocket;
  } catch {
    return () => {};
  }
  if (typeof Original !== 'function' || INSTALLED.has(scope)) {
    return () => {};
  }
  INSTALLED.add(scope);

  const safely = (build: () => ObservedEvent, raw?: unknown): void => {
    try {
      report(build(), raw);
    } catch {
      // Observation must never affect the page.
    }
  };

  const originalSend = Original.prototype.send;
  const originalAddEventListener = Original.prototype.addEventListener;
  const originalRemoveEventListener = Original.prototype.removeEventListener;
  const origOnMessageDesc = Object.getOwnPropertyDescriptor(Original.prototype, 'onmessage');

  function patchedSend(this: WebSocket, data: unknown): void {
    if (!this) {
      return;
    }

    try {
      if (typeof this.url === 'string') {
        readReplayManager.registerSocket(this, (d) => {
          try {
            if (this.readyState !== 2 && this.readyState !== 3) {
              originalSend.call(this, d as never);
            }
          } catch {
            // Ignore
          }
        });
      }
    } catch {
      // Non-standard socket
    }

    let verdict: SendVerdict = 'pass';
    let dataToSend = data;

    try {
      const url = typeof this.url === 'string' ? this.url : '';
      const decision = intercept?.(url, data);
      if (typeof decision === 'string') {
        verdict = decision;
      } else if (decision && typeof decision === 'object') {
        verdict = decision.action;
        if (decision.modifiedData !== undefined) {
          dataToSend = decision.modifiedData;
        }
      }
    } catch {
      verdict = 'pass';
    }

    safely(() => {
      const kind =
        verdict === 'drop'
          ? 'websocket.suppressed'
          : verdict === 'mixed'
            ? 'websocket.mixed'
            : 'websocket.send';
      const event = newEvent(kind, this.url || '', frameUrl);
      event.value = describeValue(dataToSend);
      return event;
    }, dataToSend);

    if (verdict === 'drop') {
      if (
        typeof this.url === 'string' &&
        (this.url.includes('/ws/lightspeed') || this.url.includes('/ws/realtime'))
      ) {
        readReplayManager.cacheSuppressedReceipt(this.url, data);
      }
      return;
    }

    try {
      if (this.readyState === 2 || this.readyState === 3) {
        return;
      }
      return originalSend.call(this, dataToSend as never);
    } catch {
      // Prevent unhandled DOMException when socket is closing/closed during stream teardown
    }
  }

  Original.prototype.send = patchedSend as typeof originalSend;

  const wrappedListeners = new WeakMap<object, EventListener>();

  if (interceptReceive && originalAddEventListener) {
    Original.prototype.addEventListener = function (
      this: WebSocket,
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ): void {
      if (type !== 'message' || typeof listener !== 'function') {
        try {
          return originalAddEventListener.call(this, type, listener as never, options);
        } catch {
          return;
        }
      }

      const originalListener = listener as EventListener;
      const wrapped: EventListener = (event: Event) => {
        const msgEvent = event as MessageEvent;
        try {
          if (interceptReceive(this.url, msgEvent.data) === 'drop') {
            event.stopImmediatePropagation();
            return;
          }
        } catch {
          // Fail-open
        }
        return originalListener.call(this, event);
      };

      wrappedListeners.set(originalListener, wrapped);
      try {
        return originalAddEventListener.call(this, type, wrapped, options);
      } catch {
        try {
          return originalAddEventListener.call(this, type, listener as never, options);
        } catch {
          return;
        }
      }
    } as typeof originalAddEventListener;
  }

  if (interceptReceive && originalRemoveEventListener) {
    Original.prototype.removeEventListener = function (
      this: WebSocket,
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | EventListenerOptions,
    ): void {
      if (type === 'message' && typeof listener === 'function') {
        const wrapped = wrappedListeners.get(listener);
        if (wrapped) {
          wrappedListeners.delete(listener);
          try {
            return originalRemoveEventListener.call(this, type, wrapped, options);
          } catch {
            return;
          }
        }
      }
      try {
        return originalRemoveEventListener.call(this, type, listener as never, options);
      } catch {
        return;
      }
    } as typeof originalRemoveEventListener;
  }

  if (origOnMessageDesc && origOnMessageDesc.set && interceptReceive) {
    const origSet = origOnMessageDesc.set;
    const origGet = origOnMessageDesc.get;

    Object.defineProperty(Original.prototype, 'onmessage', {
      configurable: true,
      enumerable: true,
      get() {
        return origGet ? origGet.call(this) : null;
      },
      set(handler: ((this: WebSocket, ev: MessageEvent) => unknown) | null) {
        if (typeof handler !== 'function') {
          return origSet.call(this, handler);
        }
        const wrapped = function (this: WebSocket, ev: MessageEvent) {
          try {
            if (interceptReceive(this.url, ev.data) === 'drop') {
              return;
            }
          } catch {
            // Fail open
          }
          return handler.call(this, ev);
        };
        return origSet.call(this, wrapped);
      },
    });
  }

  const Wrapped = new Proxy(Original, {
    construct(target, args: [string, ...unknown[]], newTarget) {
      safely(() => newEvent('websocket.create', String(args[0]), frameUrl));
      return Reflect.construct(target, args, newTarget);
    },
  });

  scope.WebSocket = Wrapped;

  return () => {
    Original.prototype.send = originalSend;
    if (originalAddEventListener) {
      Original.prototype.addEventListener = originalAddEventListener;
    }
    if (originalRemoveEventListener) {
      Original.prototype.removeEventListener = originalRemoveEventListener;
    }
    if (origOnMessageDesc) {
      Object.defineProperty(Original.prototype, 'onmessage', origOnMessageDesc);
    }
    scope.WebSocket = Original;
    INSTALLED.delete(scope);
  };
}
