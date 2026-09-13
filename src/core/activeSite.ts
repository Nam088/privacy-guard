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

export async function getActiveSite(timeoutMs: number = 300): Promise<SiteModule | null> {
  try {
    const queryPromise = browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('tabs.query timeout')), timeoutMs),
    );
    const tabs = (await Promise.race([queryPromise, timeoutPromise])) as TabLike[];
    return resolveActiveSite(tabs);
  } catch (error) {
    return null;
  }
}
