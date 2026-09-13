import { describe, expect, it } from 'vitest';
import {
  cleanTextUrls,
  isTrackingParam,
  stripTrackingParams,
} from '@/observe/cleanShareUtil';

describe('cleanShareUtil', () => {
  describe('isTrackingParam', () => {
    it('identifies Meta and marketing tracking keys', () => {
      expect(isTrackingParam('mibextid')).toBe(true);
      expect(isTrackingParam('rdid')).toBe(true);
      expect(isTrackingParam('igsh')).toBe(true);
      expect(isTrackingParam('fbclid')).toBe(true);
      expect(isTrackingParam('utm_source')).toBe(true);
      expect(isTrackingParam('__cft__[0]')).toBe(true);
      expect(isTrackingParam('__tn__')).toBe(true);
    });

    it('rejects legitimate content parameters', () => {
      expect(isTrackingParam('id')).toBe(false);
      expect(isTrackingParam('v')).toBe(false);
      expect(isTrackingParam('story_fbid')).toBe(false);
      expect(isTrackingParam('set')).toBe(false);
      expect(isTrackingParam('fbid')).toBe(false);
    });
  });

  describe('stripTrackingParams', () => {
    it('strips mibextid and rdid from Facebook share link', () => {
      const input = 'https://www.facebook.com/share/p/1B1tXv7q8r/?mibextid=wwXIfr&rdid=123';
      const res = stripTrackingParams(input);
      expect(res.modified).toBe(true);
      expect(res.cleanedUrl).toBe('https://www.facebook.com/share/p/1B1tXv7q8r/');
    });

    it('strips igsh and utm_source from Instagram post URL', () => {
      const input =
        'https://www.instagram.com/p/DF2157_SYG3/?igsh=OGQ5ZDc2ODk2ZA==&utm_source=ig_web_copy_link';
      const res = stripTrackingParams(input);
      expect(res.modified).toBe(true);
      expect(res.cleanedUrl).toBe('https://www.instagram.com/p/DF2157_SYG3/');
    });

    it('preserves valid content parameters while stripping tracking tokens', () => {
      const input =
        'https://www.facebook.com/permalink.php?story_fbid=12345&id=67890&mibextid=abc';
      const res = stripTrackingParams(input);
      expect(res.modified).toBe(true);
      expect(res.cleanedUrl).toBe(
        'https://www.facebook.com/permalink.php?story_fbid=12345&id=67890',
      );
    });

    it('returns original URL when no tracking parameters exist', () => {
      const input = 'https://www.facebook.com/zuck';
      const res = stripTrackingParams(input);
      expect(res.modified).toBe(false);
      expect(res.cleanedUrl).toBe(input);
    });

    it('handles non-URL strings gracefully', () => {
      expect(stripTrackingParams('just a string').modified).toBe(false);
      expect(stripTrackingParams('').modified).toBe(false);
    });
  });

  describe('cleanTextUrls', () => {
    it('strips tracking params from URLs embedded within text messages', () => {
      const input =
        'Hey check this out: https://www.facebook.com/reel/12345/?mibextid=rS40aB thanks!';
      const res = cleanTextUrls(input);
      expect(res.modified).toBe(true);
      expect(res.cleanedText).toBe(
        'Hey check this out: https://www.facebook.com/reel/12345/ thanks!',
      );
    });

    it('cleans multiple URLs in a single string', () => {
      const input =
        'Link 1: https://www.instagram.com/p/123/?igsh=abc and Link 2: https://fb.com/p/456?rdid=xyz';
      const res = cleanTextUrls(input);
      expect(res.modified).toBe(true);
      expect(res.cleanedText).toBe(
        'Link 1: https://www.instagram.com/p/123/ and Link 2: https://fb.com/p/456',
      );
    });

    it('leaves plain text without URLs untouched', () => {
      const input = 'Hello world, no links here!';
      const res = cleanTextUrls(input);
      expect(res.modified).toBe(false);
      expect(res.cleanedText).toBe(input);
    });
  });
});
