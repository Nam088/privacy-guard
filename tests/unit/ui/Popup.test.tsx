import { render, screen, waitFor } from '@testing-library/preact';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { facebook } from '@/sites/facebook';
import { instagram } from '@/sites/instagram';
import { Popup } from '@/entrypoints/popup/Popup';
import { DEFAULT_SETTINGS } from '@/core/settings/schema';
import {
  isReady,
  settings,
  stopSettingsStore,
} from '@/core/settings/store';

vi.mock('@/core/activeSite', () => ({
  getActiveSite: vi.fn(),
}));

vi.mock('@/core/permissions', () => ({
  ensureAllUrlsPermission: vi.fn(),
}));

const { getActiveSite } = await import('@/core/activeSite');
const mockedGetActiveSite = vi.mocked(getActiveSite);

const { ensureAllUrlsPermission } = await import('@/core/permissions');
const mockedEnsurePermission = vi.mocked(ensureAllUrlsPermission);

describe('Popup', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    mockedGetActiveSite.mockReset();
    mockedEnsurePermission.mockReset();
    // `settings` and `isReady` are module level singletons, so without this reset a test
    // inherits whatever the previous one left behind. That is what made an earlier test in
    // this file start with protection already paused, which disabled the toggle it was
    // trying to click.
    stopSettingsStore();
    settings.value = DEFAULT_SETTINGS;
  });

  it('shows the global section on an unsupported site', async () => {
    mockedGetActiveSite.mockResolvedValue(null);
    render(<Popup />);

    await waitFor(() => {
      expect(screen.getByText(/Open Facebook, Messenger or Instagram/)).toBeTruthy();
    });
    expect(screen.getByText('All websites')).toBeTruthy();
    expect(screen.queryByText('Facebook')).toBeNull();
  });

  it('shows the site section when a supported site is active', async () => {
    mockedGetActiveSite.mockResolvedValue(facebook);
    render(<Popup />);

    await waitFor(() => {
      expect(screen.getByText('Facebook')).toBeTruthy();
    });
    expect(screen.queryByText(/Open Facebook, Messenger or Instagram/)).toBeNull();
  });

  it('disables exactly the planned features, so the popup never claims protection it lacks', async () => {
    mockedGetActiveSite.mockResolvedValue(facebook);
    render(<Popup />);

    await waitFor(() => {
      expect(screen.getByText('Facebook')).toBeTruthy();
    });

    for (const feature of facebook.features) {
      const row = screen.getByText(feature.label).closest('label');
      expect(row).not.toBeNull();
      const input = row?.querySelector('input[role="switch"]');
      expect((input as HTMLInputElement).disabled).toBe(feature.status === 'planned');
    }
  });

  it('badges every planned feature as Soon, so a disabled row does not read as broken', async () => {
    const siteWithPlanned = {
      ...instagram,
      features: [
        ...instagram.features,
        {
          id: 'mockPlannedFeature',
          label: 'Planned Feature',
          description: 'A planned feature for testing',
          defaultEnabled: false,
          status: 'planned' as const,
        },
      ],
    };
    mockedGetActiveSite.mockResolvedValue(siteWithPlanned);
    render(<Popup />);

    await waitFor(() => {
      expect(screen.getByText('Instagram')).toBeTruthy();
    });

    const planned = siteWithPlanned.features.filter((feature) => feature.status === 'planned');

    expect(screen.getAllByText('Soon')).toHaveLength(planned.length);
    // The badge marks what is not built. An active feature wearing it would be the same lie in
    // the other direction.
    expect(planned.length).toBeGreaterThan(0);
  });

  it('leaves the active global features usable', async () => {
    mockedGetActiveSite.mockResolvedValue(null);
    render(<Popup />);

    await waitFor(() => {
      expect(screen.getByText('All websites')).toBeTruthy();
    });

    const row = screen.getByText('Block Meta Pixel').closest('label');
    const input = row?.querySelector('input[role="switch"]');
    expect((input as HTMLInputElement).disabled).toBe(false);
  });

  it('disables every toggle when protection is paused', async () => {
    mockedGetActiveSite.mockResolvedValue(null);
    render(<Popup />);

    // The initial "Protection on" text reflects the settings store's default value, not
    // necessarily its storage backed one. `isReady` only flips once `initSettingsStore`'s
    // read has actually resolved and its storage watcher is attached, so waiting on it here
    // avoids a race where that still-pending read overwrites the click below with stale data.
    await waitFor(() => {
      expect(isReady.value).toBe(true);
    });
    await waitFor(() => {
      expect(screen.getByText('Protection on')).toBeTruthy();
    });

    const master = screen.getAllByRole('switch')[0] as HTMLInputElement;
    master.click();

    await waitFor(() => {
      expect(screen.getByText('Protection paused')).toBeTruthy();
    });

    for (const input of screen.getAllByRole('switch').slice(1)) {
      expect((input as HTMLInputElement).disabled).toBe(true);
    }
  });

  it('leaves the setting off when the permission is declined', async () => {
    mockedGetActiveSite.mockResolvedValue(null);
    mockedEnsurePermission.mockResolvedValue(false);
    const { settings } = await import('@/core/settings/store');
    render(<Popup />);

    // Wait for the store to finish loading before interacting. A prior test may have left
    // the module level `settings` signal at `masterEnabled: false`; until `initSettingsStore`'s
    // read resolves and restores the default, every toggle renders disabled and a click is a
    // no-op, which would make this assertion pass for the wrong reason.
    await waitFor(() => {
      expect(isReady.value).toBe(true);
    });
    await waitFor(() => {
      expect(screen.getByText('Strip fbclid from links')).toBeTruthy();
    });

    const row = screen.getByText('Strip fbclid from links').closest('label');
    const input = row?.querySelector('input[role="switch"]') as HTMLInputElement;
    input.click();

    await waitFor(() => {
      expect(mockedEnsurePermission).toHaveBeenCalled();
    });
    expect(settings.value.features['global.stripFbclid']).toBe(false);
  });

  it('turns the setting on when the permission is granted', async () => {
    mockedGetActiveSite.mockResolvedValue(null);
    mockedEnsurePermission.mockResolvedValue(true);
    const { settings } = await import('@/core/settings/store');
    render(<Popup />);

    await waitFor(() => {
      expect(isReady.value).toBe(true);
    });
    await waitFor(() => {
      expect(screen.getByText('Strip fbclid from links')).toBeTruthy();
    });

    const row = screen.getByText('Strip fbclid from links').closest('label');
    const input = row?.querySelector('input[role="switch"]') as HTMLInputElement;
    input.click();

    await waitFor(() => {
      expect(settings.value.features['global.stripFbclid']).toBe(true);
    });
  });

  it('does not ask for permission for any other feature', async () => {
    mockedGetActiveSite.mockResolvedValue(null);
    mockedEnsurePermission.mockResolvedValue(true);
    render(<Popup />);

    await waitFor(() => {
      expect(isReady.value).toBe(true);
    });
    await waitFor(() => {
      expect(screen.getByText('Block Meta Pixel')).toBeTruthy();
    });

    const row = screen.getByText('Block Meta Pixel').closest('label');
    const input = row?.querySelector('input[role="switch"]') as HTMLInputElement;
    input.click();

    await waitFor(() => {
      expect(mockedEnsurePermission).not.toHaveBeenCalled();
    });
  });
});
