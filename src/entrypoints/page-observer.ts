import { defineUnlistedScript } from '#imports';
import { installObservers } from '@/observe/install';
import { scrub } from '@/observe/scrub';
import type { ObservedEvent } from '@/observe/types';
import type { SendDecision, SendVerdict } from '@/observe/websocket';
import { RuleEngine } from '@/engine';
import {
  FacebookInboxWatermarkRule,
  FacebookReadReceiptRule,
  FacebookStoryViewsRule,
  FacebookTypingRule,
  FacebookVoiceMemoRule,
} from '@/sites/facebook/rules';
import { transformStreamControllerPresence } from '@/observe/stealthPresence';
import { isDwellTelemetryData } from '@/observe/telemetry';
import {
  attachLinkShimBypass,
  isLinkShimUrl,
  unwrapLinkShim,
} from '@/observe/linkShim';
import { findSiteForUrl } from '@/sites/registry';

export const OBSERVER_EVENT = 'privacy-guard:observed';
export const CONFIGURE_EVENT = 'privacy-guard:configure';

export interface ObserverConfig {
  readonly capture?: boolean;
  /** Read receipt task labels to suppress. Empty means suppress none, which is the start state. */
  readonly readReceiptLabels?: readonly string[];
  /** Socket paths the read receipt labels were observed on. A frame elsewhere is never inspected. */
  readonly readReceiptPaths?: readonly string[];
  /** Typing task labels to suppress. Kept apart so each rule reports only what it acted on. */
  readonly typingLabels?: readonly string[];
  /** Socket paths the typing labels were observed on. */
  readonly typingPaths?: readonly string[];
  /** Inbox watermark task labels to suppress. The payload, not the label, settles each frame. */
  readonly inboxWatermarkLabels?: readonly string[];
  /** Socket paths the inbox watermark labels were observed on. */
  readonly inboxWatermarkPaths?: readonly string[];
  /** Whether facebook story views should be suppressed. */
  readonly hideStoryViews?: boolean;
  /** Whether typing indicators should be suppressed. */
  readonly hideTyping?: boolean;
  /** Whether feed auto-refresh should be blocked. */
  readonly blockFeedAutoRefresh?: boolean;
  /** Whether sponsored posts should be hidden. */
  readonly hideSponsoredPosts?: boolean;
  /** Whether suggested posts should be hidden. */
  readonly hideSuggestedPosts?: boolean;
  /** Whether reels and short videos should be hidden. */
  readonly hideReels?: boolean;
  /** Whether active online status (green dot) should be hidden. */
  readonly hideOnlineStatus?: boolean;
  /** Whether WebRTC IP leak shield should be enabled. */
  readonly protectWebRtcIp?: boolean;
  /** Whether voice note played markers should be suppressed. */
  readonly hideVoicePlayed?: boolean;
  /** Whether dwell time analytics should be scrambled. */
  readonly scrambleDwellTime?: boolean;
  /** Whether Meta Link Shim redirect tracking should be bypassed. */
  readonly bypassLinkShim?: boolean;
}

export default defineUnlistedScript(() => {
  const target = document.currentScript ?? document.documentElement;
  let capturing = false;

  const engine = new RuleEngine();
  const storyRule = new FacebookStoryViewsRule();
  const voiceMemoRule = new FacebookVoiceMemoRule();
  const typingHttpRule = new FacebookTypingRule();
  const readReceiptHttpRule = new FacebookReadReceiptRule();

  let storyViewsActive = false;
  let typingActive = false;
  let feedAutoRefreshActive = false;
  let sponsoredPostsActive = false;
  let suggestedPostsActive = false;
  let reelsActive = false;
  let onlineStatusHidden = false;
  let webRtcProtected = false;
  let voicePlayedActive = false;
  let dwellTimeScrambled = false;
  let readReceiptsActive = false;
  let linkShimBypassed = false;

  let isFacebookSite = false;
  const currentSite = findSiteForUrl(location.href);
  if (currentSite && currentSite.id === 'facebook') {
    isFacebookSite = true;
  }

  attachLinkShimBypass(document, () => linkShimBypassed);

  const origWindowOpen = window.open;
  window.open = function (url?: string | URL, targetWindow?: string, features?: string) {
    if (linkShimBypassed && typeof url === 'string' && isLinkShimUrl(url)) {
      const unwrapped = unwrapLinkShim(url);
      if (unwrapped) {
        return origWindowOpen.call(this, unwrapped, targetWindow, features);
      }
    }
    return origWindowOpen.call(this, url, targetWindow, features);
  };

  document.addEventListener(CONFIGURE_EVENT, (event) => {
    const rawDetail = (event as CustomEvent<ObserverConfig | string>).detail;
    let detail: ObserverConfig = {};
    if (typeof rawDetail === 'string') {
      try {
        detail = JSON.parse(rawDetail) as ObserverConfig;
      } catch {
        detail = {};
      }
    } else if (rawDetail && typeof rawDetail === 'object') {
      detail = rawDetail;
    }
    capturing = Boolean(detail.capture);
    storyViewsActive = Boolean(detail.hideStoryViews);
    typingActive = Boolean(detail.hideTyping);
    feedAutoRefreshActive = Boolean(detail.blockFeedAutoRefresh);
    sponsoredPostsActive = Boolean(detail.hideSponsoredPosts);
    suggestedPostsActive = Boolean(detail.hideSuggestedPosts);
    reelsActive = Boolean(detail.hideReels);
    onlineStatusHidden = Boolean(detail.hideOnlineStatus);
    webRtcProtected = Boolean(detail.protectWebRtcIp);
    voicePlayedActive = Boolean(detail.hideVoicePlayed);
    dwellTimeScrambled = Boolean(detail.scrambleDwellTime);
    linkShimBypassed = Boolean(detail.bypassLinkShim);

    const readReceiptLabels = detail.readReceiptLabels ?? [];
    const typingLabels = detail.typingLabels ?? [];
    const inboxWatermarkLabels = detail.inboxWatermarkLabels ?? [];

    readReceiptsActive = readReceiptLabels.length > 0;

    const activeRules = [];
    if (readReceiptLabels.length > 0) {
      activeRules.push(new FacebookReadReceiptRule(readReceiptLabels, detail.readReceiptPaths));
    }
    if (typingLabels.length > 0) {
      activeRules.push(new FacebookTypingRule(typingLabels, detail.typingPaths));
    }
    if (inboxWatermarkLabels.length > 0) {
      activeRules.push(
        new FacebookInboxWatermarkRule(inboxWatermarkLabels, detail.inboxWatermarkPaths),
      );
    }
    engine.updateRules(activeRules);
  });

  function intercept(url: string, data: unknown): SendVerdict | SendDecision {
    if (onlineStatusHidden && url.includes('/ws/streamcontroller')) {
      const modified = transformStreamControllerPresence(url, data);
      return { action: 'pass', modifiedData: modified };
    }
    if (dwellTimeScrambled && url.includes('/ws/realtime') && isDwellTelemetryData(data)) {
      return 'drop';
    }
    const decision = engine.intercept(url, data);
    return decision.action;
  }

  const interceptReceive = (): 'pass' | 'drop' => 'pass';

  function interceptHttp(url: string, body?: unknown): 'pass' | 'drop' {
    if (storyViewsActive) {
      const storyVerdict = storyRule.evaluateHttp(url, body);
      if (storyVerdict && storyVerdict.action === 'drop') {
        return 'drop';
      }
    }
    if (voicePlayedActive) {
      const voiceVerdict = voiceMemoRule.evaluateHttp(url, body);
      if (voiceVerdict && voiceVerdict.action === 'drop') {
        return 'drop';
      }
    }
    if (typingActive) {
      const typingVerdict = typingHttpRule.evaluateHttp(url, body);
      if (typingVerdict && typingVerdict.action === 'drop') {
        return 'drop';
      }
    }
    if (readReceiptsActive) {
      const readVerdict = readReceiptHttpRule.evaluateHttp(url, body);
      if (readVerdict && readVerdict.action === 'drop') {
        return 'drop';
      }
    }
    return 'pass';
  }

  function interceptWorker(data: unknown): 'pass' | 'drop' {
    if (typingActive) {
      const verdict = typingHttpRule.evaluateWorker(data);
      if (verdict === 'drop') {
        return 'drop';
      }
    }
    if (readReceiptsActive) {
      const verdict = readReceiptHttpRule.evaluateWorker(data);
      if (verdict === 'drop') {
        return 'drop';
      }
    }
    return 'pass';
  }

  let isTypingSuppressed: (() => boolean) | undefined = undefined;
  let isReadSuppressed: (() => boolean) | undefined = undefined;
  if (isFacebookSite) {
    isTypingSuppressed = () => typingActive;
    isReadSuppressed = () => readReceiptsActive;
  }

  let isSponsoredActive: (() => boolean) | undefined = undefined;
  let isSuggestedActive: (() => boolean) | undefined = undefined;
  let isReelsActive: (() => boolean) | undefined = undefined;
  if (isFacebookSite) {
    isSponsoredActive = () => sponsoredPostsActive;
    isSuggestedActive = () => suggestedPostsActive;
    isReelsActive = () => reelsActive;
  }

  installObservers(
    window as unknown as Parameters<typeof installObservers>[0],
    (event: ObservedEvent, raw?: unknown) => {
      if (capturing) {
        attachPayload(event, raw);
      }
      let detail: unknown = event;
      // @ts-expect-error Firefox global cloneInto
      if (typeof cloneInto === 'function' && document.defaultView) {
        try {
          // @ts-expect-error Firefox global cloneInto
          detail = cloneInto(event, document.defaultView);
        } catch {
          detail = event;
        }
      }
      target.dispatchEvent(
        new CustomEvent(OBSERVER_EVENT, { detail, bubbles: true }),
      );
    },
    {
      frameUrl: location.href,
      interceptSocket: intercept,
      interceptReceiveSocket: interceptReceive,
      interceptFetch: interceptHttp,
      interceptXhr: interceptHttp,
      interceptWorker,
      isTypingSuppressed,
      isReadSuppressed,
      isFeedAutoRefreshBlocked: () => feedAutoRefreshActive,
      isSponsoredActive,
      isSuggestedActive,
      isReelsActive,
      isWebRtcProtected: () => webRtcProtected,
      isDwellTimeScrambled: () => dwellTimeScrambled,
    },
  );
});

function attachPayload(event: ObservedEvent, raw?: unknown): void {
  try {
    event.payload = JSON.stringify(scrub(raw));
  } catch {
    // A payload that cannot be described is simply not recorded.
  }
}
