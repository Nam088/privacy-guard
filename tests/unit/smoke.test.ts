import { describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

describe('test environment', () => {
  it('provides fakeBrowser with in memory storage', async () => {
    await fakeBrowser.storage.local.set({ ping: 'pong' });
    const result = await fakeBrowser.storage.local.get('ping');
    expect(result).toEqual({ ping: 'pong' });
  });
});
