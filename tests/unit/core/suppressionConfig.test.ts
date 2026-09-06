import { describe, expect, it } from 'vitest';
import { buildSuppressionConfig } from '@/core/suppressionConfig';
import { SITE_MODULES } from '@/sites/registry';
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
        blockFeedAutoRefresh: true,
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
  it('grants Instagram nothing', () => {
    expect(buildSuppressionConfig('https://www.instagram.com/direct/t/1', on)).toEqual(NOTHING);
  });

  // Found by mutation: deleting the site check broke nothing, because Instagram's own
  // hideReadReceipts is `planned` and the feature status was silently doing the work. The day that
  // status changes, this is the test that has to fail rather than the labels leaking across.
  it('grants Instagram nothing even though it lists the same feature', () => {
    expect(
      SITE_MODULES.find((module) => module.id === 'instagram')?.features.map((f) => f.id),
    ).toContain('hideReadReceipts');

    const everythingOn: Settings = {
      ...DEFAULT_SETTINGS,
      features: Object.fromEntries(
        SITE_MODULES.flatMap((module) => module.features.map((f) => [`${module.id}.${f.id}`, true])),
      ),
    };

    expect(buildSuppressionConfig('https://www.instagram.com/direct/t/1', everythingOn)).toEqual(
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
      features: { ...DEFAULT_SETTINGS.features, 'facebook.hideStoryViews': true },
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
      features: { ...DEFAULT_SETTINGS.features, 'facebook.hideSuggestedPosts': true },
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
      features: { ...DEFAULT_SETTINGS.features, 'facebook.hideReels': true },
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
      features: { ...DEFAULT_SETTINGS.features, 'facebook.bypassLinkShim': true },
    };
    expect(buildSuppressionConfig('https://www.facebook.com/', withLinkShim).bypassLinkShim).toBe(
      true,
    );
    expect(
      buildSuppressionConfig('https://www.instagram.com/', withLinkShim).bypassLinkShim,
    ).toBeUndefined();
  });
});

