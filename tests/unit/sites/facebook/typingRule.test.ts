import { describe, expect, it } from 'vitest';
import { FacebookTypingRule } from '@/sites/facebook/rules/typingRule';
import { LazyInterceptContext } from '@/engine/context';

const HEADER = new Uint8Array([
  0x0f, 0x7d, 0x00, 0x02, 0x00, 0x00, 0x7b, 0x7d, 0x0d, 0x7d, 0x00, 0xb1,
]);

function buildSingleFrame(label: number | string): Uint8Array {
  const outer = JSON.stringify({
    app_id: '1',
    payload: JSON.stringify({
      label,
      payload: JSON.stringify({ thread_key: 12345, is_typing: 1 }),
      version: '1.0',
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

function buildArrayFrame(tasks: { label: string }[]): Uint8Array {
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

describe('FacebookTypingRule', () => {
  const rule = new FacebookTypingRule();

  it('declares target paths for both websocket and http channels', () => {
    expect(rule.targetPaths).toContain('/ws/lightspeed');
    expect(rule.targetPaths).toContain('/ws/realtime');
    expect(rule.targetHttpPaths).toContain('/api/graphql/');
    expect(rule.targetHttpPaths).toContain('/graphql/');
    expect(rule.targetHttpPaths).toContain('/ajax/messaging/typ.php');
  });

  it('drops /ws/realtime frames carrying send_typing_indicators', () => {
    const payload = JSON.stringify({
      events: [
        {
          name: 'messenger_web_ux_event',
          extra: JSON.stringify({
            event_name: 'send_typing_indicators',
            entry_point: 'popup_chat_box',
            thread_fbid: '8482072268488190',
            thread_type: 15,
          }),
        },
      ],
    });
    const bytes = new TextEncoder().encode(payload);
    const context = new LazyInterceptContext(
      'wss://gateway.facebook.com/ws/realtime?x-dgw-appid=2220391788200892',
      bytes,
    );
    const verdict = rule.evaluate(context);

    expect(verdict).toEqual({
      action: 'drop',
      ruleId: 'facebook.hideTyping',
      reason: 'realtime-typing-indicator',
      metadata: { channel: 'ws.realtime' },
    });
  });

  it('drops websocket frames carrying only typing label 3 in single envelope', () => {
    const rawFrame = buildSingleFrame(3);
    const context = new LazyInterceptContext('wss://gateway.facebook.com/ws/lightspeed', rawFrame);
    const verdict = rule.evaluate(context);

    expect(verdict).toEqual({
      action: 'drop',
      ruleId: 'facebook.hideTyping',
      reason: 'all-typing-indicator',
      metadata: { labels: ['3'], signal: ['3'] },
    });
  });

  it('returns mixed verdict when typing label is bundled with innocent tasks', () => {
    const rawFrame = buildArrayFrame([{ label: '3' }, { label: '145' }]);
    const context = new LazyInterceptContext('wss://gateway.facebook.com/ws/lightspeed', rawFrame);
    const verdict = rule.evaluate(context);

    expect(verdict?.action).toBe('mixed');
  });

  it('ignores websocket frames carrying no typing tasks', () => {
    const rawFrame = buildArrayFrame([{ label: '145' }]);
    const context = new LazyInterceptContext('wss://gateway.facebook.com/ws/lightspeed', rawFrame);
    expect(rule.evaluate(context)).toBeNull();
  });

  it('drops legacy http endpoint /ajax/messaging/typ.php requests', () => {
    const verdict = rule.evaluateHttp('https://www.facebook.com/ajax/messaging/typ.php', 'typ=1&to=123');
    expect(verdict).toEqual({
      action: 'drop',
      ruleId: 'facebook.hideTyping',
      reason: 'legacy-typing-endpoint',
    });
  });

  it('drops GraphQL typing indicator mutations', () => {
    const mutations = [
      'useTypingIndicatorMutation',
      'LSPlatformTypingMutation',
      'TypingMutation',
      'ThreadTypingIndicatorMutation',
    ];

    for (const mutation of mutations) {
      const body = `fb_api_req_friendly_name=${mutation}&variables=%7B%22is_typing%22%3A1%7D`;
      const verdict = rule.evaluateHttp('https://www.facebook.com/api/graphql/', body);
      expect(verdict).toEqual({
        action: 'drop',
        ruleId: 'facebook.hideTyping',
        reason: 'graphql-typing-mutation',
        metadata: { operations: [mutation] },
      });
    }
  });

  it('passes normal GraphQL feed queries', () => {
    const body = 'fb_api_req_friendly_name=CometNewsFeed_Query';
    expect(rule.evaluateHttp('https://www.facebook.com/api/graphql/', body)).toBeNull();
  });

  it('passes a message whose own text reads like a typing mutation', () => {
    // The old raw-body scan dropped a send whose payload merely contained "typing" ahead of the
    // word "mutation", and the composer was handed a synthetic 200 for a message never sent.
    const body =
      'fb_api_req_friendly_name=useLSSendMessageMutation&variables=' +
      encodeURIComponent(JSON.stringify({ text: 'i hate typing' })) +
      '&fb_api_caller_class=RelayModern_TypingMutation_shaped_string';
    expect(rule.evaluateHttp('https://www.facebook.com/api/graphql/', body)).toBeNull();
  });

  it('reports a batch mixing a typing mutation with a real one, and lets it through', () => {
    const body =
      'fb_api_req_friendly_name=LSPlatformTypingMutation&x=1&fb_api_req_friendly_name=useLSSendMessageMutation';
    const verdict = rule.evaluateHttp('https://www.facebook.com/api/graphql/', body);
    expect(verdict?.action).toBe('mixed');
    expect(verdict?.reason).toBe('mixed-typing-indicator');
  });

  it('never inspects a graphql path on a host that is not Meta', () => {
    expect(
      rule.evaluateHttp(
        'https://analytics.example.com/graphql/',
        'fb_api_req_friendly_name=LSPlatformTypingMutation',
      ),
    ).toBeNull();
  });

  it('never drops the legacy typing endpoint on a host that is not Meta', () => {
    expect(rule.evaluateHttp('https://evil.example/ajax/messaging/typ.php', null)).toBeNull();
  });

  it('passes non-matching or empty requests', () => {
    expect(rule.evaluateHttp('https://www.facebook.com/api/graphql/', null)).toBeNull();
    expect(rule.evaluateHttp('https://www.facebook.com/api/graphql/', '')).toBeNull();
    expect(rule.evaluateHttp('https://www.facebook.com/messages/t/123', 'body')).toBeNull();
  });

  describe('evaluateWorker', () => {
    it('drops sendChatStateFromComposer when state is typing', () => {
      const payload = {
        action: 'sendChatStateFromComposer',
        chatJid: '100026113054815',
        state: 'TYPING',
      };
      expect(rule.evaluateWorker(payload)).toBe('drop');
    });

    it('drops array-based RPC payloads containing sendChatStateFromComposer', () => {
      const payload = [1, 'backend', 'sendChatStateFromComposer', [{ state: 1 }]];
      expect(rule.evaluateWorker(payload)).toBe('drop');
    });

    it('drops telemetry/action payloads containing send_typing_indicators', () => {
      const payload = {
        event_name: 'send_typing_indicators',
        entry_point: 'popup_chat_box',
      };
      expect(rule.evaluateWorker(payload)).toBe('drop');
    });

    it('allows stop states through so recipient typing bubble clears', () => {
      expect(
        rule.evaluateWorker({
          action: 'sendChatStateFromComposer',
          state: 'IDLE',
        }),
      ).toBe('pass');

      expect(
        rule.evaluateWorker({
          action: 'sendChatStateFromComposer',
          state: 'PAUSED',
        }),
      ).toBe('pass');
    });

    it('passes unrelated worker messages', () => {
      expect(rule.evaluateWorker({ type: 'responsiveness' })).toBe('pass');
      expect(rule.evaluateWorker(null)).toBe('pass');
      expect(rule.evaluateWorker(undefined)).toBe('pass');
    });

    it('never drops outbound message sends in Worker even if typing state exists', () => {
      expect(rule.evaluateWorker({ action: 'sendMessage', text: 'sdas' })).toBe('pass');
      expect(
        rule.evaluateWorker({ action: 'sendMessage', text: '232', state: 'TYPING' }),
      ).toBe('pass');
      expect(
        rule.evaluateWorker([1, 'backend', 'sendMessage', [{ body: 'dadádadasdadadádádádasdasda' }]]),
      ).toBe('pass');
    });

    it('never drops /ws/realtime frames carrying outbound user messages', () => {
      const payload = JSON.stringify({
        events: [
          {
            name: 'messenger_web_ux_event',
            extra: JSON.stringify({
              event_name: 'send_typing_indicators',
              body: '24234234',
            }),
          },
        ],
      });
      const bytes = new TextEncoder().encode(payload);
      const context = new LazyInterceptContext('wss://gateway.facebook.com/ws/realtime', bytes);
      expect(rule.evaluate(context)).toBeNull();
    });
  });
});
