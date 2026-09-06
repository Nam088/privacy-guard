import { describe, expect, it } from 'vitest';
import { resolveActiveSite } from '@/core/activeSite';

describe('resolveActiveSite', () => {
  it('resolves a supported site from the first tab', () => {
    expect(resolveActiveSite([{ url: 'https://www.facebook.com/' }])?.id).toBe(
      'facebook',
    );
  });

  it('resolves the other supported site', () => {
    expect(resolveActiveSite([{ url: 'https://www.instagram.com/' }])?.id).toBe(
      'instagram',
    );
  });

  it('returns null for an unsupported site', () => {
    expect(resolveActiveSite([{ url: 'https://example.com/' }])).toBeNull();
  });

  it('returns null when the tab has no url, which is what happens without host permission', () => {
    expect(resolveActiveSite([{}])).toBeNull();
  });

  it('returns null when there are no tabs at all', () => {
    expect(resolveActiveSite([])).toBeNull();
  });

  it('ignores tabs after the first', () => {
    expect(
      resolveActiveSite([
        { url: 'https://example.com/' },
        { url: 'https://www.facebook.com/' },
      ]),
    ).toBeNull();
  });
});
