import type { Feature } from '../sites/types';

export const GLOBAL_FEATURES: readonly Feature[] = [
  {
    id: 'blockMetaPixel',
    label: 'Block Meta tracking pixels',
    description: 'Stop Facebook tracking code loading on other websites',
    defaultEnabled: true,
    status: 'active',
  },
  {
    id: 'stripFbclid',
    label: 'Strip fbclid from links',
    description:
      'Remove the tracking parameter when you follow a link off Facebook. Asks for permission to read all sites',
    defaultEnabled: false,
    status: 'active',
  },
];
