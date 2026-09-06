import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

// The probe is pasted into a page console, so it has no exports to import. The test evaluates the
// exact bytes that get pasted, which makes the pasteable artifact itself the thing under test
// rather than a tidied copy of it.
const PROBE_SOURCE = readFileSync(
  resolve(process.cwd(), 'tools/probes/gateway-frame-probe.js'),
  'utf8',
);

interface Summary {
  verdict: string;
  notes: string[];
  envelopes: Record<string, number>;
  headerBytesByPath: Record<string, Record<string, number>>;
  decodedByPath: Record<string, number>;
  unknownShapes: Record<string, number>;
  labelsByPath: Record<string, Record<string, number>>;
  byWindow: {
    window: string;
    decoded: number;
    undecoded: number;
    byPath: Record<string, number>;
    labels: Record<string, number>;
  }[];
  blockers: string[];
  taskCountPerFrame: Record<string, number>;
  signalFramesSharedWithOtherTasks: number;
  framesDecoded: number;
  framesUndecoded: number;
  headerBytesSeen: Record<string, number>;
  labelsByEnvelope: Record<string, Record<string, number>>;
  undecoded: {
    tooSmallToCarryATask: number;
    largeEnoughToCarryATask: number;
    smallestDecodedFrameBytes: number | null;
    floorUsed: number;
    floorWasCalibrated: boolean;
    byteLengths: Record<string, number>;
    headHex: Record<string, number>;
    containingTaskMarkers: number;
    markersSeen: Record<string, number>;
  };
  signalFrames: { labels: string[]; taskFields: string[] }[];
}

interface Probe {
  mark(name: string): string;
  decodeFrame(bytes: Uint8Array): { outer: Record<string, unknown>; headerBytes: number } | null;
  extractTasks(inner: unknown): { envelope: string; tasks: unknown[] };
  summarize(): Summary;
  stop(): void;
}

function loadProbe(): Probe {
  new Function(PROBE_SOURCE)();
  return (globalThis as unknown as { __gwProbe: Probe }).__gwProbe;
}

// The probe forwards every frame to whatever send it found at install time, and jsdom's real send
// rejects a plain object standing in for a socket. Installing a recorder first gives the probe
// something forwardable and gives the test a view of what came through.
function loadProbeOverRecorder(): { probe: Probe; forwarded: unknown[]; restore(): void } {
  const real = WebSocket.prototype.send;
  const forwarded: unknown[] = [];
  WebSocket.prototype.send = function recordingSend(this: WebSocket, data: unknown) {
    forwarded.push(data);
  } as unknown as typeof WebSocket.prototype.send;
  return {
    probe: loadProbe(),
    forwarded,
    restore: () => {
      WebSocket.prototype.send = real;
    },
  };
}

// The header observed on a live socket. Bytes seven and eight are 7b 7d, an ASCII {}, and that
// empty object is the trap every naive decoder falls into.
const HEADER = new Uint8Array([0x0f, 0x7d, 0x00, 0x02, 0x00, 0x00, 0x7b, 0x7d, 0x0d, 0x7d, 0x00, 0xb1]);

function frameOf(payload: unknown, header: Uint8Array = HEADER): Uint8Array {
  const outer = JSON.stringify({
    app_id: '936619743392459',
    payload: JSON.stringify(payload),
    request_id: 7,
    type: 3,
  });
  const body = new TextEncoder().encode(outer);
  const frame = new Uint8Array(header.length + body.length);
  frame.set(header, 0);
  frame.set(body, header.length);
  return frame;
}

function bytesOf(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function task(label: string, fields: Record<string, unknown>) {
  return { label, payload: JSON.stringify(fields) };
}

const readReceiptFrame = frameOf({
  epoch_id: '6839503921',
  tasks: [
    task('72', { thread_key: '100001234567890' }),
    task('235', { thread_key: '100001234567890' }),
  ],
  version_id: '7261334017',
});

const typingFrame = frameOf({
  label: '3',
  payload: JSON.stringify({
    thread_key: '100001234567890',
    is_typing: 1,
    is_group_thread: 0,
    attribution: 0,
    sync_group: 1,
    thread_type: 1,
  }),
  version: '7261334017',
});

describe('the gateway frame probe', () => {
  afterEach(() => {
    const probe = (globalThis as unknown as { __gwProbe?: Probe }).__gwProbe;
    probe?.stop();
    delete (globalThis as unknown as { __gwProbe?: Probe }).__gwProbe;
  });

  // A passing decode cannot distinguish a working decoder from an absent one unless the naive
  // decoder is shown failing on the same input first. This asserts the trap is real.
  it('is measuring something a first brace scan gets wrong', () => {
    const text = new TextDecoder().decode(readReceiptFrame);
    const naive = JSON.parse(text.slice(text.indexOf('{'), text.indexOf('{') + 2));

    expect(naive).toEqual({});

    const probe = loadProbe();
    const decoded = probe.decodeFrame(readReceiptFrame);

    expect(decoded?.headerBytes).toBe(HEADER.length);
    expect(Object.keys(decoded?.outer ?? {})).toContain('payload');
  });

  it('counts every task in an array envelope, not just the first', () => {
    const probe = loadProbe();
    const decoded = probe.decodeFrame(readReceiptFrame);
    const inner = JSON.parse(String(decoded?.outer.payload));
    const extracted = probe.extractTasks(inner);

    expect(extracted.envelope).toBe('array');
    expect(extracted.tasks).toHaveLength(2);
  });

  it('reads the single task envelope typing uses instead of calling the frame empty', () => {
    const probe = loadProbe();
    const decoded = probe.decodeFrame(typingFrame);
    const inner = JSON.parse(String(decoded?.outer.payload));
    const extracted = probe.extractTasks(inner);

    expect(extracted.envelope).toBe('single');
    expect(extracted.tasks).toHaveLength(1);
  });

  it('refuses to call an unrecognised envelope an empty task list', () => {
    const probe = loadProbe();

    expect(probe.extractTasks({ epoch_id: '1', version_id: '2' })).toEqual({
      envelope: 'unknown',
      tasks: [],
    });
  });

  it('finds no object in a frame that carries none', () => {
    const probe = loadProbe();

    expect(probe.decodeFrame(HEADER)).toBeNull();
  });

  it('reports safe to drop only when a signal frame carries signal tasks alone', () => {
    const { probe, restore } = loadProbeOverRecorder();
    const socket = { url: 'wss://gateway.messenger.com/ws/lightspeed?x=1' } as unknown as WebSocket;

    try {
      WebSocket.prototype.send.call(socket, readReceiptFrame as unknown as ArrayBufferView);
      const clean = probe.summarize();

      expect(clean.taskCountPerFrame).toEqual({ 2: 1 });
      expect(clean.signalFramesSharedWithOtherTasks).toBe(0);
      expect(clean.verdict).toContain('SAFE');

      // The finding that would change M3b's shape: a read receipt batched with a pagination task.
      WebSocket.prototype.send.call(
        socket,
        frameOf({
          epoch_id: '6839503922',
          tasks: [task('72', { thread_key: '1' }), task('145', { cursor: 'x' })],
          version_id: '7261334017',
        }) as unknown as ArrayBufferView,
      );
      const mixed = probe.summarize();

      expect(mixed.signalFramesSharedWithOtherTasks).toBe(1);
      expect(mixed.verdict).toContain('NOT SAFE');
    } finally {
      restore();
    }
  });

  it('says so when the action produced no signal at all', () => {
    const { probe, restore } = loadProbeOverRecorder();
    const socket = { url: 'wss://gateway.messenger.com/ws/lightspeed' } as unknown as WebSocket;

    try {
      WebSocket.prototype.send.call(
        socket,
        frameOf({
          epoch_id: '1',
          tasks: [task('145', { cursor: 'x' })],
          version_id: '2',
        }) as unknown as ArrayBufferView,
      );

      expect(probe.summarize().verdict).toContain('NO SIGNAL SEEN');
    } finally {
      restore();
    }
  });

  // 112 of 157 frames went unread on the first live run. Only accepting objects was one reason a
  // frame could be skipped, so a top level array now decodes rather than counting as a hole.
  it('reads a top level array, not only an object', () => {
    const probe = loadProbe();
    const frame = new Uint8Array([...HEADER, ...bytesOf('[{"a":1},{"b":2}]')]);
    const decoded = probe.decodeFrame(frame);

    expect(decoded?.headerBytes).toBe(HEADER.length);
    expect(decoded?.outer).toEqual([{ a: 1 }, { b: 2 }]);
  });

  // The failure this probe committed on its first real run: it announced the frame was safe to
  // drop while 71 percent of the socket had gone unread.
  it('refuses to call dropping safe while frames went unread', () => {
    const { probe, restore } = loadProbeOverRecorder();
    const socket = { url: 'wss://gateway.messenger.com/ws/lightspeed' } as unknown as WebSocket;

    try {
      WebSocket.prototype.send.call(socket, readReceiptFrame as unknown as ArrayBufferView);
      expect(probe.summarize().verdict).toContain('SAFE');

      // An undecodable frame that is plainly a task frame, the kind that leaves a hole.
      WebSocket.prototype.send.call(
        socket,
        bytesOf(
          '\u0000\u0001garbage "tasks" and no parseable json'.padEnd(readReceiptFrame.length + 1, '.'),
        ) as unknown as ArrayBufferView,
      );
      const holed = probe.summarize();

      expect(holed.verdict).toContain('INCONCLUSIVE');
      expect(holed.undecoded.containingTaskMarkers).toBe(1);
      expect(holed.blockers.join(' ')).toContain('task frames were missed');
    } finally {
      restore();
    }
  });

  // The live run of 2026-09-05 sent 26 undecodable frames of 1, 3 and 8 bytes. A frame that short
  // cannot hold a task envelope, so it is control traffic and not a hole in the sample. The
  // threshold is the shortest frame that did decode, never a hardcoded guess.
  it('does not treat a frame too short to hold a task as a gap', () => {
    const { probe, restore } = loadProbeOverRecorder();
    const socket = { url: 'wss://gateway.messenger.com/ws/lightspeed' } as unknown as WebSocket;

    try {
      WebSocket.prototype.send.call(socket, readReceiptFrame as unknown as ArrayBufferView);
      WebSocket.prototype.send.call(
        socket,
        new Uint8Array([0x0c, 0x70, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00]) as unknown as ArrayBufferView,
      );
      const summary = probe.summarize();

      expect(summary.undecoded.tooSmallToCarryATask).toBe(1);
      expect(summary.undecoded.largeEnoughToCarryATask).toBe(0);
      expect(summary.undecoded.smallestDecodedFrameBytes).toBe(readReceiptFrame.length);
      expect(summary.blockers).toEqual([]);
      expect(summary.verdict).toContain('SAFE');
    } finally {
      restore();
    }
  });

  // The same relaxation must not swallow a frame that was big enough to have carried a task.
  it('still counts a large undecodable frame as a gap', () => {
    const { probe, restore } = loadProbeOverRecorder();
    const socket = { url: 'wss://gateway.messenger.com/ws/lightspeed' } as unknown as WebSocket;

    try {
      WebSocket.prototype.send.call(socket, readReceiptFrame as unknown as ArrayBufferView);
      WebSocket.prototype.send.call(
        socket,
        new Uint8Array(readReceiptFrame.length + 10).fill(0x41) as unknown as ArrayBufferView,
      );
      const summary = probe.summarize();

      expect(summary.undecoded.tooSmallToCarryATask).toBe(0);
      expect(summary.undecoded.largeEnoughToCarryATask).toBe(1);
      expect(summary.blockers.join(' ')).toContain('large enough to have carried a task');
      expect(summary.verdict).toContain('INCONCLUSIVE');
    } finally {
      restore();
    }
  });

  // Found by mutation: removing the marker check from the size classification broke nothing,
  // because no test covered a short frame that nonetheless names a task envelope. A task key in
  // the bytes outranks the frame being small.
  it('counts a short frame naming a task envelope as a gap regardless of its size', () => {
    const { probe, restore } = loadProbeOverRecorder();
    const socket = { url: 'wss://gateway.messenger.com/ws/lightspeed' } as unknown as WebSocket;

    try {
      WebSocket.prototype.send.call(socket, readReceiptFrame as unknown as ArrayBufferView);
      WebSocket.prototype.send.call(socket, bytesOf('"tasks"') as unknown as ArrayBufferView);
      const summary = probe.summarize();

      expect(summary.undecoded.byteLengths).toEqual({ 7: 1 });
      expect(summary.undecoded.tooSmallToCarryATask).toBe(0);
      expect(summary.undecoded.containingTaskMarkers).toBe(1);
      expect(summary.blockers.join(' ')).toContain('task frames were missed');
      expect(summary.verdict).toContain('INCONCLUSIVE');
    } finally {
      restore();
    }
  });

  // Found on a live run: with nothing decoded there was nothing to calibrate against, so two one
  // byte pings were reported as large enough to have carried a task. A run that decodes nothing
  // still knows a ping is a ping.
  it('classifies by size even when no frame decoded at all', () => {
    const { probe, restore } = loadProbeOverRecorder();
    const socket = { url: 'wss://gateway.messenger.com/ws/lightspeed' } as unknown as WebSocket;

    try {
      WebSocket.prototype.send.call(socket, new Uint8Array([0x09]) as unknown as ArrayBufferView);
      WebSocket.prototype.send.call(socket, new Uint8Array([0x09]) as unknown as ArrayBufferView);
      const summary = probe.summarize();

      expect(summary.framesDecoded).toBe(0);
      expect(summary.undecoded.smallestDecodedFrameBytes).toBeNull();
      expect(summary.undecoded.floorWasCalibrated).toBe(false);
      expect(summary.undecoded.tooSmallToCarryATask).toBe(2);
      expect(summary.undecoded.largeEnoughToCarryATask).toBe(0);
      expect(summary.blockers).toEqual([]);
    } finally {
      restore();
    }
  });

  // A run can produce a single task envelope without producing label 3, which is what happened on
  // 2026-09-05. Splitting labels by envelope is how the typing label gets named.
  it('says which labels arrived in which envelope', () => {
    const { probe, restore } = loadProbeOverRecorder();
    const socket = { url: 'wss://gateway.messenger.com/ws/lightspeed' } as unknown as WebSocket;

    try {
      WebSocket.prototype.send.call(socket, readReceiptFrame as unknown as ArrayBufferView);
      WebSocket.prototype.send.call(socket, typingFrame as unknown as ArrayBufferView);
      const summary = probe.summarize();

      expect(summary.labelsByEnvelope.array).toEqual({ 72: 1, 235: 1 });
      expect(summary.labelsByEnvelope.single).toEqual({ 3: 1 });
    } finally {
      restore();
    }
  });

  // A header whose length moves is a fact about the decoder, not about the sample, so it is
  // reported as a note and does not suppress an otherwise sound verdict. The live run of
  // 2026-09-05 saw lengths 8, 14, 15 and 16 across four sockets, which is four consistent
  // framings rather than one inconsistent one.
  it('reports a moving header length as a note, per path, not as a blocker', () => {
    const { probe, restore } = loadProbeOverRecorder();
    const lightspeed = { url: 'wss://gateway.messenger.com/ws/lightspeed' } as unknown as WebSocket;
    const realtime = { url: 'wss://gateway.messenger.com/ws/realtime' } as unknown as WebSocket;
    const longer = new Uint8Array([...HEADER, 0x00, 0x00, 0x00, 0x00]);

    try {
      WebSocket.prototype.send.call(lightspeed, readReceiptFrame as unknown as ArrayBufferView);
      WebSocket.prototype.send.call(
        realtime,
        frameOf(
          { epoch_id: '1', tasks: [task('235', { thread_key: '1' })], version_id: '2' },
          longer,
        ) as unknown as ArrayBufferView,
      );
      const summary = probe.summarize();

      expect(summary.headerBytesByPath).toEqual({
        '/ws/lightspeed': { 12: 1 },
        '/ws/realtime': { 16: 1 },
      });
      expect(summary.notes.join(' ')).toContain('header lengths seen: 12, 16');
      expect(summary.blockers).toEqual([]);
      expect(summary.verdict).toContain('SAFE');
    } finally {
      restore();
    }
  });

  // Two tasks under one label are only harmless if they are the same kind of task.
  it('shows the field names behind a repeated label', () => {
    const { probe, restore } = loadProbeOverRecorder();
    const socket = { url: 'wss://gateway.messenger.com/ws/lightspeed' } as unknown as WebSocket;

    try {
      WebSocket.prototype.send.call(
        socket,
        frameOf({
          epoch_id: '1',
          tasks: [task('72', { thread_key: '1' }), task('72', { thread_key: '2' })],
          version_id: '2',
        }) as unknown as ArrayBufferView,
      );

      expect(probe.summarize().signalFrames[0]?.taskFields).toEqual([
        '72: thread_key',
        '72: thread_key',
      ]);
    } finally {
      restore();
    }
  });

  // Contamination is a positive finding: it survives an incomplete sample, because one frame
  // proving batching is enough to rule dropping out.
  it('keeps the not safe verdict even when the sample is incomplete', () => {
    const { probe, restore } = loadProbeOverRecorder();
    const socket = { url: 'wss://gateway.messenger.com/ws/lightspeed' } as unknown as WebSocket;

    try {
      WebSocket.prototype.send.call(
        socket,
        frameOf({
          epoch_id: '1',
          tasks: [task('72', { thread_key: '1' }), task('145', { cursor: 'x' })],
          version_id: '2',
        }) as unknown as ArrayBufferView,
      );
      WebSocket.prototype.send.call(
        socket,
        bytesOf('garbage "tasks"'.padEnd(400, '.')) as unknown as ArrayBufferView,
      );

      expect(probe.summarize().verdict).toContain('NOT SAFE');
    } finally {
      restore();
    }
  });

  // The live run of 2026-09-05 found /ws/streamcontroller frames whose outer object holds a single
  // `payload` key, matching neither envelope. Reporting them as `unknown` and stopping there is
  // what left the typing question open, so the shape is now named.
  it('names the shape of an envelope it does not recognise', () => {
    const { probe, restore } = loadProbeOverRecorder();
    const socket = { url: 'wss://gateway.messenger.com/ws/streamcontroller' } as unknown as WebSocket;

    try {
      const body = JSON.stringify({
        payload: JSON.stringify({ stream_id: 'x', seq: 1, is_typing: 0 }),
      });
      const frame = new Uint8Array([...HEADER, ...bytesOf(body)]);
      WebSocket.prototype.send.call(socket, frame as unknown as ArrayBufferView);
      const summary = probe.summarize();

      // The outer `payload` wrapper is already unwrapped by the time the shape is taken, so what
      // gets named is the shape that actually matters.
      expect(summary.unknownShapes).toEqual({
        '/ws/streamcontroller :: is_typing,seq,stream_id': 1,
      });
    } finally {
      restore();
    }
  });

  // The 2026-09-05 run reported a streamcontroller shape as the single word
  // `presenceReportingAmendment`, because the shape reader only recursed into json hiding in a
  // string and stopped at a plainly nested object. That one word is what left typing unanswered,
  // so the nesting has to come through.
  it('descends into a plainly nested object, not only into json in a string', () => {
    const { probe, restore } = loadProbeOverRecorder();
    const socket = { url: 'wss://gateway.messenger.com/ws/streamcontroller' } as unknown as WebSocket;

    try {
      const body = JSON.stringify({
        payload: {
          presenceReportingAmendment: {
            thread_key: '1',
            typing_state: 1,
            reporting_interval: 60,
          },
        },
      });
      WebSocket.prototype.send.call(
        socket,
        new Uint8Array([...HEADER, ...bytesOf(body)]) as unknown as ArrayBufferView,
      );

      expect(probe.summarize().unknownShapes).toEqual({
        '/ws/streamcontroller :: presenceReportingAmendment{reporting_interval,thread_key,typing_state}': 1,
      });
    } finally {
      restore();
    }
  });

  it('names the shape of the elements inside an array', () => {
    const { probe, restore } = loadProbeOverRecorder();
    const socket = { url: 'wss://gateway.messenger.com/ws/streamcontroller' } as unknown as WebSocket;

    try {
      const body = JSON.stringify({
        payload: { additionalContacts: [{ contact_id: '1', name: 'x' }] },
      });
      WebSocket.prototype.send.call(
        socket,
        new Uint8Array([...HEADER, ...bytesOf(body)]) as unknown as ArrayBufferView,
      );

      expect(probe.summarize().unknownShapes).toEqual({
        '/ws/streamcontroller :: additionalContacts{[contact_id,name]}': 1,
      });
    } finally {
      restore();
    }
  });

  // Arithmetic from the 2026-09-05 run: 35 frames had an unrecognised envelope, 11 produced a
  // shape, and the missing 24 were exactly the 24 decoded /ws/realtime frames. They have no
  // `payload` key, so shaping only the inner made them decode and then vanish.
  it('shapes the outer object when a frame has no inner payload', () => {
    const { probe, restore } = loadProbeOverRecorder();
    const socket = { url: 'wss://gateway.messenger.com/ws/realtime' } as unknown as WebSocket;

    try {
      const body = JSON.stringify({ app_id: '1', batch: [{ event: 'x' }], seq: 4 });
      WebSocket.prototype.send.call(
        socket,
        new Uint8Array([...HEADER, ...bytesOf(body)]) as unknown as ArrayBufferView,
      );
      const summary = probe.summarize();

      expect(summary.envelopes.unknown).toBe(1);
      expect(summary.unknownShapes).toEqual({
        '/ws/realtime :: outer: app_id,batch{[event]},seq': 1,
      });
    } finally {
      restore();
    }
  });

  // Every unrecognised frame must appear in unknownShapes, or the report understates what was
  // never understood.
  it('leaves no unrecognised frame without a shape', () => {
    const { probe, restore } = loadProbeOverRecorder();
    const realtime = { url: 'wss://gateway.messenger.com/ws/realtime' } as unknown as WebSocket;
    const stream = { url: 'wss://gateway.messenger.com/ws/streamcontroller' } as unknown as WebSocket;

    try {
      WebSocket.prototype.send.call(
        realtime,
        new Uint8Array([...HEADER, ...bytesOf('{"a":1}')]) as unknown as ArrayBufferView,
      );
      WebSocket.prototype.send.call(
        stream,
        new Uint8Array([
          ...HEADER,
          ...bytesOf(JSON.stringify({ payload: { presenceReportingAmendment: { availability: 1 } } })),
        ]) as unknown as ArrayBufferView,
      );
      const summary = probe.summarize();
      const shaped = Object.values(summary.unknownShapes).reduce((a, b) => a + b, 0);

      expect(summary.envelopes.unknown).toBe(2);
      expect(shaped).toBe(2);
    } finally {
      restore();
    }
  });

  it('decodes every gateway path, not only lightspeed', () => {
    const { probe, restore } = loadProbeOverRecorder();
    const lightspeed = { url: 'wss://gateway.messenger.com/ws/lightspeed' } as unknown as WebSocket;
    const realtime = { url: 'wss://gateway.messenger.com/ws/realtime' } as unknown as WebSocket;

    try {
      WebSocket.prototype.send.call(lightspeed, readReceiptFrame as unknown as ArrayBufferView);
      WebSocket.prototype.send.call(realtime, typingFrame as unknown as ArrayBufferView);
      const summary = probe.summarize();

      expect(summary.decodedByPath).toEqual({ '/ws/lightspeed': 1, '/ws/realtime': 1 });
      expect(summary.labelsByPath).toEqual({
        '/ws/lightspeed': { 72: 1, 235: 1 },
        '/ws/realtime': { 3: 1 },
      });
    } finally {
      restore();
    }
  });

  // Without marks nothing is attributable: three runs have now produced label lists that cannot
  // be tied to the action that caused them.
  it('separates what arrived while typing from what arrived while idle', () => {
    const { probe, restore } = loadProbeOverRecorder();
    const socket = { url: 'wss://gateway.messenger.com/ws/lightspeed' } as unknown as WebSocket;

    try {
      probe.mark('idle');
      WebSocket.prototype.send.call(
        socket,
        frameOf({
          epoch_id: '1',
          tasks: [task('145', { cursor: 'x' })],
          version_id: '2',
        }) as unknown as ArrayBufferView,
      );
      probe.mark('typing');
      WebSocket.prototype.send.call(socket, typingFrame as unknown as ArrayBufferView);
      const summary = probe.summarize();

      expect(summary.byWindow.map((w) => w.window)).toEqual(['idle', 'typing']);
      expect(summary.byWindow[0]?.labels).toEqual({ 145: 1 });
      expect(summary.byWindow[1]?.labels).toEqual({ 3: 1 });
    } finally {
      restore();
    }
  });

  it('keeps an undecodable frame in the window it arrived in', () => {
    const { probe, restore } = loadProbeOverRecorder();
    const socket = { url: 'wss://gateway.messenger.com/ws/lightspeed' } as unknown as WebSocket;

    try {
      probe.mark('typing');
      WebSocket.prototype.send.call(socket, new Uint8Array([0x09]) as unknown as ArrayBufferView);
      const summary = probe.summarize();

      expect(summary.byWindow[0]?.window).toBe('typing');
      expect(summary.byWindow[0]?.undecoded).toBe(1);
    } finally {
      restore();
    }
  });

  it('passes the frame through to the original send untouched', () => {
    const { probe, forwarded, restore } = loadProbeOverRecorder();
    const socket = { url: 'wss://gateway.messenger.com/ws/lightspeed' } as unknown as WebSocket;

    try {
      WebSocket.prototype.send.call(socket, readReceiptFrame as unknown as ArrayBufferView);

      expect(forwarded).toEqual([readReceiptFrame]);
      expect(probe.summarize().framesDecoded).toBe(1);
    } finally {
      restore();
    }
  });
});
