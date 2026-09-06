/**
 * Task extraction from decoded Meta Device Gateway frames.
 *
 * Supports array envelopes (`inner.tasks`), single task envelopes (`inner.label`), and treats
 * unrecognised or corrupted task arrays as `unknown` (never empty) to prevent dropping frames
 * containing unread data.
 */

export type Envelope = 'array' | 'single' | 'unknown';

/**
 * One task, with its payload already unwrapped.
 *
 * A label alone settles most frames, but not all of them: label 6 is the inbox watermark only
 * when its payload says `parent_thread_key: 0`. A payload that will not parse is `null`, never an
 * empty object, so a rule reading a field cannot mistake a frame it failed to understand for one
 * that simply lacks the field.
 */
export interface FrameTask {
  readonly label: string;
  readonly payload: unknown;
}

export interface FrameTasks {
  readonly envelope: Envelope;
  readonly labels: readonly string[];
  readonly tasks: readonly FrameTask[];
}

interface JsonObject {
  readonly [key: string]: unknown;
}

export function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseNested(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function labelOf(task: unknown): string | null {
  if (!isObject(task) || typeof task.label === 'undefined') {
    return null;
  }
  return String(task.label);
}

/**
 * Pulls task labels out of a decoded DGW frame.
 */
const NO_TASKS: FrameTasks = { envelope: 'unknown', labels: [], tasks: [] };

function payloadOf(task: unknown): unknown {
  if (!isObject(task)) {
    return null;
  }
  return parseNested(task.payload);
}

export function extractTasks(frame: unknown): FrameTasks {
  if (!isObject(frame)) {
    return NO_TASKS;
  }

  const inner = parseNested(frame.payload);
  if (!isObject(inner)) {
    return NO_TASKS;
  }

  if (Array.isArray(inner.tasks)) {
    const tasks: FrameTask[] = [];
    for (const entry of inner.tasks) {
      const label = labelOf(entry);
      if (label === null) {
        return NO_TASKS;
      }
      tasks.push({ label, payload: payloadOf(entry) });
    }
    return { envelope: 'array', labels: tasks.map((entry) => entry.label), tasks };
  }

  const single = labelOf(inner);
  if (single !== null) {
    return {
      envelope: 'single',
      labels: [single],
      tasks: [{ label: single, payload: payloadOf(inner) }],
    };
  }

  return NO_TASKS;
}
