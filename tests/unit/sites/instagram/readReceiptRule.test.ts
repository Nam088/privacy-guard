import { describe, expect, it } from 'vitest';
import { LazyInterceptContext } from '@/engine';
import { InstagramReadReceiptRule } from '@/sites/instagram/rules/readReceiptRule';

describe('InstagramReadReceiptRule', () => {
  const rule = new InstagramReadReceiptRule();

  it('has correct rule identification', () => {
    expect(rule.id).toBe('instagram.hideReadReceipts');
  });

  it('drops REST read receipt requests to /api/v1/direct_v2/threads/.../items/.../seen/', () => {
    const url = 'https://www.instagram.com/api/v1/direct_v2/threads/12345678/items/987654321/seen/';
    const verdict = rule.evaluateHttp(url, null);

    expect(verdict).toEqual({
      action: 'drop',
      ruleId: 'instagram.hideReadReceipts',
      reason: 'instagram-rest-read-receipt',
      metadata: expect.objectContaining({
        url,
        simulatedResponse: { status: 200, body: JSON.stringify({ status: 'ok' }) },
      }),
    });
  });

  it('drops REST read receipt requests to /api/v1/direct_v2/threads/.../seen/', () => {
    const url = 'https://www.instagram.com/api/v1/direct_v2/threads/12345678/seen/';
    const verdict = rule.evaluateHttp(url, null);

    expect(verdict?.action).toBe('drop');
    expect(verdict?.reason).toBe('instagram-rest-read-receipt');
  });

  it('drops GraphQL mutations carrying direct_thread_seen', () => {
    const url = 'https://www.instagram.com/api/graphql';
    const body = JSON.stringify({
      fb_api_req_friendly_name: 'direct_thread_seen',
      variables: { thread_id: '123' },
    });
    const verdict = rule.evaluateHttp(url, body);

    expect(verdict?.action).toBe('drop');
    expect(verdict?.reason).toBe('instagram-graphql-read-receipt');
  });

  it('drops GraphQL mutations carrying PolarisDirectThreadSeenMutation', () => {
    const url = 'https://www.instagram.com/api/graphql';
    const body = JSON.stringify({
      fb_api_req_friendly_name: 'PolarisDirectThreadSeenMutation',
      variables: { thread_id: '123' },
    });
    const verdict = rule.evaluateHttp(url, body);

    expect(verdict?.action).toBe('drop');
  });

  it('passes unrelated GraphQL queries', () => {
    const url = 'https://www.instagram.com/api/graphql';
    const body = JSON.stringify({
      fb_api_req_friendly_name: 'PolarisFeedTimelineQuery',
    });
    const verdict = rule.evaluateHttp(url, body);

    expect(verdict).toBeNull();
  });

  it('drops WebSocket realtime binary messages with direct_v2_seen marker', () => {
    const message = JSON.stringify({
      event: 'direct_v2_seen',
      thread_id: '123',
    });
    const bytes = new TextEncoder().encode(message);
    const context = new LazyInterceptContext('wss://gateway.instagram.com/ws/realtime', bytes);

    const verdict = rule.evaluate(context);
    expect(verdict?.action).toBe('drop');
    expect(verdict?.reason).toBe('instagram-realtime-read-receipt');
  });

  it('ignores WebSocket connections on non-instagram hosts', () => {
    const message = JSON.stringify({ event: 'direct_v2_seen' });
    const bytes = new TextEncoder().encode(message);
    const context = new LazyInterceptContext('wss://gateway.messenger.com/ws/realtime', bytes);

    const verdict = rule.evaluate(context);
    expect(verdict).toBeNull();
  });
});
