/**
 * Clean Share Links Hook.
 *
 * Automatically sanitizes tracking parameters (mibextid, rdid, igsh, utm_*, etc.)
 * from URLs when copying links or text to clipboard on Facebook and Instagram.
 */

import { cleanTextUrls } from './cleanShareUtil';

export function installCleanShareHook(
  win: Window,
  isActive: () => boolean,
): () => void {
  if (!win || typeof win.addEventListener !== 'function') {
    return () => {};
  }

  // 1. Intercept document "copy" events (triggered by user selection Ctrl+C / Cmd+C or context menu)
  function handleCopy(event: ClipboardEvent): void {
    if (!isActive()) {
      return;
    }

    try {
      const selection = win.getSelection()?.toString() || '';
      if (!selection) {
        return;
      }

      const { cleanedText, modified } = cleanTextUrls(selection);
      if (modified && event.clipboardData) {
        event.clipboardData.setData('text/plain', cleanedText);
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    } catch {
      // Ignore clipboard access errors
    }
  }

  win.addEventListener('copy', handleCopy, true);

  // 2. Intercept navigator.clipboard.writeText (called by Meta's "Copy Link" buttons)
  let originalWriteText: ((text: string) => Promise<void>) | undefined;
  const nav = win.navigator;
  if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
    originalWriteText = nav.clipboard.writeText.bind(nav.clipboard);
    nav.clipboard.writeText = async function (text: string): Promise<void> {
      if (isActive() && typeof text === 'string') {
        const { cleanedText } = cleanTextUrls(text);
        return originalWriteText!(cleanedText);
      }
      return originalWriteText!(text);
    };
  }

  return () => {
    win.removeEventListener('copy', handleCopy, true);
    if (nav && nav.clipboard && originalWriteText) {
      nav.clipboard.writeText = originalWriteText;
    }
  };
}
