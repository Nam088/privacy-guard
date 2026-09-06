import { describe, expect, it } from 'vitest';
import {
  attachLinkShimBypass,
  isLinkShimUrl,
  unwrapAnchorElement,
  unwrapLinkShim,
} from '@/observe/linkShim';

describe('linkShim', () => {
  describe('isLinkShimUrl', () => {
    it('detects Facebook and Messenger Link Shim URLs', () => {
      expect(
        isLinkShimUrl('https://l.facebook.com/l.php?u=https%3A%2F%2Fexample.com&h=123'),
      ).toBe(true);
      expect(
        isLinkShimUrl('https://lm.facebook.com/l.php?u=https%3A%2F%2Fexample.com'),
      ).toBe(true);
      expect(
        isLinkShimUrl('https://l.messenger.com/l.php?u=https%3A%2F%2Fexample.com'),
      ).toBe(true);
      expect(
        isLinkShimUrl('https://l.instagram.com/?u=https%3A%2F%2Fexample.com'),
      ).toBe(true);
    });

    it('rejects URLs without shim host or u parameter', () => {
      expect(isLinkShimUrl('https://www.facebook.com/messages/t/123')).toBe(false);
      expect(isLinkShimUrl('https://l.facebook.com/l.php')).toBe(false);
      expect(isLinkShimUrl('https://example.com/?u=https%3A%2F%2Ffoo.com')).toBe(false);
      expect(isLinkShimUrl('')).toBe(false);
    });
  });

  describe('unwrapLinkShim', () => {
    it('extracts and decodes the target URL cleanly', () => {
      const shim =
        'https://l.facebook.com/l.php?u=https%3A%2F%2Fvnexpress.net%2Ftin-tuc%3Fref%3Dfb&h=AT0123';
      expect(unwrapLinkShim(shim)).toBe('https://vnexpress.net/tin-tuc?ref=fb');
    });

    it('rejects unsafe protocols (XSS protection)', () => {
      expect(
        unwrapLinkShim('https://l.facebook.com/l.php?u=javascript%3Aalert%281%29'),
      ).toBeNull();
      expect(
        unwrapLinkShim('https://l.facebook.com/l.php?u=data%3Atext%2Fhtml%2Cevil'),
      ).toBeNull();
      expect(
        unwrapLinkShim('https://l.facebook.com/l.php?u=file%3A%2F%2F%2Fetc%2Fpasswd'),
      ).toBeNull();
    });

    it('returns null on malformed or missing target', () => {
      expect(unwrapLinkShim('https://l.facebook.com/l.php')).toBeNull();
      expect(unwrapLinkShim('not-a-url')).toBeNull();
    });
  });

  describe('unwrapAnchorElement', () => {
    it('rewrites anchor href and cleans Lynx tracking attributes', () => {
      const anchor = document.createElement('a');
      anchor.setAttribute(
        'href',
        'https://l.facebook.com/l.php?u=https%3A%2F%2Fgoogle.com&h=token',
      );
      anchor.setAttribute(
        'data-lynx-uri',
        'https://l.facebook.com/l.php?u=https%3A%2F%2Fgoogle.com&h=token',
      );

      const modified = unwrapAnchorElement(anchor);
      expect(modified).toBe(true);
      expect(anchor.getAttribute('href')).toBe('https://google.com/');
      expect(anchor.getAttribute('data-lynx-uri')).toBe('https://google.com/');
    });

    it('leaves clean anchors untouched', () => {
      const anchor = document.createElement('a');
      anchor.setAttribute('href', 'https://github.com');

      const modified = unwrapAnchorElement(anchor);
      expect(modified).toBe(false);
      expect(anchor.getAttribute('href')).toBe('https://github.com');
    });
  });

  describe('attachLinkShimBypass', () => {
    it('unwraps anchors when click occurs while enabled', () => {
      const enabled = true;
      const cleanup = attachLinkShimBypass(document, () => enabled);

      const anchor = document.createElement('a');
      anchor.setAttribute(
        'href',
        'https://l.facebook.com/l.php?u=https%3A%2F%2Fwikipedia.org&h=xyz',
      );
      document.body.appendChild(anchor);

      anchor.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(anchor.getAttribute('href')).toBe('https://wikipedia.org/');

      cleanup();
      document.body.removeChild(anchor);
    });

    it('does not unwrap when disabled', () => {
      const enabled = false;
      const cleanup = attachLinkShimBypass(document, () => enabled);

      const anchor = document.createElement('a');
      const originalHref =
        'https://l.facebook.com/l.php?u=https%3A%2F%2Fwikipedia.org&h=xyz';
      anchor.setAttribute('href', originalHref);
      document.body.appendChild(anchor);

      anchor.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(anchor.getAttribute('href')).toBe(originalHref);

      cleanup();
      document.body.removeChild(anchor);
    });
  });
});
