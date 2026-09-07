import type { HttpSuppressionRule, RuleVerdict } from '@/engine';
import { INSTAGRAM_SIGNATURES } from '../signatures';
import {
  GRAPHQL_PATHS,
  collectOperationNames,
  decideByOperationNames,
  parseGraphQLUrl,
} from '../../facebook/rules/graphqlRequest';

const LIVE_STREAM_SEEN_REGEX =
  /(?:live.*(?:seen|join|heartbeat|presence|ping|cvc)|(?:seen|join|heartbeat|ping|cvc).*live)/i;

function isInstagramLiveSeenOperation(name: string): boolean {
  if (LIVE_STREAM_SEEN_REGEX.test(name)) {
    return true;
  }
  const lowered = name.toLowerCase();
  return INSTAGRAM_SIGNATURES.liveSeenMutations.some(
    (known) => known.toLowerCase() === lowered,
  );
}

/**
 * InstagramLiveStreamViewsRule: Strategy for suppressing Instagram Live join & heartbeat events.
 *
 * Drops REST `/api/v1/live/{id}/heartbeat_and_get_viewer_count/`, `/api/v1/live/{id}/join/`
 * and GraphQL `PolarisLiveViewerJoinMutation`, `PolarisLiveHeartbeatMutation`.
 * Answers with synthetic 200 OK so the live video player streams smoothly without logging the user.
 */
export class InstagramLiveStreamViewsRule implements HttpSuppressionRule {
  readonly id = 'instagram.hideLiveStreamViews';
  readonly targetPaths: readonly string[] = [
    ...GRAPHQL_PATHS,
    '/api/v1/live/',
  ];

  evaluateHttp(url: string, body: unknown): RuleVerdict | null {
    // 1. Check REST endpoints
    for (const pattern of INSTAGRAM_SIGNATURES.liveSeenRestPatterns) {
      if (pattern.test(url)) {
        return {
          action: 'drop',
          ruleId: this.id,
          reason: 'instagram-rest-live-seen',
          metadata: {
            url,
            simulatedResponse: { status: 200, body: JSON.stringify({ status: 'ok' }) },
          },
        };
      }
    }

    // 2. Check GraphQL mutations
    const parsedUrl = parseGraphQLUrl(url, 'instagram');
    if (parsedUrl !== null) {
      const names = collectOperationNames(parsedUrl, body);
      const action = decideByOperationNames(names, isInstagramLiveSeenOperation);
      if (action !== 'pass') {
        return {
          action,
          ruleId: this.id,
          reason: action === 'drop' ? 'instagram-graphql-live-seen' : 'mixed-live-seen',
          metadata: {
            operations: names,
            simulatedResponse: { status: 200, body: JSON.stringify({ data: { status: 'ok' } }) },
          },
        };
      }
    }

    return null;
  }
}
