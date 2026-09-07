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
import { collectWorkerActions } from '@/sites/workerUtil';

const TYPING_MUTATION_PATTERN =
  /typing.{0,30}mutation|typsubscription|direct.*typing|activity.*status|polaris.*activity/i;

function isInstagramTypingOperation(name: string): boolean {
  if (TYPING_MUTATION_PATTERN.test(name)) {
    return true;
  }
  const lowered = name.toLowerCase();
  return INSTAGRAM_SIGNATURES.typingMutations.some((known) => known.toLowerCase() === lowered);
}

/**
 * InstagramTypingRule: Strategy for suppressing Instagram Direct typing indicators.
 *
 * In 2026, Instagram Direct uses Meta's unified LightSpeed / DGW task label 3,
 * realtime WebSocket frames, and GraphQL typing mutations.
 *
 * Drops typing pings while preserving idle / stop-typing signals so the UI state doesn't freeze.
 */
export class InstagramTypingRule implements SuppressionRule, HttpSuppressionRule {
  readonly id = 'instagram.hideTyping';
  readonly targetPaths: readonly string[];
  readonly targetHttpPaths: readonly string[] = [
    ...GRAPHQL_PATHS,
    '/api/v1/direct_v2/threads/',
  ];

  private readonly signalLabels: readonly string[];

  constructor(
    signalLabels: readonly string[] = INSTAGRAM_SIGNATURES.typingLabels,
    targetPaths: readonly string[] = INSTAGRAM_SIGNATURES.typingPaths,
  ) {
    this.signalLabels = signalLabels;
    this.targetPaths = targetPaths;
  }

  evaluate(context: InterceptContext): RuleVerdict | null {
    const url = context.url.toLowerCase();

    // 1. Realtime text frame inspection (/ws/realtime, gateway, edge-chat)
    if (
      url.includes('/ws/realtime') ||
      INSTAGRAM_SIGNATURES.wsHosts.some((host) => url.includes(host))
    ) {
      const bytes = context.getBytes();
      if (bytes) {
        try {
          const text = new TextDecoder('utf-8').decode(bytes);
          // If explicitly idle/stopped typing (status 0), allow it to clear typing state
          if (
            text.includes('"activity_status":"0"') ||
            text.includes('"activity_status":0') ||
            text.includes('"activity_status": 0') ||
            text.includes('"is_typing":0') ||
            text.includes('"is_typing":"0"') ||
            text.includes('"is_typing": 0')
          ) {
            return null;
          }

          if (
            text.includes('indicate_activity') ||
            text.includes('activity_status_indication') ||
            text.includes('typing_indicator') ||
            (text.includes('"activity_status"') && (text.includes('"1"') || text.includes(':1') || text.includes(': 1'))) ||
            (text.includes('"is_typing"') && (text.includes('"1"') || text.includes(':1') || text.includes(': 1')))
          ) {
            return {
              action: 'drop',
              ruleId: this.id,
              reason: 'instagram-realtime-typing',
              metadata: { channel: 'instagram.ws' },
            };
          }
        } catch {
          // fall through to DGW task inspection
        }
      }
    }

    // 2. DGW task label 3 inspection
    const { envelope, labels } = context.getDgwTasks();
    if (envelope === 'unknown' || labels.length === 0) {
      return null;
    }

    const signal = labels.filter((label) => this.signalLabels.includes(label));
    if (signal.length === 0) {
      return null;
    }

    // Check payload if available: allow is_typing: 0 through to clear typing
    const bytes = context.getBytes();
    if (bytes) {
      try {
        const text = new TextDecoder('utf-8').decode(bytes);
        if (text.includes('"is_typing":0') || text.includes('"is_typing":"0"')) {
          return null;
        }
      } catch {
        // drop if undecodable but carries typing task label
      }
    }

    return {
      action: 'drop',
      ruleId: this.id,
      reason: 'all-typing',
      metadata: { labels, signal },
    };
  }

  evaluateHttp(url: string, body: unknown): RuleVerdict | null {
    // 1. Check REST endpoints (legacy / fallback)
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

        // Allow idle status through to clear typing indicator
        const isIdle =
          bodyString.includes('activity_status=0') ||
          bodyString.includes('"activity_status":"0"') ||
          bodyString.includes('"activity_status":0');

        if (isIdle) {
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

    // 2. Check GraphQL mutations (modern Instagram Web)
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

  evaluateWorker(data: unknown): 'pass' | 'drop' {
    if (!data || typeof data !== 'object') {
      return 'pass';
    }

    const candidates = collectWorkerActions(data);

    for (const candidate of candidates) {
      const lowered = candidate.toLowerCase();
      if (
        INSTAGRAM_SIGNATURES.typingWorkerActions.some((action) =>
          lowered.includes(action.toLowerCase()),
        )
      ) {
        return 'drop';
      }
    }

    return 'pass';
  }
}
