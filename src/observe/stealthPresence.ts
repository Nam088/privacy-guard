import { findJsonBounds, toBytes } from '@/protocol/dgw/frameDecoder';
import { reencodeDgwFrame } from '@/protocol/dgw/frameEncoder';

interface PresenceReportingArguments {
  availability?: number;
  foregrounded?: boolean;
  makeUserAvailableWhenInForeground?: boolean;
  [key: string]: unknown;
}

interface PresencePayload {
  payload?: {
    presenceReportingAmendment?: {
      reportingArguments?: PresenceReportingArguments;
      [key: string]: unknown;
    };
    presenceReportingRequest?: {
      availability?: number;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  presenceReportingRequest?: {
    availability?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

function neutralizePresenceObject(obj: PresencePayload): boolean {
  let changed = false;

  const amendArgs = obj.payload?.presenceReportingAmendment?.reportingArguments;
  if (amendArgs) {
    if (amendArgs.availability !== 2) {
      amendArgs.availability = 2;
      changed = true;
    }
    if (amendArgs.foregrounded !== false) {
      amendArgs.foregrounded = false;
      changed = true;
    }
    if (
      'makeUserAvailableWhenInForeground' in amendArgs &&
      amendArgs.makeUserAvailableWhenInForeground !== false
    ) {
      amendArgs.makeUserAvailableWhenInForeground = false;
      changed = true;
    }
  }

  for (const req of [obj.payload?.presenceReportingRequest, obj.presenceReportingRequest]) {
    if (req && req.availability === 1) {
      req.availability = 2;
      changed = true;
    }
  }

  return changed;
}

/**
 * Transforms presenceReportingAmendment and presenceReportingRequest frames to force offline/away status.
 *
 * Availability:
 * 1 = Active / Online (triggers green dot)
 * 2 = Away / Inactive / Offline (hides green dot)
 * 3 = Offline
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
    if (
      !data.includes('presenceReportingAmendment') &&
      !data.includes('presenceReportingRequest')
    ) {
      return data;
    }
    try {
      const json = JSON.parse(data) as PresencePayload;
      if (neutralizePresenceObject(json)) {
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

  const bounds = findJsonBounds(bytes);
  if (!bounds) {
    return data;
  }

  let decoded: PresencePayload;
  try {
    const jsonStr = new TextDecoder().decode(bytes.subarray(bounds.start, bounds.end));
    decoded = JSON.parse(jsonStr) as PresencePayload;
  } catch {
    return data;
  }

  if (!decoded || typeof decoded !== 'object' || !neutralizePresenceObject(decoded)) {
    return data;
  }

  try {
    const modifiedJsonBytes = new TextEncoder().encode(JSON.stringify(decoded));
    const result = reencodeDgwFrame(bytes, modifiedJsonBytes, bounds.start, bounds.end);

    if (data instanceof ArrayBuffer) {
      return result.buffer;
    }
    return result;
  } catch {
    return data;
  }
}
