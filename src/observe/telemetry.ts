/**
 * Dwell Time & Behavior Telemetry Scrambler.
 *
 * Blocks invasive millisecond-level dwell time, video watch duration,
 * and viewability beacons dispatched via navigator.sendBeacon and /ajax/bz.
 */

export interface TelemetryScope {
  navigator?: {
    sendBeacon?: (url: string | URL, data?: BodyInit | null) => boolean;
  };
}

const INSTALLED = new WeakSet<object>();

import { FACEBOOK_SIGNATURES } from '@/sites/facebook/signatures';

export function isDwellTelemetryData(data: unknown): boolean {
  if (!data) {
    return false;
  }
  let text = '';
  if (typeof data === 'string') {
    text = data;
  } else if (
    data instanceof ArrayBuffer ||
    (typeof data === 'object' && Object.prototype.toString.call(data) === '[object ArrayBuffer]')
  ) {
    text = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(data as ArrayBuffer));
  } else if (ArrayBuffer.isView(data)) {
    text = new TextDecoder('utf-8', { fatal: false }).decode(
      new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
    );
  }
  const lower = text.toLowerCase();
  return FACEBOOK_SIGNATURES.dwellTimeKeywords.some((kw) => lower.includes(kw));
}

function isDwellTelemetry(url: string, data?: unknown): boolean {
  if (url.includes('/ajax/bz') || url.includes('/ajax/browser_metrics')) {
    if (data instanceof FormData) {
      return true;
    }
    return isDwellTelemetryData(data);
  }
  return false;
}

export function installTelemetryScrambler(
  scope: TelemetryScope,
  isScrambleActive: () => boolean,
): () => void {
  const nav = scope.navigator;
  if (!nav || typeof nav.sendBeacon !== 'function' || INSTALLED.has(scope)) {
    return () => {};
  }
  INSTALLED.add(scope);

  const originalSendBeacon = nav.sendBeacon;

  nav.sendBeacon = function (url: string | URL, data?: BodyInit | null): boolean {
    const urlStr = String(url);
    if (isScrambleActive() && isDwellTelemetry(urlStr, data)) {
      // Pretend to successfully enqueue without transmitting
      return true;
    }
    return originalSendBeacon.call(this, url, data);
  };

  return () => {
    nav.sendBeacon = originalSendBeacon;
    INSTALLED.delete(scope);
  };
}
