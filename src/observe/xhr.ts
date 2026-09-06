import { describeValue, newEvent, type ObservedEvent, type Report } from './types';

export type XhrVerdict = 'pass' | 'drop';

export type InterceptXhr = (url: string, body?: unknown) => XhrVerdict;

interface XhrScope {
  XMLHttpRequest?: typeof XMLHttpRequest;
}

const INSTALLED = new WeakSet<object>();
const XHR_URL = Symbol('privacy-guard.xhr.url');

/** The shape Relay treats as a completed streaming response with nothing left to come. */
const SYNTHETIC_BODY = '{"data":{},"extensions":{"is_final":true}}';

const SYNTHETIC_HEADERS = 'content-type: application/json; charset=utf-8\r\ncache-control: no-store';

/**
 * Answers a suppressed request the way a real one would have been answered.
 *
 * `responseType` is honoured because a caller that asked for `json` reads `.response` expecting an
 * object, and handing it a string is a crash in somebody else's code rather than a suppressed
 * request. The header stubs exist for the same reason: Relay reads the content type.
 */
function fakeResponse(xhr: XMLHttpRequest): void {
  const define = (key: string, value: unknown): void => {
    try {
      Object.defineProperty(xhr, key, { value, configurable: true });
    } catch {
      // A property that will not be redefined is left alone; the rest of the response still holds.
    }
  };

  // An XHR that never opened for real may not carry the property at all; the spec default is ''.
  const responseType = xhr.responseType || '';

  let responseValue: unknown;
  switch (responseType) {
    case 'json':
      try {
        responseValue = JSON.parse(SYNTHETIC_BODY);
      } catch {
        responseValue = null;
      }
      break;
    case 'arraybuffer':
      responseValue = new TextEncoder().encode(SYNTHETIC_BODY).buffer;
      break;
    case 'blob':
      if (typeof Blob === 'function') {
        responseValue = new Blob([SYNTHETIC_BODY], { type: 'application/json' });
      } else {
        responseValue = SYNTHETIC_BODY;
      }
      break;
    default:
      responseValue = SYNTHETIC_BODY;
  }

  define('readyState', 4);
  define('status', 200);
  define('statusText', 'OK');
  define('response', responseValue);
  define('responseURL', '');
  // Reading responseText on a non-text responseType throws on a real XHR, so it is only stubbed
  // where a real XHR would have offered it.
  if (responseType === '' || responseType === 'text') {
    define('responseText', SYNTHETIC_BODY);
  }
  define('getAllResponseHeaders', () => SYNTHETIC_HEADERS);
  define('getResponseHeader', (name: string) => {
    const lowered = String(name).toLowerCase();
    if (lowered === 'content-type') {
      return 'application/json; charset=utf-8';
    }
    if (lowered === 'cache-control') {
      return 'no-store';
    }
    return null;
  });
}

/**
 * Observes and selectively intercepts XMLHttpRequest calls.
 *
 * When an outbound XHR matches a suppression rule (such as storiesUpdateSeenStateMutation),
 * it returns a synthetic 200 OK response matching Facebook Relay's is_final payload without
 * hitting the network.
 */
export function observeXhr(
  scope: XhrScope,
  report: Report,
  frameUrl?: string,
  intercept?: InterceptXhr,
): () => void {
  let OriginalXHR: typeof XMLHttpRequest | undefined;
  try {
    OriginalXHR = scope.XMLHttpRequest;
  } catch {
    return () => {};
  }

  if (typeof OriginalXHR !== 'function' || INSTALLED.has(scope)) {
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

  const proto = OriginalXHR.prototype;
  const originalOpen = proto.open;
  const originalSend = proto.send;

  proto.open = function (this: XMLHttpRequest & { [XHR_URL]?: string }, ...args: unknown[]) {
    const urlArg = args[1];
    let requestUrl = '';
    if (typeof urlArg === 'string') {
      requestUrl = urlArg;
    } else if (urlArg instanceof URL) {
      requestUrl = urlArg.href;
    }
    this[XHR_URL] = requestUrl;
    return Reflect.apply(originalOpen, this, args);
  } as typeof originalOpen;

  proto.send = function (this: XMLHttpRequest & { [XHR_URL]?: string }, body?: unknown) {
    let requestUrl = '';
    if (this[XHR_URL]) {
      requestUrl = this[XHR_URL];
    }

    let verdict: XhrVerdict = 'pass';
    try {
      if (intercept) {
        verdict = intercept(requestUrl, body);
      }
    } catch {
      verdict = 'pass';
    }

    safely(() => {
      let kind: 'xhr.suppressed' | 'xhr.send' = 'xhr.send';
      if (verdict === 'drop') {
        kind = 'xhr.suppressed';
      }
      const event = newEvent(kind, requestUrl, frameUrl);
      event.value = describeValue(body);
      return event;
    }, body);

    if (verdict !== 'drop') {
      return Reflect.apply(originalSend, this, [body]);
    }

    fakeResponse(this);

    const dispatch = (type: string): void => {
      try {
        if (typeof Event === 'function') {
          this.dispatchEvent(new Event(type));
        }
      } catch {
        // Event dispatch failure should never crash the page.
      }
    };

    // A real send() returns before any of its events fire, and callers rely on that: assigning
    // xhr.onload after xhr.send() is legal, and firing synchronously here would run the handler
    // before it had been assigned and lose the response entirely.
    const deliver = (): void => {
      dispatch('readystatechange');
      dispatch('load');
      dispatch('loadend');
    };
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(deliver);
    } else {
      setTimeout(deliver, 0);
    }
    return;
  } as typeof originalSend;

  return () => {
    proto.open = originalOpen;
    proto.send = originalSend;
    INSTALLED.delete(scope);
  };
}
