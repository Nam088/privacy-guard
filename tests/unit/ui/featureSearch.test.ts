import { describe, expect, it } from 'vitest';
import {
  buildSearchIndex,
  normalizeSearchText,
  searchFeatures,
} from '@/ui/search/featureSearch';

describe('featureSearch', () => {
  describe('normalizeSearchText', () => {
    it('lowercases and trims text', () => {
      expect(normalizeSearchText('  Hello WORLD  ')).toBe('hello world');
    });

    it('removes Vietnamese diacritics (accents)', () => {
      expect(normalizeSearchText('Lưu tin nhắn đã gỡ (Chống thu hồi)')).toBe(
        'luu tin nhan da go chong thu hoi',
      );
      expect(normalizeSearchText('Chặn đang soạn tin nhắn')).toBe(
        'chan dang soan tin nhan',
      );
      expect(normalizeSearchText('Bảo vệ WebRTC không lộ IP')).toBe(
        'bao ve webrtc khong lo ip',
      );
    });

    it('converts đ and Đ to d', () => {
      expect(normalizeSearchText('Đã xem')).toBe('da xem');
      expect(normalizeSearchText('đang gõ')).toBe('dang go');
      expect(normalizeSearchText('Đề xuất')).toBe('de xuat');
    });

    it('collapses punctuation and extra spaces', () => {
      expect(normalizeSearchText('anti-tracking: / (shield)??')).toBe(
        'anti tracking shield',
      );
    });

    it('handles empty or blank input', () => {
      expect(normalizeSearchText('')).toBe('');
      expect(normalizeSearchText('   ')).toBe('');
    });
  });

  describe('buildSearchIndex', () => {
    it('creates search index covering all features', () => {
      const index = buildSearchIndex('en');
      expect(index.length).toBeGreaterThanOrEqual(25);

      const searchFeat = index.find((i) => i.key === 'facebook.stealthSearch');
      expect(searchFeat).toBeDefined();
      expect(searchFeat?.scope).toBe('facebook');
      expect(searchFeat?.category).toBe('privacy');
      expect(searchFeat?.enLabel).toContain('Stealth search');
      expect(searchFeat?.viLabel).toContain('Tìm kiếm vô danh');
      expect(searchFeat?.searchCorpus).toContain('tim kiem');
      expect(searchFeat?.searchCorpus).toContain('stealth');
    });

    it('adapts active labels based on locale', () => {
      const enIndex = buildSearchIndex('en');
      const viIndex = buildSearchIndex('vi');

      const enSearch = enIndex.find((i) => i.key === 'facebook.stealthSearch');
      const viSearch = viIndex.find((i) => i.key === 'facebook.stealthSearch');

      expect(enSearch?.activeLocaleLabel).toContain('Stealth search');
      expect(viSearch?.activeLocaleLabel).toContain('Tìm kiếm vô danh');
    });
  });

  describe('searchFeatures - Multi-language and Lazy matching', () => {
    const items = buildSearchIndex('vi');

    it('finds stealth search using English query "stealth"', () => {
      const results = searchFeatures(items, 'stealth');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some((r) => r.item.key === 'facebook.stealthSearch')).toBe(true);
    });

    it('finds stealth search using Vietnamese query WITH diacritics "tìm kiếm"', () => {
      const results = searchFeatures(items, 'tìm kiếm');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some((r) => r.item.key === 'facebook.stealthSearch')).toBe(true);
    });

    it('finds stealth search using Vietnamese query WITHOUT diacritics "tim kiem"', () => {
      const results = searchFeatures(items, 'tim kiem');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some((r) => r.item.key === 'facebook.stealthSearch')).toBe(true);
    });

    it('finds stealth search using synonym "lich su"', () => {
      const results = searchFeatures(items, 'lich su');
      expect(results.some((r) => r.item.key === 'facebook.stealthSearch')).toBe(true);
    });

    it('finds typing indicator using English "typing" and Vietnamese "dang go" and "đang gõ"', () => {
      const enResults = searchFeatures(items, 'typing');
      expect(enResults.some((r) => r.item.key === 'facebook.hideTyping')).toBe(true);
      expect(enResults.some((r) => r.item.key === 'instagram.hideTyping')).toBe(true);

      const viNoAccentResults = searchFeatures(items, 'dang go');
      expect(viNoAccentResults.some((r) => r.item.key === 'facebook.hideTyping')).toBe(true);

      const viAccentResults = searchFeatures(items, 'đang gõ');
      expect(viAccentResults.some((r) => r.item.key === 'facebook.hideTyping')).toBe(true);
    });

    it('finds read receipts using synonym "seen" or "đã xem" or "da xem"', () => {
      const seenResults = searchFeatures(items, 'seen');
      expect(seenResults.some((r) => r.item.key === 'facebook.hideReadReceipts')).toBe(true);

      const daXemResults = searchFeatures(items, 'đã xem');
      expect(daXemResults.some((r) => r.item.key === 'facebook.hideReadReceipts')).toBe(true);

      const daXemNoAccent = searchFeatures(items, 'da xem');
      expect(daXemNoAccent.some((r) => r.item.key === 'facebook.hideReadReceipts')).toBe(true);
    });

    it('finds ads features using "ads" or "quang cao" or "quảng cáo" or "sponsor"', () => {
      const adsResults = searchFeatures(items, 'ads');
      expect(adsResults.some((r) => r.item.key === 'facebook.hideSponsoredPosts')).toBe(true);
      expect(adsResults.some((r) => r.item.key === 'instagram.hideSponsoredPosts')).toBe(true);

      const qcResults = searchFeatures(items, 'quang cao');
      expect(qcResults.some((r) => r.item.key === 'facebook.hideSponsoredPosts')).toBe(true);

      const qcAccentResults = searchFeatures(items, 'quảng cáo');
      expect(qcAccentResults.some((r) => r.item.key === 'facebook.hideSponsoredPosts')).toBe(true);
    });

    it('finds WebRTC IP leak shield using "webrtc" or "ip" or "cuoc goi" or "cuộc gọi"', () => {
      const ipResults = searchFeatures(items, 'ip leak');
      expect(ipResults.some((r) => r.item.key === 'facebook.protectWebRtcIp')).toBe(true);

      const callResults = searchFeatures(items, 'cuộc gọi');
      expect(callResults.some((r) => r.item.key === 'facebook.protectWebRtcIp')).toBe(true);
    });

    it('supports multi-token lazy search e.g. "fb tim kiem" or "ig reels"', () => {
      const fbSearch = searchFeatures(items, 'fb tim kiem');
      expect(fbSearch.length).toBeGreaterThanOrEqual(1);
      expect(fbSearch[0]!.item.key).toBe('facebook.stealthSearch');

      const igReels = searchFeatures(items, 'ig reels');
      expect(igReels.length).toBeGreaterThanOrEqual(1);
      expect(igReels[0]!.item.key).toBe('instagram.hideReels');
    });

    it('supports scope filtering', () => {
      const allTyping = searchFeatures(items, 'typing');
      expect(allTyping.length).toBe(2);

      const fbOnly = searchFeatures(items, 'typing', { scope: 'facebook' });
      expect(fbOnly.length).toBe(1);
      expect(fbOnly[0]!.item.scope).toBe('facebook');

      const igOnly = searchFeatures(items, 'typing', { scope: 'instagram' });
      expect(igOnly.length).toBe(1);
      expect(igOnly[0]!.item.scope).toBe('instagram');
    });

    it('returns empty array when no features match', () => {
      const noMatch = searchFeatures(items, 'xyznonexistentterm12345');
      expect(noMatch).toEqual([]);
    });

    it('returns all items when query is empty or whitespace', () => {
      const emptyQuery = searchFeatures(items, '   ');
      expect(emptyQuery.length).toBe(items.length);
    });

    it('sorts higher relevance scores to the top', () => {
      const results = searchFeatures(items, 'reels');
      expect(results.length).toBeGreaterThanOrEqual(2);
      // Top results should have high scores
      expect(results[0]!.score).toBeGreaterThanOrEqual(70);
    });
  });
});
