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
  isFacebookUrl,
  parseGraphQLUrl,
} from './graphqlRequest';

/**
 * Matches operation names not on the signature list.
 *
 * Only ever tested against an operation name. Running it across a whole request body, as this
 * once did, meant any payload containing "typing" ahead of the word "mutation" was dropped.
 */
const TYPING_MUTATION_PATTERN = /typing.{0,30}mutation|typsubscription/i;


function isTypingOperation(name: string): boolean {
  if (TYPING_MUTATION_PATTERN.test(name)) {
    return true;
  }
  const lowered = name.toLowerCase();
  return FACEBOOK_SIGNATURES.typingMutations.some((known) => known.toLowerCase() === lowered);
}

/**
 * FacebookTypingRule: Strategy for suppressing Messenger/Facebook typing indicators.
 *
 * 1. WebSocket: Drops task label 3 frames on `/ws/lightspeed`.
 * 2. HTTP Legacy: Drops `/ajax/messaging/typ.php` requests.
 * 3. HTTP GraphQL: Drops GraphQL typing mutations on `/api/graphql/`.
 */
export class FacebookTypingRule implements SuppressionRule, HttpSuppressionRule {
  readonly id = 'facebook.hideTyping';
  readonly targetPaths: readonly string[];
  /** Every HTTP path this rule inspects, which is the list `evaluateHttp` actually walks. */
  readonly targetHttpPaths: readonly string[] = [
    ...GRAPHQL_PATHS,
    ...FACEBOOK_SIGNATURES.typingLegacyPaths,
  ];

  private readonly signalLabels: readonly string[];

  constructor(
    signalLabels: readonly string[] = FACEBOOK_SIGNATURES.typingLabels,
    targetPaths: readonly string[] = FACEBOOK_SIGNATURES.typingPaths,
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
            text.includes('send_typing_indicators') ||
            text.includes('send_typing_indicators_SECURE_MESSAGE_OVER_WA_ONE_TO_ONE') ||
            text.includes('"event_name":"send_typing_indicators"')
          ) {
            return {
              action: 'drop',
              ruleId: this.id,
              reason: 'realtime-typing-indicator',
              metadata: { channel: 'ws.realtime' },
            };
          }
        } catch {
          return null;
        }
      }
      return null;
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
        reason: 'mixed-typing-indicator',
        metadata: { labels, signal },
      };
    }

    return {
      action: 'drop',
      ruleId: this.id,
      reason: 'all-typing-indicator',
      metadata: { labels, signal },
    };
  }

  evaluateHttp(url: string, body: unknown): RuleVerdict | null {
    // The legacy endpoint carries nothing but a typing ping, so the path alone settles it.
    if (
      isFacebookUrl(url) &&
      FACEBOOK_SIGNATURES.typingLegacyPaths.some((path) => url.includes(path))
    ) {
      return {
        action: 'drop',
        ruleId: this.id,
        reason: 'legacy-typing-endpoint',
      };
    }

    const parsedUrl = parseGraphQLUrl(url);
    if (parsedUrl === null) {
      return null;
    }

    const names = collectOperationNames(parsedUrl, body);
    const action = decideByOperationNames(names, isTypingOperation);
    if (action === 'pass') {
      return null;
    }

    let reason = 'mixed-typing-indicator';
    if (action === 'drop') {
      reason = 'graphql-typing-mutation';
    }

    return {
      action,
      ruleId: this.id,
      reason,
      metadata: { operations: names },
    };
  }

  /**
   * Evaluates messages dispatched to Armadillo Web Worker / SharedWorker (via postMessage).
   */
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

    const matchesAction = FACEBOOK_SIGNATURES.typingWorkerActions.some((action) =>
      lower.includes(action.toLowerCase()),
    );
    if (!matchesAction) {
      return 'pass';
    }

    // Preserve stop states (e.g. idle, paused) so user is not stuck in typing indicator
    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;
      const state =
        obj.state ??
        (Array.isArray(obj.args) ? (obj.args[0] as Record<string, unknown>)?.state : undefined);
      if (
        typeof state === 'string' &&
        FACEBOOK_SIGNATURES.typingStopStates.some((stop) => state.toLowerCase().includes(stop))
      ) {
        return 'pass';
      }
    }

    return 'drop';
  }
}
