import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DECLUTTER_STYLE_ID,
  DECLUTTER_SPONSORED_STYLE_ID,
  DECLUTTER_SUGGESTED_STYLE_ID,
  DECLUTTER_REELS_STYLE_ID,
  DECLUTTER_HIDDEN_CLASS,
  SPONSORED_HIDDEN_CLASS,
  SUGGESTED_HIDDEN_CLASS,
  REELS_HIDDEN_CLASS,
  installFeedDeclutterHook,
  isFeedUnitUnwanted,
  isSponsoredPost,
  isSuggestedPost,
  isReelsPost,
} from '@/observe/feedDeclutter';

describe('feedDeclutter', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'test-feed-container';
    document.body.appendChild(container);
  });

  afterEach(() => {
    for (const id of [
      DECLUTTER_STYLE_ID,
      DECLUTTER_SPONSORED_STYLE_ID,
      DECLUTTER_SUGGESTED_STYLE_ID,
      DECLUTTER_REELS_STYLE_ID,
    ]) {
      const existingStyle = document.getElementById(id);
      if (existingStyle) {
        existingStyle.remove();
      }
    }
    container.remove();
    document.body.innerHTML = '';
  });

  it('injects stylesheet with declutter rules on installation', () => {
    const cleanup = installFeedDeclutterHook(window, () => true);

    const styleEl = document.getElementById(DECLUTTER_STYLE_ID) as HTMLStyleElement | null;
    const sponsoredEl = document.getElementById(DECLUTTER_SPONSORED_STYLE_ID) as HTMLStyleElement | null;
    const suggestedEl = document.getElementById(DECLUTTER_SUGGESTED_STYLE_ID) as HTMLStyleElement | null;
    const reelsEl = document.getElementById(DECLUTTER_REELS_STYLE_ID) as HTMLStyleElement | null;

    expect(styleEl).not.toBeNull();
    expect(sponsoredEl).not.toBeNull();
    expect(suggestedEl).not.toBeNull();
    expect(reelsEl).not.toBeNull();

    expect(sponsoredEl?.textContent).toContain(SPONSORED_HIDDEN_CLASS);
    expect(suggestedEl?.textContent).toContain(SUGGESTED_HIDDEN_CLASS);
    expect(reelsEl?.textContent).toContain(REELS_HIDDEN_CLASS);
    expect(styleEl?.textContent).toContain(DECLUTTER_HIDDEN_CLASS);

    cleanup();
    expect(document.getElementById(DECLUTTER_STYLE_ID)).toBeNull();
    expect(document.getElementById(DECLUTTER_SPONSORED_STYLE_ID)).toBeNull();
    expect(document.getElementById(DECLUTTER_SUGGESTED_STYLE_ID)).toBeNull();
    expect(document.getElementById(DECLUTTER_REELS_STYLE_ID)).toBeNull();
  });

  it('handles empty or missing document safely', () => {
    const fakeWin = {} as Window;
    const cleanup = installFeedDeclutterHook(fakeWin, () => true);
    expect(typeof cleanup).toBe('function');
    cleanup();
  });

  describe('isFeedUnitUnwanted', () => {
    it('detects sponsored ads via legal transparency link', () => {
      const unit = document.createElement('div');
      unit.setAttribute('data-pagelet', 'FeedUnit_0');
      unit.innerHTML = `
        <article>
          <a href="https://www.facebook.com/ads/about/?entry_product=ad_preferences">About Ads</a>
          <div>Post content</div>
        </article>
      `;

      expect(isFeedUnitUnwanted(unit)).toBe(true);
    });

    it('detects sponsored ads via alternate about ads link', () => {
      const unit = document.createElement('div');
      unit.setAttribute('data-pagelet', 'FeedUnit_0');
      unit.innerHTML = `
        <article>
          <a href="https://web.facebook.com/about/ads?ref=feed">Ad Info</a>
        </article>
      `;

      expect(isFeedUnitUnwanted(unit)).toBe(true);
    });

    it('detects sponsored ads via backend data-ft metadata', () => {
      const unit = document.createElement('div');
      unit.setAttribute('data-pagelet', 'FeedUnit_1');
      unit.innerHTML = `
        <article data-ft='{"ei":"sponsored_ad","ad_id":"12345"}'>
          <div>Ad body</div>
        </article>
      `;

      expect(isFeedUnitUnwanted(unit)).toBe(true);
    });

    it('detects sponsored ads via sponsored_ad CSS class', () => {
      const unit = document.createElement('div');
      unit.setAttribute('data-pagelet', 'FeedUnit_2');
      unit.innerHTML = `
        <div class="x1n2onr6 sponsored_ad">
          <div>Ad creative</div>
        </div>
      `;

      expect(isFeedUnitUnwanted(unit)).toBe(true);
    });

    it('detects sponsored ads via Call-To-Action rendering role', () => {
      const unit = document.createElement('div');
      unit.setAttribute('data-pagelet', 'FeedUnit_3');
      unit.innerHTML = `
        <article>
          <div data-ad-rendering-role="cta-button">
            <button>Sign Up</button>
          </div>
        </article>
      `;

      expect(isFeedUnitUnwanted(unit)).toBe(true);
    });

    it('detects sponsored ads via obfuscated SVG link with #?abf hash anchor', () => {
      const unit = document.createElement('div');
      unit.setAttribute('data-virtualized', 'false');
      unit.innerHTML = `
        <article>
          <a href="?__cft__[0]=AZ123&__tn__=%2CO%2CP-R#?abf" role="link">
            <svg><use xlink:href="#SvgWml131"></use></svg>
          </a>
          <div>Ad creative</div>
        </article>
      `;

      expect(isFeedUnitUnwanted(unit)).toBe(true);
    });

    it('detects sponsored ads via anti-adblock decoy node clusters', () => {
      const unit = document.createElement('div');
      unit.setAttribute('data-virtualized', 'false');
      unit.innerHTML = `
        <div aria-hidden="true" data-0="0" data-1="1" data-2="2" data-19="19">
          <blockquote><span>Facebook</span></blockquote>
        </div>
        <div>Ad creative</div>
      `;

      expect(isFeedUnitUnwanted(unit)).toBe(true);
    });

    it('detects reels trays via reel navigation links', () => {
      const unit = document.createElement('div');
      unit.setAttribute('data-pagelet', 'FeedUnit_4');
      unit.innerHTML = `
        <div>
          <a href="/reel/123456789/">Watch Reel</a>
        </div>
      `;

      expect(isReelsPost(unit)).toBe(true);
      expect(isSuggestedPost(unit)).toBe(false);
      expect(isSponsoredPost(unit)).toBe(false);
      expect(isFeedUnitUnwanted(unit)).toBe(true);
    });

    it('detects reels trays via data-pagelet container attribute', () => {
      const unit = document.createElement('div');
      unit.setAttribute('data-pagelet', 'FeedUnit_ReelsTray');
      unit.innerHTML = `
        <div>Short videos tray</div>
      `;

      expect(isReelsPost(unit)).toBe(true);
      expect(isSuggestedPost(unit)).toBe(false);
      expect(isSponsoredPost(unit)).toBe(false);
      expect(isFeedUnitUnwanted(unit)).toBe(true);
    });

    it('detects suggested posts from unfollowed pages via button inside profile_name h4', () => {
      const unit = document.createElement('div');
      unit.setAttribute('data-pagelet', 'FeedUnit_5');
      unit.innerHTML = `
        <div data-ad-rendering-role="profile_name">
          <h4>
            <span>
              <a href="/stranger_page" role="link">Stranger Page</a>
              <span> · </span>
              <div role="button" tabindex="0">
                <span>Follow</span>
              </div>
            </span>
          </h4>
        </div>
        <div>Suggested post body</div>
      `;

      expect(isFeedUnitUnwanted(unit)).toBe(true);
    });

    it('detects suggested posts with button tag inside profile_name h4 across languages', () => {
      const unit = document.createElement('div');
      unit.setAttribute('data-pagelet', 'FeedUnit_6');
      unit.innerHTML = `
        <div data-ad-rendering-role="profile_name">
          <h4>
            <span>
              <a href="/page_de" role="link">Seite</a>
              <button>Abonnieren</button>
            </span>
          </h4>
        </div>
      `;

      expect(isFeedUnitUnwanted(unit)).toBe(true);
    });

    it('detects Type 2 suggested posts via "Gợi ý cho bạn" text in metadata row (Vietnamese)', () => {
      const unit = document.createElement('div');
      unit.setAttribute('data-pagelet', 'FeedUnit_7');
      // Matches real Alpha Gaming PUBG structure: no Follow button in h4,
      // but "Gợi ý cho bạn" text appears in the row below the profile_name container.
      unit.innerHTML = `
        <div class="x78zum5 xdt5ytf xz62fqu x16ldp7u">
          <div class="xu06os2">
            <span dir="ltr">
              <div data-ad-rendering-role="profile_name">
                <h4>
                  <span>
                    <a href="/apgpubg" role="link">Alpha Gaming PUBG</a>
                  </span>
                </h4>
              </div>
            </span>
          </div>
          <div class="xu06os2">
            <span dir="ltr">
              <div>
                <span>Gợi ý cho bạn</span>
                <span> · </span>
                <a aria-label="2 ngày" href="/apgpubg/posts/123">2 ngày</a>
              </div>
            </span>
          </div>
        </div>
      `;

      expect(isFeedUnitUnwanted(unit)).toBe(true);
    });

    it('detects Type 2 suggested posts via "Suggested for you" text in metadata row (English)', () => {
      const unit = document.createElement('div');
      unit.setAttribute('data-pagelet', 'FeedUnit_8');
      unit.innerHTML = `
        <div class="x78zum5">
          <div class="xu06os2">
            <span dir="ltr">
              <div data-ad-rendering-role="profile_name">
                <h4>
                  <span>
                    <a href="/some_page" role="link">Some Page</a>
                  </span>
                </h4>
              </div>
            </span>
          </div>
          <div class="xu06os2">
            <span dir="ltr">
              <div>
                <span>Suggested for you</span>
                <span> · </span>
                <a aria-label="3 days ago" href="/some_page/posts/456">3 days ago</a>
              </div>
            </span>
          </div>
        </div>
      `;

      expect(isFeedUnitUnwanted(unit)).toBe(true);
    });

    it('preserves organic posts from friends and followed pages', () => {
      const unit = document.createElement('div');
      unit.setAttribute('data-pagelet', 'FeedUnit_7');
      // Friends' organic posts have data-ad-rendering-role on structural elements
      // but NO Follow button inside the profile_name h4
      unit.innerHTML = `
        <div data-ad-rendering-role="profile_name">
          <h4>
            <span>
              <a href="/friend_profile" role="link">Alice Smith</a>
            </span>
          </h4>
        </div>
        <div data-ad-rendering-role="story_message">
          <p>Hello friends, having coffee today!</p>
        </div>
      `;

      expect(isFeedUnitUnwanted(unit)).toBe(false);
    });

    it('preserves organic group posts where authors have no follow buttons', () => {
      const unit = document.createElement('div');
      unit.setAttribute('data-pagelet', 'FeedUnit_8');
      unit.innerHTML = `
        <div data-ad-rendering-role="profile_name">
          <h4>
            <span>
              <a href="/groups/tech" role="link">Tech Group</a>
              <span> &gt; </span>
              <a href="/members/bob" role="link">Bob</a>
            </span>
          </h4>
        </div>
        <div>Group discussion thread</div>
      `;

      expect(isFeedUnitUnwanted(unit)).toBe(false);
    });
  });

  describe('dynamic DOM mutation handling', () => {
    it('applies hidden class to newly appended unwanted feed units when active', async () => {
      let isDeclutterOn = true;
      const cleanup = installFeedDeclutterHook(window, () => isDeclutterOn);

      const adUnit = document.createElement('div');
      adUnit.setAttribute('data-pagelet', 'FeedUnit_10');
      adUnit.innerHTML = `
        <article data-ft='{"ei":"sponsored_ad"}'>
          <div>Ad creative</div>
        </article>
      `;
      container.appendChild(adUnit);

      // Wait for observer dispatch
      await new Promise((resolve) => setTimeout(resolve, 30));

      expect(adUnit.classList.contains(DECLUTTER_HIDDEN_CLASS)).toBe(true);

      // When turned off, polling/sweep disables style
      isDeclutterOn = false;
      await new Promise((resolve) => setTimeout(resolve, 70));
      const styleEl = document.getElementById(DECLUTTER_STYLE_ID) as HTMLStyleElement | null;
      expect(styleEl?.disabled).toBe(true);

      cleanup();
    });

    it('does not apply hidden class when declutter is inactive', async () => {
      const cleanup = installFeedDeclutterHook(window, () => false);

      const adUnit = document.createElement('div');
      adUnit.setAttribute('data-pagelet', 'FeedUnit_11');
      adUnit.innerHTML = `
        <a href="/ads/about/">About</a>
      `;
      container.appendChild(adUnit);

      await new Promise((resolve) => setTimeout(resolve, 30));

      expect(adUnit.classList.contains(DECLUTTER_HIDDEN_CLASS)).toBe(false);

      cleanup();
    });

    it('applies hidden class to virtualized feed units with sponsored links', async () => {
      const cleanup = installFeedDeclutterHook(window, () => true);

      const virtualizedUnit = document.createElement('div');
      virtualizedUnit.setAttribute('data-virtualized', 'false');
      virtualizedUnit.innerHTML = `
        <article>
          <a href="?__cft__[0]=AZ999#?abf">Sponsored</a>
        </article>
      `;
      container.appendChild(virtualizedUnit);

      await new Promise((resolve) => setTimeout(resolve, 30));

      expect(virtualizedUnit.classList.contains(DECLUTTER_HIDDEN_CLASS)).toBe(true);

      cleanup();
    });
  });

  describe('independent modes: sponsored vs suggested', () => {
    it('evaluates isSponsoredPost and isSuggestedPost accurately', () => {
      // A post with /ads/about/ link is sponsored
      const ad = document.createElement('div');
      ad.innerHTML = '<a href="/ads/about/">About</a>';
      expect(isSponsoredPost(ad)).toBe(true);
      expect(isSuggestedPost(ad)).toBe(false);

      // data-ad-rendering-role="profile_name" + h4 button = suggested post from unfollowed page
      const suggested = document.createElement('div');
      suggested.innerHTML = `
        <div data-ad-rendering-role="profile_name">
          <h4><button>Follow</button></h4>
        </div>
      `;
      expect(isSponsoredPost(suggested)).toBe(false);
      expect(isSuggestedPost(suggested)).toBe(true);
    });

    it('hides only sponsored posts when only isSponsoredActive is on', async () => {
      const cleanup = installFeedDeclutterHook(window, {
        isSponsoredActive: () => true,
        isSuggestedActive: () => false,
      });

      const adUnit = document.createElement('div');
      adUnit.setAttribute('data-pagelet', 'FeedUnit_Ad');
      adUnit.innerHTML = '<article data-ft=\'{"ei":"sponsored_ad"}\'></article>';

      // Suggested: unfollowed page with Follow button in profile_name h4
      const suggestedUnit = document.createElement('div');
      suggestedUnit.setAttribute('data-pagelet', 'FeedUnit_Sug');
      suggestedUnit.innerHTML = '<div data-ad-rendering-role="profile_name"><h4><button>Follow</button></h4></div>';

      container.appendChild(adUnit);
      container.appendChild(suggestedUnit);

      await new Promise((resolve) => setTimeout(resolve, 30));

      expect(adUnit.classList.contains(SPONSORED_HIDDEN_CLASS)).toBe(true);
      expect(suggestedUnit.classList.contains(SUGGESTED_HIDDEN_CLASS)).toBe(false);
      expect(suggestedUnit.classList.contains(DECLUTTER_HIDDEN_CLASS)).toBe(false);

      cleanup();
    });

    it('hides only suggested posts when only isSuggestedActive is on', async () => {
      const cleanup = installFeedDeclutterHook(window, {
        isSponsoredActive: () => false,
        isSuggestedActive: () => true,
        isReelsActive: () => false,
      });

      const adUnit = document.createElement('div');
      adUnit.setAttribute('data-pagelet', 'FeedUnit_Ad');
      adUnit.innerHTML = '<article data-ft=\'{"ei":"sponsored_ad"}\'></article>';

      // Suggested: unfollowed page with Follow button in profile_name h4
      const suggestedUnit = document.createElement('div');
      suggestedUnit.setAttribute('data-pagelet', 'FeedUnit_Sug');
      suggestedUnit.innerHTML = '<div data-ad-rendering-role="profile_name"><h4><button>Follow</button></h4></div>';

      // Reels tray
      const reelsUnit = document.createElement('div');
      reelsUnit.setAttribute('data-pagelet', 'FeedUnit_ReelsTray');
      reelsUnit.innerHTML = '<a href="/reel/123">Reel</a>';

      container.appendChild(adUnit);
      container.appendChild(suggestedUnit);
      container.appendChild(reelsUnit);

      await new Promise((resolve) => setTimeout(resolve, 30));

      expect(adUnit.classList.contains(SPONSORED_HIDDEN_CLASS)).toBe(false);
      expect(suggestedUnit.classList.contains(SUGGESTED_HIDDEN_CLASS)).toBe(true);
      expect(reelsUnit.classList.contains(REELS_HIDDEN_CLASS)).toBe(false);

      cleanup();
    });

    it('hides only reels when only isReelsActive is on', async () => {
      const cleanup = installFeedDeclutterHook(window, {
        isSponsoredActive: () => false,
        isSuggestedActive: () => false,
        isReelsActive: () => true,
      });

      const suggestedUnit = document.createElement('div');
      suggestedUnit.setAttribute('data-pagelet', 'FeedUnit_Sug');
      suggestedUnit.innerHTML = '<div data-ad-rendering-role="profile_name"><h4><button>Follow</button></h4></div>';

      const reelsUnit = document.createElement('div');
      reelsUnit.setAttribute('data-pagelet', 'FeedUnit_ReelsTray');
      reelsUnit.innerHTML = '<a href="/reel/123">Reel</a>';

      container.appendChild(suggestedUnit);
      container.appendChild(reelsUnit);

      await new Promise((resolve) => setTimeout(resolve, 30));

      expect(suggestedUnit.classList.contains(SUGGESTED_HIDDEN_CLASS)).toBe(false);
      expect(reelsUnit.classList.contains(REELS_HIDDEN_CLASS)).toBe(true);

      cleanup();
    });

    it('hides both suggested posts and reels when both are on', async () => {
      const cleanup = installFeedDeclutterHook(window, {
        isSponsoredActive: () => false,
        isSuggestedActive: () => true,
        isReelsActive: () => true,
      });

      const suggestedUnit = document.createElement('div');
      suggestedUnit.setAttribute('data-pagelet', 'FeedUnit_Sug');
      suggestedUnit.innerHTML = '<div data-ad-rendering-role="profile_name"><h4><button>Follow</button></h4></div>';

      const reelsUnit = document.createElement('div');
      reelsUnit.setAttribute('data-pagelet', 'FeedUnit_ReelsTray');
      reelsUnit.innerHTML = '<a href="/reel/123">Reel</a>';

      container.appendChild(suggestedUnit);
      container.appendChild(reelsUnit);

      await new Promise((resolve) => setTimeout(resolve, 30));

      expect(suggestedUnit.classList.contains(SUGGESTED_HIDDEN_CLASS)).toBe(true);
      expect(reelsUnit.classList.contains(REELS_HIDDEN_CLASS)).toBe(true);

      cleanup();
    });
  });
});
