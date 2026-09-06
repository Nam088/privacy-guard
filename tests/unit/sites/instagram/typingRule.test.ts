import { describe, expect, it } from 'vitest';
import { LazyInterceptContext } from '@/engine';
import { InstagramTypingRule } from '@/sites/instagram/rules/typingRule';

describe('InstagramTypingRule', () => {
  const rule = new InstagramTypingRule();

  it('has correct rule identification', () => {
    expect(rule.id).toBe('instagram.hideTyping');
  });

  it('drops REST typing activity indications with activity_status=1', () => {
    const url = 'https://www.instagram.com/api/v1/direct_v2/threads/123/activity_status_indication/';
    const body = 'activity_status=1';
    const verdict = rule.evaluateHttp(url, body);

    expect(verdict).toEqual({
      action: 'drop',
      ruleId: 'instagram.hideTyping',
      reason: 'instagram-rest-typing',
      metadata: expect.objectContaining({
        url,
        simulatedResponse: { status: 200, body: JSON.stringify({ status: 'ok' }) },
      }),
    });
  });

  it('allows REST idle activity indications with activity_status=0 to preserve chat state', () => {
    const url = 'https://www.instagram.com/api/v1/direct_v2/threads/123/activity_status_indication/';
    const body = 'activity_status=0';
    const verdict = rule.evaluateHttp(url, body);

    expect(verdict).toBeNull();
  });

  it('drops GraphQL typing mutations', () => {
    const url = 'https://www.instagram.com/api/graphql';
    const body = JSON.stringify({
      fb_api_req_friendly_name: 'PolarisDirectActivityStatusMutation',
      variables: { thread_id: '123' },
    });
    const verdict = rule.evaluateHttp(url, body);

    expect(verdict?.action).toBe('drop');
    expect(verdict?.reason).toBe('instagram-graphql-typing');
  });

  it('drops WebSocket typing messages with activity_status_indication', () => {
    const message = JSON.stringify({
      event: 'activity_status_indication',
      activity_status: '1',
    });
    const bytes = new TextEncoder().encode(message);
    const context = new LazyInterceptContext('wss://edge-chat.instagram.com/chat', bytes);

    const verdict = rule.evaluate(context);
    expect(verdict?.action).toBe('drop');
    expect(verdict?.reason).toBe('instagram-realtime-typing');
  });

  it('allows WebSocket typing messages with activity_status: 0 through', () => {
    const message = JSON.stringify({
      event: 'activity_status_indication',
      activity_status: '0',
    });
    const bytes = new TextEncoder().encode(message);
    const context = new LazyInterceptContext('wss://edge-chat.instagram.com/chat', bytes);

    const verdict = rule.evaluate(context);
    expect(verdict).toBeNull();
  });
});
