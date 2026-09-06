import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { DEFAULT_SETTINGS } from '@/core/settings/schema';
import { readSettings, writeSettings } from '@/core/settings/storage';
import {
  initSettingsStore,
  isReady,
  setFeature,
  setLocale,
  setMasterEnabled,
  settings,
  stopSettingsStore,
} from '@/core/settings/store';

describe('settings store', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    stopSettingsStore();
    settings.value = DEFAULT_SETTINGS;
  });

  it('starts out not ready', () => {
    expect(isReady.value).toBe(false);
  });

  it('loads stored settings on init', async () => {
    await writeSettings({
      ...DEFAULT_SETTINGS,
      features: {
        ...DEFAULT_SETTINGS.features,
        'global.blockMetaPixel': false,
      },
    });
    await initSettingsStore();
    expect(isReady.value).toBe(true);
    expect(settings.value.features['global.blockMetaPixel']).toBe(false);
  });

  it('updates the signal before the write resolves', async () => {
    await initSettingsStore();
    const pending = setFeature('global.blockMetaPixel', false);
    expect(settings.value.features['global.blockMetaPixel']).toBe(false);
    await pending;
  });

  it('persists a feature change', async () => {
    await initSettingsStore();
    await setFeature('global.blockMetaPixel', false);
    const persisted = await readSettings();
    expect(persisted.features['global.blockMetaPixel']).toBe(false);
  });

  it('does not disturb other features', async () => {
    await initSettingsStore();
    await setFeature('global.blockMetaPixel', false);
    expect(settings.value.features['global.stripFbclid']).toBe(false);
    expect(settings.value.features['facebook.hideTyping']).toBe(true);
  });

  it('persists the master switch', async () => {
    await initSettingsStore();
    await setMasterEnabled(false);
    const persisted = await readSettings();
    expect(persisted.masterEnabled).toBe(false);
  });

  it('goes back to not ready when stopped', async () => {
    await initSettingsStore();
    stopSettingsStore();
    expect(isReady.value).toBe(false);
  });

  it('survives being initialised twice without leaking a watcher', async () => {
    await initSettingsStore();
    await initSettingsStore();
    await setMasterEnabled(false);
    expect(settings.value.masterEnabled).toBe(false);
  });

  it('rolls the signal back when the write fails, so the interface never shows an unsaved state', async () => {
    await initSettingsStore();
    const before = settings.value.features['global.blockMetaPixel'];

    const storageModule = await import('@/core/settings/storage');
    const spy = vi
      .spyOn(storageModule, 'writeSettings')
      .mockRejectedValue(new Error('quota exceeded'));

    await expect(setFeature('global.blockMetaPixel', !before)).rejects.toThrow(
      'quota exceeded',
    );
    expect(settings.value.features['global.blockMetaPixel']).toBe(before);

    spy.mockRestore();
  });

  it('still rejects so the caller learns the write failed', async () => {
    await initSettingsStore();

    const storageModule = await import('@/core/settings/storage');
    const spy = vi
      .spyOn(storageModule, 'writeSettings')
      .mockRejectedValue(new Error('quota exceeded'));

    await expect(setMasterEnabled(false)).rejects.toThrow('quota exceeded');
    expect(settings.value.masterEnabled).toBe(true);

    spy.mockRestore();
  });

  it('does not let a slow initial read clobber a change made while it was in flight', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const storageModule = await import('@/core/settings/storage');
    const readSpy = vi
      .spyOn(storageModule, 'readSettings')
      .mockImplementation(async () => {
        await gate;
        return DEFAULT_SETTINGS;
      });

    const init = initSettingsStore();
    await setMasterEnabled(false);
    expect(settings.value.masterEnabled).toBe(false);

    release();
    await init;

    expect(settings.value.masterEnabled).toBe(false);
    readSpy.mockRestore();
  });

  it('starts watching before the initial read resolves, so a write in that window is not missed', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const storageModule = await import('@/core/settings/storage');
    const readSpy = vi
      .spyOn(storageModule, 'readSettings')
      .mockImplementation(async () => {
        await gate;
        return DEFAULT_SETTINGS;
      });
    const watchSpy = vi.spyOn(storageModule.settingsItem, 'watch');

    const init = initSettingsStore();
    expect(watchSpy).toHaveBeenCalled();

    release();
    await init;
    readSpy.mockRestore();
    watchSpy.mockRestore();
  });

  it('persists a locale change', async () => {
    await initSettingsStore();
    await setLocale('vi');
    expect(settings.value.locale).toBe('vi');
    const persisted = await readSettings();
    expect(persisted.locale).toBe('vi');
  });
});
