import { beforeEach, describe, expect, it } from 'vitest';
import {
  collectFeedUnits,
  findFeedContainers,
  isFeedContainer,
  isInstagramAd,
  isInstagramSuggested,
} from '@/observe/feedDeclutterUtil';

describe('feedDeclutterUtil', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  describe('isFeedContainer', () => {
    it('returns false for null or undefined or invalid elements', () => {
      expect(isFeedContainer(null as unknown as Element)).toBe(false);
      expect(isFeedContainer({} as unknown as Element)).toBe(false);
    });

    it('identifies role=feed and role=main as feed containers', () => {
      const feed = document.createElement('div');
      feed.setAttribute('role', 'feed');
      expect(isFeedContainer(feed)).toBe(true);

      const main = document.createElement('div');
      main.setAttribute('role', 'main');
      expect(isFeedContainer(main)).toBe(true);
    });

    it('identifies data-pagelet=Feed as feed container', () => {
      const feedPagelet = document.createElement('div');
      feedPagelet.setAttribute('data-pagelet', 'Feed');
      expect(isFeedContainer(feedPagelet)).toBe(true);
    });

    it('identifies wrappers holding multiple post units as feed containers', () => {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = `
        <div data-pagelet="FeedUnit_1"></div>
        <div data-pagelet="FeedUnit_2"></div>
      `;
      expect(isFeedContainer(wrapper)).toBe(true);

      const cometWrapper = document.createElement('div');
      cometWrapper.innerHTML = `
        <div><div data-ad-rendering-role="profile_name">User 1</div></div>
        <div><div data-ad-rendering-role="profile_name">User 2</div></div>
      `;
      expect(isFeedContainer(cometWrapper)).toBe(true);
    });

    it('does NOT misclassify an individual virtualized post as a feed container', () => {
      const singlePost = document.createElement('div');
      singlePost.setAttribute('data-virtualized', 'false');
      singlePost.innerHTML = `
        <div data-ad-rendering-role="profile_name">User 1</div>
        <div>Content</div>
      `;
      expect(isFeedContainer(singlePost)).toBe(false);
    });
  });

  describe('findFeedContainers and collectFeedUnits', () => {
    it('locates feed containers under role=main and collects direct feed units', () => {
      const main = document.createElement('div');
      main.setAttribute('role', 'main');

      const postsList = document.createElement('div');
      const p1 = document.createElement('div');
      p1.innerHTML = '<div data-ad-rendering-role="profile_name">Author 1</div>';
      const p2 = document.createElement('div');
      p2.innerHTML = '<div data-ad-rendering-role="profile_name">Author 2</div>';
      const p3 = document.createElement('div');
      p3.innerHTML = '<a href="/reel/12345">Reels</a>';

      postsList.appendChild(p1);
      postsList.appendChild(p2);
      postsList.appendChild(p3);
      main.appendChild(postsList);
      container.appendChild(main);

      const containers = findFeedContainers(document);
      expect(containers.length).toBe(1);
      expect(containers[0]).toBe(postsList);

      const units = collectFeedUnits(document);
      expect(units).toContain(p1);
      expect(units).toContain(p2);
      expect(units).toContain(p3);
    });

    it('collects right rail sponsored cards', () => {
      const rightRail = document.createElement('div');
      rightRail.id = 'right_rail_container';

      const adCard = document.createElement('div');
      adCard.innerHTML = `
        <span>Được tài trợ</span>
        <a href="https://example.com" target="rhcad">Ad</a>
      `;

      const birthdayCard = document.createElement('div');
      birthdayCard.innerHTML = `
        <span>Sinh nhật</span>
        <a href="/events/birthdays/">Birthdays</a>
      `;

      rightRail.appendChild(adCard);
      rightRail.appendChild(birthdayCard);
      container.appendChild(rightRail);

      const units = collectFeedUnits(document);
      expect(units).toContain(adCard);
      expect(units).not.toContain(birthdayCard);
    });
  });

  describe('isInstagramAd', () => {
    it('detects Instagram ads via persistent CTA or partnership links', () => {
      const adArticle = document.createElement('article');
      adArticle.innerHTML = '<a href="/brand/?enable_persistent_cta=true">Sponsored Brand</a>';
      expect(isInstagramAd(adArticle)).toBe(true);

      const partnership = document.createElement('article');
      partnership.innerHTML = '<a href="/brand/paid_partnership">Partner</a>';
      expect(isInstagramAd(partnership)).toBe(true);
    });

    it('detects Instagram ads via Ad text badge or localized label', () => {
      const adBadge = document.createElement('article');
      adBadge.innerHTML = '<div><span>Brand Name</span><span>Ad</span></div>';
      expect(isInstagramAd(adBadge)).toBe(true);

      const vnAd = document.createElement('article');
      vnAd.innerHTML = '<div><span>Được tài trợ</span></div>';
      expect(isInstagramAd(vnAd)).toBe(true);
    });

    it('returns false for organic Instagram articles', () => {
      const organic = document.createElement('article');
      organic.innerHTML = '<div><span>Friend Name</span><span>Beautiful sunset</span></div>';
      expect(isInstagramAd(organic)).toBe(false);
    });
  });

  describe('isInstagramSuggested', () => {
    it('detects algorithmic suggested posts via Follow button', () => {
      const suggested = document.createElement('article');
      suggested.innerHTML = `
        <div>
          <span>creator_xyz</span>
          <div role="button">Follow</div>
        </div>
      `;
      expect(isInstagramSuggested(suggested)).toBe(true);

      const vnSuggested = document.createElement('article');
      vnSuggested.innerHTML = `
        <div>
          <span>creator_vn</span>
          <button>Theo dõi</button>
        </div>
      `;
      expect(isInstagramSuggested(vnSuggested)).toBe(true);
    });

    it('returns false for ads even if they have buttons', () => {
      const adWithBtn = document.createElement('article');
      adWithBtn.innerHTML = `
        <a href="/ad/?enable_persistent_cta=true">Shop</a>
        <div role="button">Follow</div>
      `;
      expect(isInstagramSuggested(adWithBtn)).toBe(false);
    });

    it('returns false for organic followed accounts without Follow button', () => {
      const followed = document.createElement('article');
      followed.innerHTML = `
        <div>
          <span>close_friend</span>
          <span>Great day!</span>
        </div>
      `;
      expect(isInstagramSuggested(followed)).toBe(false);
    });
  });
});
