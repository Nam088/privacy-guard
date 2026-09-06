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
    if (!data || typeof data !== 'object') {
      return 'pass';
    }

    // Explicit safeguard: Never drop outbound message operations or payloads carrying user text
    if (isOutboundMessagePayload(data)) {
      return 'pass';
    }

    const actionCandidates: string[] = [];
    let stateCandidate: unknown = undefined;

    if (Array.isArray(data)) {
      for (const item of data) {
        if (typeof item === 'string') {
          actionCandidates.push(item);
        } else if (item && typeof item === 'object') {
          const extracted = extractStateValue(item);
          if (extracted !== undefined && stateCandidate === undefined) {
            stateCandidate = extracted;
          }
        }
      }
    } else {
      const rec = data as Record<string, unknown>;
      const keys = [
        rec.action,
        rec.type,
        rec.name,
        rec.event,
        rec.event_name,
        rec.command,
        rec.actionType,
      ];
      for (const k of keys) {
        if (typeof k === 'string') {
          actionCandidates.push(k);
        }
      }
      stateCandidate = extractStateValue(rec);
    }

    for (const candidate of actionCandidates) {
      const lowered = candidate.toLowerCase();
      if (
        FACEBOOK_SIGNATURES.typingWorkerActions.some(
          (action) => lowered === action.toLowerCase(),
        )
      ) {
        // Preserve stop states (e.g. idle, paused, stopped) so user is not stuck in typing indicator
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

function extractStateValue(data: unknown): unknown {
  if (!data || typeof data !== 'object') {
    return undefined;
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      const val = extractStateValue(item);
      if (val !== undefined) {
        return val;
      }
    }
    return undefined;
  }
  const obj = data as Record<string, unknown>;
  if (obj.state !== undefined) {
    return obj.state;
  }
  if (obj.args !== undefined) {
    return extractStateValue(obj.args);
  }
  return undefined;
}

function isOutboundMessagePayload(data: unknown): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      if (typeof item === 'string') {
        const lower = item.toLowerCase();
        if (
          lower === 'sendmessage' ||
          lower === 'sendtextmessage' ||
          lower === 'sendmediamessage' ||
          lower.includes('sendmessage') ||
          lower.includes('send_message')
        ) {
          return true;
        }
      } else if (item && typeof item === 'object') {
        if (isOutboundMessagePayload(item)) {
          return true;
        }
      }
    }
    return false;
  }

  const rec = data as Record<string, unknown>;
  if (
    rec.body !== undefined ||
    rec.text !== undefined ||
    rec.message !== undefined ||
    rec.offline_threading_id !== undefined ||
    rec.message_id !== undefined ||
    rec.client_context !== undefined
  ) {
    return true;
  }

  const keys = [
    rec.action,
    rec.type,
    rec.name,
    rec.event,
    rec.event_name,
    rec.command,
    rec.actionType,
  ];
  for (const k of keys) {
    if (typeof k === 'string') {
      const lower = k.toLowerCase();
      if (
        lower === 'sendmessage' ||
        lower === 'sendtextmessage' ||
        lower === 'sendmediamessage' ||
        lower.includes('sendmessage') ||
        lower.includes('send_message')
      ) {
        return true;
      }
    }
  }

  return false;
}
