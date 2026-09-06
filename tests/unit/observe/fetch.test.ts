import { describe, expect, it, vi } from 'vitest';
import { observeFetch, type InterceptFetch } from '@/observe/fetch';
import type { ObservedEvent, Report } from '@/observe/types';

describe('observeFetch', () => {
  it('suppresses request when interceptor returns drop', async () => {
    const originalFetch = vi.fn().mockResolvedValue(new Response('ok'));
    const scope = { fetch: originalFetch } as unknown as Window & typeof globalThis;
    const events: ObservedEvent[] = [];
    const report: Report = (e) => events.push(e);

    const intercept: InterceptFetch = (url) => {
      if (url.includes('StoriesSeen')) return 'drop';
      return 'pass';
    };

    const undo = observeFetch(scope, report, 'https://facebook.com', intercept);

    // Call fetch with a StoriesSeen request
    const response = await scope.fetch('https://facebook.com/api/graphql/?fb_api_req_friendly_name=StoriesSeenMutation', {
      method: 'POST',
      body: 'story_id=123',
    });

    expect(originalFetch).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(events.some((e) => e.kind === 'fetch.suppressed')).toBe(true);

    undo();
  });

  it('passes normal request through to original fetch', async () => {
    const originalFetch = vi.fn().mockResolvedValue(new Response('feed content'));
    const scope = { fetch: originalFetch } as unknown as Window & typeof globalThis;
    const events: ObservedEvent[] = [];
    const report: Report = (e) => events.push(e);

    const undo = observeFetch(scope, report, 'https://facebook.com', () => 'pass');

    const response = await scope.fetch('https://facebook.com/api/graphql/?fb_api_req_friendly_name=CometNewsFeed_Query');

    expect(originalFetch).toHaveBeenCalled();
    const text = await response.text();
    expect(text).toBe('feed content');
    expect(events.some((e) => e.kind === 'fetch.send')).toBe(true);

    undo();
  });

  it('restores original fetch on undo', () => {
    const originalFetch = vi.fn();
    const scope = { fetch: originalFetch } as unknown as Window & typeof globalThis;

    const undo = observeFetch(scope, () => {});
    expect(scope.fetch).not.toBe(originalFetch);

    undo();
    expect(scope.fetch).toBe(originalFetch);
  });
});
