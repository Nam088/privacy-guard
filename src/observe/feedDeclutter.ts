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

import {
  MULTI_LANG_SPONSORED_REGEX,
  MULTI_LANG_SUGGESTED_REGEX,
  collectFeedUnits,
  ensureStyleSheet,
  isFeedContainer,
  isInstagramAd,
  isInstagramSuggested,
} from './feedDeclutterUtil';

export { isFeedContainer };

export const DECLUTTER_SPONSORED_STYLE_ID = 'fb-security-sponsored-style';
export const DECLUTTER_SUGGESTED_STYLE_ID = 'fb-security-suggested-style';
export const DECLUTTER_REELS_STYLE_ID = 'fb-security-reels-style';
export const DECLUTTER_STYLE_ID = 'fb-security-declutter-style';

export const SPONSORED_HIDDEN_CLASS = 'fb-sec-sponsored-hidden';
export const SUGGESTED_HIDDEN_CLASS = 'fb-sec-suggested-hidden';
export const REELS_HIDDEN_CLASS = 'fb-sec-reels-hidden';
export const DECLUTTER_HIDDEN_CLASS = 'fb-sec-declutter-hidden';

export const SPONSORED_CSS = `
/* Sponsored Ads (Facebook Comet) — Language-Agnostic Core Signals */
div[data-pagelet^="FeedUnit_"]:has(a[href*="/ads/about"]),
div[data-pagelet^="FeedUnit_"]:has(a[href*="/about/ads"]),
div[data-pagelet^="FeedUnit_"]:has(a[href*="/ad_preferences"]),
div[data-pagelet^="FeedUnit_"]:has(a[href*="facebook.com/ads/about"]),
div[data-pagelet^="FeedUnit_"]:has(a[href*="ad_id="]),
div[data-pagelet^="FeedUnit_"]:has(article[data-ft*="sponsored_ad"]),
div[data-pagelet^="FeedUnit_"]:has([data-ft*='"ei":"sponsored_ad"']),
div[data-pagelet^="FeedUnit_"]:has(.sponsored_ad),
div[data-pagelet^="FeedUnit_"]:has(a[href*="#?abf"]),

/* Modern Facebook Comet Feed Post Ads */
div[class*="x1lliihq"]:has(a[href*="/ads/about"]),
div[class*="x1lliihq"]:has(a[href*="/about/ads"]),
div[class*="x1lliihq"]:has(a[href*="ad_id="]),

/* Right Rail Sponsored Ads — Language-Agnostic & Modern Comet */
div[data-pagelet="RightRail"]:has(a[href*="ad_id="]),
div[data-pagelet="RightRail"]:has(a[href*="/ads/about"]),
div[data-pagelet="RightRail"]:has(a[href*="/about/ads"]),
div[data-pagelet="RightRail"]:has(a[href*="/ad_preferences"]),
#right_rail_container div:has(> div a[href*="/ads/about"]),
#right_rail_container div:has(> div a[href*="/about/ads"]),
#right_rail_container div:has(> div a[href*="ad_id="]),
#right_rail_container div:has(> div a[target^="rhcad"]),
[role="complementary"] div:has(> div a[href*="/ads/about"]),
[role="complementary"] div:has(> div a[href*="ad_id="]),
[role="complementary"] div:has(> div a[target^="rhcad"]),

/* Instagram Sponsored — Language-Agnostic */
article:has(a[href*="/ads/about/"]),
article:has(a[href*="/about/ads/"]),
article:has(a[href*="paid_partnership"]),
article:has(a[href*="enable_persistent_cta=true"]),
article:has(a[href*="a_mpk="]),

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
/* Suggested Posts — unfollowed pages/creators (Facebook Comet) */
div[data-pagelet^="FeedUnit_"]:has([data-ad-rendering-role="profile_name"] h4 [role="button"]),
div[data-pagelet^="FeedUnit_"]:has([data-ad-rendering-role="profile_name"] h4 button),
div[class*="x1lliihq"]:has([data-ad-rendering-role="profile_name"] h4 [role="button"]),
div[class*="x1lliihq"]:has([data-ad-rendering-role="profile_name"] h4 button),

/* Instagram Suggested */
article:has(a[href*="suggested"]),
div[data-testid*="suggested"],

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
/* Reels / Short Video trays (Facebook Comet) */
div[data-pagelet^="FeedUnit_"]:has(a[href*="/reel/"]),
div[data-pagelet^="FeedUnit_"]:has(a[href*="/reels/"]),
div[data-pagelet^="FeedUnit_"]:has([data-pagelet*="Reels"]),
div[data-pagelet^="FeedUnit_"]:has([data-pagelet*="ShortVideos"]),
div[class*="x1lliihq"]:has(a[href*="/reel/"]),
div[class*="x1lliihq"]:has(a[href*="/reels/"]),

/* Instagram Reels */
article:has(a[href^="/reel/"]),
article:has(a[href^="/reels/"]),
div:has(> a[href^="/reels/"]),

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
 * Primary detection is completely language-independent (Meta URLs and protocol markers),
 * with multi-language accessibility label fallbacks.
 */
export function isSponsoredPost(element: Element): boolean {
  if (isFeedContainer(element)) {
    return false;
  }

  // 1. Legal transparency links for Meta Ads (100% language-agnostic worldwide)
  const adAboutLink = element.querySelector(
    'a[href*="/ads/about"], a[href*="facebook.com/ads/about"], a[href*="/about/ads"], a[href*="/ad_preferences"], a[href*="instagram.com/about/ads"]',
  );
  if (adAboutLink) {
    return true;
  }

  // 2. Outbound advertising clickthrough tracking query parameter & attributes (100% language-agnostic)
  const adTrackingLink = element.querySelector(
    'a[href*="ad_id="], a[href*="ad_id%3D"], a[target^="rhcad"], a[attributionsrc]',
  );
  if (adTrackingLink) {
    return true;
  }

  // 3. Backend data-ft JSON marker (100% language-agnostic)
  const articleAd = element.querySelector('[data-ft*="sponsored_ad"]');
  if (articleAd || element.matches('[data-ft*="sponsored_ad"]')) {
    return true;
  }

  // 4. Internal sponsored_ad CSS class (100% language-agnostic)
  const classAd = element.querySelector('.sponsored_ad');
  if (classAd || element.classList.contains('sponsored_ad')) {
    return true;
  }

  // 5. Obfuscated SVG Sponsored label with internal hash anchor (100% language-agnostic)
  const sponsoredHashLink = element.querySelector('a[href*="#?abf"]');
  if (sponsoredHashLink) {
    return true;
  }

  // 6. Instagram Ads & Paid Partnership (100% language-agnostic)
  if (isInstagramAd(element)) {
    return true;
  }

  // 7. Multi-language accessibility labels for sponsored content (mandated by WCAG / Meta UI)
  const ariaElements = element.querySelectorAll('[aria-label]');
  for (let i = 0; i < ariaElements.length; i += 1) {
    const el = ariaElements[i];
    if (el) {
      const label = el.getAttribute('aria-label');
      if (label && MULTI_LANG_SPONSORED_REGEX.test(label)) {
        return true;
      }
    }
  }

  // 8. Text content matching sponsored heading in right rail or ad card
  if (element.closest('#right_rail_container, [role="complementary"]')) {
    if (MULTI_LANG_SPONSORED_REGEX.test(element.textContent || '')) {
      return true;
    }
  }

  return false;
}

/**
 * Checks whether a feed unit element is a suggested post or video tray.
 *
 * Two types of suggested posts exist on Facebook Comet:
 *
 * Type 1 — Unfollowed page: a Follow/Subscribe button appears inside the
 *   profile_name h4 header next to the page name. (100% language-agnostic)
 *
 * Type 2 — Algorithm recommendation: Facebook places "Gợi ý cho bạn" /
 *   "Suggested for you" (or localized equivalent) in the metadata row.
 */
export function isSuggestedPost(element: Element): boolean {
  if (isFeedContainer(element)) {
    return false;
  }

  // If this feed unit is a Reels or short video tray, it is handled under the Reels category
  if (isReelsPost(element)) {
    return false;
  }

  // 1. Instagram algorithmic suggested posts (unfollowed accounts with Follow button)
  if (isInstagramSuggested(element)) {
    return true;
  }

  // 2. Type 1: Unfollowed page with Follow/Subscribe button in profile header h4 (language-agnostic)
  const profileHeader = element.querySelector('[data-ad-rendering-role="profile_name"] h4');
  if (profileHeader) {
    const followAction = profileHeader.querySelector('[role="button"], button');
    if (followAction) {
      return true;
    }
  }

  // 2. Button with Follow/Theo dõi/Tham gia inside profile_name container
  const profileNameEl = element.querySelector('[data-ad-rendering-role="profile_name"]');
  if (profileNameEl) {
    const followButton = profileNameEl.querySelector('[role="button"], button');
    if (followButton) {
      const btnText = followButton.textContent ?? '';
      if (/(?:follow|theo dõi|tham gia|join|abonnieren|s'abonner|seguir)/i.test(btnText)) {
        return true;
      }
    }

    // 3. Type 2: Multi-language recommendation label in the metadata row
    const metadataRow = profileNameEl.parentElement?.parentElement?.nextElementSibling;
    if (metadataRow) {
      const metaText = metadataRow.textContent ?? '';
      if (MULTI_LANG_SUGGESTED_REGEX.test(metaText)) {
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
  if (isFeedContainer(element)) {
    return false;
  }

  // Guard against sidebar/navigation links and non-feed items
  if (element.closest('nav, [role="navigation"], [role="banner"], header')) {
    return false;
  }

  const reelLinks = element.querySelectorAll('a[href*="/reel/"], a[href*="/reels/"]');
  for (let i = 0; i < reelLinks.length; i += 1) {
    const link = reelLinks[i];
    const href = link?.getAttribute('href') || '';
    if (!href.includes('/reel/?')) {
      return true;
    }
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

interface UnitClassification {
  sponsored?: boolean;
  suggested?: boolean;
  reels?: boolean;
}

const CLASSIFICATION_CACHE = new WeakMap<Element, UnitClassification>();

/**
 * Sweeps the current DOM and applies/removes hidden classes according to active preferences.
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

  const feedUnits = collectFeedUnits(doc);
  for (let i = 0; i < feedUnits.length; i += 1) {
    const unit = feedUnits[i];
    if (unit) {
      if (isFeedContainer(unit)) {
        continue;
      }
      // Guard against intermediate feed wrappers that contain multiple feed units
      if (unit.querySelectorAll('div[data-pagelet^="FeedUnit_"]').length > 0 && !unit.getAttribute('data-pagelet')?.startsWith('FeedUnit_')) {
        continue;
      }

      let cached = CLASSIFICATION_CACHE.get(unit);
      if (!cached) {
        cached = {};
        CLASSIFICATION_CACHE.set(unit, cached);
      }

      if (cached.sponsored === undefined) {
        cached.sponsored = isSponsoredPost(unit);
      }
      if (cached.suggested === undefined) {
        cached.suggested = isSuggestedPost(unit);
      }
      if (cached.reels === undefined) {
        cached.reels = isReelsPost(unit);
      }

      const isSponsored = cached.sponsored;
      const isSuggested = cached.suggested;
      const isReels = cached.reels;

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

  // State change detector: only sweeps DOM if predicate return values actually changed
  let lastSponsoredOn = isSponsored();
  let lastSuggestedOn = isSuggested();
  let lastReelsOn = isReels();

  let checkInterval: ReturnType<typeof setInterval> | null = null;
  if (typeof setInterval === 'function') {
    checkInterval = setInterval(() => {
      const sp = isSponsored();
      const sg = isSuggested();
      const rl = isReels();
      if (sp !== lastSponsoredOn || sg !== lastSuggestedOn || rl !== lastReelsOn) {
        lastSponsoredOn = sp;
        lastSuggestedOn = sg;
        lastReelsOn = rl;
        sweepFeed(doc, isSponsored, isSuggested, isReels);
      }
    }, 50);
  }

  const onConfigureEvent = () => {
    lastSponsoredOn = isSponsored();
    lastSuggestedOn = isSuggested();
    lastReelsOn = isReels();
    sweepFeed(doc, isSponsored, isSuggested, isReels);
  };
  try {
    doc.addEventListener('privacy-guard:configure', onConfigureEvent);
  } catch {
    // Ignore
  }

  // 4. Return clean teardown function
  return () => {
    if (checkInterval) {
      clearInterval(checkInterval);
    }
    try {
      doc.removeEventListener('privacy-guard:configure', onConfigureEvent);
    } catch {
      // Ignore
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
