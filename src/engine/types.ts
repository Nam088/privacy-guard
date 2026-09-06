/**
 * Core types and interfaces for the interception & suppression engine.
 *
 * Implements Strategy, Virtual Proxy (Lazy Context), and Chain of Responsibility patterns.
 */

export type VerdictAction = 'pass' | 'drop' | 'mixed';

export interface RuleVerdict {
  readonly action: VerdictAction;
  readonly ruleId: string;
  readonly reason?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Lazy Context Interface (Virtual Proxy Pattern).
 * Defers byte conversion and JSON frame decoding until a rule explicitly asks for it.
 * Memoizes results across all rules evaluating the same frame.
 */
export interface InterceptContext {
  readonly url: string;
  readonly rawData: unknown;
  getBytes(): Uint8Array | null;
  getDgwFrame(): unknown | null;
  getDgwTasks(): {
    readonly envelope: string;
    readonly labels: readonly string[];
    /** Each task with its payload unwrapped, for rules a label alone cannot settle. */
    readonly tasks: readonly { readonly label: string; readonly payload: unknown }[];
  };
}

/**
 * Strategy Pattern: a rule the RuleEngine runs over outbound WebSocket frames.
 */
export interface SuppressionRule {
  readonly id: string;
  /** Socket pathnames this rule listens on (e.g. ['/ws/lightspeed']). Used for O(1) fast-exit. */
  readonly targetPaths: readonly string[];
  /** Evaluates whether this frame matches the privacy signal. Returns null if not interested. */
  evaluate(context: InterceptContext): RuleVerdict | null;
}

/**
 * A rule that acts on outbound HTTP rather than on socket frames.
 *
 * These do not go through the RuleEngine: there is no frame to decode and no shared context worth
 * memoizing, so the caller asks them directly. The interface exists so a rule of this kind is
 * recognisable as one, rather than looking like a SuppressionRule that forgot to implement
 * `evaluate`.
 */
export interface HttpSuppressionRule {
  readonly id: string;
  /** Request pathnames this rule inspects. Anything else is never looked at. */
  readonly targetPaths: readonly string[];
  /** Returns null when the request is not one this rule has an opinion about. */
  evaluateHttp(url: string, body: unknown): RuleVerdict | null;
}
