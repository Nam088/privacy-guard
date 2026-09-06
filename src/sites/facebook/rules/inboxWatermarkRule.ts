import type { InterceptContext, RuleVerdict, SuppressionRule } from '@/engine';
import { FACEBOOK_SIGNATURES } from '../signatures';

/** The root folder. Any other value is a folder inside the inbox, which this rule leaves alone. */
const ROOT_FOLDER = 0;

function isRootFolderWatermark(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return false;
  }
  return (payload as Record<string, unknown>).parent_thread_key === ROOT_FOLDER;
}

/**
 * FacebookInboxWatermarkRule: withholds when the user last opened their inbox.
 *
 * Label 6 carries `{ parent_thread_key, last_seen_time_ms }` on `/ws/lightspeed`. With
 * `parent_thread_key: 0` it is the root folder, and the timestamp is a record of the user opening
 * Messenger at all, separate from having read anything in it.
 *
 * The label alone is not enough. The same label on a folder inside the inbox is something this
 * feature never promised to hide, so the payload decides, and a payload that could not be read
 * decides nothing.
 */
export class FacebookInboxWatermarkRule implements SuppressionRule {
  readonly id = 'facebook.hideInboxLastSeen';
  readonly targetPaths: readonly string[];

  private readonly signalLabels: readonly string[];

  constructor(
    signalLabels: readonly string[] = FACEBOOK_SIGNATURES.inboxWatermarkLabels,
    targetPaths: readonly string[] = FACEBOOK_SIGNATURES.inboxWatermarkPaths,
  ) {
    this.signalLabels = signalLabels;
    this.targetPaths = targetPaths;
  }

  evaluate(context: InterceptContext): RuleVerdict | null {
    const { envelope, tasks } = context.getDgwTasks();
    if (envelope === 'unknown' || tasks.length === 0) {
      return null;
    }

    const signal = tasks.filter(
      (entry) => this.signalLabels.includes(entry.label) && isRootFolderWatermark(entry.payload),
    );
    if (signal.length === 0) {
      return null;
    }

    const labels = tasks.map((entry) => entry.label);

    if (signal.length !== tasks.length) {
      return {
        action: 'mixed',
        ruleId: this.id,
        reason: 'mixed-inbox-watermark',
        metadata: { labels, signal: signal.map((entry) => entry.label) },
      };
    }

    return {
      action: 'drop',
      ruleId: this.id,
      reason: 'inbox-root-watermark',
      metadata: { labels, signal: signal.map((entry) => entry.label) },
    };
  }
}
