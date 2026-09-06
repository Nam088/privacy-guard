import { browser, defineBackground, storage } from '#imports';
import { applyBadge } from '@/core/badge';
import { appendCapture } from '@/core/capture/storage';
import { applyRulesets } from '@/core/rulesets';
import type { Settings } from '@/core/settings/schema';
import { readSettings, settingsItem } from '@/core/settings/storage';

const captureEnabled = storage.defineItem<boolean>('local:captureEnabled', {
  fallback: false,
  version: 1,
});

export default defineBackground(() => {
  void bootstrap();

  settingsItem.watch((next) => {
    if (next) {
      void apply(next);
    }
  });

  browser.runtime.onMessage.addListener((message) => {
    if ((message as { type?: string })?.type !== 'observed') {
      return;
    }
    void (async () => {
      if (!(await captureEnabled.getValue())) {
        return;
      }
      try {
        await appendCapture((message as { event: never }).event);
      } catch (error) {
        console.warn('[privacy-guard] could not store an observation', error);
      }
    })();
  });
});

async function bootstrap(): Promise<void> {
  await apply(await readSettings());
}

async function apply(settings: Settings): Promise<void> {
  await applyBadge(settings);
  try {
    await applyRulesets(settings);
  } catch (error) {
    console.warn('[privacy-guard] could not apply rulesets', error);
  }
}
