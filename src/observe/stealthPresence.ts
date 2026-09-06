import { decodeFrame, toBytes } from '@/protocol/dgw/frameDecoder';

/**
 * Transforms presenceReportingAmendment frames to force offline/away status.
 *
 * Availability:
 * 1 = Active / Online (triggers green dot)
 * 2 = Away / Inactive / Offline (hides green dot)
 * Foregrounded:
 * true = Tab focused / typing
 * false = Tab blurred / backgrounded
 */
export function transformStreamControllerPresence(url: string, data: unknown): unknown {
  if (!url.includes('/ws/streamcontroller')) {
    return data;
  }

  // Handle string payload
  if (typeof data === 'string') {
    if (!data.includes('presenceReportingAmendment')) {
      return data;
    }
    try {
      const json = JSON.parse(data);
      if (json?.payload?.presenceReportingAmendment?.reportingArguments) {
        json.payload.presenceReportingAmendment.reportingArguments.availability = 2;
        json.payload.presenceReportingAmendment.reportingArguments.foregrounded = false;
        return JSON.stringify(json);
      }
    } catch {
      return data;
    }
    return data;
  }

  // Handle binary payload (Uint8Array, ArrayBuffer, Buffer)
  const bytes = toBytes(data);
  if (!bytes || bytes.length < 14) {
    return data;
  }

  const decoded = decodeFrame(bytes);
  if (
    !decoded ||
    typeof decoded !== 'object' ||
    !(decoded as Record<string, unknown>).payload
  ) {
    return data;
  }

  const root = decoded as {
    payload?: {
      presenceReportingAmendment?: {
        reportingArguments?: {
          availability?: number;
          foregrounded?: boolean;
          [key: string]: unknown;
        };
      };
    };
  };

  const args = root.payload?.presenceReportingAmendment?.reportingArguments;
  if (!args) {
    return data;
  }

  args.availability = 2;
  args.foregrounded = false;

  try {
    let jsonStart = -1;
    for (let i = 0; i < bytes.length; i += 1) {
      if (bytes[i] === 0x7b) {
        jsonStart = i;
        break;
      }
    }
    if (jsonStart === -1) {
      return data;
    }

    const modifiedJsonBytes = new TextEncoder().encode(JSON.stringify(root));
    const headerBytes = bytes.subarray(0, jsonStart);
    const result = new Uint8Array(headerBytes.length + modifiedJsonBytes.length);
    result.set(headerBytes, 0);
    result.set(modifiedJsonBytes, headerBytes.length);

    if (data instanceof ArrayBuffer) {
      return result.buffer;
    }
    return result;
  } catch {
    return data;
  }
}
