import { decodeFrame, extractTasks, toBytes, type FrameTasks } from '@/protocol/dgw';
import type { InterceptContext } from './types';

/**
 * LazyInterceptContext: Implements Lazy Initialization and Memoization.
 *
 * Guarantees zero byte conversions or JSON parsing if no active rule accesses the frame data.
 * If multiple rules evaluate the same frame, the frame is parsed exactly once and shared.
 */
export class LazyInterceptContext implements InterceptContext {
  private _bytes: Uint8Array | null | undefined;
  private _dgwFrame: unknown | null | undefined;
  private _dgwTasks: FrameTasks | undefined;

  constructor(
    public readonly url: string,
    public readonly rawData: unknown,
  ) {}

  getBytes(): Uint8Array | null {
    if (this._bytes === undefined) {
      this._bytes = toBytes(this.rawData);
    }
    return this._bytes;
  }

  getDgwFrame(): unknown | null {
    if (this._dgwFrame === undefined) {
      const bytes = this.getBytes();
      if (bytes !== null) {
        this._dgwFrame = decodeFrame(bytes);
      } else {
        this._dgwFrame = null;
      }
    }
    return this._dgwFrame;
  }

  getDgwTasks(): FrameTasks {
    if (this._dgwTasks === undefined) {
      const frame = this.getDgwFrame();
      if (frame !== null) {
        this._dgwTasks = extractTasks(frame);
      } else {
        this._dgwTasks = { envelope: 'unknown', labels: [], tasks: [] };
      }
    }
    return this._dgwTasks;
  }
}
