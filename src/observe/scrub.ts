const MAX_DEPTH = 12;
const SHORT_DIGITS = 3;

// A key that reads like a field name is structure worth keeping. Anything else is treated as
// content, because this data uses identifiers as map keys as readily as it uses them as values.
const FIELD_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,39}$/;

function scrubKey(key: string): string {
  return FIELD_NAME.test(key) ? key : `<key:${key.length}>`;
}

function scrubString(value: string, depth: number): unknown {
  const trimmed = value.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return scrubValue(JSON.parse(trimmed), depth + 1);
    } catch {
      // Not json after all, fall through to the length marker.
    }
  }
  if (new RegExp(`^\\d{1,${SHORT_DIGITS}}$`).test(value)) {
    return value;
  }
  return `<string:${value.length}>`;
}

function scrubValue(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) {
    return '<deep>';
  }
  if (value === null || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    const digits = Math.abs(value).toString().length;
    return digits > SHORT_DIGITS ? `<number:${digits}>` : value;
  }
  if (typeof value === 'string') {
    return scrubString(value, depth);
  }
  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[scrubKey(key)] = scrubValue(item, depth + 1);
    }
    return out;
  }
  return `<${typeof value}>`;
}

export function scrub(value: unknown): unknown {
  return scrubValue(value, 0);
}
