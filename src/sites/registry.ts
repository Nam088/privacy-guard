import { facebook } from './facebook';
import { instagram } from './instagram';
import type { SiteModule } from './types';

export const SITE_MODULES: readonly SiteModule[] = [facebook, instagram];

const HTTP_SCHEMES = new Set(['http:', 'https:']);

function hostMatches(hostname: string, host: string): boolean {
  return hostname === host || hostname.endsWith(`.${host}`);
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
