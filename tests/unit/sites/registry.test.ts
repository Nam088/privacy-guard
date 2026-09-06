import { describe, expect, it } from 'vitest';
import { SITE_MODULES, findSiteForUrl, isMessagingSurface } from '@/sites/registry';

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

describe('isMessagingSurface', () => {
  it('treats every messenger.com page as messaging', () => {
    expect(isMessagingSurface('https://www.messenger.com/')).toBe(true);
    expect(isMessagingSurface('https://www.messenger.com/t/1')).toBe(true);
    expect(isMessagingSurface('https://messenger.com/e2ee/t/1')).toBe(true);
  });

  it('treats the Facebook inbox routes as messaging', () => {
    expect(isMessagingSurface('https://www.facebook.com/messages')).toBe(true);
    expect(isMessagingSurface('https://www.facebook.com/messages/t/1')).toBe(true);
    expect(isMessagingSurface('https://www.facebook.com/messages/e2ee/t/1')).toBe(true);
    expect(isMessagingSurface('https://m.facebook.com/messages/')).toBe(true);
  });

  it('treats Instagram direct routes as messaging', () => {
    expect(isMessagingSurface('https://www.instagram.com/direct/inbox/')).toBe(true);
    expect(isMessagingSurface('https://www.instagram.com/direct/t/1')).toBe(true);
  });

  it('leaves browsing surfaces alone', () => {
    expect(isMessagingSurface('https://www.facebook.com/')).toBe(false);
    expect(isMessagingSurface('https://www.facebook.com/watch')).toBe(false);
    expect(isMessagingSurface('https://www.instagram.com/')).toBe(false);
  });

  // A route whose name merely starts with the same letters is not the inbox.
  it('does not match a lookalike path segment', () => {
    expect(isMessagingSurface('https://www.facebook.com/messagesomething')).toBe(false);
    expect(isMessagingSurface('https://www.instagram.com/directory')).toBe(false);
  });

  it('is case insensitive on the host', () => {
    expect(isMessagingSurface('https://WWW.Messenger.COM/t/1')).toBe(true);
  });

  it('says no for anything it cannot parse', () => {
    expect(isMessagingSurface(undefined)).toBe(false);
    expect(isMessagingSurface('')).toBe(false);
    expect(isMessagingSurface('not a url')).toBe(false);
  });
});
