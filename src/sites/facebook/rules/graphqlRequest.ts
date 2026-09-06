/**
 * Shared targeting for the HTTP rules: which requests belong to us, and what operations they
 * carry.
 *
 * Both HTTP rules used to fall back to running their signature regex across the whole request
 * body. That reads well until you notice what it costs: an unanchored pattern over tens of
 * kilobytes matched a feed query whose text merely contained the right words, and the request was
 * then answered with a synthetic 200, so the failure was invisible. Naming the operations first
 * and matching only those replaces a guess with a fact.
 */

import { extractGraphQLOperation } from '@/protocol/graphql/parser';
import { findSiteForUrl } from '@/sites/registry';

/** The GraphQL endpoints on a Meta host. Shared, because both HTTP rules watch the same ones. */
export const GRAPHQL_PATHS: readonly string[] = ['/api/graphql/', '/graphql/'];

/** The origin a relative request URL is read against. Only the pathname is taken from it. */
const RELATIVE_BASE = 'https://www.facebook.com';

const NAME_KEYS = ['fb_api_req_friendly_name', 'operationName'];

/**
 * Parses a request URL and confirms it is a Meta GraphQL endpoint.
 *
 * The host check is the point. Without it any request whose path merely contained `/graphql/`
 * was inspected and could be dropped, third party analytics endpoints included.
 */
export function parseGraphQLUrl(url: string, allowedSite?: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(url, RELATIVE_BASE);
  } catch {
    return null;
  }

  const site = findSiteForUrl(parsed.href);
  if (!site) {
    return null;
  }
  if (allowedSite && site.id !== allowedSite) {
    return null;
  }
  if (site.id !== 'facebook' && site.id !== 'instagram') {
    return null;
  }

  const pathname = parsed.pathname;
  const isGraph =
    GRAPHQL_PATHS.some((path) => pathname.includes(path)) ||
    pathname === '/api/graphql' ||
    pathname === '/graphql';

  if (!isGraph) {
    return null;
  }

  return parsed;
}

/** Whether a URL points at a Meta endpoint this module is allowed to touch. */
export function isFacebookUrl(url: string): boolean {
  try {
    return findSiteForUrl(new URL(url, RELATIVE_BASE).href)?.id === 'facebook';
  } catch {
    return false;
  }
}

function addName(names: Set<string>, value: string | null | undefined): void {
  if (typeof value === 'string' && value.length > 0) {
    names.add(value);
  }
}

/**
 * Reads operation names straight out of the raw text of a body.
 *
 * This exists for batched requests, where the structured parser returns only the first operation.
 * It reads the values of the name keys rather than scanning for signatures, so an operation name
 * is still the only thing ever matched against.
 */
function scanRawNames(text: string, names: Set<string>): void {
  for (const key of NAME_KEYS) {
    const urlEncoded = new RegExp(`${key}=([^&\\s]+)`, 'gi');
    let match = urlEncoded.exec(text);
    while (match !== null) {
      const raw = match[1];
      if (raw !== undefined) {
        try {
          addName(names, decodeURIComponent(raw.replace(/\+/g, ' ')));
        } catch {
          addName(names, raw);
        }
      }
      match = urlEncoded.exec(text);
    }

    const json = new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`, 'gi');
    match = json.exec(text);
    while (match !== null) {
      addName(names, match[1]);
      match = json.exec(text);
    }
  }
}

/**
 * Every GraphQL operation this request carries, from the query string, the structured body, and a
 * raw scan for the batched case.
 *
 * An empty result means nothing could be identified, which is a reason to leave the request alone
 * rather than a reason to guess at it.
 */
export function collectOperationNames(parsedUrl: URL, body: unknown): readonly string[] {
  const names = new Set<string>();

  addName(names, parsedUrl.searchParams.get('fb_api_req_friendly_name'));
  addName(names, parsedUrl.searchParams.get('operationName'));

  const op = extractGraphQLOperation(body);
  if (op) {
    addName(names, op.friendlyName);
  }

  if (typeof body === 'string') {
    scanRawNames(body, names);
  }

  return [...names];
}

/**
 * Turns a set of operation names into a verdict, under the same law the WebSocket path obeys:
 * drop only when every operation in the request is one we suppress, and report the rest as mixed
 * so a leak is counted rather than paid for with a broken request.
 */
export function decideByOperationNames(
  names: readonly string[],
  isSignal: (name: string) => boolean,
): 'pass' | 'drop' | 'mixed' {
  if (names.length === 0) {
    return 'pass';
  }
  const signal = names.filter(isSignal);
  if (signal.length === 0) {
    return 'pass';
  }
  if (signal.length !== names.length) {
    return 'mixed';
  }
  return 'drop';
}
