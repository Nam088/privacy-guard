import { describe, expect, it, vi } from 'vitest';
import { observeXhr, type InterceptXhr } from '@/observe/xhr';
import type { ObservedEvent, Report } from '@/observe/types';

function fakeXhrClass(originalOpen: () => void, originalSend: (body?: unknown) => void) {
  return class FakeXHR extends EventTarget {
    readyState = 0;
    status = 0;
    responseType: XMLHttpRequestResponseType = '';
    responseText = '';
    response: unknown = '';
    open(...args: unknown[]) {
      return originalOpen(...(args as []));
    }
    send(body?: unknown) {
      return originalSend(body);
    }
  } as unknown as typeof XMLHttpRequest;
}

const dropStorySeen: InterceptXhr = (_url, body) =>
  typeof body === 'string' && body.includes('storiesUpdateSeenState') ? 'drop' : 'pass';

describe('observeXhr', () => {
  it('suppresses xhr request when interceptor returns drop', () => {
    const originalOpen = vi.fn();
    const originalSend = vi.fn();
    const scope = { XMLHttpRequest: fakeXhrClass(originalOpen, originalSend) };
    const events: ObservedEvent[] = [];
    const report: Report = (e) => {
      events.push(e);
    };

    const undo = observeXhr(scope, report, 'https://facebook.com', dropStorySeen);

    const xhr = new scope.XMLHttpRequest();
    xhr.open('POST', 'https://facebook.com/api/graphql/');
    xhr.send('fb_api_req_friendly_name=storiesUpdateSeenStateMutation');

    expect(originalSend).not.toHaveBeenCalled();
    expect(xhr.status).toBe(200);
    expect(xhr.readyState).toBe(4);
    expect(events.some((e) => e.kind === 'xhr.suppressed')).toBe(true);

    undo();
  });

  it('passes normal xhr request through to original send', () => {
    const originalOpen = vi.fn();
    const originalSend = vi.fn();
    const scope = { XMLHttpRequest: fakeXhrClass(originalOpen, originalSend) };
    const events: ObservedEvent[] = [];
    const report: Report = (e) => {
      events.push(e);
    };

    const undo = observeXhr(scope, report, 'https://facebook.com', () => 'pass');

    const xhr = new scope.XMLHttpRequest();
    xhr.open('POST', 'https://facebook.com/api/graphql/');
    xhr.send('fb_api_req_friendly_name=CometNewsFeed_Query');

    expect(originalSend).toHaveBeenCalled();
    expect(events.some((e) => e.kind === 'xhr.send')).toBe(true);

    undo();
  });

  it('delivers the synthetic response after send returns, not during it', async () => {
    // Assigning onload after send() is legal, and a synchronous dispatch would run the handler
    // before it existed and lose the response.
    const scope = { XMLHttpRequest: fakeXhrClass(vi.fn(), vi.fn()) };
    const undo = observeXhr(scope, () => {}, 'https://facebook.com', dropStorySeen);

    const xhr = new scope.XMLHttpRequest();
    xhr.open('POST', 'https://facebook.com/api/graphql/');
    xhr.send('fb_api_req_friendly_name=storiesUpdateSeenStateMutation');

    const onload = vi.fn();
    xhr.addEventListener('load', onload);
    expect(onload).not.toHaveBeenCalled();

    await Promise.resolve();
    expect(onload).toHaveBeenCalled();

    undo();
  });

  it('honours responseType json so a caller reading .response gets an object', async () => {
    const scope = { XMLHttpRequest: fakeXhrClass(vi.fn(), vi.fn()) };
    const undo = observeXhr(scope, () => {}, 'https://facebook.com', dropStorySeen);

    const xhr = new scope.XMLHttpRequest();
    xhr.open('POST', 'https://facebook.com/api/graphql/');
    xhr.responseType = 'json';
    xhr.send('fb_api_req_friendly_name=storiesUpdateSeenStateMutation');

    expect(typeof xhr.response).toBe('object');
    expect((xhr.response as { extensions: { is_final: boolean } }).extensions.is_final).toBe(true);

    undo();
  });

  it('answers header reads the way a real response would', () => {
    const scope = { XMLHttpRequest: fakeXhrClass(vi.fn(), vi.fn()) };
    const undo = observeXhr(scope, () => {}, 'https://facebook.com', dropStorySeen);

    const xhr = new scope.XMLHttpRequest();
    xhr.open('POST', 'https://facebook.com/api/graphql/');
    xhr.send('fb_api_req_friendly_name=storiesUpdateSeenStateMutation');

    expect(xhr.getResponseHeader('Content-Type')).toBe('application/json; charset=utf-8');
    expect(xhr.getAllResponseHeaders()).toContain('content-type');
    expect(xhr.getResponseHeader('x-not-set')).toBeNull();

    undo();
  });
});
