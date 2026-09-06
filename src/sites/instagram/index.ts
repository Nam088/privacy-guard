import type { SiteModule } from '../types';
import { INSTAGRAM_FEATURES } from './features';

export const instagram: SiteModule = {
  id: 'instagram',
  displayName: 'Instagram',
  hosts: ['instagram.com'],
  matches: ['*://*.instagram.com/*'],
  features: INSTAGRAM_FEATURES,
};
