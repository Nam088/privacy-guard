import { LazyInterceptContext } from './context';
import type { SuppressionRule, VerdictAction } from './types';

export interface EngineDecision {
  readonly action: VerdictAction;
  readonly reason?: string;
  readonly matchedRules?: readonly string[];
}

/**
 * RuleEngine: Implements Chain of Responsibility & Aggregation.
 *
 * 1. O(1) Fast-exit on unmatched URL pathnames.
 * 2. Lazy evaluation of frames through LazyInterceptContext.
 * 3. Short-circuit: First 'drop' stops chain immediately.
 * 4. Asymmetric fail-open: Any error falls back to 'pass' to protect user experience.
 */
export class RuleEngine {
  private pathToRules = new Map<string, SuppressionRule[]>();
  private allRules: SuppressionRule[] = [];

  constructor(rules: readonly SuppressionRule[] = []) {
    this.updateRules(rules);
  }

  updateRules(rules: readonly SuppressionRule[]): void {
    this.allRules = [...rules];
    this.pathToRules.clear();
    for (const rule of rules) {
      for (const path of rule.targetPaths) {
        const list = this.pathToRules.get(path) ?? [];
        list.push(rule);
        this.pathToRules.set(path, list);
      }
    }
  }

  getRules(): readonly SuppressionRule[] {
    return [...this.allRules];
  }

  intercept(url: string, rawData: unknown): EngineDecision {
    if (this.allRules.length === 0) {
      return { action: 'pass', reason: 'no-active-rules' };
    }

    let pathname: string;
    try {
      pathname = new URL(url).pathname;
    } catch {
      return { action: 'pass', reason: 'invalid-url' };
    }

    // O(1) Fast-exit: No rule targets this socket path
    const targetRules = this.pathToRules.get(pathname);
    if (!targetRules || targetRules.length === 0) {
      return { action: 'pass', reason: 'path-not-targeted' };
    }

    const context = new LazyInterceptContext(url, rawData);
    let hasMixed = false;
    const matchedRules: string[] = [];

    for (const rule of targetRules) {
      try {
        const verdict = rule.evaluate(context);
        if (!verdict) {
          continue;
        }
        matchedRules.push(rule.id);
        if (verdict.action === 'drop') {
          return { action: 'drop', reason: verdict.reason ?? 'suppressed', matchedRules };
        }
        if (verdict.action === 'mixed') {
          hasMixed = true;
        }
      } catch {
        // Asymmetric fail-open: never let a buggy rule throw and break client connection
        continue;
      }
    }

    if (hasMixed) {
      return { action: 'mixed', reason: 'mixed-signal', matchedRules };
    }

    return { action: 'pass', reason: 'no-matching-signal', matchedRules };
  }
}
