import { facebook } from './facebook';
import { instagram } from './instagram';
import type { SiteModule } from './types';

export const SITE_MODULES: readonly SiteModule[] = [facebook, instagram];

const HTTP_SCHEMES = new Set(['http:', 'https:']);

function hostMatches(hostname: string, host: string): boolean {
  return hostname === host || hostname.endsWith(`.${host}`);
}

/**
 * Hosts that serve nothing but messaging, and inbox path prefixes on the hosts that serve both.
 * Kept as a prefix list rather than a regex so a lookalike route (/messagesomething, /directory)
 * cannot be mistaken for the inbox. Messenger's own /t/ and /e2ee/ routes need no entry: they
 * only ever appear under messenger.com or under /messages, both already covered. A bare /t entry
 * would be worse than useless, since Instagram allows single-character usernames.
 */
const MESSAGING_HOSTS = ['messenger.com'];
const MESSAGING_PATH_PREFIXES = ['/messages', '/direct'];

function pathMatches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Whether the URL is a messaging surface rather than a browsing one.
 *
 * Features that fake an always-foreground tab belong on the feed, not the inbox: a conversation
 * has no reading position to hold, and a client that believes it never lost focus skips the
 * resync it would otherwise run on the way back, which is how a send ends up stuck.
 */
export function isMessagingSurface(url: string | undefined): boolean {
  if (!url) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (!HTTP_SCHEMES.has(parsed.protocol)) {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();
  if (MESSAGING_HOSTS.some((host) => hostMatches(hostname, host))) {
    return true;
  }

  const pathname = parsed.pathname.toLowerCase();
  return MESSAGING_PATH_PREFIXES.some((prefix) => pathMatches(pathname, prefix));
}

export function findSiteForUrl(url: string | undefined): SiteModule | null {
  if (!url) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (!HTTP_SCHEMES.has(parsed.protocol)) {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();
  return (
    SITE_MODULES.find((module) =>
      module.hosts.some((host) => hostMatches(hostname, host)),
    ) ?? null
  );
}
