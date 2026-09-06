import { defineContentScript, injectScript, storage } from '#imports';
import { createObservationForwarder } from '@/core/observationBridge';
import { readSettings, settingsItem } from '@/core/settings/storage';
import { buildSuppressionConfig } from '@/core/suppressionConfig';
import type { ObservedEvent } from '@/observe/types';
import { CONFIGURE_EVENT, OBSERVER_EVENT, type ObserverConfig } from '../page-observer';

export default defineContentScript({
  matches: [
    '*://*.facebook.com/*',
    '*://*.messenger.com/*',
    '*://*.instagram.com/*',
    '*://*.fbsbx.com/*',
  ],
  allFrames: true,
  runAt: 'document_start',
  async main() {
    let unwatch: (() => void) | undefined;

    const forwarder = createObservationForwarder(undefined, () => {
      document.removeEventListener(OBSERVER_EVENT, onObserved);
      // The forwarder stops when the extension context dies, which is the same moment the
      // settings watch stops being able to mean anything. Leaving it registered would keep a
      // listener alive against a context that can no longer answer.
      if (unwatch) {
        try {
          unwatch();
        } catch {
          // In an invalidated extension context, unwatch can throw because storage
          // listeners can no longer be accessed.
        }
      }
      unwatch = undefined;
    });

    function onObserved(event: Event): void {
      const customEvent = event as CustomEvent<ObservedEvent | string>;
      let detail = customEvent.detail;
      if (typeof detail === 'string') {
        try {
          detail = JSON.parse(detail);
        } catch {
          return;
        }
      }
      if (detail && typeof detail === 'object') {
        forwarder.handle(detail as ObservedEvent);
      }
    }

    document.addEventListener(OBSERVER_EVENT, onObserved);

    function configure(config: ObserverConfig): void {
      let detail: unknown;
      // In Firefox (Gecko), Xray vision prevents page scripts from reading content script objects
      // unless cloneInto is used.
      // @ts-expect-error Firefox global cloneInto
      if (typeof cloneInto === 'function' && document.defaultView) {
        // @ts-expect-error Firefox global cloneInto
        detail = cloneInto(config, document.defaultView);
      } else {
        try {
          detail = JSON.parse(JSON.stringify(config));
        } catch {
          detail = config;
        }
      }
      document.dispatchEvent(new CustomEvent(CONFIGURE_EVENT, { detail }));
    }

    async function readCapture(): Promise<boolean> {
      try {
        return Boolean(await storage.getItem<boolean>('local:captureEnabled'));
      } catch {
        return false;
      }
    }

    // Everything below can fail on a page that blocks the injection or after the extension is
    // reloaded under an open tab. None of it may surface as an unhandled rejection: this runs on
    // somebody's Facebook, and a stream of errors in their console is a real cost even when
    // nothing else breaks.
    try {
      try {
        await injectScript('/page-observer.js', { keepInDom: true });
      } catch {
        // Firefox fallback: when script tag with src is blocked or fails, fetch and inline
        const script = document.createElement('script');
        const scriptUrl = browser.runtime.getURL('/page-observer.js');
        const res = await fetch(scriptUrl);
        script.textContent = await res.text();
        (document.head ?? document.documentElement).appendChild(script);
      }

      configure({
        capture: await readCapture(),
        ...buildSuppressionConfig(location.href, await readSettings()),
      });

      // Re-sent on every settings change so turning the feature off takes effect on tabs that are
      // already open. A toggle that needs a reload to mean anything is a toggle that lies.
      //
      // Capture is read again rather than carried over from above, because it lives under its own
      // key: reusing the value read at startup would let a feature toggle quietly re-assert a
      // capture setting the user had since turned off. Settings go back through readSettings for
      // the same reason they did the first time, so a stored value that no longer parses is
      // repaired rather than handed to the observer.
      unwatch = settingsItem.watch(() => {
        void (async () => {
          try {
            configure({
              capture: await readCapture(),
              ...buildSuppressionConfig(location.href, await readSettings()),
            });
          } catch {
            // A settings read that fails leaves the observer on its last known configuration,
            // which is the safe direction: it keeps suppressing what it was already suppressing.
          }
        })();
      });
    } catch {
      if (unwatch) {
        try {
          unwatch();
        } catch {
          // Ignored: extension context may already be invalidated
        }
      }
      document.removeEventListener(OBSERVER_EVENT, onObserved);
    }
  },
});
