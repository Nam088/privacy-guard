/**
 * In-place DGW payload neutralization for Meta protocols (Facebook / Messenger).
 *
 * In DGW v5 (Grouped Web Stream), dropping WebSocket frames on /ws/lightspeed or /ws/realtime
 * breaks the stream sequence counter (e.g. streamId: 11 missing before streamId: 13), causing
 * Meta gateways to abort connections with code 1006 ABNORMAL_CLOSURE or hang on ESTABLISHMENT_TIMEOUT.
 * This stalls subsequent user outbound messages (task label 46) on "Sending..." for 30s.
 *
 * Rather than dropping frames, this module performs zero-byte-shift, in-place neutralization:
 * 1. Typing indicators (task 3): sets `is_typing: 1` -> `is_typing: 0` (same 1-byte length).
 * 2. Read receipts (task 21): sets `last_read_watermark_ts: <13-digit-ts>` -> `0` padded with spaces.
 * 3. Inbox watermarks (task 6): sets `last_seen_time_ms: <13-digit-ts>` -> `0` padded with spaces.
 * 4. Realtime telemetry: neutralizes `send_typing_indicators` -> `noop_typing_indicators`.
 *
 * Preserves 100% of binary framing, packet lengths, and stream sequence continuity.
 */

const IS_TYPING_BYTES = [0x69, 0x73, 0x5f, 0x74, 0x79, 0x70, 0x69, 0x6e, 0x67]; // "is_typing"
const WATERMARK_TS_BYTES = [
  0x6c, 0x61, 0x73, 0x74, 0x5f, 0x72, 0x65, 0x61, 0x64, 0x5f, 0x77, 0x61, 0x74, 0x65, 0x72, 0x6d,
  0x61, 0x72, 0x6b, 0x5f, 0x74, 0x73,
]; // "last_read_watermark_ts"
const LAST_SEEN_MS_BYTES = [
  0x6c, 0x61, 0x73, 0x74, 0x5f, 0x73, 0x65, 0x65, 0x6e, 0x5f, 0x74, 0x69, 0x6d, 0x65, 0x5f, 0x6d,
  0x73,
]; // "last_seen_time_ms"
const SEND_TYPING_BYTES = [
  0x73, 0x65, 0x6e, 0x64, 0x5f, 0x74, 0x79, 0x70, 0x69, 0x6e, 0x67, 0x5f, 0x69, 0x6e, 0x64, 0x69,
  0x63, 0x61, 0x74, 0x6f, 0x72, 0x73,
]; // "send_typing_indicators" (22 bytes)
const NOOP_PREFIX_BYTES = [0x6e, 0x6f, 0x6f, 0x70]; // "noop"

function containsSubsequence(target: Uint8Array, needle: number[], start: number): boolean {
  if (start + needle.length > target.length) {
    return false;
  }
  for (let j = 0; j < needle.length; j += 1) {
    if (target[start + j] !== needle[j]) {
      return false;
    }
  }
  return true;
}

function findSubsequence(target: Uint8Array, needle: number[]): number {
  const limit = target.length - needle.length;
  for (let i = 0; i <= limit; i += 1) {
    if (containsSubsequence(target, needle, i)) {
      return i;
    }
  }
  return -1;
}

function isArrayBuffer(val: unknown): val is ArrayBuffer {
  return (
    val instanceof ArrayBuffer ||
    Object.prototype.toString.call(val) === '[object ArrayBuffer]'
  );
}

function toUint8Array(data: ArrayBuffer | ArrayBufferView): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (isArrayBuffer(data)) {
    return new Uint8Array(data);
  }
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

/** Check if payload carries user message text or send action (task 46) which must never be mutated. */
function isOutboundMessageText(text: string): boolean {
  return /["\\](?:body|text|send_message|message_send|composer_send_message|offline_threading_id|message_id)["\\]/i.test(
    text,
  );
}

/**
 * Neutralizes typing indicator from `is_typing: 1` to `is_typing: 0`.
 * Returns the modified payload (preserving input type) or null if no modification was needed.
 */
export function neutralizeTypingDgw(data: unknown): unknown | null {
  if (data == null) {
    return null;
  }

  if (typeof data === 'string') {
    if (isOutboundMessageText(data) && !data.includes('"label":"3"') && !data.includes('\\"label\\":\\"3\\"')) {
      return null;
    }
    const regex = /(is_typing\\*":\s*)1/g;
    if (!regex.test(data)) {
      return null;
    }
    return data.replace(/(is_typing\\*":\s*)1/g, '$10');
  }

  if (isArrayBuffer(data) || ArrayBuffer.isView(data)) {
    const src = toUint8Array(data);

    const copy = new Uint8Array(src.length);
    copy.set(src);

    let changed = false;
    const limit = copy.length - IS_TYPING_BYTES.length - 2;
    for (let i = 0; i <= limit; i += 1) {
      if (containsSubsequence(copy, IS_TYPING_BYTES, i)) {
        const scanLimit = Math.min(copy.length, i + IS_TYPING_BYTES.length + 20);
        for (let k = i + IS_TYPING_BYTES.length; k < scanLimit; k += 1) {
          if (copy[k] === 0x3a) {
            // Found colon ':'
            const valLimit = Math.min(copy.length, k + 10);
            for (let m = k + 1; m < valLimit; m += 1) {
              if (copy[m] === 0x31) {
                // '1' -> '0'
                copy[m] = 0x30;
                changed = true;
                break;
              } else if (copy[m] === 0x30) {
                // already '0'
                break;
              }
            }
            break;
          }
        }
      }
    }

    if (!changed) {
      return null;
    }

    if (isArrayBuffer(data)) {
      return copy.buffer;
    }
    return copy;
  }

  return null;
}

/**
 * Neutralizes read receipt watermark timestamp (`last_read_watermark_ts`) to `0` padded with spaces.
 * Preserves exact byte length and JSON syntax.
 */
export function neutralizeReadReceiptDgw(data: unknown): unknown | null {
  if (data == null) {
    return null;
  }

  if (typeof data === 'string') {
    if (isOutboundMessageText(data) && !data.includes('"label":"21"') && !data.includes('\\"label\\":\\"21\\"')) {
      return null;
    }
    const regex = /(last_read_watermark_ts\\*":\s*)([1-9]\d*)/g;
    if (!regex.test(data)) {
      return null;
    }
    return data.replace(/(last_read_watermark_ts\\*":\s*)([1-9]\d*)/g, (_, prefix, digits) => {
      const padding = ' '.repeat(digits.length - 1);
      return `${prefix}0${padding}`;
    });
  }

  if (isArrayBuffer(data) || ArrayBuffer.isView(data)) {
    const src = toUint8Array(data);

    const copy = new Uint8Array(src.length);
    copy.set(src);

    let changed = false;
    const limit = copy.length - WATERMARK_TS_BYTES.length - 10;
    for (let i = 0; i <= limit; i += 1) {
      if (containsSubsequence(copy, WATERMARK_TS_BYTES, i)) {
        const scanLimit = Math.min(copy.length, i + WATERMARK_TS_BYTES.length + 20);
        for (let k = i + WATERMARK_TS_BYTES.length; k < scanLimit; k += 1) {
          if (copy[k] === 0x3a) {
            // Found colon ':'
            const valLimit = Math.min(copy.length, k + 10);
            for (let m = k + 1; m < valLimit; m += 1) {
              const byteM = copy[m];
              if (byteM !== undefined && byteM >= 0x31 && byteM <= 0x39) {
                // First digit 1-9 -> '0'
                copy[m] = 0x30;
                let n = m + 1;
                while (n < copy.length) {
                  const byteN = copy[n];
                  if (byteN === undefined || byteN < 0x30 || byteN > 0x39) {
                    break;
                  }
                  copy[n] = 0x20; // replace remaining digits with space ' '
                  n += 1;
                }
                changed = true;
                break;
              }
            }
            break;
          }
        }
      }
    }

    if (!changed) {
      return null;
    }

    if (isArrayBuffer(data)) {
      return copy.buffer;
    }
    return copy;
  }

  return null;
}

/**
 * Neutralizes inbox watermark timestamp (`last_seen_time_ms`) to `0` padded with spaces.
 */
export function neutralizeInboxWatermarkDgw(data: unknown): unknown | null {
  if (data == null) {
    return null;
  }

  if (typeof data === 'string') {
    const regex = /(last_seen_time_ms\\*":\s*)([1-9]\d*)/g;
    if (!regex.test(data)) {
      return null;
    }
    return data.replace(/(last_seen_time_ms\\*":\s*)([1-9]\d*)/g, (_, prefix, digits) => {
      const padding = ' '.repeat(digits.length - 1);
      return `${prefix}0${padding}`;
    });
  }

  if (isArrayBuffer(data) || ArrayBuffer.isView(data)) {
    const src = toUint8Array(data);

    const copy = new Uint8Array(src.length);
    copy.set(src);

    let changed = false;
    const limit = copy.length - LAST_SEEN_MS_BYTES.length - 10;
    for (let i = 0; i <= limit; i += 1) {
      if (containsSubsequence(copy, LAST_SEEN_MS_BYTES, i)) {
        const scanLimit = Math.min(copy.length, i + LAST_SEEN_MS_BYTES.length + 20);
        for (let k = i + LAST_SEEN_MS_BYTES.length; k < scanLimit; k += 1) {
          if (copy[k] === 0x3a) {
            // Found colon ':'
            const valLimit = Math.min(copy.length, k + 10);
            for (let m = k + 1; m < valLimit; m += 1) {
              const byteM = copy[m];
              if (byteM !== undefined && byteM >= 0x31 && byteM <= 0x39) {
                // First digit 1-9 -> '0'
                copy[m] = 0x30;
                let n = m + 1;
                while (n < copy.length) {
                  const byteN = copy[n];
                  if (byteN === undefined || byteN < 0x30 || byteN > 0x39) {
                    break;
                  }
                  copy[n] = 0x20; // space ' '
                  n += 1;
                }
                changed = true;
                break;
              }
            }
            break;
          }
        }
      }
    }

    if (!changed) {
      return null;
    }

    if (isArrayBuffer(data)) {
      return copy.buffer;
    }
    return copy;
  }

  return null;
}

const STATE_BYTES = [0x73, 0x74, 0x61, 0x74, 0x65]; // "state"

/**
 * Neutralizes telemetry on /ws/realtime (e.g. `send_typing_indicators` -> `noop_typing_indicators` or `state: 1` -> `state: 0`).
 * Keeps the packet length identical (22 chars) and preserves sequential DGW packet counter.
 */
export function neutralizeRealtimeTelemetry(data: unknown): unknown | null {
  if (data == null) {
    return null;
  }

  if (typeof data === 'string') {
    let modified = data;
    let changed = false;
    if (modified.includes('send_typing_indicators')) {
      modified = modified.replaceAll('send_typing_indicators', 'noop_typing_indicators');
      changed = true;
    }
    if (/(["\\](?:state|chat_state|chatstate)["\\]:\s*)1/g.test(modified)) {
      modified = modified.replace(/(["\\](?:state|chat_state|chatstate)["\\]:\s*)1/g, '$10');
      changed = true;
    }
    return changed ? modified : null;
  }

  if (isArrayBuffer(data) || ArrayBuffer.isView(data)) {
    const src = toUint8Array(data);
    const copy = new Uint8Array(src.length);
    copy.set(src);
    let changed = false;

    const pos = findSubsequence(copy, SEND_TYPING_BYTES);
    if (pos !== -1) {
      for (let i = 0; i < NOOP_PREFIX_BYTES.length; i += 1) {
        const nb = NOOP_PREFIX_BYTES[i];
        if (nb !== undefined) {
          copy[pos + i] = nb; // "send" -> "noop"
        }
      }
      changed = true;
    }

    const statePos = findSubsequence(copy, STATE_BYTES);
    if (statePos !== -1) {
      const scanLimit = Math.min(copy.length, statePos + STATE_BYTES.length + 10);
      for (let k = statePos + STATE_BYTES.length; k < scanLimit; k += 1) {
        if (copy[k] === 0x3a) { // ':'
          for (let m = k + 1; m < Math.min(copy.length, k + 5); m += 1) {
            if (copy[m] === 0x31) { // '1' -> '0'
              copy[m] = 0x30;
              changed = true;
              break;
            }
          }
          break;
        }
      }
    }

    if (!changed) {
      return null;
    }

    if (isArrayBuffer(data)) {
      return copy.buffer;
    }
    return copy;
  }

  return null;
}
