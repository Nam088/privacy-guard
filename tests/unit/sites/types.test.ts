import { describe, expect, it } from 'vitest';
import { GLOBAL_SCOPE, featureKey } from '@/sites/types';

describe('featureKey', () => {
  it('joins a scope and a feature id with a dot', () => {
    expect(featureKey('facebook', 'hideReadReceipts')).toBe(
      'facebook.hideReadReceipts',
    );
  });

  it('uses the global scope for tracker features', () => {
    expect(featureKey(GLOBAL_SCOPE, 'blockMetaPixel')).toBe(
      'global.blockMetaPixel',
    );
  });

  it('produces a distinct key for the same feature id on different sites', () => {
    expect(featureKey('facebook', 'hideReadReceipts')).not.toBe(
      featureKey('instagram', 'hideReadReceipts'),
    );
  });
});
