import { browser } from '#imports';
import { isFeatureOn, type Settings } from './settings/schema';

export const RULESET_IDS = {
  metaPixel: 'meta-pixel',
  fbclid: 'fbclid',
} as const;

export type RulesetId = (typeof RULESET_IDS)[keyof typeof RULESET_IDS];

const RULESET_FEATURE: Record<RulesetId, string> = {
  [RULESET_IDS.metaPixel]: 'global.blockMetaPixel',
  [RULESET_IDS.fbclid]: 'global.stripFbclid',
};

export interface RulesetPlan {
  enable: RulesetId[];
  disable: RulesetId[];
}

export function resolveRulesets(settings: Settings): RulesetPlan {
  const enable: RulesetId[] = [];
  const disable: RulesetId[] = [];

  for (const id of Object.values(RULESET_IDS)) {
    if (isFeatureOn(settings, RULESET_FEATURE[id])) {
      enable.push(id);
    } else {
      disable.push(id);
    }
  }

  return { enable, disable };
}

export async function applyRulesets(settings: Settings): Promise<void> {
  const { enable, disable } = resolveRulesets(settings);
  await browser.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: enable,
    disableRulesetIds: disable,
  });
}
