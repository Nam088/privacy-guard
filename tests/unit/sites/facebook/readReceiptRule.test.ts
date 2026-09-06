import { describe, expect, it } from 'vitest';
import { LazyInterceptContext } from '@/engine';
import { FacebookReadReceiptRule } from '@/sites/facebook/rules';

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

describe('FacebookReadReceiptRule', () => {
  const rule = new FacebookReadReceiptRule(['21', '72', '235']);

  it('targets /ws/lightspeed and /ws/realtime', () => {
    expect(rule.targetPaths).toContain('/ws/lightspeed');
    expect(rule.targetPaths).toContain('/ws/realtime');
  });

  it('drops frame when all tasks are read receipts (e.g. label 21)', () => {
    const raw = buildFrame([{ label: '21' }]);
    const context = new LazyInterceptContext('wss://gateway.messenger.com/ws/lightspeed', raw);

    expect(rule.evaluate(context)).toEqual({
      action: 'drop',
      ruleId: 'facebook.hideReadReceipts',
      reason: 'all-read-receipt',
      metadata: expect.anything(),
    });
  });

  it('drops doubled 72 frames observed on live Messenger', () => {
    const raw = buildFrame([{ label: '72' }, { label: '72' }]);
    const context = new LazyInterceptContext('wss://gateway.messenger.com/ws/lightspeed', raw);

    expect(rule.evaluate(context)?.action).toBe('drop');
  });

  it('drops doubled 235 frames observed on live Messenger', () => {
    const raw = buildFrame([{ label: '235' }, { label: '235' }]);
    const context = new LazyInterceptContext('wss://gateway.messenger.com/ws/lightspeed', raw);

    expect(rule.evaluate(context)?.action).toBe('drop');
  });

  it('drops /ws/realtime text frames carrying last_read_watermark_ts', () => {
    const payload = new TextEncoder().encode('{"event":"last_read_watermark_ts","thread_id":"123"}');
    const context = new LazyInterceptContext('wss://gateway.facebook.com/ws/realtime?appid=1', payload);

    expect(rule.evaluate(context)).toEqual({
      action: 'drop',
      ruleId: 'facebook.hideReadReceipts',
      reason: 'realtime-read-receipt',
      metadata: { channel: 'ws.realtime' },
    });
  });

  it('returns mixed when a read receipt task shares frame with an innocent task', () => {
    const raw = buildFrame([{ label: '21' }, { label: '145' }]);
    const context = new LazyInterceptContext('wss://gateway.messenger.com/ws/lightspeed', raw);

    expect(rule.evaluate(context)).toEqual({
      action: 'mixed',
      ruleId: 'facebook.hideReadReceipts',
      reason: 'mixed-read-receipt',
      metadata: expect.anything(),
    });
  });

  it('returns null when frame contains no read receipt tasks', () => {
    const raw = buildFrame([{ label: '145' }]);
    const context = new LazyInterceptContext('wss://gateway.messenger.com/ws/lightspeed', raw);

    expect(rule.evaluate(context)).toBeNull();
  });

  it('drops HTTP GraphQL read receipt mutations', () => {
    const body = new URLSearchParams({
      fb_api_req_friendly_name: 'useReadReceiptMutation',
    }).toString();
    const verdict = rule.evaluateHttp('https://www.facebook.com/api/graphql/', body);
    expect(verdict?.action).toBe('drop');
  });

  it('drops Worker messages carrying read receipt actions', () => {
    expect(rule.evaluateWorker({ action: 'mark_read', thread_id: '123' })).toBe('drop');
    expect(rule.evaluateWorker({ action: 'send_read_receipt' })).toBe('drop');
    expect(rule.evaluateWorker({ action: 'unrelated_message' })).toBe('pass');
  });

  it('never drops outbound message sends in Worker even if watermark is bundled', () => {
    expect(rule.evaluateWorker({ action: 'sendMessage', text: 'sdas' })).toBe('pass');
    expect(rule.evaluateWorker({ action: 'sendMessage', text: '232', thread_read_watermark: 9999 })).toBe('pass');
    expect(rule.evaluateWorker({ body: 'dadádadasdadadádádádasdasda', updatewatermark: true })).toBe('pass');
    expect(
      rule.evaluateWorker([1, 'backend', 'sendMessage', [{ body: '24234234', offline_threading_id: '789' }]]),
    ).toBe('pass');
  });

  it('never drops /ws/realtime frames carrying outbound user message payloads', () => {
    const payload = new TextEncoder().encode(
      '{"event":"last_read_watermark_ts","thread_id":"123","body":"sdas","watermark_ts":12345}',
    );
    const context = new LazyInterceptContext('wss://gateway.facebook.com/ws/realtime?appid=1', payload);
    expect(rule.evaluate(context)).toBeNull();
  });
});

