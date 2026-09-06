/**
 * The read receipt suppression law, exercised end to end through the engine.
 *
 * These cases were written against a standalone `decideFrame` helper that the RuleEngine later
 * replaced. The helper went; the observations did not, so they now run through the code that
 * actually ships: the engine's path gate, the lazy frame decode, and the rule's all-or-nothing
 * verdict.
 */
import { describe, expect, it } from 'vitest';
import { RuleEngine } from '@/engine';
import { FacebookReadReceiptRule } from '@/sites/facebook/rules';
import { FACEBOOK_SIGNATURES } from '@/sites/facebook/signatures';

const HEADER = new Uint8Array([
  0x0f, 0x7d, 0x00, 0x02, 0x00, 0x00, 0x7b, 0x7d, 0x0d, 0x7d, 0x00, 0xb1,
]);

const LABELS = FACEBOOK_SIGNATURES.readReceiptLabels;
const SOCKET = 'wss://gateway.messenger.com/ws/lightspeed';

function withHeader(outer: string): Uint8Array {
  const body = new TextEncoder().encode(outer);
  const out = new Uint8Array(HEADER.length + body.length);
  out.set(HEADER, 0);
  out.set(body, HEADER.length);
  return out;
}

function frame(tasks: { label: string; fields?: Record<string, unknown> }[]): Uint8Array {
  return withHeader(
    JSON.stringify({
      app_id: '1',
      payload: JSON.stringify({
        epoch_id: '1',
        tasks: tasks.map(({ label, fields }) => ({
          label,
          payload: JSON.stringify(fields ?? { thread_key: '1' }),
        })),
        version_id: '2',
      }),
      request_id: 7,
      type: 3,
    }),
  );
}

// The single task envelope, which is how label 21 arrives and why five runs missed it.
function singleFrame(label: string, fields: Record<string, unknown>): Uint8Array {
  return withHeader(
    JSON.stringify({
      app_id: '1',
      payload: JSON.stringify({ label, payload: JSON.stringify(fields), version: '2' }),
      request_id: 7,
      type: 3,
    }),
  );
}

// The payload actually observed at 2026-09-05T18:45:48Z.
const WATERMARK = {
  thread_id: 8482072268488190,
  last_read_watermark_ts: 1788633948478,
  sync_group: 95,
  offline_threading_id: null,
};

function decide(data: unknown, labels: readonly string[] = LABELS, url = SOCKET) {
  const engine = new RuleEngine(
    labels.length > 0 ? [new FacebookReadReceiptRule(labels)] : [],
  );
  return engine.intercept(url, data);
}

describe('the suppressed label list', () => {
  // Pinned, because adding 21 to the module broke no test: nothing held the list, so removing it
  // again would be silent. 21 is the one carrying the watermark, and dropping 72 and 235 without
  // it protects nothing at all.
  it('is exactly the three labels observed on this account', () => {
    expect([...LABELS].sort()).toEqual(['21', '235', '72']);
  });

  it('drops the watermark task, which arrives alone in the single envelope', () => {
    expect(decide(singleFrame('21', WATERMARK)).action).toBe('drop');
  });

  // The point of dropping it: the timestamp never reaches the socket.
  it('withholds a frame that would otherwise carry last_read_watermark_ts', () => {
    const frameBytes = singleFrame('21', WATERMARK);

    expect(new TextDecoder().decode(frameBytes)).toContain('last_read_watermark_ts');
    expect(decide(frameBytes).action).toBe('drop');
  });

  it('leaves a single envelope task that is not on the list alone', () => {
    expect(decide(singleFrame('3', { thread_key: '1', is_typing: 1 })).action).toBe('pass');
    expect(decide(singleFrame('389', { thread_key: '1' })).action).toBe('pass');
  });
});

describe('deciding one frame', () => {
  // The shape actually observed: 72 and 235 arrive in separate frames, each doubled.
  it('drops a frame whose every task is a read receipt', () => {
    expect(decide(frame([{ label: '72' }, { label: '72' }])).action).toBe('drop');
    expect(decide(frame([{ label: '235' }, { label: '235' }])).action).toBe('drop');
  });

  // The rule the whole design rests on. Frames of 100 tasks exist on this socket, so a read
  // receipt sharing one with a pagination task is not hypothetical.
  it('reports a frame that mixes a read receipt with anything else, and sends it', () => {
    const decision = decide(frame([{ label: '72' }, { label: '145' }]));

    expect(decision.action).toBe('mixed');
    expect(decision.matchedRules).toEqual(['facebook.hideReadReceipts']);
  });

  it('passes a frame with no read receipt in it', () => {
    expect(decide(frame([{ label: '145' }])).action).toBe('pass');
  });

  it('passes a frame it could not read, rather than dropping what it does not understand', () => {
    expect(decide(new Uint8Array([0x09])).action).toBe('pass');
    expect(decide(HEADER).action).toBe('pass');
    expect(decide(new Blob(['x'])).action).toBe('pass');
  });

  // With the feature off there are no labels to match, and nothing may be dropped whatever the
  // frame contains.
  it('drops nothing when given no labels', () => {
    expect(decide(frame([{ label: '72' }]), []).action).toBe('pass');
  });

  it('does not drop a label that merely contains a signal label', () => {
    expect(decide(frame([{ label: '720' }])).action).toBe('pass');
    expect(decide(frame([{ label: '1235' }])).action).toBe('pass');
  });

  it('never throws on a frame designed to break a parser', () => {
    const nasty = [
      new Uint8Array(0),
      new Uint8Array([0x7b]),
      new TextEncoder().encode('{"payload":"not json"}'),
      new TextEncoder().encode('{"payload":"{\\"tasks\\":[]}"}'),
    ];

    for (const bytes of nasty) {
      expect(decide(bytes).action).toBe('pass');
    }
  });
});

describe('the socket the signal was observed on', () => {
  const droppable = frame([{ label: '72' }, { label: '72' }]);

  it('matches the sockets the signal was observed on', () => {
    expect(decide(droppable, LABELS, `${SOCKET}?x=1`).action).toBe('drop');
    expect(decide(droppable, LABELS, 'wss://gateway.messenger.com/ws/realtime').action).toBe('drop');
  });

  it('does not match untargeted gateway sockets', () => {
    for (const other of ['/ws/streamcontroller', '/ws/rpsignaling']) {
      const decision = decide(droppable, LABELS, `wss://gateway.messenger.com${other}`);
      expect(decision.action).toBe('pass');
      expect(decision.reason).toBe('path-not-targeted');
    }
  });

  it('does not match a path that merely contains it', () => {
    expect(decide(droppable, LABELS, 'wss://evil.example/ws/lightspeed/other').action).toBe('pass');
  });

  it('passes something that is not a url', () => {
    const decision = decide(droppable, LABELS, 'not a url');
    expect(decision.action).toBe('pass');
    expect(decision.reason).toBe('invalid-url');
  });
});
