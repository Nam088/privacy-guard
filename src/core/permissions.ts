import { browser } from '#imports';

export const ALL_URLS = ['<all_urls>'];

async function hasAllUrlsPermission(): Promise<boolean> {
  return browser.permissions.contains({ origins: ALL_URLS });
}

export async function ensureAllUrlsPermission(): Promise<boolean> {
  try {
    if (await hasAllUrlsPermission()) {
      return true;
    }
    return await browser.permissions.request({ origins: ALL_URLS });
  } catch {
    return false;
  }
}
