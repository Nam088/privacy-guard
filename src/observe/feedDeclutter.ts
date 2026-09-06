/**
 * Facebook Comet Feed Decluttering Engine.
 *
 * Suppresses unwanted feed units without breaking React's virtual DOM reconciliation:
 * 1. Sponsored Posts / Advertisements: Statutory transparency links (/ads/about/, /about/ads),
 *    immutable backend metadata (article[data-ft*="sponsored_ad"], .sponsored_ad),
 *    call-to-action roles ([data-ad-rendering-role^="cta"]),
 *    profile-name ad slot ([data-ad-rendering-role="profile_name"]),
 *    obfuscated SVG Sponsored labels with internal hash anchors (a[href*="#?abf"]),
 *    and anti-adblock decoy node clusters (div[data-0][data-1][data-2]).
 * 2. Suggested Posts & Short Video Trays: Posts from unfollowed entities
 *    detected by a Follow/Theo-doi button that is NOT inside an ad container,
 *    and video tray navigation paths (/reel/, /reels/, [data-pagelet*="Reels"]).
 *
 * Feed containers: Supports standard FeedUnit pagelets (div[data-pagelet^="FeedUnit_"])
 * and virtualized feed items (div[data-virtualized="false"]).
 *
 * NOTE: data-ad-rendering-role is an ad-only attribute. It must NEVER be used as a
 * suggested-post signal — all its values belong to the Sponsored category.
 */

export const DECLUTTER_SPONSORED_STYLE_ID = 'fb-security-sponsored-style';
export const DECLUTTER_SUGGESTED_STYLE_ID = 'fb-security-suggested-style';
export const DECLUTTER_REELS_STYLE_ID = 'fb-security-reels-style';
export const DECLUTTER_STYLE_ID = 'fb-security-declutter-style';

export const SPONSORED_HIDDEN_CLASS = 'fb-sec-sponsored-hidden';
export const SUGGESTED_HIDDEN_CLASS = 'fb-sec-suggested-hidden';
export const REELS_HIDDEN_CLASS = 'fb-sec-reels-hidden';
export const DECLUTTER_HIDDEN_CLASS = 'fb-sec-declutter-hidden';

export const SPONSORED_CSS = `
/* Sponsored Ads (Language-Agnostic) */
div[data-pagelet^="FeedUnit_"]:has(a[href*="/ads/about/"]),
div[data-pagelet^="FeedUnit_"]:has(a[href*="/about/ads"]),
div[data-pagelet^="FeedUnit_"]:has(article[data-ft*="sponsored_ad"]),
div[data-pagelet^="FeedUnit_"]:has(.sponsored_ad),
div[data-pagelet^="FeedUnit_"]:has([data-ad-rendering-role^="cta"]),
div[data-pagelet^="FeedUnit_"]:has(a[href*="#?abf"]),
div[data-pagelet^="FeedUnit_"]:has(div[data-0][data-1][data-2]),

div[data-virtualized="false"]:has(a[href*="/ads/about/"]),
div[data-virtualized="false"]:has(a[href*="/about/ads"]),
div[data-virtualized="false"]:has(article[data-ft*="sponsored_ad"]),
div[data-virtualized="false"]:has(.sponsored_ad),
div[data-virtualized="false"]:has([data-ad-rendering-role^="cta"]),
div[data-virtualized="false"]:has(a[href*="#?abf"]),
div[data-virtualized="false"]:has(div[data-0][data-1][data-2]),

.${SPONSORED_HIDDEN_CLASS} {
  display: none !important;
  height: 0 !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  visibility: hidden !important;
}
`;

export const SUGGESTED_CSS = `
/* Suggested Posts — unfollowed pages/creators */
div[data-pagelet^="FeedUnit_"]:has([data-ad-rendering-role="profile_name"] h4 [role="button"]),
div[data-pagelet^="FeedUnit_"]:has([data-ad-rendering-role="profile_name"] h4 button),
div[data-virtualized="false"]:has([data-ad-rendering-role="profile_name"] h4 [role="button"]),
div[data-virtualized="false"]:has([data-ad-rendering-role="profile_name"] h4 button),

.${SUGGESTED_HIDDEN_CLASS} {
  display: none !important;
  height: 0 !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  visibility: hidden !important;
}
`;

export const REELS_CSS = `
/* Reels / Short Video trays */
div[data-pagelet^="FeedUnit_"]:has(a[href*="/reel/"]),
div[data-pagelet^="FeedUnit_"]:has(a[href*="/reels/"]),
div[data-pagelet^="FeedUnit_"]:has([data-pagelet*="Reels"]),
div[data-pagelet^="FeedUnit_"]:has([data-pagelet*="ShortVideos"]),
div[data-virtualized="false"]:has(a[href*="/reel/"]),
div[data-virtualized="false"]:has(a[href*="/reels/"]),
div[data-virtualized="false"]:has([data-pagelet*="Reels"]),
div[data-virtualized="false"]:has([data-pagelet*="ShortVideos"]),

.${REELS_HIDDEN_CLASS} {
  display: none !important;
  height: 0 !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  visibility: hidden !important;
}
`;

// Provides CSS backing for the DECLUTTER_HIDDEN_CLASS marker added by sweepFeed.
// Deliberately does NOT include SPONSORED_CSS or SUGGESTED_CSS selectors — those
// are injected via their own dedicated stylesheets so they can be toggled
// independently. Mixing them here caused both to activate whenever either
// mode was enabled.
const DECLUTTER_CLASS_CSS = `
.${DECLUTTER_HIDDEN_CLASS} {
  display: none !important;
  height: 0 !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  visibility: hidden !important;
}
`;

/**
 * Checks whether a feed unit element is a sponsored advertisement.
 * Completely language-independent.
 */
export function isSponsoredPost(element: Element): boolean {
  // 1. Legal transparency links
  const adAboutLink = element.querySelector('a[href*="/ads/about/"], a[href*="/about/ads"]');
  if (adAboutLink) {
    return true;
  }

  // 2. Backend data-ft JSON marker
  const articleAd = element.querySelector('article[data-ft*="sponsored_ad"]');
  if (articleAd) {
    return true;
  }
  if (element.matches('article[data-ft*="sponsored_ad"]')) {
    return true;
  }

  // 3. Internal sponsored_ad CSS class
  const classAd = element.querySelector('.sponsored_ad');
  if (classAd) {
    return true;
  }
  if (element.classList.contains('sponsored_ad')) {
    return true;
  }

  // 4. Call-to-action rendering role (cta-* values are ad-exclusive).
  //    NOTE: do NOT broaden to [data-ad-rendering-role] without a value filter —
  //    profile_name and story_message appear on organic posts too.
  const ctaButton = element.querySelector('[data-ad-rendering-role^="cta"]');
  if (ctaButton) {
    return true;
  }

  // 5. Obfuscated SVG Sponsored label with internal hash anchor
  const sponsoredHashLink = element.querySelector('a[href*="#?abf"]');
  if (sponsoredHashLink) {
    return true;
  }

  // 6. Decoy anti-adblock nodes with indexed data attributes
  const decoyNode = element.querySelector('div[data-0][data-1][data-2]');
  if (decoyNode) {
    return true;
  }

  return false;
}

/**
 * Checks whether a feed unit element is a suggested post or video tray.
 *
 * Two types of suggested posts exist on Facebook Comet:
 *
 * Type 1 — Unfollowed page: a Follow/Subscribe button appears inside the
 *   profile_name h4 header next to the page name.
 *
 * Type 2 — Algorithm recommendation: Facebook places "Gợi ý cho bạn" /
 *   "Suggested for you" text in the metadata row directly below the page name.
 *   This type may appear even for pages the user follows or has liked.
 *   CSS selectors cannot match text content, so this is JS-only detection.
 */
export function isSuggestedPost(element: Element): boolean {
  // If this feed unit is a Reels or short video tray, it is handled under the Reels category
  if (isReelsPost(element)) {
    return false;
  }

  // 1. Type 1: Unfollowed page with Follow/Subscribe button in profile header h4
  const profileHeader = element.querySelector('[data-ad-rendering-role="profile_name"] h4');
  if (profileHeader) {
    const followAction = profileHeader.querySelector('[role="button"], button');
    if (followAction) {
      return true;
    }
  }

  // 2. Type 2: "Gợi ý cho bạn" / "Suggested for you" label in the metadata row.
  //    The metadata row is the next sibling of the profile_name container
  //    (profile_name sits in a span inside a row div; the metadata row is adjacent).
  const profileNameEl = element.querySelector('[data-ad-rendering-role="profile_name"]');
  if (profileNameEl) {
    const metadataRow = profileNameEl.parentElement?.parentElement?.nextElementSibling;
    if (metadataRow) {
      const metaText = metadataRow.textContent ?? '';
      if (metaText.includes('Gợi ý cho bạn') || metaText.includes('Suggested for you')) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Checks whether a feed unit element is a Reels or short video tray / post.
 */
export function isReelsPost(element: Element): boolean {
  const reelLink = element.querySelector('a[href*="/reel/"], a[href*="/reels/"]');
  if (reelLink) {
    return true;
  }
  const pageletAttr = element.getAttribute('data-pagelet');
  if (pageletAttr) {
    if (pageletAttr.includes('Reels') || pageletAttr.includes('ShortVideos')) {
      return true;
    }
  }
  return false;
}

/**
 * Checks whether a feed unit DOM container is unwanted under either category.
 * Provided for backwards compatibility with tests and composite callers.
 */
export function isFeedUnitUnwanted(element: Element): boolean {
  if (isSponsoredPost(element)) {
    return true;
  }
  if (isSuggestedPost(element)) {
    return true;
  }
  if (isReelsPost(element)) {
    return true;
  }
  return false;
}

export interface FeedDeclutterOptions {
  readonly isSponsoredActive?: () => boolean;
  readonly isSuggestedActive?: () => boolean;
  readonly isReelsActive?: () => boolean;
  readonly isFeedDeclutterActive?: () => boolean;
}

export type FeedDeclutterPredicate = (() => boolean) | FeedDeclutterOptions;

function resolvePredicates(options: FeedDeclutterPredicate): {
  isSponsored: () => boolean;
  isSuggested: () => boolean;
  isReels: () => boolean;
} {
  if (typeof options === 'function') {
    return {
      isSponsored: options,
      isSuggested: options,
      isReels: options,
    };
  }

  let isSponsored = () => false;
  if (options.isSponsoredActive) {
    isSponsored = options.isSponsoredActive;
  } else if (options.isFeedDeclutterActive) {
    isSponsored = options.isFeedDeclutterActive;
  }

  let isSuggested = () => false;
  if (options.isSuggestedActive) {
    isSuggested = options.isSuggestedActive;
  } else if (options.isFeedDeclutterActive) {
    isSuggested = options.isFeedDeclutterActive;
  }

  let isReels = () => false;
  if (options.isReelsActive) {
    isReels = options.isReelsActive;
  } else if (options.isFeedDeclutterActive) {
    isReels = options.isFeedDeclutterActive;
  }

  return {
    isSponsored,
    isSuggested,
    isReels,
  };
}

function ensureStyleSheet(
  doc: Document,
  styleId: string,
  cssContent: string,
): HTMLStyleElement | null {
  let styleEl = doc.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = doc.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = cssContent;
    const targetHead = doc.head || doc.documentElement;
    if (targetHead) {
      targetHead.appendChild(styleEl);
    }
  }
  return styleEl;
}

/**
 * Sweeps the DOM and applies hidden classes to unwanted feed units based on active modes.
 */
function sweepFeed(
  doc: Document,
  isSponsored: () => boolean,
  isSuggested: () => boolean,
  isReels: () => boolean,
): void {
  const sponsoredOn = isSponsored();
  const suggestedOn = isSuggested();
  const reelsOn = isReels();

  const sponsoredStyle = doc.getElementById(DECLUTTER_SPONSORED_STYLE_ID) as HTMLStyleElement | null;
  if (sponsoredStyle) {
    sponsoredStyle.disabled = !sponsoredOn;
  }

  const suggestedStyle = doc.getElementById(DECLUTTER_SUGGESTED_STYLE_ID) as HTMLStyleElement | null;
  if (suggestedStyle) {
    suggestedStyle.disabled = !suggestedOn;
  }

  const reelsStyle = doc.getElementById(DECLUTTER_REELS_STYLE_ID) as HTMLStyleElement | null;
  if (reelsStyle) {
    reelsStyle.disabled = !reelsOn;
  }

  const legacyStyle = doc.getElementById(DECLUTTER_STYLE_ID) as HTMLStyleElement | null;
  if (legacyStyle) {
    legacyStyle.disabled = !(sponsoredOn || suggestedOn || reelsOn);
  }

  const feedUnits = doc.querySelectorAll('div[data-pagelet^="FeedUnit_"], div[data-virtualized="false"]');
  for (let i = 0; i < feedUnits.length; i += 1) {
    const unit = feedUnits[i];
    if (unit) {
      const isSponsored = isSponsoredPost(unit);
      const isSuggested = isSuggestedPost(unit);
      const isReels = isReelsPost(unit);

      if (sponsoredOn && isSponsored) {
        unit.classList.add(SPONSORED_HIDDEN_CLASS);
        unit.classList.add(DECLUTTER_HIDDEN_CLASS);
      } else {
        unit.classList.remove(SPONSORED_HIDDEN_CLASS);
      }

      if (suggestedOn && isSuggested) {
        unit.classList.add(SUGGESTED_HIDDEN_CLASS);
        unit.classList.add(DECLUTTER_HIDDEN_CLASS);
      } else {
        unit.classList.remove(SUGGESTED_HIDDEN_CLASS);
      }

      if (reelsOn && isReels) {
        unit.classList.add(REELS_HIDDEN_CLASS);
        unit.classList.add(DECLUTTER_HIDDEN_CLASS);
      } else {
        unit.classList.remove(REELS_HIDDEN_CLASS);
      }

      if (
        (!sponsoredOn || !isSponsored) &&
        (!suggestedOn || !isSuggested) &&
        (!reelsOn || !isReels)
      ) {
        unit.classList.remove(DECLUTTER_HIDDEN_CLASS);
      }
    }
  }
}

/**
 * Installs stylesheet and dynamic mutation observer for feed decluttering.
 */
export function installFeedDeclutterHook(
  win: Window,
  options: FeedDeclutterPredicate,
): () => void {
  const doc = win.document;
  if (!doc) {
    return () => {};
  }

  const { isSponsored, isSuggested, isReels } = resolvePredicates(options);

  // 1. Inject or reuse dedicated stylesheets
  const sponsoredStyle = ensureStyleSheet(doc, DECLUTTER_SPONSORED_STYLE_ID, SPONSORED_CSS);
  const suggestedStyle = ensureStyleSheet(doc, DECLUTTER_SUGGESTED_STYLE_ID, SUGGESTED_CSS);
  const reelsStyle = ensureStyleSheet(doc, DECLUTTER_REELS_STYLE_ID, REELS_CSS);
  const legacyStyle = ensureStyleSheet(doc, DECLUTTER_STYLE_ID, DECLUTTER_CLASS_CSS);

  if (sponsoredStyle) {
    sponsoredStyle.disabled = !isSponsored();
  }

  if (suggestedStyle) {
    suggestedStyle.disabled = !isSuggested();
  }

  if (reelsStyle) {
    reelsStyle.disabled = !isReels();
  }

  if (legacyStyle) {
    legacyStyle.disabled = !(isSponsored() || isSuggested() || isReels());
  }

  // 2. Initial sweep
  sweepFeed(doc, isSponsored, isSuggested, isReels);

  // 3. Observe dynamic feed pagination
  let mutationScheduled = false;
  let observer: MutationObserver | null = null;

  if (typeof MutationObserver === 'function') {
    observer = new MutationObserver(() => {
      if (mutationScheduled) {
        return;
      }
      mutationScheduled = true;
      const onSchedule = () => {
        mutationScheduled = false;
        sweepFeed(doc, isSponsored, isSuggested, isReels);
      };
      if (typeof win.requestAnimationFrame === 'function') {
        win.requestAnimationFrame(onSchedule);
      } else {
        setTimeout(onSchedule, 16);
      }
    });

    const targetNode = doc.body || doc.documentElement;
    if (targetNode) {
      observer.observe(targetNode, {
        childList: true,
        subtree: true,
      });
    }
  }

  // Periodic safety check for state toggle transitions
  let checkInterval: ReturnType<typeof setInterval> | null = null;
  if (typeof setInterval === 'function') {
    checkInterval = setInterval(() => {
      sweepFeed(doc, isSponsored, isSuggested, isReels);
    }, 50);
  }

  // 4. Return clean teardown function
  return () => {
    if (checkInterval) {
      clearInterval(checkInterval);
    }
    if (observer) {
      observer.disconnect();
    }
    const spStyle = doc.getElementById(DECLUTTER_SPONSORED_STYLE_ID);
    if (spStyle) {
      spStyle.remove();
    }
    const sgStyle = doc.getElementById(DECLUTTER_SUGGESTED_STYLE_ID);
    if (sgStyle) {
      sgStyle.remove();
    }
    const rlStyle = doc.getElementById(DECLUTTER_REELS_STYLE_ID);
    if (rlStyle) {
      rlStyle.remove();
    }
    const legStyle = doc.getElementById(DECLUTTER_STYLE_ID);
    if (legStyle) {
      legStyle.remove();
    }
    const hiddenNodes = doc.querySelectorAll(
      `.${SPONSORED_HIDDEN_CLASS}, .${SUGGESTED_HIDDEN_CLASS}, .${REELS_HIDDEN_CLASS}, .${DECLUTTER_HIDDEN_CLASS}`,
    );
    for (let i = 0; i < hiddenNodes.length; i += 1) {
      const node = hiddenNodes[i];
      if (node) {
        node.classList.remove(SPONSORED_HIDDEN_CLASS);
        node.classList.remove(SUGGESTED_HIDDEN_CLASS);
        node.classList.remove(REELS_HIDDEN_CLASS);
        node.classList.remove(DECLUTTER_HIDDEN_CLASS);
      }
    }
  };
}
