import { describe, expect, it } from 'vitest';
import { LazyInterceptContext } from '@/engine';
import { InstagramTypingRule } from '@/sites/instagram/rules/typingRule';

const HEADER = new Uint8Array([
  0x0f, 0x7d, 0x00, 0x02, 0x00, 0x00, 0x7b, 0x7d, 0x0d, 0x7d, 0x00, 0xb1,
]);

function buildFrame(tasks: { label: string }[]): Uint8Array {
  const outer = JSON.stringify({
    app_id: '1',
    payload: JSON.stringify({
      epoch_id: '1',
      tasks: tasks.map(({ label }) => ({ label, payload: '{}' })),
      version_id: '2',
    }),
    request_id: 7,
    type: 3,
  });
  const body = new TextEncoder().encode(outer);
  const out = new Uint8Array(HEADER.length + body.length);
  out.set(HEADER, 0);
  out.set(body, HEADER.length);
  return out;
}

describe('InstagramTypingRule', () => {
  const rule = new InstagramTypingRule();

  it('has correct rule identification', () => {
    expect(rule.id).toBe('instagram.hideTyping');
  });

  it('targets modern unified /ws/lightspeed and /ws/realtime sockets', () => {
    expect(rule.targetPaths).toContain('/ws/lightspeed');
    expect(rule.targetPaths).toContain('/ws/realtime');
  });

  it('drops DGW task label 3 frames on Instagram Web', () => {
    const raw = buildFrame([{ label: '3' }]);
    const context = new LazyInterceptContext('wss://gateway.instagram.com/ws/realtime', raw);

    expect(rule.evaluate(context)).toEqual({
      action: 'drop',
      ruleId: 'instagram.hideTyping',
      reason: 'all-typing',
      metadata: expect.anything(),
    });
  });

  it('drops unified Meta LightSpeed GraphQL typing mutations', () => {
    for (const mutation of [
      'useTypingIndicatorMutation',
      'LSPlatformTypingMutation',
      'TypingMutation',
      'ThreadTypingIndicatorMutation',
      'CometTypingMutation',
    ]) {
      const url = 'https://www.instagram.com/api/graphql';
      const body = JSON.stringify({
        fb_api_req_friendly_name: mutation,
        variables: { thread_id: '123' },
      });
      const verdict = rule.evaluateHttp(url, body);
      expect(verdict?.action).toBe('drop');
    }
  });

  it('drops PolarisDirectActivityStatusMutation GraphQL typing mutations', () => {
    const url = 'https://www.instagram.com/api/graphql';
    const body = JSON.stringify({
      fb_api_req_friendly_name: 'PolarisDirectActivityStatusMutation',
      variables: { thread_id: '123' },
    });
    const verdict = rule.evaluateHttp(url, body);

    expect(verdict?.action).toBe('drop');
    expect(verdict?.reason).toBe('instagram-graphql-typing');
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

  it('drops Worker typing actions', () => {
    expect(rule.evaluateWorker({ action: 'typing_indicator' })).toBe('drop');
    expect(rule.evaluateWorker({ command: 'user_is_typing' })).toBe('drop');
    expect(rule.evaluateWorker({ action: 'send_message' })).toBe('pass');
  });
});
