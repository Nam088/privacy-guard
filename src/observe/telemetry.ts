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

export {
  COMMON_DWELL_KEYWORDS,
  DWELL_TELEMETRY_PATHS,
  DWELL_GRAPHQL_OPERATIONS,
  extractTextFromData,
  isDwellTelemetryData,
  isDwellTelemetry,
} from './dwellTelemetryUtil';

import { isDwellTelemetry } from './dwellTelemetryUtil';

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
