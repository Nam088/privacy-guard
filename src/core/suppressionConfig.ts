import { isFeatureOn, type Settings } from './settings/schema';
import { FACEBOOK_SIGNATURES } from '@/sites/facebook/signatures';
import { INSTAGRAM_SIGNATURES } from '@/sites/instagram/signatures';
import { findSiteForUrl, isMessagingSurface } from '@/sites/registry';
import { featureKey } from '@/sites/types';

/**
 * What the page observer is allowed to suppress on one page.
 *
 * The labels are kept apart per feature rather than merged into one list. Merging them looked
 * harmless, since both features drop frames on the same socket, but it meant the read receipt
 * rule was handed the typing label and reported a suppressed typing frame as a read receipt. A
 * suppressor that misreports what it did cannot be audited, and auditing it is the point.
 */
export interface SuppressionConfig {
  readonly siteId?: 'facebook' | 'instagram';
  readonly readReceiptLabels: readonly string[];
  readonly readReceiptPaths: readonly string[];
  readonly typingLabels: readonly string[];
  readonly typingPaths: readonly string[];
  readonly inboxWatermarkLabels: readonly string[];
  readonly inboxWatermarkPaths: readonly string[];
  readonly hideReadReceipts?: boolean;
  readonly hideStoryViews?: boolean;
  readonly hideTyping?: boolean;
  readonly blockFeedAutoRefresh?: boolean;
  readonly hideSponsoredPosts?: boolean;
  readonly hideSuggestedPosts?: boolean;
  readonly hideReels?: boolean;
  readonly hideOnlineStatus?: boolean;
  readonly protectWebRtcIp?: boolean;
  readonly hideVoicePlayed?: boolean;
  readonly scrambleDwellTime?: boolean;
  readonly bypassLinkShim?: boolean;
  readonly mediaDownloader?: boolean;
}

const NOTHING: SuppressionConfig = {
  readReceiptLabels: [],
  readReceiptPaths: [],
  typingLabels: [],
  typingPaths: [],
  inboxWatermarkLabels: [],
  inboxWatermarkPaths: [],
};

/**
 * Works out what the page observer should suppress on this page.
 *
 * Supports Facebook and Instagram with platform-specific signatures and rules.
 */
export function buildSuppressionConfig(
  url: string | undefined,
  settings: Settings,
): SuppressionConfig {
  const site = findSiteForUrl(url);
  if (site === null || (site.id !== 'facebook' && site.id !== 'instagram')) {
    return NOTHING;
  }

  const isReadOn = isFeatureOn(settings, featureKey(site.id, 'hideReadReceipts'));
  const isTypingOn = isFeatureOn(settings, featureKey(site.id, 'hideTyping'));
  const isStoryOn = isFeatureOn(settings, featureKey(site.id, 'hideStoryViews'));
  const isFeedReloadOn = isFeatureOn(settings, featureKey(site.id, 'blockFeedAutoRefresh'));
  const isSponsoredPostsOn = isFeatureOn(settings, featureKey(site.id, 'hideSponsoredPosts'));
  const isSuggestedPostsOn = isFeatureOn(settings, featureKey(site.id, 'hideSuggestedPosts'));
  const isReelsOn = isFeatureOn(settings, featureKey(site.id, 'hideReels'));
  const isInboxLastSeenOn = isFeatureOn(settings, featureKey(site.id, 'hideInboxLastSeen'));
  const isOnlineStatusHiddenOn = isFeatureOn(settings, featureKey(site.id, 'hideOnlineStatus'));
  const isWebRtcProtectedOn = isFeatureOn(settings, featureKey(site.id, 'protectWebRtcIp'));
  const isVoicePlayedHiddenOn = isFeatureOn(settings, featureKey(site.id, 'hideVoicePlayed'));
  const isDwellTimeScrambledOn = isFeatureOn(settings, featureKey(site.id, 'scrambleDwellTime'));
  const isLinkShimBypassedOn = isFeatureOn(settings, featureKey(site.id, 'bypassLinkShim'));

  let readReceiptLabels: readonly string[] = [];
  let readReceiptPaths: readonly string[] = [];
  let typingLabels: readonly string[] = [];
  let typingPaths: readonly string[] = [];
  let inboxWatermarkLabels: readonly string[] = [];
  let inboxWatermarkPaths: readonly string[] = [];

  if (site.id === 'facebook') {
    if (isReadOn) {
      readReceiptLabels = FACEBOOK_SIGNATURES.readReceiptLabels;
      readReceiptPaths = FACEBOOK_SIGNATURES.readReceiptPaths;
    }
    if (isTypingOn) {
      typingLabels = FACEBOOK_SIGNATURES.typingLabels;
      typingPaths = FACEBOOK_SIGNATURES.typingPaths;
    }
    if (isInboxLastSeenOn) {
      inboxWatermarkLabels = FACEBOOK_SIGNATURES.inboxWatermarkLabels;
      inboxWatermarkPaths = FACEBOOK_SIGNATURES.inboxWatermarkPaths;
    }
  } else if (site.id === 'instagram') {
    if (isReadOn) {
      readReceiptLabels = INSTAGRAM_SIGNATURES.readReceiptLabels;
      readReceiptPaths = INSTAGRAM_SIGNATURES.readReceiptPaths;
    }
    if (isTypingOn) {
      typingLabels = INSTAGRAM_SIGNATURES.typingLabels;
      typingPaths = INSTAGRAM_SIGNATURES.typingPaths;
    }
    if (isInboxLastSeenOn) {
      inboxWatermarkLabels = INSTAGRAM_SIGNATURES.inboxWatermarkLabels;
      inboxWatermarkPaths = INSTAGRAM_SIGNATURES.inboxWatermarkPaths;
    }
  }

  const result: {
    readReceiptLabels: readonly string[];
    readReceiptPaths: readonly string[];
    typingLabels: readonly string[];
    typingPaths: readonly string[];
    inboxWatermarkLabels: readonly string[];
    inboxWatermarkPaths: readonly string[];
    hideReadReceipts?: boolean;
    hideStoryViews?: boolean;
    hideTyping?: boolean;
    blockFeedAutoRefresh?: boolean;
    hideSponsoredPosts?: boolean;
    hideSuggestedPosts?: boolean;
    hideReels?: boolean;
    hideOnlineStatus?: boolean;
    protectWebRtcIp?: boolean;
    hideVoicePlayed?: boolean;
    scrambleDwellTime?: boolean;
    bypassLinkShim?: boolean;
    mediaDownloader?: boolean;
  } = {
    readReceiptLabels,
    readReceiptPaths,
    typingLabels,
    typingPaths,
    inboxWatermarkLabels,
    inboxWatermarkPaths,
  };

  if (site.id === 'instagram' && isReadOn) {
    result.hideReadReceipts = true;
  }
  if (isStoryOn) {
    result.hideStoryViews = true;
  }
  if (isTypingOn) {
    result.hideTyping = true;
  }
  // Held back on the inbox: there is no reading position to keep there, and a client told it
  // never lost focus skips the reconnect and resync it runs on the way back to a visible tab.
  if (isFeedReloadOn && !isMessagingSurface(url)) {
    result.blockFeedAutoRefresh = true;
  }
  if (isSponsoredPostsOn) {
    result.hideSponsoredPosts = true;
  }
  if (isSuggestedPostsOn) {
    result.hideSuggestedPosts = true;
  }
  if (isReelsOn) {
    result.hideReels = true;
  }
  if (isOnlineStatusHiddenOn) {
    result.hideOnlineStatus = true;
  }
  if (isWebRtcProtectedOn) {
    result.protectWebRtcIp = true;
  }
  if (isVoicePlayedHiddenOn) {
    result.hideVoicePlayed = true;
  }
  if (isDwellTimeScrambledOn) {
    result.scrambleDwellTime = true;
  }
  if (isLinkShimBypassedOn) {
    result.bypassLinkShim = true;
  }
  const isMediaDownloaderOn = isFeatureOn(settings, featureKey(site.id, 'mediaDownloader'));
  if (isMediaDownloaderOn) {
    result.mediaDownloader = true;
  }

  return result;
}
