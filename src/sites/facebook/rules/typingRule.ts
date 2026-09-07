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
import {
  collectWorkerActions,
  extractStateValue,
  isOutboundMessagePayload,
} from '@/sites/workerUtil';

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
          // Never drop frames carrying outbound user message bodies or send actions
          const isOutboundMessage =
            /["\\](?:body|text|send_message|message_send|composer_send_message|offline_threading_id|message_id)["\\]/i.test(
              text,
            );
          if (isOutboundMessage) {
            return null;
          }

          if (
            text.includes('send_typing_indicators') ||
            text.includes('send_typing_indicators_SECURE_MESSAGE_OVER_WA_ONE_TO_ONE') ||
            text.includes('"event_name":"send_typing_indicators"') ||
            text.includes('sendChatStateFromComposer') ||
            text.includes('sendChatState') ||
            text.includes('chatstate') ||
            text.includes('chat_state')
          ) {
            // Preserve stop states (e.g. idle, pause, stop, is_typing: 0) so recipient is never stuck with 3 dots
            const isStop =
              /["\\](?:idle|pause|stop|inactive|clear|gone)["\\]|"state":\s*0|"state":\s*2|"is_typing":\s*0|"chat_state":\s*0/i.test(
                text,
              );
            if (isStop) {
              return null;
            }
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
    if (!data || typeof data !== 'object') {
      return 'pass';
    }

    // Explicit safeguard: Never drop outbound message operations or payloads carrying user text
    if (isOutboundMessagePayload(data)) {
      return 'pass';
    }

    const actionCandidates = collectWorkerActions(data);
    const stateCandidate = extractStateValue(data);

    for (const candidate of actionCandidates) {
      const lowered = candidate.toLowerCase();
      if (
        FACEBOOK_SIGNATURES.typingWorkerActions.some(
          (action) => lowered === action.toLowerCase() || lowered.includes(action.toLowerCase()),
        )
      ) {
        // Preserve stop states (e.g. idle, paused, stopped, 0) so user is not stuck in typing indicator
        if (
          typeof stateCandidate === 'string' &&
          FACEBOOK_SIGNATURES.typingStopStates.some((stop) =>
            stateCandidate.toLowerCase().includes(stop),
          )
        ) {
          return 'pass';
        }
        if (
          typeof stateCandidate === 'number' &&
          (stateCandidate === 0 || stateCandidate === 2)
        ) {
          return 'pass';
        }
        return 'drop';
      }
    }

    return 'pass';
  }
}

export { collectWorkerActions, extractStateValue, isOutboundMessagePayload };


