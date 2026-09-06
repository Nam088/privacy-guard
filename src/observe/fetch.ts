import { describeValue, newEvent, type ObservedEvent, type Report } from './types';

export type FetchVerdict = 'pass' | 'drop';

export type InterceptFetch = (url: string, body?: unknown) => FetchVerdict;

interface FetchScope {
  fetch?: typeof fetch;
}

const INSTALLED = new WeakSet<object>();

/**
 * Observes and selectively intercepts window.fetch requests.
 *
 * When an outbound request matches a suppression rule (such as storiesUpdateSeenStateMutation),
 * it returns a synthetic 200 OK Response matching Facebook Relay's is_final shape rather than sending
 * the request over the network.
 */
export function observeFetch(
  scope: FetchScope,
  report: Report,
  frameUrl?: string,
  intercept?: InterceptFetch,
): () => void {
  let originalFetch: typeof fetch | undefined;
  try {
    originalFetch = scope.fetch;
  } catch {
    return () => {};
  }

  if (typeof originalFetch !== 'function' || INSTALLED.has(scope)) {
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

  /** Answers a suppressed request the way Relay expects a completed stream to be answered. */
  function syntheticResponse(): Response {
    return new Response('{"data":{},"extensions":{"is_final":true}}', {
      status: 200,
      statusText: 'OK',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }

  function decide(this: unknown, url: string, bodyData: unknown, input: RequestInfo | URL, init?: RequestInit) {
    let verdict: FetchVerdict = 'pass';
    try {
      if (intercept) {
        verdict = intercept(url, bodyData);
      }
    } catch {
      verdict = 'pass';
    }

    safely(() => {
      let kind: 'fetch.suppressed' | 'fetch.send' = 'fetch.send';
      if (verdict === 'drop') {
        kind = 'fetch.suppressed';
      }
      const event = newEvent(kind, url, frameUrl);
      event.value = describeValue(bodyData);
      return event;
    }, bodyData);

    if (verdict === 'drop') {
      return Promise.resolve(syntheticResponse());
    }

    return originalFetch!.call(this, input, init);
  }

  function patchedFetch(
    this: unknown,
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    let url: string;
    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof URL) {
      url = input.href;
    } else {
      url = input.url;
    }

    const bodyData: unknown = init?.body;

    // Reading a Request's body is the one case that has to wait, because the body only arrives as
    // a promise. Everything else stays synchronous: making the whole function async would push
    // every passing request a microtask further out for no reason at all.
    if (bodyData === undefined && typeof Request === 'function' && input instanceof Request) {
      return input
        .clone()
        .text()
        .catch(() => undefined)
        .then((text) => decide.call(this, url, text, input, init));
    }

    return decide.call(this, url, bodyData, input, init);
  }

  scope.fetch = patchedFetch as typeof fetch;

  return () => {
    scope.fetch = originalFetch;
    INSTALLED.delete(scope);
  };
}
