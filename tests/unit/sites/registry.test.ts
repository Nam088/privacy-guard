import { describe, expect, it } from 'vitest';
import { SITE_MODULES, findSiteForUrl } from '@/sites/registry';

describe('SITE_MODULES', () => {
  it('holds both modules shipping in v1', () => {
    expect(SITE_MODULES.map((m) => m.id).sort()).toEqual([
      'facebook',
      'instagram',
    ]);
  });
});

describe('findSiteForUrl', () => {
  it('matches the bare host', () => {
    expect(findSiteForUrl('https://facebook.com/')?.id).toBe('facebook');
  });

  it('matches a subdomain', () => {
    expect(findSiteForUrl('https://www.facebook.com/feed')?.id).toBe('facebook');
    expect(findSiteForUrl('https://m.facebook.com/')?.id).toBe('facebook');
  });

  it('matches the second host of a module', () => {
    expect(findSiteForUrl('https://www.messenger.com/t/1')?.id).toBe('facebook');
  });

  it('matches the other module', () => {
    expect(findSiteForUrl('https://www.instagram.com/direct/')?.id).toBe(
      'instagram',
    );
  });

  it('does not match a host that merely ends with a supported host', () => {
    expect(findSiteForUrl('https://notfacebook.com/')).toBeNull();
    expect(findSiteForUrl('https://evilfacebook.com/')).toBeNull();
  });

  it('does not match a supported host appearing in the path', () => {
    expect(findSiteForUrl('https://evil.example/facebook.com/login')).toBeNull();
  });

  it('returns null for an unsupported site', () => {
    expect(findSiteForUrl('https://example.com/')).toBeNull();
  });

  it('returns null for a url that is undefined or empty', () => {
    expect(findSiteForUrl(undefined)).toBeNull();
    expect(findSiteForUrl('')).toBeNull();
  });

  it('returns null for a malformed url instead of throwing', () => {
    expect(findSiteForUrl('not a url')).toBeNull();
  });

  it('returns null for a non http scheme', () => {
    expect(findSiteForUrl('chrome-extension://abc/popup.html')).toBeNull();
    expect(findSiteForUrl('file:///Users/someone/facebook.com')).toBeNull();
  });

  it('is case insensitive about the host', () => {
    expect(findSiteForUrl('https://WWW.Facebook.COM/')?.id).toBe('facebook');
  });
});
