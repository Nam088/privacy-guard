import { describe, expect, it } from 'vitest';
import { facebook } from '@/sites/facebook';
import { instagram } from '@/sites/instagram';
import type { SiteModule } from '@/sites/types';
import { GLOBAL_FEATURES } from '@/trackers/features';

const MODULES: SiteModule[] = [facebook, instagram];

describe.each(MODULES)('site module $id', (site) => {
  it('has a non empty id and display name', () => {
    expect(site.id.length).toBeGreaterThan(0);
    expect(site.displayName.length).toBeGreaterThan(0);
  });

  it('declares at least one host and one match pattern', () => {
    expect(site.hosts.length).toBeGreaterThan(0);
    expect(site.matches.length).toBeGreaterThan(0);
  });

  it('declares only bare hostnames in hosts, no scheme and no wildcard', () => {
    for (const host of site.hosts) {
      expect(host).not.toContain('*');
      expect(host).not.toContain('/');
      expect(host).not.toContain(':');
    }
  });

  it('declares at least one feature', () => {
    expect(site.features.length).toBeGreaterThan(0);
  });

  it('has no duplicate feature ids', () => {
    const ids = site.features.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every feature a non empty label and description', () => {
    for (const feature of site.features) {
      expect(feature.label.length).toBeGreaterThan(0);
      expect(feature.description.length).toBeGreaterThan(0);
    }
  });

  // The promise is not that nothing is active, it is that nothing is active without interception
  // behind it. Adding a feature to this list is how a build starts claiming protection it lacks,
  // so the list is written out rather than derived.
  it('marks a feature active only when this build actually intercepts it', () => {
    const SHIPPED: Record<string, readonly string[]> = {
      facebook: [
        'hideReadReceipts',
        'hideTyping',
        'hideStoryViews',
        'blockFeedAutoRefresh',
        'hideInboxLastSeen',
        'hideSponsoredPosts',
        'hideSuggestedPosts',
        'hideReels',
        'hideOnlineStatus',
        'protectWebRtcIp',
        'hideVoicePlayed',
        'scrambleDwellTime',
        'bypassLinkShim',
        'mediaDownloader',
      ],
      instagram: [
        'hideReadReceipts',
        'hideTyping',
        'hideStoryViews',
        'bypassLinkShim',
        'hideSuggestedPosts',
        'hideReels',
        'hideOnlineStatus',
        'hideSponsoredPosts',
        'protectWebRtcIp',
        'mediaDownloader',
      ],
    };

    for (const feature of site.features) {
      const shipped = SHIPPED[site.id]?.includes(feature.id) ?? false;
      let expectedStatus = 'planned';
      if (shipped) {
        expectedStatus = 'active';
      }
      expect(feature.status).toBe(expectedStatus);
    }
  });
});

describe('the two modules together', () => {
  it('have different ids', () => {
    expect(facebook.id).not.toBe(instagram.id);
  });

  it('do not claim the same host', () => {
    const all = [...facebook.hosts, ...instagram.hosts];
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('global tracker features', () => {
  it('declares at least one feature', () => {
    expect(GLOBAL_FEATURES.length).toBeGreaterThan(0);
  });

  it('has no duplicate feature ids', () => {
    const ids = GLOBAL_FEATURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every feature a non empty label and description', () => {
    for (const feature of GLOBAL_FEATURES) {
      expect(feature.label.length).toBeGreaterThan(0);
      expect(feature.description.length).toBeGreaterThan(0);
    }
  });

  it('marks every feature active, because tracker blocking ships in M2', () => {
    for (const feature of GLOBAL_FEATURES) {
      expect(feature.status).toBe('active');
    }
  });

  it('includes the two features M2 implements', () => {
    const ids = GLOBAL_FEATURES.map((f) => f.id);
    expect(ids).toContain('blockMetaPixel');
    expect(ids).toContain('stripFbclid');
  });

  it('leaves fbclid stripping off by default, because it needs an extra permission', () => {
    const strip = GLOBAL_FEATURES.find((f) => f.id === 'stripFbclid');
    expect(strip?.defaultEnabled).toBe(false);
  });
});
