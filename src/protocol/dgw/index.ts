import { decodeFrame } from './frameDecoder';
import { extractTasks, type FrameTasks } from './taskExtractor';

export * from './frameDecoder';
export * from './frameEncoder';
export * from './taskExtractor';

/** Decodes a frame and extracts its tasks in one step. */
export function readFrame(bytes: Uint8Array): FrameTasks {
  const decoded = decodeFrame(bytes);
  if (decoded === null) {
    return { envelope: 'unknown', labels: [], tasks: [] };
  }
  return extractTasks(decoded);
}
