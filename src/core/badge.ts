import { browser } from '#imports';
import type { Settings } from './settings/schema';

const WARNING_COLOR = '#e41e3f';

export interface BadgeState {
  text: string;
  color: string;
}

export function resolveBadge(settings: Settings): BadgeState {
  const warn = settings.showBadge && !settings.masterEnabled;
  return {
    text: warn ? 'OFF' : '',
    color: WARNING_COLOR,
  };
}

export async function applyBadge(settings: Settings): Promise<void> {
  const { text, color } = resolveBadge(settings);
  await browser.action.setBadgeBackgroundColor({ color });
  await browser.action.setBadgeText({ text });
}
