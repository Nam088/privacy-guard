import { describe, expect, it } from 'vitest';
import { buildSuppressionConfig } from '@/core/suppressionConfig';
import { DEFAULT_SETTINGS, type Settings } from '@/core/settings/schema';
import { FACEBOOK_SIGNATURES } from '@/sites/facebook/signatures';

const on: Settings = {
  ...DEFAULT_SETTINGS,
  features: {
    ...DEFAULT_SETTINGS.features,
    'facebook.hideReadReceipts': true,
    'facebook.hideTyping': true,
    'facebook.hideStoryViews': true,
    'facebook.hideSuggestedPosts': true,
    'facebook.hideReels': true,
  },
};

const NOTHING = {
  readReceiptLabels: [],
  readReceiptPaths: [],
  typingLabels: [],
  typingPaths: [],
  inboxWatermarkLabels: [],
  inboxWatermarkPaths: [],
};

describe('buildSuppressionConfig', () => {
  // The inbox watermark is off by default, so an otherwise fully enabled profile must not be
  // granted it by accident.
  it('grants the inbox watermark label only when its own feature is on', () => {
    const withInbox: Settings = {
      ...on,
      features: { ...on.features, 'facebook.hideInboxLastSeen': true },
    };

    const granted = buildSuppressionConfig('https://www.messenger.com/t/1', withInbox);
    expect(granted.inboxWatermarkLabels).toEqual(FACEBOOK_SIGNATURES.inboxWatermarkLabels);
    expect(granted.inboxWatermarkPaths).toEqual(FACEBOOK_SIGNATURES.inboxWatermarkPaths);

    expect(buildSuppressionConfig('https://www.messenger.com/t/1', on).inboxWatermarkLabels).toEqual(
      [],
    );
    expect(buildSuppressionConfig('https://www.instagram.com/', withInbox).inboxWatermarkLabels).toEqual(
      [],
    );
  });

  // The read receipt rule once reported a suppressed typing frame as its own because the two label
  // sets were merged. A third set must not repeat it.
  it('never mixes the inbox watermark label into another feature set', () => {
    const withInbox: Settings = {
      ...on,
      features: { ...on.features, 'facebook.hideInboxLastSeen': true },
    };
    const config = buildSuppressionConfig('https://www.messenger.com/t/1', withInbox);

    for (const label of FACEBOOK_SIGNATURES.inboxWatermarkLabels) {
      expect(config.readReceiptLabels).not.toContain(label);
      expect(config.typingLabels).not.toContain(label);
    }
  });

  it('grants the observed labels on messenger and facebook', () => {
    for (const url of ['https://www.messenger.com/t/1', 'https://www.facebook.com/messages']) {
      expect(buildSuppressionConfig(url, on)).toEqual({
        readReceiptLabels: FACEBOOK_SIGNATURES.readReceiptLabels,
        readReceiptPaths: FACEBOOK_SIGNATURES.readReceiptPaths,
        typingLabels: FACEBOOK_SIGNATURES.typingLabels,
        typingPaths: FACEBOOK_SIGNATURES.typingPaths,
        // Off by default, so a profile with every other feature on is still granted nothing here.
        inboxWatermarkLabels: [],
        inboxWatermarkPaths: [],
        hideStoryViews: true,
        hideTyping: true,
        // Feed auto-refresh blocking is a browsing-surface feature: an inbox has no feed to
        // hold in place, and spoofing an always-visible tab there costs realtime resync.
        hideSponsoredPosts: true,
        hideSuggestedPosts: true,
        hideReels: true,
        protectWebRtcIp: true,
        hideVoicePlayed: true,
        bypassLinkShim: true,
      });
    }
  });

  // Keeping the two sets apart is the point. Merged into one list, the read receipt rule was
  // handed the typing label and reported a suppressed typing frame as a read receipt.
  it('never mixes the typing label into the read receipt set', () => {
    const config = buildSuppressionConfig('https://www.messenger.com/t/1', on);

    for (const label of FACEBOOK_SIGNATURES.typingLabels) {
      expect(config.readReceiptLabels).not.toContain(label);
    }
    for (const label of FACEBOOK_SIGNATURES.readReceiptLabels) {
      expect(config.typingLabels).not.toContain(label);
    }
  });

  it('grants only the typing set when read receipts are off', () => {
    const typingOnly: Settings = {
      ...on,
      features: { ...on.features, 'facebook.hideReadReceipts': false },
    };
    const config = buildSuppressionConfig('https://www.messenger.com/', typingOnly);

    expect(config.readReceiptLabels).toEqual([]);
    expect(config.readReceiptPaths).toEqual([]);
    expect(config.typingLabels).toEqual(FACEBOOK_SIGNATURES.typingLabels);
  });

  // The whole point of keeping the modules separate. Instagram is Meta on a different gateway
  // host where no label has ever been observed, and inheriting these would be a guess.
  it('does not leak Facebook MQTT labels to Instagram', () => {
    const config = buildSuppressionConfig('https://www.instagram.com/direct/t/1', on);
    expect(config.readReceiptLabels).toEqual([]);
    expect(config.readReceiptPaths).toEqual([]);
    expect(config.typingLabels).toEqual([]);
    expect(config.typingPaths).toEqual([]);
    expect(config.inboxWatermarkLabels).toEqual([]);
    expect(config.inboxWatermarkPaths).toEqual([]);
  });

  it('keeps Instagram suppression strictly separate from Facebook feature switches', () => {
    const igOff: Settings = {
      ...DEFAULT_SETTINGS,
      features: {
        ...DEFAULT_SETTINGS.features,
        'instagram.hideReadReceipts': false,
        'instagram.hideTyping': false,
        'instagram.hideStoryViews': false,
        'instagram.bypassLinkShim': false,
        'instagram.hideSuggestedPosts': false,
        'instagram.hideReels': false,
        'facebook.hideReadReceipts': true,
        'facebook.hideTyping': true,
        'facebook.hideStoryViews': true,
        'facebook.bypassLinkShim': true,
        'facebook.hideSuggestedPosts': true,
        'facebook.hideReels': true,
      },
    };

    expect(buildSuppressionConfig('https://www.instagram.com/direct/t/1', igOff)).toEqual(
      NOTHING,
    );
  });

  it('grants nothing on a site with no module', () => {
    expect(buildSuppressionConfig('https://example.com/', on)).toEqual(NOTHING);
    expect(buildSuppressionConfig(undefined, on)).toEqual(NOTHING);
  });

  it('grants nothing when the user turned the feature off', () => {
    const off: Settings = {
      ...on,
      features: {
        ...on.features,
        'facebook.hideReadReceipts': false,
        'facebook.hideTyping': false,
      },
    };
    const config = buildSuppressionConfig('https://www.messenger.com/', off);

    expect(config.readReceiptLabels).toEqual([]);
    expect(config.typingLabels).toEqual([]);
    expect(config.hideTyping).toBeUndefined();
  });

  it('grants nothing when the master switch is off', () => {
    const off: Settings = { ...on, masterEnabled: false };
    expect(buildSuppressionConfig('https://www.messenger.com/', off)).toEqual(NOTHING);
  });

  it('grants the labels by default, since the feature ships enabled', () => {
    const config = buildSuppressionConfig('https://www.messenger.com/', DEFAULT_SETTINGS);

    expect(config.readReceiptLabels).toEqual(FACEBOOK_SIGNATURES.readReceiptLabels);
    expect(config.typingLabels).toEqual(FACEBOOK_SIGNATURES.typingLabels);
  });

  it('grants hideStoryViews on facebook when enabled', () => {
    const withStory: Settings = {
      ...DEFAULT_SETTINGS,
      features: {
        ...DEFAULT_SETTINGS.features,
        'facebook.hideStoryViews': true,
        'instagram.hideStoryViews': false,
      },
    };
    expect(buildSuppressionConfig('https://www.facebook.com/', withStory).hideStoryViews).toBe(true);
    expect(
      buildSuppressionConfig('https://www.instagram.com/', withStory).hideStoryViews,
    ).toBeUndefined();
  });

  it('grants hideTyping on facebook when enabled', () => {
    const withTyping: Settings = {
      ...DEFAULT_SETTINGS,
      features: { ...DEFAULT_SETTINGS.features, 'facebook.hideTyping': true },
    };
    expect(buildSuppressionConfig('https://www.facebook.com/', withTyping).hideTyping).toBe(true);
  });

  it('grants blockFeedAutoRefresh on facebook when enabled', () => {
    const withFeed: Settings = {
      ...DEFAULT_SETTINGS,
      features: { ...DEFAULT_SETTINGS.features, 'facebook.blockFeedAutoRefresh': true },
    };
    expect(buildSuppressionConfig('https://www.facebook.com/', withFeed).blockFeedAutoRefresh).toBe(
      true,
    );
    expect(
      buildSuppressionConfig('https://www.instagram.com/', withFeed).blockFeedAutoRefresh,
    ).toBeUndefined();
  });

  it('withholds blockFeedAutoRefresh on messaging surfaces', () => {
    const withFeed: Settings = {
      ...DEFAULT_SETTINGS,
      features: {
        ...DEFAULT_SETTINGS.features,
        'facebook.blockFeedAutoRefresh': true,
        'instagram.blockFeedAutoRefresh': true,
      },
    };

    for (const url of [
      'https://www.messenger.com/t/1',
      'https://www.facebook.com/messages',
      'https://www.facebook.com/messages/t/1',
      'https://www.instagram.com/direct/inbox/',
    ]) {
      expect(buildSuppressionConfig(url, withFeed).blockFeedAutoRefresh).toBeUndefined();
    }

    // The browsing surface of the same site still gets it.
    expect(
      buildSuppressionConfig('https://www.facebook.com/', withFeed).blockFeedAutoRefresh,
    ).toBe(true);
  });

  it('grants hideSponsoredPosts on facebook when enabled', () => {
    const withSponsored: Settings = {
      ...DEFAULT_SETTINGS,
      features: { ...DEFAULT_SETTINGS.features, 'facebook.hideSponsoredPosts': true },
    };
    expect(buildSuppressionConfig('https://www.facebook.com/', withSponsored).hideSponsoredPosts).toBe(
      true,
    );
    expect(
      buildSuppressionConfig('https://www.instagram.com/', withSponsored).hideSponsoredPosts,
    ).toBeUndefined();
  });

  it('grants hideSuggestedPosts on facebook when enabled', () => {
    const withDeclutter: Settings = {
      ...DEFAULT_SETTINGS,
      features: {
        ...DEFAULT_SETTINGS.features,
        'facebook.hideSuggestedPosts': true,
        'instagram.hideSuggestedPosts': false,
      },
    };
    expect(buildSuppressionConfig('https://www.facebook.com/', withDeclutter).hideSuggestedPosts).toBe(
      true,
    );
    expect(
      buildSuppressionConfig('https://www.instagram.com/', withDeclutter).hideSuggestedPosts,
    ).toBeUndefined();
  });

  it('grants hideReels on facebook when enabled', () => {
    const withReels: Settings = {
      ...DEFAULT_SETTINGS,
      features: {
        ...DEFAULT_SETTINGS.features,
        'facebook.hideReels': true,
        'instagram.hideReels': false,
      },
    };
    expect(buildSuppressionConfig('https://www.facebook.com/', withReels).hideReels).toBe(
      true,
    );
    expect(
      buildSuppressionConfig('https://www.instagram.com/', withReels).hideReels,
    ).toBeUndefined();
  });

  it('grants bypassLinkShim on facebook when enabled', () => {
    const withLinkShim: Settings = {
      ...DEFAULT_SETTINGS,
      features: {
        ...DEFAULT_SETTINGS.features,
        'facebook.bypassLinkShim': true,
        'instagram.bypassLinkShim': false,
      },
    };
    expect(buildSuppressionConfig('https://www.facebook.com/', withLinkShim).bypassLinkShim).toBe(
      true,
    );
    expect(
      buildSuppressionConfig('https://www.instagram.com/', withLinkShim).bypassLinkShim,
    ).toBeUndefined();
  });

  it('correctly builds suppression config for instagram when features are enabled', () => {
    const igSettings: Settings = {
      ...DEFAULT_SETTINGS,
      features: {
        ...DEFAULT_SETTINGS.features,
        'instagram.hideReadReceipts': true,
        'instagram.hideTyping': true,
        'instagram.hideStoryViews': true,
        'instagram.bypassLinkShim': true,
        'instagram.hideSuggestedPosts': true,
        'instagram.hideReels': true,
      },
    };

    const config = buildSuppressionConfig('https://www.instagram.com/direct/t/123', igSettings);
    expect(config.hideReadReceipts).toBe(true);
    expect(config.hideTyping).toBe(true);
    expect(config.hideStoryViews).toBe(true);
    expect(config.bypassLinkShim).toBe(true);
    expect(config.hideSuggestedPosts).toBe(true);
    expect(config.hideReels).toBe(true);
    // Should not inherit facebook DGW labels
    expect(config.readReceiptLabels).toEqual([]);
    expect(config.typingLabels).toEqual([]);
  });
});


