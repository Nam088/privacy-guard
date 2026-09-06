import { browser } from '#imports';
import { findSiteForUrl } from '@/sites/registry';
import type { SiteModule } from '@/sites/types';

export interface TabLike {
  url?: string | undefined;
}

export function resolveActiveSite(
  tabs: readonly TabLike[],
): SiteModule | null {
  return findSiteForUrl(tabs[0]?.url);
}

export async function getActiveSite(): Promise<SiteModule | null> {
  try {
    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    return resolveActiveSite(tabs);
  } catch (error) {
    console.warn('[privacy-guard] could not read the active tab', error);
    return null;
  }
}
