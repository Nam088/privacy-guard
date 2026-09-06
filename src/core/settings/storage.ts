import { storage } from '#imports';
import {
  DEFAULT_SETTINGS,
  buildDefaultFeatures,
  settingsSchema,
  type Settings,
} from './schema';

export const SETTINGS_VERSION = 1;

export const settingsItem = storage.defineItem<Settings>('local:settings', {
  fallback: DEFAULT_SETTINGS,
  version: SETTINGS_VERSION,
});

function withMissingFeatures(settings: Settings): Settings {
  return {
    ...settings,
    features: { ...buildDefaultFeatures(), ...settings.features },
  };
}

export async function readSettings(): Promise<Settings> {
  const raw = await settingsItem.getValue();
  const parsed = settingsSchema.safeParse(raw);
  if (parsed.success) {
    return withMissingFeatures(parsed.data);
  }
  await settingsItem.setValue(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

export async function writeSettings(next: Settings): Promise<void> {
  await settingsItem.setValue(settingsSchema.parse(next));
}
