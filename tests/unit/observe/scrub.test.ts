import { describe, expect, it } from 'vitest';
import { scrub } from '@/observe/scrub';

describe('scrub', () => {
  it('keeps object keys, since the shape is what we are studying', () => {
    const out = scrub({ tasks: [{ label: '389', payload: 'x' }] });
    expect(Object.keys(out as object)).toEqual(['tasks']);
  });

  it('replaces every string value with a length marker', () => {
    const out = scrub({ text: 'see you at eight' }) as Record<string, string>;
    expect(out.text).toBe('<string:16>');
  });

  it('keeps short numeric labels, because they are the thing being identified', () => {
    const out = scrub({ label: '389' }) as Record<string, string>;
    expect(out.label).toBe('389');
  });

  it('redacts a long number that could be an account or thread id', () => {
    const out = scrub({ thread_key: 8482072268488190 }) as Record<string, string>;
    expect(out.thread_key).toBe('<number:16>');
  });

  it('keeps a small number, which carries structure not identity', () => {
    const out = scrub({ type: 4 }) as Record<string, number>;
    expect(out.type).toBe(4);
  });

  it('keeps booleans and null', () => {
    const out = scrub({ ok: true, missing: null }) as Record<string, unknown>;
    expect(out.ok).toBe(true);
    expect(out.missing).toBeNull();
  });

  it('recurses into nested objects and arrays', () => {
    const out = scrub({ a: [{ b: 'secret' }] }) as { a: Array<{ b: string }> };
    expect(out.a[0]?.b).toBe('<string:6>');
  });

  it('parses and scrubs a string that contains json, since payloads nest', () => {
    const out = scrub({ payload: '{"text":"hello there"}' }) as Record<string, unknown>;
    expect(out.payload).toEqual({ text: '<string:11>' });
  });

  it('leaves nothing readable from a realistic frame', () => {
    const frame = {
      app_id: '2220391788200892',
      payload: JSON.stringify({
        // eslint-disable-next-line no-loss-of-precision -- realistic snowflake-style id, value not asserted
        epoch_id: 7501954664706356560,
        tasks: [
          {
            label: '389',
            payload: JSON.stringify({
              thread_key: 8482072268488190,
              text: 'meet me at the usual place',
            }),
          },
        ],
      }),
    };
    const serialised = JSON.stringify(scrub(frame));
    expect(serialised).not.toContain('meet me');
    expect(serialised).not.toContain('8482072268488190');
    expect(serialised).not.toContain('2220391788200892');
    expect(serialised).toContain('389');
  });

  it('caps recursion so a cyclic or vast object cannot hang the page', () => {
    const deep: Record<string, unknown> = {};
    let node = deep;
    for (let i = 0; i < 200; i += 1) {
      const next: Record<string, unknown> = {};
      node.next = next;
      node = next;
    }
    expect(() => scrub(deep)).not.toThrow();
  });
});

describe('scrub, object keys', () => {
  it('keeps a key that looks like a field name, since the shape is the point', () => {
    const out = scrub({ thread_key: 1, appId: 2, tasks: 3 }) as Record<string, unknown>;
    expect(Object.keys(out).sort()).toEqual(['appId', 'tasks', 'thread_key']);
  });

  it('redacts a key that is an identifier rather than a field name', () => {
    const out = scrub({ '8482072268488190': true }) as Record<string, unknown>;
    expect(Object.keys(out)).toEqual(['<key:16>']);
  });

  it('redacts a key that is readable text', () => {
    const out = scrub({ 'meet me at the docks at midnight': true }) as Record<string, unknown>;
    expect(JSON.stringify(out)).not.toContain('docks');
  });

  it('redacts a key that is a phone number', () => {
    const out = scrub({ '+15551234567': 1 }) as Record<string, unknown>;
    expect(JSON.stringify(out)).not.toContain('5551234567');
  });

  it('redacts a key that carries a token', () => {
    const out = scrub({ 'session_token=eyJhbGciOiJIUzI1NiJ9.secret.sig': 1 }) as Record<
      string,
      unknown
    >;
    expect(JSON.stringify(out)).not.toContain('secret');
  });
});

describe('scrub, numbers use the same threshold as strings', () => {
  it('redacts a six digit code, which a one time password looks like', () => {
    const out = scrub({ otp: 483920 }) as Record<string, string>;
    expect(out.otp).toBe('<number:6>');
  });

  it('still keeps a small structural number', () => {
    const out = scrub({ type: 4, version: 12 }) as Record<string, number>;
    expect(out.type).toBe(4);
    expect(out.version).toBe(12);
  });

  it('treats a number and a numeric string the same way', () => {
    const asNumber = scrub({ v: 4839 }) as Record<string, unknown>;
    const asString = scrub({ v: '4839' }) as Record<string, unknown>;
    expect(typeof asNumber.v).toBe('string');
    expect(typeof asString.v).toBe('string');
  });
});
