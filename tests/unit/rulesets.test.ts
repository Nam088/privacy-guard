import { describe, expect, it } from 'vitest';
import { RULESET_IDS, resolveRulesets } from '@/core/rulesets';
import { DEFAULT_SETTINGS, type Settings } from '@/core/settings/schema';

function withFeature(key: string, value: boolean): Settings {
  return {
    ...DEFAULT_SETTINGS,
    features: { ...DEFAULT_SETTINGS.features, [key]: value },
  };
}

describe('resolveRulesets', () => {
  it('enables the pixel ruleset by default', () => {
    const plan = resolveRulesets(DEFAULT_SETTINGS);
    expect(plan.enable).toContain(RULESET_IDS.metaPixel);
    expect(plan.disable).not.toContain(RULESET_IDS.metaPixel);
  });

  it('leaves the fbclid ruleset disabled by default', () => {
    const plan = resolveRulesets(DEFAULT_SETTINGS);
    expect(plan.disable).toContain(RULESET_IDS.fbclid);
  });

  it('disables the pixel ruleset when the feature is turned off', () => {
    const plan = resolveRulesets(withFeature('global.blockMetaPixel', false));
    expect(plan.disable).toContain(RULESET_IDS.metaPixel);
    expect(plan.enable).not.toContain(RULESET_IDS.metaPixel);
  });

  it('enables the fbclid ruleset when the feature is turned on', () => {
    const plan = resolveRulesets(withFeature('global.stripFbclid', true));
    expect(plan.enable).toContain(RULESET_IDS.fbclid);
  });

  it('disables everything when the master switch is off', () => {
    const plan = resolveRulesets({
      ...DEFAULT_SETTINGS,
      masterEnabled: false,
    });
    expect(plan.enable).toEqual([]);
    expect(plan.disable).toContain(RULESET_IDS.metaPixel);
    expect(plan.disable).toContain(RULESET_IDS.fbclid);
  });

  it('never puts the same ruleset in both lists', () => {
    const cases: Settings[] = [
      DEFAULT_SETTINGS,
      { ...DEFAULT_SETTINGS, masterEnabled: false },
      withFeature('global.blockMetaPixel', false),
      withFeature('global.stripFbclid', true),
    ];
    for (const settings of cases) {
      const { enable, disable } = resolveRulesets(settings);
      expect(enable.filter((id) => disable.includes(id))).toEqual([]);
    }
  });

  it('accounts for every known ruleset in every case', () => {
    const all = Object.values(RULESET_IDS);
    const cases: Settings[] = [
      DEFAULT_SETTINGS,
      { ...DEFAULT_SETTINGS, masterEnabled: false },
    ];
    for (const settings of cases) {
      const { enable, disable } = resolveRulesets(settings);
      expect([...enable, ...disable].sort()).toEqual([...all].sort());
    }
  });
});
