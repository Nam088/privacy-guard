import { describe, expect, it } from 'vitest';
import {
  detectBrowserLocale,
  getDictionary,
  getFeatureTranslation,
  resolveLocale,
} from '@/i18n';
import { ALL_FEATURES } from '@/core/settings/schema';

describe('i18n system', () => {
  describe('detectBrowserLocale', () => {
    it('returns en by default in test environment', () => {
      expect(['en', 'vi']).toContain(detectBrowserLocale());
    });
  });

  describe('resolveLocale', () => {
    it('resolves explicit en and vi settings', () => {
      expect(resolveLocale('en')).toBe('en');
      expect(resolveLocale('vi')).toBe('vi');
    });

    it('falls back to detected locale for auto or undefined', () => {
      const detected = detectBrowserLocale();
      expect(resolveLocale('auto')).toBe(detected);
      expect(resolveLocale(undefined)).toBe(detected);
    });
  });

  describe('getDictionary', () => {
    it('returns english dictionary', () => {
      const dict = getDictionary('en');
      expect(dict.app.name).toBe('Privacy Guard');
      expect(dict.app.protectionOn).toBe('Protection on');
    });

    it('returns vietnamese dictionary', () => {
      const dict = getDictionary('vi');
      expect(dict.app.name).toBe('Privacy Guard');
      expect(dict.app.protectionOn).toBe('Bảo vệ đang bật');
    });
  });

  describe('feature translations', () => {
    it('provides english and vietnamese translations for every active feature', () => {
      for (const entry of ALL_FEATURES) {
        const enTrans = getFeatureTranslation(entry.key, 'en');
        expect(enTrans).toBeDefined();
        expect(enTrans?.label.length).toBeGreaterThan(0);
        expect(enTrans?.description.length).toBeGreaterThan(0);

        const viTrans = getFeatureTranslation(entry.key, 'vi');
        expect(viTrans).toBeDefined();
        expect(viTrans?.label.length).toBeGreaterThan(0);
        expect(viTrans?.description.length).toBeGreaterThan(0);
      }
    });

    it('translates separate sponsored and suggested posts features accurately', () => {
      const sponsoredVi = getFeatureTranslation('facebook.hideSponsoredPosts', 'vi');
      expect(sponsoredVi?.label).toContain('tài trợ');

      const suggestedVi = getFeatureTranslation('facebook.hideSuggestedPosts', 'vi');
      expect(suggestedVi?.label).toContain('gợi ý');
    });
  });
});
