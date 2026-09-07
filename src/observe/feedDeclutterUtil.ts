/**
 * Utility helpers and predicates for Facebook and Instagram Feed Decluttering.
 *
 * Provides language-agnostic DOM heuristics, feed unit collectors,
 * container guards, and style management for Facebook Comet and Instagram.
 */

export const MULTI_LANG_SPONSORED_REGEX =
  /(?:^|\s|\b|[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af])(?:sponsored|được tài trợ|nội dung được tài trợ|nhà quảng cáo|advertiser|sponsorisé|patrocinado|publicidad|gesponsert|sponsorizzato|sponsorlu|bersponsor|sponsorowane|gesponsord|sponsrad|реклама|مُموَّل|贊助|赞助|広告|광고|스폰서|ได้รับการสนับสนุน|प्रायोजित)(?:$|\s|\b|[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af])/i;

export const MULTI_LANG_SUGGESTED_REGEX =
  /(?:gợi ý cho bạn|suggested for you|recommandé|suggestions pour vous|sugerencias para ti|sugestões para você|vorschläge für dich|consigliato|recomendado|おすすめ|为你推荐|為你推薦|추천|рекомендуемое|ditampilkan untuk anda|önerilen|podpowiadane)/i;

export const MULTI_LANG_FOLLOW_REGEX =
  /^(?:follow|theo dõi|seguir|s'abonner|abonnieren|seguindo|フォローする|关注|關注|팔로우|seguire|подписаться)$/i;

/**
 * Checks whether an element is an Instagram feed advertisement.
 * Covers sponsored partnership links, persistent CTAs, and statutory ad labels.
 */
export function isInstagramAd(element: Element): boolean {
  if (
    element.querySelector(
      'a[href*="enable_persistent_cta=true"], a[href*="a_mpk="], a[href*="paid_partnership"], a[href*="/about/ads/"], a[href*="/ads/about/"]',
    )
  ) {
    return true;
  }
  const textElements = element.querySelectorAll('span, div');
  for (let i = 0; i < textElements.length; i += 1) {
    const el = textElements[i];
    if (el && el.children.length === 0) {
      const text = el.textContent?.trim() || '';
      if (text === 'Ad' || MULTI_LANG_SPONSORED_REGEX.test(text)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Checks whether an element is an Instagram algorithmic suggested post.
 * Identified by a Follow/Theo dõi button on an unfollowed creator's article.
 */
export function isInstagramSuggested(element: Element): boolean {
  if (isInstagramAd(element)) {
    return false;
  }
  const buttons = element.querySelectorAll('button, div[role="button"]');
  for (let i = 0; i < buttons.length; i += 1) {
    const btn = buttons[i];
    if (btn && MULTI_LANG_FOLLOW_REGEX.test(btn.textContent?.trim() || '')) {
      return true;
    }
  }
  return false;
}

/**
 * Checks whether an element is an outer feed container.
 * Feed containers must NEVER be hidden, even if their subtree contains sponsored posts.
 */
export function isFeedContainer(element: Element): boolean {
  if (!element || typeof element.getAttribute !== 'function') {
    return false;
  }
  const role = element.getAttribute('role');
  if (role === 'feed' || role === 'main') {
    return true;
  }
  if (element.getAttribute('data-pagelet') === 'Feed') {
    return true;
  }
  // Elements holding multiple feed posts are containers, not individual units
  if (
    element.querySelectorAll('div[data-pagelet^="FeedUnit_"]').length > 1 ||
    element.querySelectorAll('[data-ad-rendering-role="profile_name"]').length > 1 ||
    element.querySelectorAll('[data-virtualized]').length > 1
  ) {
    return true;
  }
  return false;
}

/**
 * Ensures a dedicated stylesheet exists in the document head/documentElement.
 */
export function ensureStyleSheet(
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
 * Locates parent feed containers across Comet, mobile, and Instagram layouts.
 */
export function findFeedContainers(doc: Document): Element[] {
  const containers: Element[] = [];
  const feeds = doc.querySelectorAll('div[role="feed"], div[data-pagelet="Feed"]');
  for (let i = 0; i < feeds.length; i += 1) {
    const f = feeds[i];
    if (f) {
      containers.push(f);
    }
  }

  const main = doc.querySelector('[role="main"]');
  if (main) {
    const profileNames = main.querySelectorAll('[data-ad-rendering-role="profile_name"]');
    for (let i = 0; i < profileNames.length; i += 1) {
      const pn = profileNames[i];
      let cur = pn?.parentElement;
      while (cur && cur !== main) {
        if (cur.children.length >= 3) {
          let postCount = 0;
          for (let j = 0; j < cur.children.length; j += 1) {
            const child = cur.children[j];
            if (
              child &&
              (child.querySelector('[data-ad-rendering-role="profile_name"], a[href*="/reel/"]') ||
                child.getAttribute('data-pagelet')?.startsWith('FeedUnit_'))
            ) {
              postCount += 1;
            }
          }
          if (postCount >= 2) {
            if (!containers.includes(cur)) {
              containers.push(cur);
            }
            break;
          }
        }
        cur = cur.parentElement;
      }
    }
  }

  return containers;
}

/**
 * Climbs up from a child signal node to find its outer feed post unit.
 */
export function resolveFeedUnit(startEl: Element, doc: Document): Element | null {
  let cur: Element | null = startEl;
  while (cur && cur.parentElement && cur.parentElement !== doc.body) {
    const parentEl: Element = cur.parentElement;
    if (parentEl.children.length >= 2) {
      let siblingPosts = 0;
      for (let j = 0; j < parentEl.children.length; j += 1) {
        const sibling = parentEl.children[j];
        if (
          sibling &&
          (sibling.querySelector('[data-ad-rendering-role="profile_name"], a[href*="/reel/"]') ||
            sibling.getAttribute('data-pagelet')?.startsWith('FeedUnit_'))
        ) {
          siblingPosts += 1;
        }
      }
      if (siblingPosts >= 2) {
        return isFeedContainer(cur) ? null : cur;
      }
    }
    cur = parentEl;
  }
  return null;
}

/**
 * Climbs up from a sponsored signal node in the right rail to its card unit.
 */
export function resolveRightRailUnit(startEl: Element, rightRail: Element): Element | null {
  let cur: Element | null = startEl;
  while (cur && cur.parentElement) {
    if (cur.parentElement === rightRail) {
      return cur;
    }
    if (
      cur.parentElement.children.length >= 2 &&
      Array.from(cur.parentElement.children).some(
        (c) =>
          c !== cur &&
          (/(?:sinh nhật|birthdays|contacts|người liên hệ)/i.test(c.textContent || '') ||
            Boolean(c.querySelector('a[href*="/events/birthdays"]'))),
      )
    ) {
      return cur;
    }
    cur = cur.parentElement;
  }
  return null;
}

/**
 * Universally collects individual feed units, reels trays, and right-rail ad units.
 * Supports legacy Facebook Comet, modern Comet virtualized feeds, and Instagram.
 */
export function collectFeedUnits(doc: Document): Element[] {
  const units = new Set<Element>();

  // 1. Standard / Legacy selectors
  const legacyElements = doc.querySelectorAll(
    'div[data-pagelet^="FeedUnit_"], div[role="feed"] > div, div[data-pagelet="RightRail"], article',
  );
  for (let i = 0; i < legacyElements.length; i += 1) {
    const el = legacyElements[i];
    if (el && !isFeedContainer(el)) {
      units.add(el);
    }
  }

  // 2. Modern Comet Feed Containers: direct children
  const feedContainers = findFeedContainers(doc);
  for (let i = 0; i < feedContainers.length; i += 1) {
    const container = feedContainers[i];
    if (!container) {
      continue;
    }
    for (let j = 0; j < container.children.length; j += 1) {
      const child = container.children[j];
      if (child && child.tagName !== 'H3' && !isFeedContainer(child)) {
        units.add(child);
      }
    }
  }

  // 3. Modern Comet Feed Posts: walk up from profile_name to post unit if not yet collected
  const profileNames = doc.querySelectorAll('[data-ad-rendering-role="profile_name"]');
  for (let i = 0; i < profileNames.length; i += 1) {
    const pn = profileNames[i];
    if (!pn) {
      continue;
    }
    const unit = resolveFeedUnit(pn, doc);
    if (unit) {
      units.add(unit);
    }
  }

  // 4. Modern Comet Reels Trays: walk up from reel links (excluding navigation and sidebar tabs)
  const reelLinks = doc.querySelectorAll('a[href*="/reel/"], a[href*="/reels/"]');
  for (let i = 0; i < reelLinks.length; i += 1) {
    const rl = reelLinks[i];
    if (!rl) {
      continue;
    }
    const href = rl.getAttribute('href') || '';
    if (href.includes('/reel/?') || rl.closest('nav, [role="navigation"], [role="banner"], header')) {
      continue;
    }

    const unit = resolveFeedUnit(rl, doc);
    if (unit) {
      units.add(unit);
    }
  }

  // 5. Modern Right Rail Sponsored Units
  const rightRail = doc.querySelector('#right_rail_container, [role="complementary"]');
  if (rightRail) {
    const candidateHeadings = rightRail.querySelectorAll('span, h3, h4');
    for (let i = 0; i < candidateHeadings.length; i += 1) {
      const h = candidateHeadings[i];
      if (h && MULTI_LANG_SPONSORED_REGEX.test(h.textContent || '')) {
        const unit = resolveRightRailUnit(h, rightRail);
        if (unit) {
          units.add(unit);
        }
      }
    }

    // Direct ad links in right rail
    const adLinks = rightRail.querySelectorAll('a[target^="rhcad"], a[attributionsrc], a[href*="ad_id"]');
    for (let i = 0; i < adLinks.length; i += 1) {
      const link = adLinks[i];
      if (link) {
        const unit = resolveRightRailUnit(link, rightRail);
        if (unit) {
          units.add(unit);
        }
      }
    }
  }

  return Array.from(units);
}
