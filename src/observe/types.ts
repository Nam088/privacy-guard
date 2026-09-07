export type ObservedKind =
  | 'websocket.create'
  | 'websocket.send'
  /** A frame was dropped: every task in it was one this build suppresses. */
  | 'websocket.suppressed'
  /**
   * A frame carrying a suppressed task was let through because it also carried something else.
   * This is a leak, and it is reported rather than hidden: a suppressor that silently fails open
   * is indistinguishable from one that works.
   */
  | 'websocket.mixed'
  | 'worker.create'
  | 'sharedworker.create'
  | 'port.postMessage'
  | 'port.suppressed'
  | 'worker.postMessage'
  | 'worker.suppressed'
  | 'fetch.send'
  | 'fetch.suppressed'
  /** Same two outcomes as fetch, kept apart so the transport is legible in the record. */
  | 'xhr.send'
  | 'xhr.suppressed';

export interface DescribedValue {
  type: string;
  byteLength: number;
}

export interface ObservedEvent {
  seq: number;
  at: number;
  kind: ObservedKind;
  target: string;
  frameUrl?: string;
  value?: DescribedValue;
  payload?: string;
}

export type Report = (event: ObservedEvent, raw?: unknown) => void;

let sequence = 0;

export function newEvent(
  kind: ObservedKind,
  target: string,
  frameUrl?: string,
): ObservedEvent {
  sequence += 1;
  return {
    seq: sequence,
    at: Date.now(),
    kind,
    target,
    frameUrl,
  };
}

function getUtf8ByteLength(str: string): number {
  let bytes = 0;
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i += 1;
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

export function describeValue(value: unknown): DescribedValue {
  if (typeof value === 'string') {
    return { type: 'string', byteLength: getUtf8ByteLength(value) };
  }
  if (value instanceof ArrayBuffer) {
    return { type: 'ArrayBuffer', byteLength: value.byteLength };
  }
  if (ArrayBuffer.isView(value)) {
    return { type: value.constructor.name, byteLength: value.byteLength };
  }
  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    return { type: 'Blob', byteLength: value.size };
  }
  return { type: 'unknown', byteLength: 0 };
}
