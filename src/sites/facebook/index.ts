import type { SiteModule } from '../types';
import { FACEBOOK_FEATURES } from './features';

export const facebook: SiteModule = {
  id: 'facebook',
  displayName: 'Facebook',
  hosts: ['facebook.com', 'messenger.com', 'fbsbx.com'],
  matches: ['*://*.facebook.com/*', '*://*.messenger.com/*', '*://*.fbsbx.com/*'],
  features: FACEBOOK_FEATURES,
};
