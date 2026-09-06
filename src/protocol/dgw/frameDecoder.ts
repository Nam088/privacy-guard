/**
 * Low-level binary frame decoding for Meta's Device Gateway (DGW).
 *
 * Handles variable-length binary headers (8, 12, 14, 15, 16 bytes), skips past the header's
 * embedded `7b 7d` ({}) empty-object trap, and parses balanced JSON bodies.
 */

const OPEN_BRACE = 0x7b;
const OPEN_BRACKET = 0x5b;

const decoder = new TextDecoder('utf-8');
const encoder = new TextEncoder();

/**
 * Reads one balanced JSON object or array starting at `from`, tracking string state so a brace
 * inside a string value cannot end it early. Returns null when the text does not start with a
 * complete one.
 */
export function readBalancedJson(text: string, from = 0): unknown {
  const first = text.charCodeAt(from);
  if (first !== OPEN_BRACE && first !== OPEN_BRACKET) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = from; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === '{' || char === '[') {
      depth += 1;
    } else if (char === '}' || char === ']') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(from, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * Finds the JSON in a frame and parses it, skipping past the header's embedded `{}` rather than
 * stopping at it. Returns null for a frame carrying no JSON at all (e.g. 1-byte pings or acks).
 */
export function decodeFrame(bytes: Uint8Array): unknown {
  // Decode once from the first candidate and scan the text from there, rather than decoding the
  // whole tail again at every brace. A frame carrying a hundred tasks has a lot of braces in it,
  // and this runs on every send. The scan moves to characters at this point precisely because a
  // byte offset stops matching a character offset the moment the payload is not all ASCII.
  let firstCandidate = -1;
  for (let i = 0; i < bytes.length; i += 1) {
    const byte = bytes[i];
    if (byte === OPEN_BRACE || byte === OPEN_BRACKET) {
      firstCandidate = i;
      break;
    }
  }
  if (firstCandidate === -1) {
    return null;
  }

  const text = decoder.decode(bytes.subarray(firstCandidate));
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char !== '{' && char !== '[') {
      continue;
    }
    const parsed = readBalancedJson(text, i);
    if (parsed !== null && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
      return parsed;
    }
  }
  return null;
}

/** Normalises whatever `WebSocket.send` was handed. Blobs are async and return null. */
export function toBytes(data: unknown): Uint8Array | null {
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  if (typeof data === 'string') {
    return encoder.encode(data);
  }
  return null;
}
