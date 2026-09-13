/**
 * Utility functions for stripping tracking identifiers from shared URLs and clipboard contents.
 */

export const TRACKING_PARAMS: ReadonlySet<string> = new Set([
  // Meta Facebook / Messenger tracking tokens
  'fbclid',
  'mibextid',
  'rdid',
  'share_id',
  'ref',
  'ref_component',
  'ref_page',
  'notif_t',
  'notif_id',

  // Meta Instagram tracking tokens
  'igsh',
  'igshid',

  // Standard UTM / Campaign trackers
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',

  // Other ad / marketing click trackers
  'gclid',
  'msclkid',
  'mc_eid',
  'yclid',
  'twclid',
]);

/**
 * Checks if a query parameter key represents a tracking token.
 */
export function isTrackingParam(key: string): boolean {
  const lower = key.toLowerCase();
  if (TRACKING_PARAMS.has(lower)) {
    return true;
  }
  // Meta compound tracking tokens: __cft__[0], __cft__, __tn__
  if (lower.startsWith('__cft') || lower.startsWith('__tn')) {
    return true;
  }
  if (lower.startsWith('utm_')) {
    return true;
  }
  return false;
}

export interface StripResult {
  readonly cleanedUrl: string;
  readonly modified: boolean;
}

/**
 * Strips tracking query parameters from a single URL string.
 * Preserves the original URL if no tracking parameters are found or if parsing fails.
 */
export function stripTrackingParams(urlStr: string): StripResult {
  if (!urlStr || typeof urlStr !== 'string') {
    return { cleanedUrl: urlStr, modified: false };
  }

  try {
    const url = new URL(urlStr);
    const paramsToDelete: string[] = [];

    for (const key of url.searchParams.keys()) {
      if (isTrackingParam(key)) {
        paramsToDelete.push(key);
      }
    }

    if (paramsToDelete.length === 0) {
      return { cleanedUrl: urlStr, modified: false };
    }

    for (const key of paramsToDelete) {
      url.searchParams.delete(key);
    }

    let cleaned = url.toString();
    // If search is now empty, remove trailing '?' if present
    if (cleaned.endsWith('?')) {
      cleaned = cleaned.slice(0, -1);
    }

    return { cleanedUrl: cleaned, modified: true };
  } catch {
    return { cleanedUrl: urlStr, modified: false };
  }
}

export interface CleanTextResult {
  readonly cleanedText: string;
  readonly modified: boolean;
}

/**
 * Regex identifying HTTP/HTTPS URLs embedded in text.
 */
const URL_REGEX = /https?:\/\/[^\s"'<>\\]+/gi;

/**
 * Detects all URLs in a string of text and strips tracking parameters from each.
 */
export function cleanTextUrls(text: string): CleanTextResult {
  if (!text || typeof text !== 'string') {
    return { cleanedText: text, modified: false };
  }

  let modified = false;
  const cleanedText = text.replace(URL_REGEX, (matchedUrl) => {
    const res = stripTrackingParams(matchedUrl);
    if (res.modified) {
      modified = true;
      return res.cleanedUrl;
    }
    return matchedUrl;
  });

  return { cleanedText, modified };
}
