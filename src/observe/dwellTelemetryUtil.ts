/**
 * Dwell Time & Behavior Telemetry Utility.
 *
 * Provides evidence-backed helpers to identify and suppress invasive millisecond-level
 * dwell time, video watch duration, and viewport viewability beacons across Facebook and Instagram.
 */

import { FACEBOOK_SIGNATURES } from '@/sites/facebook/signatures';
import { INSTAGRAM_SIGNATURES } from '@/sites/instagram/signatures';

export const COMMON_DWELL_KEYWORDS: readonly string[] = Array.from(
  new Set([
    ...FACEBOOK_SIGNATURES.dwellTimeKeywords,
    ...INSTAGRAM_SIGNATURES.dwellTimeKeywords,
  ]),
);

export const DWELL_TELEMETRY_PATHS: readonly string[] = Array.from(
  new Set([
    ...FACEBOOK_SIGNATURES.dwellTimePaths,
    ...INSTAGRAM_SIGNATURES.dwellTimePaths,
  ]),
);

export const DWELL_GRAPHQL_OPERATIONS: readonly string[] = Array.from(
  new Set([
    ...FACEBOOK_SIGNATURES.dwellTimeMutations,
    ...INSTAGRAM_SIGNATURES.dwellTimeMutations,
  ]),
);

/**
 * Safely extracts textual representations from diverse request payloads
 * (strings, ArrayBuffers, Views, URLSearchParams, FormData, or plain JSON objects).
 */
export function extractTextFromData(data: unknown): string {
  if (!data) {
    return '';
  }
  if (typeof data === 'string') {
    return data;
  }
  if (
    data instanceof ArrayBuffer ||
    (typeof data === 'object' && Object.prototype.toString.call(data) === '[object ArrayBuffer]')
  ) {
    return new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(data as ArrayBuffer));
  }
  if (ArrayBuffer.isView(data)) {
    return new TextDecoder('utf-8', { fatal: false }).decode(
      new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
    );
  }
  if (typeof URLSearchParams !== 'undefined' && data instanceof URLSearchParams) {
    return data.toString();
  }
  if (typeof data === 'object') {
    try {
      return JSON.stringify(data);
    } catch {
      return '';
    }
  }
  return '';
}

/**
 * Checks if arbitrary payload data matches known dwell time, watch time,
 * or viewport visibility tracking signatures.
 */
export function isDwellTelemetryData(
  data: unknown,
  customKeywords: readonly string[] = COMMON_DWELL_KEYWORDS,
): boolean {
  if (!data) {
    return false;
  }
  const text = extractTextFromData(data).toLowerCase();
  if (!text) {
    return false;
  }
  return customKeywords.some((kw) => text.includes(kw.toLowerCase()));
}

/**
 * Checks if a given request (by URL and optional body) corresponds to a dwell,
 * viewability (VPVD/Banzai), or inline video watch telemetry call that should be suppressed.
 */
export function isDwellTelemetry(url: string, data?: unknown): boolean {
  // 1. Match pure logging / telemetry endpoints (/ajax/bnzai, /ajax/bz, /ajax/merlin/, /logging/client_events/)
  const isPureLoggingEndpoint = DWELL_TELEMETRY_PATHS.some((path) => url.includes(path));

  if (isPureLoggingEndpoint) {
    // Inspect FormData specifically for Banzai (which packages event triggers inside field "q")
    if (typeof FormData !== 'undefined' && data instanceof FormData) {
      try {
        for (const [key, value] of (data as unknown as Iterable<[string, FormDataEntryValue]>)) {
          const k = String(key).toLowerCase();
          if (COMMON_DWELL_KEYWORDS.some((kw) => k.includes(kw.toLowerCase()))) {
            return true;
          }
          if (typeof value === 'string') {
            // Check the field value directly
            if (isDwellTelemetryData(value)) {
              return true;
            }
            // For Banzai 'q' field, inspect embedded JSON triggers
            if (
              k === 'q' &&
              (value.includes('dwell') ||
                value.includes('viewable') ||
                value.includes('vpvd') ||
                value.includes('watch') ||
                value.includes('timespent') ||
                value.includes('ods_web_batch') ||
                value.includes('interaction_tracing') ||
                value.includes('pointer_interaction') ||
                value.includes('hover_dwell') ||
                value.includes('mouse_movement'))
            ) {
              return true;
            }
          }
        }
      } catch {
        return true;
      }
      return false;
    }

    // Inspect URL encoded or string/object payloads
    return isDwellTelemetryData(data);
  }

  // 2. Match dedicated GraphQL telemetry operations (e.g. FalcoServer, VPVD queries)
  if (url.includes('/api/graphql') || url.includes('/graphql/query')) {
    const text = extractTextFromData(data);
    if (!text) {
      return false;
    }
    const hasDwellOp = DWELL_GRAPHQL_OPERATIONS.some((op) => text.includes(op));
    if (hasDwellOp && isDwellTelemetryData(data)) {
      return true;
    }
    return false;
  }

  return false;
}
