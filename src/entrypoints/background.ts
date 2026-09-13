import { browser, defineBackground, storage } from '#imports';
import { applyBadge } from '@/core/badge';
import { appendCapture } from '@/core/capture/storage';
import { applyRulesets } from '@/core/rulesets';
import type { Settings } from '@/core/settings/schema';
import { readSettings, settingsItem } from '@/core/settings/storage';

// Guard against known Chromium MV3 Service Worker teardown bug (Issue #341232995)
// When the Service Worker is terminating (idle timeout or reload), in-flight extension
// API calls get rejected by Chromium with "Error: No SW".
if (typeof self !== 'undefined' && 'addEventListener' in self) {
  self.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = String(reason?.message || reason || '');
    if (msg.includes('No SW') || msg.includes('Extension context invalidated')) {
      event.preventDefault();
    }
  });
}

const captureEnabled = storage.defineItem<boolean>('local:captureEnabled', {
  fallback: false,
  version: 1,
});

export default defineBackground(() => {
  bootstrap().catch(() => {});

  settingsItem.watch((next) => {
    if (next) {
      apply(next).catch(() => {});
    }
  });

  browser.runtime.onMessage.addListener((message) => {
    if ((message as { type?: string })?.type !== 'observed') {
      return;
    }
    void (async () => {
      try {
        if (!(await captureEnabled.getValue())) {
          return;
        }
        await appendCapture((message as { event: never }).event);
      } catch (error) {
        const msg = String((error as Error)?.message || error);
        if (!msg.includes('No SW')) {
          console.warn('[privacy-guard] could not store an observation', error);
        }
      }
    })();
  });
});

async function bootstrap(): Promise<void> {
  try {
    const settings = await readSettings();
    await apply(settings);
  } catch (error) {
    const msg = String((error as Error)?.message || error);
    if (!msg.includes('No SW')) {
      console.warn('[privacy-guard] bootstrap failed', error);
    }
  }
}

async function apply(settings: Settings): Promise<void> {
  try {
    await applyBadge(settings);
  } catch (error) {
    const msg = String((error as Error)?.message || error);
    if (!msg.includes('No SW')) {
      console.warn('[privacy-guard] could not apply badge', error);
    }
  }

  try {
    await applyRulesets(settings);
  } catch (error) {
    const msg = String((error as Error)?.message || error);
    if (!msg.includes('No SW')) {
      console.warn('[privacy-guard] could not apply rulesets', error);
    }
  }
}
