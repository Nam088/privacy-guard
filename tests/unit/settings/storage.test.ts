import { beforeEach, describe, expect, it } from 'vitest';
import { storage } from '#imports';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { DEFAULT_SETTINGS, type Settings } from '@/core/settings/schema';
import { readSettings, writeSettings } from '@/core/settings/storage';

describe('readSettings and writeSettings', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('returns defaults when storage is empty', async () => {
    await expect(readSettings()).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it('reads back exactly what was written', async () => {
    const next: Settings = {
      ...DEFAULT_SETTINGS,
      features: {
        ...DEFAULT_SETTINGS.features,
        'global.blockMetaPixel': false,
      },
    };
    await writeSettings(next);
    const result = await readSettings();
    expect(result.features['global.blockMetaPixel']).toBe(false);
  });

  it('leaves other features untouched when one changes', async () => {
    await writeSettings({
      ...DEFAULT_SETTINGS,
      features: {
        ...DEFAULT_SETTINGS.features,
        'global.blockMetaPixel': false,
      },
    });
    const result = await readSettings();
    expect(result.features['facebook.hideTyping']).toBe(true);
  });

  it('falls back to defaults when the stored value is corrupt', async () => {
    await storage.setItem('local:settings', { masterEnabled: 'yes' });
    await expect(readSettings()).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it('overwrites corrupt data instead of rereading it forever', async () => {
    await storage.setItem('local:settings', { garbage: true });
    await readSettings();
    const raw = await storage.getItem<Settings>('local:settings');
    expect(raw).toEqual(DEFAULT_SETTINGS);
  });

  it('backfills a feature key missing from stored settings', async () => {
    const partial = {
      ...DEFAULT_SETTINGS,
      features: { 'global.blockMetaPixel': false },
    };
    await storage.setItem('local:settings', partial);
    const result = await readSettings();
    expect(result.features['global.blockMetaPixel']).toBe(false);
    expect(result.features['facebook.hideTyping']).toBe(true);
  });

  it('refuses to write invalid settings', async () => {
    const bad = { ...DEFAULT_SETTINGS, theme: 'neon' } as unknown as Settings;
    await expect(writeSettings(bad)).rejects.toThrow();
  });
});
