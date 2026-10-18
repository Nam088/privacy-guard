import { describe, expect, it } from 'vitest';
import { createSyntheticDgwAck, decodeFrame } from '@/protocol/dgw';

const HEADER = new Uint8Array([
  0x0f, 0x7d, 0x00, 0x02, 0x00, 0x00, 0x7b, 0x7d, 0x0d, 0x7d, 0x00, 0xb1,
]);

function buildBinaryFrame(requestId: number | string, tasks: unknown[] = []): Uint8Array {
  const outer = JSON.stringify({
    app_id: '936619743392459',
    payload: JSON.stringify({
      epoch_id: '1',
      tasks,
      version_id: '2',
    }),
    request_id: requestId,
    type: 3,
  });
  const body = new TextEncoder().encode(outer);
  const out = new Uint8Array(HEADER.length + body.length);
  out.set(HEADER, 0);
  out.set(body, HEADER.length);
  return out;
}

describe('createSyntheticDgwAck', () => {
  it('returns null for null or invalid data', () => {
    expect(createSyntheticDgwAck(null)).toBeNull();
    expect(createSyntheticDgwAck(undefined)).toBeNull();
    expect(createSyntheticDgwAck(new Uint8Array([1, 2, 3]))).toBeNull();
    expect(createSyntheticDgwAck('not json')).toBeNull();
  });

  it('generates synthetic ack for JSON string carrying request_id', () => {
    const raw = JSON.stringify({
      app_id: '123',
      request_id: 42,
      type: 3,
      payload: '{"tasks":[{"label":"21"}]}',
    });

    const result = createSyntheticDgwAck(raw);
    expect(result).not.toBeNull();
    expect(result?.requestId).toBe(42);
    expect(typeof result?.ackData).toBe('string');

    const parsed = JSON.parse(result!.ackData as string);
    expect(parsed.request_id).toBe(42);
    expect(parsed.app_id).toBe('123');
    expect(parsed.success).toBe(true);
  });

  it('generates synthetic ack for binary DGW frame carrying request_id', () => {
    const raw = buildBinaryFrame(999, [{ label: '21', payload: '{"thread_id":"1"}' }]);
    const result = createSyntheticDgwAck(raw);

    expect(result).not.toBeNull();
    expect(result?.requestId).toBe(999);
    expect(result?.ackData instanceof ArrayBuffer).toBe(true);

    const decoded = decodeFrame(new Uint8Array(result!.ackData as ArrayBuffer));
    expect(decoded).toMatchObject({
      request_id: 999,
      app_id: '936619743392459',
      success: true,
    });
  });

  it('preserves header framing when generating binary synthetic ack', () => {
    const raw = buildBinaryFrame(777);
    const result = createSyntheticDgwAck(raw);
    expect(result).not.toBeNull();

    const ackBytes = new Uint8Array(result!.ackData as ArrayBuffer);
    // Header bytes 0 to HEADER.length should match original HEADER
    expect(ackBytes.subarray(0, HEADER.length)).toEqual(HEADER);
  });

  it('returns null if frame has no request_id', () => {
    const outer = JSON.stringify({
      app_id: '936619743392459',
      payload: '{}',
      type: 3,
    });
    const body = new TextEncoder().encode(outer);
    const out = new Uint8Array(HEADER.length + body.length);
    out.set(HEADER, 0);
    out.set(body, HEADER.length);

    expect(createSyntheticDgwAck(out)).toBeNull();
  });
});
