import { z } from 'zod';
import { SITE_MODULES } from '@/sites/registry';
import { GLOBAL_SCOPE, featureKey, type Feature } from '@/sites/types';
import { GLOBAL_FEATURES } from '@/trackers/features';

export interface FeatureEntry {
  readonly key: string;
  readonly scope: string;
  readonly feature: Feature;
}

export const ALL_FEATURES: readonly FeatureEntry[] = [
  ...SITE_MODULES.flatMap((module) =>
    module.features.map((feature) => ({
      key: featureKey(module.id, feature.id),
      scope: module.id,
      feature,
    })),
  ),
  ...GLOBAL_FEATURES.map((feature) => ({
    key: featureKey(GLOBAL_SCOPE, feature.id),
    scope: GLOBAL_SCOPE,
    feature,
  })),
];

const FEATURES_BY_KEY = new Map(ALL_FEATURES.map((entry) => [entry.key, entry]));

export function findFeature(key: string): FeatureEntry | null {
  return FEATURES_BY_KEY.get(key) ?? null;
}

export function buildDefaultFeatures(): Record<string, boolean> {
  const defaults: Record<string, boolean> = {};
  for (const entry of ALL_FEATURES) {
    defaults[entry.key] = entry.feature.defaultEnabled;
  }
  return defaults;
}

export const settingsSchema = z.object({
  masterEnabled: z.boolean(),
  strictMode: z.boolean(),
  showBadge: z.boolean(),
  theme: z.enum(['system', 'light', 'dark']),
  features: z.record(z.string(), z.boolean()),
  locale: z.enum(['auto', 'en', 'vi']).default('auto'),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  masterEnabled: true,
  strictMode: false,
  showBadge: true,
  theme: 'system',
  features: buildDefaultFeatures(),
  locale: 'auto',
};

export function isFeatureOn(settings: Settings, key: string): boolean {
  if (!settings.masterEnabled) {
    return false;
  }
  const entry = findFeature(key);
  if (entry === null || entry.feature.status !== 'active') {
    return false;
  }
  return settings.features[key] ?? entry.feature.defaultEnabled;
}
