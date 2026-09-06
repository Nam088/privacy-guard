import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from '#imports';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { ALL_URLS, ensureAllUrlsPermission } from '@/core/permissions';

// browser.permissions.contains/request are declared with a second,
// callback-based overload. TypeScript's `ReturnType` (which vitest's
// `Mock`/`mockResolvedValue` typing relies on) resolves an overloaded
// function type to its *last* signature, so spying on `browser.permissions`
// directly infers a `void` return type instead of `Promise<boolean>`. This
// local alias exposes only the promise-based shape actually used here, on
// the same underlying object, so the assertions below type-check without
// changing what they verify.
interface PermissionsApi {
  contains(permissions: { origins: string[] }): Promise<boolean>;
  request(permissions: { origins: string[] }): Promise<boolean>;
}

const permissions = browser.permissions as unknown as PermissionsApi;

describe('optional permission for all websites', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('does not ask again when the permission is already granted', async () => {
    vi.spyOn(permissions, 'contains').mockResolvedValue(true);
    const request = vi
      .spyOn(permissions, 'request')
      .mockResolvedValue(true);
    await expect(ensureAllUrlsPermission()).resolves.toBe(true);
    expect(request).not.toHaveBeenCalled();
  });

  it('asks for the permission when it is missing', async () => {
    vi.spyOn(permissions, 'contains').mockResolvedValue(false);
    const request = vi
      .spyOn(permissions, 'request')
      .mockResolvedValue(true);
    await expect(ensureAllUrlsPermission()).resolves.toBe(true);
    expect(request).toHaveBeenCalledWith({ origins: ALL_URLS });
  });

  it('reports false when the person declines', async () => {
    vi.spyOn(permissions, 'contains').mockResolvedValue(false);
    vi.spyOn(permissions, 'request').mockResolvedValue(false);
    await expect(ensureAllUrlsPermission()).resolves.toBe(false);
  });

  it('reports false rather than throwing when the API rejects', async () => {
    vi.spyOn(permissions, 'contains').mockRejectedValue(
      new Error('no'),
    );
    await expect(ensureAllUrlsPermission()).resolves.toBe(false);
  });
});
