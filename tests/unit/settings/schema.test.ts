import { describe, expect, it } from 'vitest';
import {
  ALL_FEATURES,
  DEFAULT_SETTINGS,
  buildDefaultFeatures,
  findFeature,
  isFeatureOn,
  settingsSchema,
  type Settings,
} from '@/core/settings/schema';
import { SITE_MODULES } from '@/sites/registry';
import { GLOBAL_FEATURES } from '@/trackers/features';

describe('ALL_FEATURES', () => {
  it('covers every site feature and every global feature exactly once', () => {
    const expected =
      SITE_MODULES.reduce((total, m) => total + m.features.length, 0) +
      GLOBAL_FEATURES.length;
    expect(ALL_FEATURES.length).toBe(expected);
    const keys = ALL_FEATURES.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('namespaces site features by module id', () => {
    const keys = ALL_FEATURES.map((entry) => entry.key);
    expect(keys).toContain('facebook.hideReadReceipts');
    expect(keys).toContain('instagram.hideReadReceipts');
  });

  it('namespaces global features under global', () => {
    const keys = ALL_FEATURES.map((entry) => entry.key);
    expect(keys).toContain('global.blockMetaPixel');
  });
});

describe('DEFAULT_SETTINGS', () => {
  it('validates against the schema', () => {
    expect(() => settingsSchema.parse(DEFAULT_SETTINGS)).not.toThrow();
  });

  it('enables the master switch and leaves strict mode off', () => {
    expect(DEFAULT_SETTINGS.masterEnabled).toBe(true);
    expect(DEFAULT_SETTINGS.strictMode).toBe(false);
  });

  it('has one entry per known feature', () => {
    expect(Object.keys(DEFAULT_SETTINGS.features).sort()).toEqual(
      ALL_FEATURES.map((entry) => entry.key).sort(),
    );
  });

  it('takes each default from the feature declaration', () => {
    for (const entry of ALL_FEATURES) {
      expect(DEFAULT_SETTINGS.features[entry.key]).toBe(
        entry.feature.defaultEnabled,
      );
    }
  });
});

describe('buildDefaultFeatures', () => {
  it('returns a fresh object each call, so callers cannot share state', () => {
    const first = buildDefaultFeatures();
    first['facebook.hideTyping'] = false;
    expect(buildDefaultFeatures()['facebook.hideTyping']).toBe(true);
  });
});

describe('settingsSchema', () => {
  it('rejects a wrong type on a global switch', () => {
    const bad = { ...DEFAULT_SETTINGS, masterEnabled: 'yes' };
    expect(settingsSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a missing field', () => {
    const incomplete: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    delete incomplete.theme;
    expect(settingsSchema.safeParse(incomplete).success).toBe(false);
  });

  it('rejects a non boolean feature value', () => {
    const bad = {
      ...DEFAULT_SETTINGS,
      features: { ...DEFAULT_SETTINGS.features, 'global.blockMetaPixel': 1 },
    };
    expect(settingsSchema.safeParse(bad).success).toBe(false);
  });

  it('accepts an unknown feature key, so an older build reading newer settings survives', () => {
    const forward = {
      ...DEFAULT_SETTINGS,
      features: { ...DEFAULT_SETTINGS.features, 'tiktok.hideSeen': true },
    };
    expect(settingsSchema.safeParse(forward).success).toBe(true);
  });
});

describe('findFeature', () => {
  it('finds a site feature by key', () => {
    expect(findFeature('facebook.hideTyping')?.feature.id).toBe('hideTyping');
  });

  it('finds a global feature by key', () => {
    expect(findFeature('global.blockMetaPixel')?.feature.id).toBe(
      'blockMetaPixel',
    );
  });

  it('returns null for an unknown key', () => {
    expect(findFeature('tiktok.hideSeen')).toBeNull();
  });
});

describe('isFeatureOn', () => {
  it('returns false for everything when the master switch is off', () => {
    const off: Settings = { ...DEFAULT_SETTINGS, masterEnabled: false };
    for (const entry of ALL_FEATURES) {
      expect(isFeatureOn(off, entry.key)).toBe(false);
    }
  });

  it('returns true for an active feature that is enabled', () => {
    expect(isFeatureOn(DEFAULT_SETTINGS, 'global.blockMetaPixel')).toBe(true);
  });

  it('returns false for an active feature that is disabled', () => {
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      features: {
        ...DEFAULT_SETTINGS.features,
        'global.blockMetaPixel': false,
      },
    };
    expect(isFeatureOn(settings, 'global.blockMetaPixel')).toBe(false);
  });

  it('returns false for a planned feature even when it is stored as enabled', () => {
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      features: {
        ...DEFAULT_SETTINGS.features,
        'instagram.hideReadReceipts': true,
      },
    };
    expect(isFeatureOn(settings, 'instagram.hideReadReceipts')).toBe(false);
  });

  it('returns true for an active feature that is stored as enabled', () => {
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      features: { ...DEFAULT_SETTINGS.features, 'facebook.hideReadReceipts': true },
    };
    expect(isFeatureOn(settings, 'facebook.hideReadReceipts')).toBe(true);
  });

  it('returns false for an active feature the user turned off', () => {
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      features: { ...DEFAULT_SETTINGS.features, 'facebook.hideReadReceipts': false },
    };
    expect(isFeatureOn(settings, 'facebook.hideReadReceipts')).toBe(false);
  });

  it('returns false for an unknown key rather than throwing', () => {
    expect(isFeatureOn(DEFAULT_SETTINGS, 'tiktok.hideSeen')).toBe(false);
  });
});
