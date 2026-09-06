import { describe, expect, it } from 'vitest';
import { LazyInterceptContext } from '@/engine';
import { InstagramReadReceiptRule } from '@/sites/instagram/rules/readReceiptRule';

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

describe('InstagramReadReceiptRule', () => {
  const rule = new InstagramReadReceiptRule();

  it('has correct rule identification', () => {
    expect(rule.id).toBe('instagram.hideReadReceipts');
  });

  it('targets modern unified /ws/lightspeed and /ws/realtime sockets', () => {
    expect(rule.targetPaths).toContain('/ws/lightspeed');
    expect(rule.targetPaths).toContain('/ws/realtime');
  });

  it('drops DGW task label 21 (read watermark) frames on Instagram Web', () => {
    const raw = buildFrame([{ label: '21' }]);
    const context = new LazyInterceptContext('wss://gateway.instagram.com/ws/realtime', raw);

    expect(rule.evaluate(context)).toEqual({
      action: 'drop',
      ruleId: 'instagram.hideReadReceipts',
      reason: 'all-read-receipt',
      metadata: expect.anything(),
    });
  });

  it('drops DGW task label 72 and 235 frames on Instagram Web', () => {
    const raw = buildFrame([{ label: '72' }, { label: '235' }]);
    const context = new LazyInterceptContext('wss://gateway.instagram.com/ws/realtime', raw);

    expect(rule.evaluate(context)?.action).toBe('drop');
  });

  it('reports mixed when DGW frame contains both read receipt and innocent tasks', () => {
    const raw = buildFrame([{ label: '21' }, { label: '999' }]);
    const context = new LazyInterceptContext('wss://gateway.instagram.com/ws/realtime', raw);

    expect(rule.evaluate(context)?.action).toBe('mixed');
  });

  it('drops WebSocket realtime frames with last_read_watermark_ts', () => {
    const message = JSON.stringify({
      last_read_watermark_ts: 1717000000000,
      thread_id: '12345',
    });
    const bytes = new TextEncoder().encode(message);
    const context = new LazyInterceptContext('wss://gateway.instagram.com/ws/realtime', bytes);

    const verdict = rule.evaluate(context);
    expect(verdict?.action).toBe('drop');
    expect(verdict?.reason).toBe('instagram-realtime-read-receipt');
  });

  it('drops Instagram GraphQL read receipt mutations', () => {
    for (const mutation of [
      'useIGDMarkThreadAsReadMutation',
      'useIGDMarkThreadAsReadValidationMutation',
      'IGDMarkThreadAsReadMutation',
      'IGDMarkThreadAsReadValidationMutation',
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

  it('drops GraphQL mutations carrying direct_thread_seen and PolarisDirectThreadSeenMutation', () => {
    for (const mutation of ['direct_thread_seen', 'PolarisDirectThreadSeenMutation']) {
      const url = 'https://www.instagram.com/api/graphql';
      const body = JSON.stringify({
        fb_api_req_friendly_name: mutation,
        variables: { thread_id: '123' },
      });
      const verdict = rule.evaluateHttp(url, body);
      expect(verdict?.action).toBe('drop');
    }
  });

  it('passes unrelated GraphQL queries', () => {
    const url = 'https://www.instagram.com/api/graphql';
    const body = JSON.stringify({
      fb_api_req_friendly_name: 'PolarisFeedTimelineQuery',
    });
    const verdict = rule.evaluateHttp(url, body);

    expect(verdict).toBeNull();
  });

  it('drops REST read receipt requests to legacy endpoints', () => {
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

  it('drops Worker/MessagePort read receipt actions', () => {
    expect(rule.evaluateWorker({ action: 'mark_thread_as_read' })).toBe('drop');
    expect(rule.evaluateWorker({ type: 'mark_thread_read' })).toBe('drop');
    expect(rule.evaluateWorker({ command: 'last_read_watermark_ts' })).toBe('drop');
    expect(rule.evaluateWorker({ action: 'send_message' })).toBe('pass');
  });
});
