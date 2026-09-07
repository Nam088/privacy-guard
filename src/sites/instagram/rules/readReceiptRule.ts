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
import { collectWorkerActions, isOutboundMessagePayload } from '@/sites/workerUtil';

const DIRECT_SEEN_REGEX =
  /readreceipt|markthreadread|mark.*thread.*as.*read|igdmarkthreadasread|mercurythreadmarkread|threadmarkread|readwatermark|direct.*seen|seen.*direct|mark.*thread.*seen/i;

function isInstagramReadReceiptOperation(name: string): boolean {
  if (DIRECT_SEEN_REGEX.test(name)) {
    return true;
  }
  const lowered = name.toLowerCase();
  return INSTAGRAM_SIGNATURES.readReceiptMutations.some((known) => known.toLowerCase() === lowered);
}

/**
 * InstagramReadReceiptRule: Strategy for suppressing Instagram Direct read receipts.
 *
 * In 2026, Instagram Direct runs on Meta's unified LightSpeed/DGW/GraphQL architecture:
 * 1. DGW task labels: 21 (last_read_watermark_ts), 72, 235.
 * 2. Realtime WebSocket text/JSON frames on /ws/realtime, /ws/lightspeed, gateway.instagram.com.
 * 3. GraphQL mutations on /api/graphql.
 * 4. SharedWorker / MessagePort messages.
 * 5. Legacy REST endpoints (/seen/).
 */
export class InstagramReadReceiptRule implements SuppressionRule, HttpSuppressionRule {
  readonly id = 'instagram.hideReadReceipts';
  readonly targetPaths: readonly string[];
  readonly targetHttpPaths: readonly string[] = [
    ...GRAPHQL_PATHS,
    '/api/v1/direct_v2/threads/',
  ];

  private readonly signalLabels: readonly string[];

  constructor(
    signalLabels: readonly string[] = INSTAGRAM_SIGNATURES.readReceiptLabels,
    targetPaths: readonly string[] = INSTAGRAM_SIGNATURES.readReceiptPaths,
  ) {
    this.signalLabels = signalLabels;
    this.targetPaths = targetPaths;
  }

  evaluate(context: InterceptContext): RuleVerdict | null {
    const url = context.url.toLowerCase();

    // 1. Realtime text / JSON inspection (/ws/realtime, gateway, edge-chat)
    if (
      url.includes('/ws/realtime') ||
      INSTAGRAM_SIGNATURES.wsHosts.some((host) => url.includes(host))
    ) {
      const bytes = context.getBytes();
      if (bytes) {
        try {
          const text = new TextDecoder('utf-8').decode(bytes);
          if (
            text.includes('last_read_watermark_ts') ||
            text.includes('mark_thread_read') ||
            text.includes('thread_read_watermark') ||
            text.includes('"read_receipt"') ||
            text.includes('"watermark_ts"') ||
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
          // fall through to DGW task inspection
        }
      }
    }

    // 2. DGW binary / task-level inspection (LightSpeed)
    const { envelope, labels } = context.getDgwTasks();
    if (envelope === 'unknown' || labels.length === 0) {
      return null;
    }

    const signal = labels.filter((label) => this.signalLabels.includes(label));
    if (signal.length === 0) {
      return null;
    }

    if (signal.length !== labels.length) {
      return {
        action: 'mixed',
        ruleId: this.id,
        reason: 'mixed-read-receipt',
        metadata: { labels, signal },
      };
    }

    return {
      action: 'drop',
      ruleId: this.id,
      reason: 'all-read-receipt',
      metadata: { labels, signal },
    };
  }

  evaluateHttp(url: string, body: unknown): RuleVerdict | null {
    // 1. Check REST endpoints (legacy / fallback)
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

    // 2. Check GraphQL mutations (modern Instagram Web)
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

  evaluateWorker(data: unknown): 'pass' | 'drop' {
    if (!data || typeof data !== 'object') {
      return 'pass';
    }

    if (isOutboundMessagePayload(data)) {
      return 'pass';
    }

    const candidates = collectWorkerActions(data);

    for (const candidate of candidates) {
      const lowered = candidate.toLowerCase();
      if (
        INSTAGRAM_SIGNATURES.readReceiptWorkerActions.some((action) =>
          lowered.includes(action.toLowerCase()),
        )
      ) {
        return 'drop';
      }
    }

    return 'pass';
  }
}
