import { describe, expect, it } from 'vitest';
import { LazyInterceptContext } from '@/engine';
import { FacebookInboxWatermarkRule } from '@/sites/facebook/rules';

const HEADER = new Uint8Array([
  0x0f, 0x7d, 0x00, 0x02, 0x00, 0x00, 0x7b, 0x7d, 0x0d, 0x7d, 0x00, 0xb1,
]);

const LIGHTSPEED = 'wss://gateway.messenger.com/ws/lightspeed';

function buildFrame(tasks: { label: string; payload: Record<string, unknown> }[]): Uint8Array {
  const outer = JSON.stringify({
    app_id: '1',
    payload: JSON.stringify({
      epoch_id: '1',
      tasks: tasks.map(({ label, payload }) => ({ label, payload: JSON.stringify(payload) })),
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

describe('FacebookInboxWatermarkRule', () => {
  const rule = new FacebookInboxWatermarkRule();

  it('targets /ws/lightspeed and /ws/realtime', () => {
    expect(rule.targetPaths).toContain('/ws/lightspeed');
    expect(rule.targetPaths).toContain('/ws/realtime');
  });

  it('drops the watermark that says when the inbox was opened', () => {
    const raw = buildFrame([
      { label: '6', payload: { parent_thread_key: 0, last_seen_time_ms: 1788633948465 } },
    ]);

    expect(rule.evaluate(new LazyInterceptContext(LIGHTSPEED, raw))).toMatchObject({
      action: 'drop',
      ruleId: 'facebook.hideInboxLastSeen',
      reason: 'inbox-root-watermark',
    });
  });

  // Label 6 on a folder is not the inbox watermark. Dropping it would withhold something this
  // feature never promised to hide, so the payload has to settle it, not the label.
  it('leaves the same label alone when it is not the root folder', () => {
    const raw = buildFrame([
      { label: '6', payload: { parent_thread_key: 8482072268488190, last_seen_time_ms: 1 } },
    ]);

    expect(rule.evaluate(new LazyInterceptContext(LIGHTSPEED, raw))).toBeNull();
  });

  it('reports mixed rather than dropping when the frame carries anything else', () => {
    const raw = buildFrame([
      { label: '6', payload: { parent_thread_key: 0 } },
      { label: '389', payload: { thread_key: '1' } },
    ]);

    expect(rule.evaluate(new LazyInterceptContext(LIGHTSPEED, raw))).toMatchObject({
      action: 'mixed',
      ruleId: 'facebook.hideInboxLastSeen',
    });
  });

  it('says nothing about a frame carrying no label 6', () => {
    const raw = buildFrame([{ label: '21', payload: { thread_id: 1 } }]);

    expect(rule.evaluate(new LazyInterceptContext(LIGHTSPEED, raw))).toBeNull();
  });

  // A payload that failed to parse must never be read as a missing field, because a missing
  // `parent_thread_key` is not the same as one that is zero.
  it('leaves a task alone when its payload could not be read', () => {
    const outer = JSON.stringify({
      app_id: '1',
      payload: JSON.stringify({
        epoch_id: '1',
        tasks: [{ label: '6', payload: 'not json' }],
        version_id: '2',
      }),
      request_id: 7,
      type: 3,
    });
    const body = new TextEncoder().encode(outer);
    const raw = new Uint8Array(HEADER.length + body.length);
    raw.set(HEADER, 0);
    raw.set(body, HEADER.length);

    expect(rule.evaluate(new LazyInterceptContext(LIGHTSPEED, raw))).toBeNull();
  });

  it('says nothing about a frame it could not decode', () => {
    expect(rule.evaluate(new LazyInterceptContext(LIGHTSPEED, new Uint8Array([0x09])))).toBeNull();
  });
});
