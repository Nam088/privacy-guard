import { describe, expect, it } from 'vitest';
import { decodeFrame, extractTasks, readBalancedJson, readFrame, toBytes } from '@/protocol/dgw';

// The header observed on a live socket. Bytes seven and eight are 7b 7d, an ASCII {}, which is the
// trap every naive decoder falls into.
const HEADER = new Uint8Array([
  0x0f, 0x7d, 0x00, 0x02, 0x00, 0x00, 0x7b, 0x7d, 0x0d, 0x7d, 0x00, 0xb1,
]);

function frame(payload: unknown, header: Uint8Array = HEADER): Uint8Array {
  const outer = JSON.stringify({
    app_id: '936619743392459',
    payload: JSON.stringify(payload),
    request_id: 7,
    type: 3,
  });
  const body = new TextEncoder().encode(outer);
  const out = new Uint8Array(header.length + body.length);
  out.set(header, 0);
  out.set(body, header.length);
  return out;
}

function task(label: string, fields: Record<string, unknown>) {
  return { label, payload: JSON.stringify(fields) };
}

const readReceipt = frame({
  epoch_id: '6839503921',
  tasks: [task('72', { thread_key: '1' }), task('72', { thread_key: '2' })],
  version_id: '7261334017',
});

describe('decodeFrame', () => {
  // A passing decode cannot be told from an absent one unless the naive decoder is shown failing
  // on the same bytes first.
  it('is doing something a first brace scan gets wrong', () => {
    const text = new TextDecoder().decode(readReceipt);
    const at = text.indexOf('{');

    expect(JSON.parse(text.slice(at, at + 2))).toEqual({});
    expect(decodeFrame(readReceipt)).toMatchObject({ app_id: expect.any(String) });
  });

  it('finds the json wherever the header ends', () => {
    for (const length of [8, 14, 15, 16]) {
      const header = new Uint8Array(length).fill(0x01);
      const decoded = decodeFrame(frame({ epoch_id: '1', tasks: [], version_id: '2' }, header));

      expect(decoded).toMatchObject({ request_id: 7 });
    }
  });

  it('returns null for a frame carrying no json', () => {
    expect(decodeFrame(HEADER)).toBeNull();
    expect(decodeFrame(new Uint8Array([0x09]))).toBeNull();
  });

  it('is not fooled by a brace inside a string value', () => {
    const decoded = decodeFrame(
      new Uint8Array([...HEADER, ...new TextEncoder().encode('{"a":"}{","b":1}')]),
    );

    expect(decoded).toEqual({ a: '}{', b: 1 });
  });

  // The decoder walks characters, not bytes, from the first candidate brace onward. Anything that
  // mixes the two reads the wrong offset the moment a message is not written in ASCII, and the
  // header itself already contains a byte that decodes to a replacement character.
  it('finds the json when the frame carries multi-byte characters', () => {
    const decoded = decodeFrame(
      frame({
        epoch_id: '1',
        tasks: [task('72', { text: 'nhắn tin tiếng Việt 🇻🇳', thread_key: '1' })],
        version_id: '2',
      }),
    );

    expect(decoded).toMatchObject({ request_id: 7 });
    expect(extractTasks(decoded)).toMatchObject({ envelope: 'array', labels: ['72'] });
  });

  it('reads a balanced object starting partway through the text', () => {
    expect(readBalancedJson('noise{"a":1}', 5)).toEqual({ a: 1 });
    expect(readBalancedJson('noise{"a":1}', 0)).toBeNull();
  });
});

describe('extractTasks', () => {
  it('reads every task in the array envelope, not just the first', () => {
    expect(extractTasks(decodeFrame(readReceipt))).toMatchObject({
      envelope: 'array',
      labels: ['72', '72'],
    });
  });

  it('reads the single task envelope rather than calling the frame empty', () => {
    const typing = frame({
      label: '3',
      payload: JSON.stringify({ thread_key: '1', is_typing: 1 }),
      version: '7261334017',
    });

    expect(extractTasks(decodeFrame(typing))).toMatchObject({ envelope: 'single', labels: ['3'] });
  });

  // Lightspeed carries a third shape, sync state, seen five times on a live run. It has no tasks
  // and must not be read as having none.
  it('refuses to call an unrecognised envelope an empty task list', () => {
    const sync = frame({
      database: 1,
      epoch_id: '1',
      failure_count: 0,
      last_applied_cursor: 'x',
      sync_params: '{}',
      version: '1',
    });

    expect(extractTasks(decodeFrame(sync))).toEqual({ envelope: 'unknown', labels: [], tasks: [] });
  });

  // The dangerous case: a tasks array whose entries have no label would otherwise read as zero
  // tasks, and a frame with zero tasks must never look like a frame whose tasks were all read.
  it('treats a tasks array it cannot label as unread, not as empty', () => {
    const odd = frame({ epoch_id: '1', tasks: [{ nope: 1 }], version_id: '2' });

    expect(extractTasks(decodeFrame(odd))).toEqual({ envelope: 'unknown', labels: [], tasks: [] });
  });

  // A label alone cannot settle every frame. Label 6 is the inbox watermark only when its payload
  // says `parent_thread_key: 0`; the same label on a folder is something else entirely.
  it('carries each task payload alongside its label', () => {
    const watermark = frame({
      epoch_id: '1',
      tasks: [task('6', { parent_thread_key: 0, last_seen_time_ms: 1788633948465 })],
      version_id: '2',
    });

    expect(extractTasks(decodeFrame(watermark)).tasks).toEqual([
      { label: '6', payload: { parent_thread_key: 0, last_seen_time_ms: 1788633948465 } },
    ]);
  });

  it('carries the payload of a single task envelope too', () => {
    const single = frame({
      label: '6',
      payload: JSON.stringify({ parent_thread_key: 0 }),
      version: '1',
    });

    expect(extractTasks(decodeFrame(single)).tasks).toEqual([
      { label: '6', payload: { parent_thread_key: 0 } },
    ]);
  });

  // A payload that will not parse must not read as an empty one, or a rule looking for a field
  // would see its absence as permission to drop.
  it('reports a payload it cannot parse as null rather than as an empty object', () => {
    const broken = frame({
      epoch_id: '1',
      tasks: [{ label: '6', payload: 'not json' }],
      version_id: '2',
    });

    expect(extractTasks(decodeFrame(broken)).tasks).toEqual([{ label: '6', payload: null }]);
  });

  it('reads a numeric label as a string', () => {
    const numeric = frame({ epoch_id: '1', tasks: [{ label: 72, payload: '{}' }], version_id: '2' });

    expect(extractTasks(decodeFrame(numeric))).toMatchObject({ envelope: 'array', labels: ['72'] });
  });
});

describe('readFrame', () => {
  it('reports an undecodable frame as unknown rather than throwing', () => {
    expect(readFrame(new Uint8Array([0x09]))).toEqual({ envelope: 'unknown', labels: [], tasks: [] });
  });
});

describe('toBytes', () => {
  // Compared as plain arrays: jsdom's TextEncoder returns a Uint8Array from another realm, and a
  // structural comparison of two typed arrays that hold identical bytes fails across realms.
  const bytes = (value: unknown) => Array.from(toBytes(value) ?? []);

  it('accepts the shapes send is actually given', () => {
    expect(bytes('ab')).toEqual([97, 98]);
    expect(bytes(new Uint8Array([1, 2]).buffer)).toEqual([1, 2]);
    expect(bytes(new Uint8Array([1, 2]))).toEqual([1, 2]);
  });

  it('reads a view of part of a buffer, not the whole buffer', () => {
    const view = new Uint8Array(new Uint8Array([1, 2, 3, 4]).buffer, 1, 2);

    expect(bytes(view)).toEqual([2, 3]);
  });

  it('returns null for anything it cannot read synchronously', () => {
    expect(toBytes(new Blob(['x']))).toBeNull();
    expect(toBytes(undefined)).toBeNull();
  });
});
