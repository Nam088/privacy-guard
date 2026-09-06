import { describe, expect, it, vi } from 'vitest';
import { LazyInterceptContext, RuleEngine, type SuppressionRule } from '@/engine';

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

describe('LazyInterceptContext', () => {
  it('does not parse bytes or json until explicitly requested', () => {
    const raw = buildFrame([{ label: '21' }]);
    const context = new LazyInterceptContext('wss://gateway.messenger.com/ws/lightspeed', raw);

    // Initial state: nothing evaluated yet
    expect(context.url).toBe('wss://gateway.messenger.com/ws/lightspeed');
    expect(context.rawData).toBe(raw);

    // Calling getBytes() lazily computes bytes
    const bytes = context.getBytes();
    expect(bytes).toBeInstanceOf(Uint8Array);

    // Calling getDgwTasks() memoizes tasks
    const tasks1 = context.getDgwTasks();
    const tasks2 = context.getDgwTasks();
    expect(tasks1).toBe(tasks2); // Same cached reference
    expect(tasks1.labels).toEqual(['21']);
  });
});

describe('RuleEngine', () => {
  it('returns pass immediately when no rules are active', () => {
    const engine = new RuleEngine([]);
    expect(engine.intercept('wss://gateway.messenger.com/ws/lightspeed', new Uint8Array([1])).action).toBe('pass');
  });

  it('performs O(1) fast-exit when socket path is not targeted by any rule', () => {
    const evaluateSpy = vi.fn();
    const dummyRule: SuppressionRule = {
      id: 'test.dummy',
      targetPaths: ['/ws/lightspeed'],
      evaluate: evaluateSpy,
    };

    const engine = new RuleEngine([dummyRule]);

    // Send to /ws/realtime (not targeted)
    const decision = engine.intercept('wss://gateway.messenger.com/ws/realtime', new Uint8Array([1]));
    expect(decision.action).toBe('pass');
    expect(decision.reason).toBe('path-not-targeted');
    expect(evaluateSpy).not.toHaveBeenCalled(); // ZERO CPU cycles spent evaluating!
  });

  it('short-circuits on drop and does not evaluate subsequent rules', () => {
    const rule1: SuppressionRule = {
      id: 'rule.drop',
      targetPaths: ['/ws/lightspeed'],
      evaluate: () => ({ action: 'drop', ruleId: 'rule.drop', reason: 'blocked' }),
    };

    const rule2Evaluate = vi.fn();
    const rule2: SuppressionRule = {
      id: 'rule.pass',
      targetPaths: ['/ws/lightspeed'],
      evaluate: rule2Evaluate,
    };

    const engine = new RuleEngine([rule1, rule2]);
    const decision = engine.intercept('wss://gateway.messenger.com/ws/lightspeed', new Uint8Array([1]));

    expect(decision.action).toBe('drop');
    expect(decision.reason).toBe('blocked');
    expect(rule2Evaluate).not.toHaveBeenCalled();
  });

  it('fails open gracefully if a rule throws an exception', () => {
    const brokenRule: SuppressionRule = {
      id: 'rule.buggy',
      targetPaths: ['/ws/lightspeed'],
      evaluate: () => {
        throw new Error('Unexpected crash in user rule');
      },
    };

    const engine = new RuleEngine([brokenRule]);
    const decision = engine.intercept('wss://gateway.messenger.com/ws/lightspeed', new Uint8Array([1]));

    expect(decision.action).toBe('pass');
  });
});
