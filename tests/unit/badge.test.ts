import { describe, expect, it } from 'vitest';
import { resolveBadge } from '@/core/badge';
import { DEFAULT_SETTINGS, type Settings } from '@/core/settings/schema';

function withSettings(patch: Partial<Settings>): Settings {
  return { ...DEFAULT_SETTINGS, ...patch };
}

describe('resolveBadge', () => {
  it('shows nothing while protection is on', () => {
    expect(resolveBadge(DEFAULT_SETTINGS).text).toBe('');
  });

  it('shows OFF when the master switch is off', () => {
    expect(resolveBadge(withSettings({ masterEnabled: false })).text).toBe(
      'OFF',
    );
  });

  it('uses the warning colour for the OFF badge', () => {
    expect(resolveBadge(withSettings({ masterEnabled: false })).color).toBe(
      '#e41e3f',
    );
  });

  it('stays silent when the person turned the badge off, even while paused', () => {
    expect(
      resolveBadge(
        withSettings({ masterEnabled: false, showBadge: false }),
      ).text,
    ).toBe('');
  });

  it('stays silent while protection is on even with the badge enabled', () => {
    expect(resolveBadge(withSettings({ showBadge: true })).text).toBe('');
  });
});
