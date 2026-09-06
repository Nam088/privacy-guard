import type {
  HttpSuppressionRule,
  InterceptContext,
  RuleVerdict,
  SuppressionRule,
} from '@/engine';
import { FACEBOOK_SIGNATURES } from '../signatures';
import {
  GRAPHQL_PATHS,
  collectOperationNames,
  decideByOperationNames,
  parseGraphQLUrl,
} from './graphqlRequest';

const READ_RECEIPT_MUTATION_PATTERN =
  /readreceipt|markthreadread|mercurythreadmarkread|threadmarkread|readwatermark/i;

function isReadReceiptOperation(name: string): boolean {
  if (READ_RECEIPT_MUTATION_PATTERN.test(name)) {
    return true;
  }
  const lowered = name.toLowerCase();
  return FACEBOOK_SIGNATURES.readReceiptMutations.some((known) => known.toLowerCase() === lowered);
}

/**
 * FacebookReadReceiptRule: Strategy for suppressing Messenger/Facebook read receipts.
 *
 * Checks DGW task labels on `/ws/lightspeed` and `/ws/realtime` against known read receipt signatures (21, 72, 235).
 * Drops only when 100% of tasks in the frame are read receipts.
 * Passes and reports 'mixed' when bundled with innocent tasks.
 * Also suppresses HTTP GraphQL mutations and Worker/MessagePort read receipt actions.
 */
export class FacebookReadReceiptRule implements SuppressionRule, HttpSuppressionRule {
  readonly id = 'facebook.hideReadReceipts';
  readonly targetPaths: readonly string[];
  readonly targetHttpPaths: readonly string[] = GRAPHQL_PATHS;

  private readonly signalLabels: readonly string[];

  constructor(
    signalLabels: readonly string[] = FACEBOOK_SIGNATURES.readReceiptLabels,
    targetPaths: readonly string[] = FACEBOOK_SIGNATURES.readReceiptPaths,
  ) {
    this.signalLabels = signalLabels;
    this.targetPaths = targetPaths;
  }

  evaluate(context: InterceptContext): RuleVerdict | null {
    if (context.url.includes('/ws/realtime')) {
      const bytes = context.getBytes();
      if (bytes) {
        try {
          const text = new TextDecoder('utf-8').decode(bytes);
          if (
            text.includes('last_read_watermark_ts') ||
            text.includes('mark_thread_read') ||
            text.includes('thread_read_watermark') ||
            text.includes('"read_receipt"') ||
            text.includes('"watermark_ts"')
          ) {
            return {
              action: 'drop',
              ruleId: this.id,
              reason: 'realtime-read-receipt',
              metadata: { channel: 'ws.realtime' },
            };
          }
        } catch {
          // fall through to DGW tasks
        }
      }
    }

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
    const parsedUrl = parseGraphQLUrl(url);
    if (parsedUrl === null) {
      return null;
    }

    const names = collectOperationNames(parsedUrl, body);
    const action = decideByOperationNames(names, isReadReceiptOperation);
    if (action === 'pass') {
      return null;
    }

    return {
      action,
      ruleId: this.id,
      reason: action === 'drop' ? 'read-receipt-mutation' : 'mixed-read-receipt',
      metadata: { operations: names },
    };
  }

  evaluateWorker(data: unknown): 'pass' | 'drop' {
    if (!data) {
      return 'pass';
    }
    let text: string;
    if (typeof data === 'string') {
      text = data;
    } else {
      try {
        text = JSON.stringify(data);
      } catch {
        text = String(data);
      }
    }
    const lower = text.toLowerCase();
    const matches = FACEBOOK_SIGNATURES.readReceiptWorkerActions.some((action) =>
      lower.includes(action.toLowerCase()),
    );
    return matches ? 'drop' : 'pass';
  }
}
