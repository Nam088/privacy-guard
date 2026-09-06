import { browser } from '#imports';
import type { ObservedEvent } from '@/observe/types';

export type SendMessage = (message: unknown) => Promise<unknown>;

export interface ObservationForwarder {
  handle: (event: ObservedEvent) => void;
  isStopped: () => boolean;
}

/**
 * Forwards observations to the background, and stops for good the first time that fails.
 *
 * The failure this exists for is the extension context being invalidated, which happens every
 * time the extension is reloaded while a page is open. The old content script keeps running and
 * every send rejects. On a busy page the observer fires constantly, so one dead context turns
 * into a stream of unhandled rejections in somebody's console.
 *
 * Stopping after the first failure rather than retrying is deliberate. The expected failure is
 * permanent for the life of that page, and a reload re-arms everything anyway. Retrying would
 * only reproduce the noise this is here to prevent.
 */
export function createObservationForwarder(
  send: SendMessage = (message) => browser.runtime.sendMessage(message),
  onStop?: () => void,
): ObservationForwarder {
  let stopped = false;

  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    if (onStop) {
      try {
        onStop();
      } catch {
        // Cleanup callbacks must never escape into unhandled promise rejections
      }
    }
  };

  return {
    isStopped: () => stopped,
    handle(event) {
      if (stopped) return;
      try {
        void Promise.resolve(send({ type: 'observed', event })).catch(stop);
      } catch {
        stop();
      }
    },
  };
}
