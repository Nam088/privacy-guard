import { findJsonBounds, toBytes } from './frameDecoder';

export interface SyntheticAckResult {
  readonly requestId: string | number;
  readonly ackData: ArrayBuffer | string;
}

/**
 * Creates a synthetic response frame (ACK) for a suppressed outbound DGW request.
 *
 * When Lightspeed or Realtime frames carrying a request_id are dropped by suppression rules,
 * the client-side task queue waits sequentially for a response ACK matching that request_id.
 * If no response arrives, the queue blocks for up to 30s before aborting with ESTABLISHMENT_TIMEOUT,
 * causing subsequent outbound user messages on the same thread to stay stuck in "Sending...".
 *
 * This function extracts the request_id from the dropped frame and constructs an immediate
 * synthetic success response preserving the connection's binary header framing.
 */
export function createSyntheticDgwAck(data: unknown): SyntheticAckResult | null {
  if (data == null) {
    return null;
  }

  // Handle string data (JSON)
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object') {
        const rawRequestId = parsed.request_id ?? parsed.requestId;
        if (rawRequestId !== undefined && rawRequestId !== null) {
          const requestId = rawRequestId as string | number;
          const ackObj = {
            app_id: parsed.app_id ?? '936619743392459',
            request_id: requestId,
            type: parsed.type ?? 3,
            payload: JSON.stringify({
              epoch_id: '0',
              tasks: [],
              version_id: '0',
              success: true,
            }),
            success: true,
          };
          return {
            requestId,
            ackData: JSON.stringify(ackObj),
          };
        }
      }
    } catch {
      return null;
    }
    return null;
  }

  // Handle binary data (ArrayBuffer, Uint8Array, Buffer)
  const bytes = toBytes(data);
  if (!bytes || bytes.length < 8) {
    return null;
  }

  const bounds = findJsonBounds(bytes);
  if (!bounds) {
    return null;
  }

  try {
    const jsonStr = new TextDecoder().decode(bytes.subarray(bounds.start, bounds.end));
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const rawRequestId = parsed.request_id ?? parsed.requestId;
    if (rawRequestId === undefined || rawRequestId === null) {
      return null;
    }

    const requestId = rawRequestId as string | number;
    const ackObj = {
      app_id: parsed.app_id ?? '936619743392459',
      request_id: requestId,
      type: parsed.type ?? 3,
      payload: JSON.stringify({
        epoch_id: '0',
        tasks: [],
        version_id: '0',
        success: true,
      }),
      success: true,
    };

    const newJsonBytes = new TextEncoder().encode(JSON.stringify(ackObj));
    const header = bytes.subarray(0, bounds.start);
    const tail = bytes.subarray(bounds.end);

    const out = new Uint8Array(header.length + newJsonBytes.length + tail.length);
    out.set(header, 0);
    out.set(newJsonBytes, header.length);
    out.set(tail, header.length + newJsonBytes.length);

    const buffer = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
    return {
      requestId,
      ackData: buffer,
    };
  } catch {
    return null;
  }
}
