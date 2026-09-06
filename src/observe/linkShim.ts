/**
 * Pure utilities and DOM observers to unwrap and bypass Meta Link Shim redirect tracking.
 *
 * When users click outgoing links, Meta intercepts them via `l.facebook.com/l.php?u=<target>&h=<token>`
 * or `lm.facebook.com/l.php`. This module safely decodes the target URL and rewrites links directly,
 * preventing Meta from recording outgoing destination clicks and accelerating page loads.
 */

const LINK_SHIM_HOSTS = [
  'l.facebook.com',
  'lm.facebook.com',
  'l.messenger.com',
  'l.instagram.com',
] as const;

/**
 * Checks if a given URL string or URL object is a Meta Link Shim redirect URL.
 */
export function isLinkShimUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return false;
  }
  try {
    const parsed = new URL(rawUrl, 'https://www.facebook.com');
    const isShimHost = LINK_SHIM_HOSTS.some(
      (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`),
    );
    const isLPhp = parsed.pathname === '/l.php' || parsed.pathname.endsWith('/l.php');
    return (isShimHost || isLPhp) && parsed.searchParams.has('u');
  } catch {
    return false;
  }
}

/**
 * Safely extracts the destination URL from a Link Shim URL.
 *
 * Validates that the unpacked target is strictly HTTP or HTTPS to eliminate
 * any risk of javascript: or other protocol execution.
 */
export function unwrapLinkShim(rawUrl: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return null;
  }
  try {
    const parsed = new URL(rawUrl, 'https://www.facebook.com');
    const target = parsed.searchParams.get('u');
    if (!target) {
      return null;
    }

    const decoded = decodeURIComponent(target);
    const targetParsed = new URL(decoded);
    if (targetParsed.protocol !== 'http:' && targetParsed.protocol !== 'https:') {
      return null;
    }

    return targetParsed.href;
  } catch {
    return null;
  }
}

/**
 * Rewrites a DOM anchor element if its href or Lynx attributes contain a Link Shim.
 * Returns true if the element was modified.
 */
export function unwrapAnchorElement(anchor: HTMLAnchorElement): boolean {
  let changed = false;
  const href = anchor.getAttribute('href');
  if (href && isLinkShimUrl(href)) {
    const unwrapped = unwrapLinkShim(href);
    if (unwrapped) {
      anchor.setAttribute('href', unwrapped);
      anchor.href = unwrapped;
      changed = true;
    }
  }

  // Clean Meta's Lynx tracking attributes which dynamically swap href on mousedown
  const lynxUri = anchor.getAttribute('data-lynx-uri');
  if (lynxUri && isLinkShimUrl(lynxUri)) {
    const unwrappedLynx = unwrapLinkShim(lynxUri);
    if (unwrappedLynx) {
      anchor.setAttribute('data-lynx-uri', unwrappedLynx);
      changed = true;
    } else {
      anchor.removeAttribute('data-lynx-uri');
      changed = true;
    }
  }

  return changed;
}

/**
 * Attaches capturing event listeners to intercept clicks and mousedown events
 * on anchor tags before Facebook's Lynx tracking handlers can overwrite them.
 */
export function attachLinkShimBypass(
  doc: Document = document,
  isEnabled: () => boolean,
): () => void {
  const handler = (event: Event) => {
    if (!isEnabled()) {
      return;
    }
    const target = event.target as HTMLElement | null;
    const anchor = target?.closest?.('a') as HTMLAnchorElement | null;
    if (anchor) {
      unwrapAnchorElement(anchor);
    }
  };

  // Use capturing phase so we unwrap before Facebook's inline or bubbling click listeners
  const events = ['click', 'auxclick', 'mousedown', 'contextmenu'] as const;
  for (const ev of events) {
    doc.addEventListener(ev, handler, true);
  }

  return () => {
    for (const ev of events) {
      doc.removeEventListener(ev, handler, true);
    }
  };
}
