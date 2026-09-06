import { signal } from '@preact/signals';
import { DEFAULT_SETTINGS, type Settings } from './schema';
import { readSettings, settingsItem, writeSettings } from './storage';

export const settings = signal<Settings>(DEFAULT_SETTINGS);
export const isReady = signal(false);

let unwatch: (() => void) | undefined;
let revision = 0;

/**
 * Loads settings and starts watching storage for changes.
 *
 * Call this exactly once per document, from the root component. The signals and the watcher
 * handle are module level singletons with no reference counting, so if two components each
 * init and stop the store on their own lifecycle, the second one to unmount silently kills
 * the first one's subscription and flips `isReady` back to false underneath it.
 *
 * The watcher is registered before the read, so a write landing while the read is in flight
 * still reaches the signal. The revision check then stops that same read from overwriting a
 * change someone made while it was pending.
 *
 * Everything else should read the `settings` signal directly rather than calling this.
 */
export async function initSettingsStore(): Promise<void> {
  const startedAt = revision;

  unwatch?.();
  unwatch = settingsItem.watch((next) => {
    if (next) {
      settings.value = next;
    }
  });

  const loaded = await readSettings();
  if (revision === startedAt) {
    settings.value = loaded;
  }

  isReady.value = true;
}

export function stopSettingsStore(): void {
  unwatch?.();
  unwatch = undefined;
  isReady.value = false;
}

async function commit(next: Settings): Promise<void> {
  const previous = settings.value;
  revision += 1;
  settings.value = next;
  try {
    await writeSettings(next);
  } catch (error) {
    settings.value = previous;
    throw error;
  }
}

export async function setFeature(key: string, value: boolean): Promise<void> {
  await commit({
    ...settings.value,
    features: { ...settings.value.features, [key]: value },
  });
}

export async function setMasterEnabled(value: boolean): Promise<void> {
  await commit({ ...settings.value, masterEnabled: value });
}

export async function setLocale(value: 'auto' | 'en' | 'vi'): Promise<void> {
  await commit({ ...settings.value, locale: value });
}
