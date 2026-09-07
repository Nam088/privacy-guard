import type { HttpSuppressionRule, RuleVerdict } from '@/engine';
import { FACEBOOK_SIGNATURES } from '../signatures';
import {
  GRAPHQL_PATHS,
  collectOperationNames,
  decideByOperationNames,
  parseGraphQLUrl,
} from './graphqlRequest';

export const LIVE_STREAM_SEEN_PATTERN =
  /(?:live.*(?:seen|join|heartbeat|presence|ping|cvc)|(?:seen|join|heartbeat|ping|cvc).*live)/i;

function isLiveStreamSeenOperation(name: string): boolean {
  if (LIVE_STREAM_SEEN_PATTERN.test(name)) {
    return true;
  }
  const lowered = name.toLowerCase();
  return FACEBOOK_SIGNATURES.liveStreamMutations.some(
    (known) => known.toLowerCase() === lowered,
  );
}

function isCvcEndpoint(url: string): boolean {
  try {
    const parsed = new URL(url, 'https://web.facebook.com');
    return (
      parsed.pathname === '/video/unified_cvc/' ||
      parsed.pathname === '/video/unified_cvc' ||
      parsed.pathname.includes('/video/unified_cvc')
    );
  } catch {
    return url.includes('/video/unified_cvc');
  }
}

/**
 * FacebookLiveStreamViewsRule: Strategy for suppressing Facebook Live Stream presence & viewer heartbeats.
 *
 * Intercepts and suppresses:
 * 1. REST `/video/unified_cvc/` Concurrent Viewer Count heartbeat pings.
 * 2. GraphQL `LiveViewerJoinMutation`, `LiveVideoViewerPingMutation`, `LiveVideoCometNuxForCVCQuery`, etc.
 *
 * Drops these tracking requests and answers with a synthetic 200 OK so video playback
 * from CDN continues smoothly while the viewer remains completely invisible.
 */
export class FacebookLiveStreamViewsRule implements HttpSuppressionRule {
  readonly id = 'facebook.hideLiveStreamViews';
  readonly targetPaths: readonly string[] = [
    ...GRAPHQL_PATHS,
    ...FACEBOOK_SIGNATURES.liveStreamPaths,
  ];

  evaluateHttp(url: string, body: unknown): RuleVerdict | null {
    // 1. Check CVC (Concurrent Viewer Count) endpoint
    if (isCvcEndpoint(url)) {
      return {
        action: 'drop',
        ruleId: this.id,
        reason: 'live-cvc-ping',
        metadata: { url },
      };
    }

    // 2. Check GraphQL mutations/queries
    const parsedUrl = parseGraphQLUrl(url);
    if (parsedUrl === null) {
      return null;
    }

    const names = collectOperationNames(parsedUrl, body);
    const action = decideByOperationNames(names, isLiveStreamSeenOperation);
    if (action === 'pass') {
      return null;
    }

    let reason = 'mixed-live-stream-seen';
    if (action === 'drop') {
      reason = 'live-stream-seen-mutation';
    }

    return {
      action,
      ruleId: this.id,
      reason,
      metadata: { operations: names },
    };
  }
}
