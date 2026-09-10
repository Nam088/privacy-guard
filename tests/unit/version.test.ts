import { browser } from '#imports';
import { describe, expect, it, vi } from 'vitest';
import { formatVersionBadge, getExtensionVersion } from '@/core/version';

describe('formatVersionBadge', () => {
  it('prefixes a version with v', () => {
    expect(formatVersionBadge('0.12.0')).toBe('v0.12.0');
  });

  it('returns an empty string for a missing version, so no badge renders', () => {
    expect(formatVersionBadge('')).toBe('');
  });
});

describe('getExtensionVersion', () => {
  it('reads the version from the manifest', () => {
    vi.spyOn(browser.runtime, 'getManifest').mockReturnValue({
      version: '1.2.3',
    } as ReturnType<typeof browser.runtime.getManifest>);

    expect(getExtensionVersion()).toBe('1.2.3');
  });

  it('falls back to an empty string when the manifest has no version', () => {
    vi.spyOn(browser.runtime, 'getManifest').mockReturnValue(
      {} as ReturnType<typeof browser.runtime.getManifest>,
    );

    expect(getExtensionVersion()).toBe('');
  });

  it('falls back to an empty string when the manifest is unavailable', () => {
    vi.spyOn(browser.runtime, 'getManifest').mockImplementation(() => {
      throw new Error('no extension context');
    });

    expect(getExtensionVersion()).toBe('');
  });
});
