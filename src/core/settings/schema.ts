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

export interface Settings {
  masterEnabled: boolean;
  strictMode: boolean;
  showBadge: boolean;
  theme: 'system' | 'light' | 'dark';
  features: Record<string, boolean>;
  locale: 'auto' | 'en' | 'vi';
}

export const settingsSchema = {
  parse(raw: unknown): Settings {
    const res = this.safeParse(raw);
    if (!res.success) {
      throw res.error;
    }
    return res.data;
  },
  safeParse(raw: unknown): { success: true; data: Settings } | { success: false; error: Error } {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      return { success: false, error: new Error('Settings must be an object') };
    }
    const c = raw as Record<string, unknown>;
    if (typeof c.masterEnabled !== 'boolean') {
      return { success: false, error: new Error('masterEnabled must be a boolean') };
    }
    if (typeof c.strictMode !== 'boolean') {
      return { success: false, error: new Error('strictMode must be a boolean') };
    }
    if (typeof c.showBadge !== 'boolean') {
      return { success: false, error: new Error('showBadge must be a boolean') };
    }
    if (c.theme !== 'system' && c.theme !== 'light' && c.theme !== 'dark') {
      return { success: false, error: new Error('theme must be system, light, or dark') };
    }
    if (typeof c.features !== 'object' || c.features === null || Array.isArray(c.features)) {
      return { success: false, error: new Error('features must be an object') };
    }
    const features: Record<string, boolean> = {};
    for (const [key, val] of Object.entries(c.features as Record<string, unknown>)) {
      if (typeof val !== 'boolean') {
        return { success: false, error: new Error(`features.${key} must be a boolean`) };
      }
      features[key] = val;
    }
    const locale =
      c.locale === 'en' || c.locale === 'vi' || c.locale === 'auto'
        ? c.locale
        : c.locale === undefined
          ? 'auto'
          : null;
    if (locale === null) {
      return { success: false, error: new Error('locale must be auto, en, or vi') };
    }

    return {
      success: true,
      data: {
        masterEnabled: c.masterEnabled,
        strictMode: c.strictMode,
        showBadge: c.showBadge,
        theme: c.theme,
        features,
        locale,
      },
    };
  },
};

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
