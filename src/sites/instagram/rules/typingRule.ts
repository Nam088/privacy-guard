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

const DIRECT_TYPING_REGEX = /direct.*typing|activity.*status|polaris.*activity/i;

function isInstagramTypingOperation(name: string): boolean {
  if (DIRECT_TYPING_REGEX.test(name)) {
    return true;
  }
  const lowered = name.toLowerCase();
  return INSTAGRAM_SIGNATURES.typingMutations.some((known) => known.toLowerCase() === lowered);
}

/**
 * InstagramTypingRule: Suppresses typing indicators in Instagram Direct.
 *
 * Drops typing starts (activity_status=1 / typing=true) while preserving idle/stop signals
 * so the conversation state remains stable.
 */
export class InstagramTypingRule implements SuppressionRule, HttpSuppressionRule {
  readonly id = 'instagram.hideTyping';
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
          text.includes('activity_status_indication') ||
          text.includes('typing_indicator') ||
          (text.includes('"activity_status"') && text.includes('"1"'))
        ) {
          // If explicitly idle/stopped (status 0), allow it to clear typing
          if (text.includes('"activity_status":"0"') || text.includes('"activity_status":0')) {
            return null;
          }
          return {
            action: 'drop',
            ruleId: this.id,
            reason: 'instagram-realtime-typing',
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
    for (const pattern of INSTAGRAM_SIGNATURES.typingRestPatterns) {
      if (pattern.test(url)) {
        let bodyString = '';
        if (typeof body === 'string') {
          bodyString = body;
        } else if (body && typeof body === 'object') {
          try {
            bodyString = JSON.stringify(body);
          } catch {
            bodyString = String(body);
          }
        }

        // Check if this is an idle / stop-typing signal
        const isIdle =
          bodyString.includes('activity_status=0') ||
          bodyString.includes('"activity_status":0') ||
          bodyString.includes('"activity_status":"0"');

        if (isIdle) {
          // Allow idle signal through to stop typing bubble cleanly
          return null;
        }

        return {
          action: 'drop',
          ruleId: this.id,
          reason: 'instagram-rest-typing',
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
      const action = decideByOperationNames(names, isInstagramTypingOperation);
      if (action !== 'pass') {
        return {
          action,
          ruleId: this.id,
          reason: action === 'drop' ? 'instagram-graphql-typing' : 'mixed-typing',
          metadata: { operations: names },
        };
      }
    }

    return null;
  }
}
