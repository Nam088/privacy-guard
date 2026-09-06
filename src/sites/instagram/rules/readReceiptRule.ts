import type {
  HttpSuppressionRule,
  InterceptContext,
  RuleVerdict,
  SuppressionRule,
} from '@/engine';
import { INSTAGRAM_SIGNATURES } from '../signatures';
import {
  GRAPHQL_PATHS,
  collectOperationNames,
  decideByOperationNames,
  parseGraphQLUrl,
} from '../../facebook/rules/graphqlRequest';

const DIRECT_SEEN_REGEX = /direct.*seen|seen.*direct|mark.*thread.*seen/i;

function isInstagramReadReceiptOperation(name: string): boolean {
  if (DIRECT_SEEN_REGEX.test(name)) {
    return true;
  }
  const lowered = name.toLowerCase();
  return INSTAGRAM_SIGNATURES.readReceiptMutations.some((known) => known.toLowerCase() === lowered);
}

/**
 * InstagramReadReceiptRule: Drops seen markers and read receipts in Instagram Direct.
 *
 * Intercepts:
 * 1. REST endpoints: /api/v1/direct_v2/threads/.../items/.../seen/
 * 2. GraphQL mutations: direct_thread_seen, PolarisDirectThreadSeenMutation
 * 3. Realtime WebSocket payloads on gateway.instagram.com / edge-chat.instagram.com
 */
export class InstagramReadReceiptRule implements SuppressionRule, HttpSuppressionRule {
  readonly id = 'instagram.hideReadReceipts';
  readonly targetPaths: readonly string[] = ['/chat', '/ws/realtime', '/pubsub'];
  readonly targetHttpPaths: readonly string[] = [
    ...GRAPHQL_PATHS,
    '/api/v1/direct_v2/threads/',
  ];

  evaluate(context: InterceptContext): RuleVerdict | null {
    const url = context.url.toLowerCase();
    const isInstagramWs = INSTAGRAM_SIGNATURES.wsHosts.some((host) => url.includes(host));
    if (!isInstagramWs) {
      return null;
    }

    const bytes = context.getBytes();
    if (bytes) {
      try {
        const text = new TextDecoder('utf-8').decode(bytes);
        if (
          text.includes('direct_v2_seen') ||
          text.includes('thread_seen') ||
          text.includes('mark_seen') ||
          text.includes('"action":"seen"')
        ) {
          return {
            action: 'drop',
            ruleId: this.id,
            reason: 'instagram-realtime-read-receipt',
            metadata: { channel: 'instagram.ws' },
          };
        }
      } catch {
        // pass through if undecodable
      }
    }

    return null;
  }

  evaluateHttp(url: string, body: unknown): RuleVerdict | null {
    // 1. Check REST endpoints
    for (const pattern of INSTAGRAM_SIGNATURES.readReceiptRestPatterns) {
      if (pattern.test(url)) {
        return {
          action: 'drop',
          ruleId: this.id,
          reason: 'instagram-rest-read-receipt',
          metadata: {
            url,
            simulatedResponse: { status: 200, body: JSON.stringify({ status: 'ok' }) },
          },
        };
      }
    }

    // 2. Check GraphQL mutations
    const parsedUrl = parseGraphQLUrl(url);
    if (parsedUrl !== null) {
      const names = collectOperationNames(parsedUrl, body);
      const action = decideByOperationNames(names, isInstagramReadReceiptOperation);
      if (action !== 'pass') {
        return {
          action,
          ruleId: this.id,
          reason: action === 'drop' ? 'instagram-graphql-read-receipt' : 'mixed-read-receipt',
          metadata: { operations: names },
        };
      }
    }

    return null;
  }
}
