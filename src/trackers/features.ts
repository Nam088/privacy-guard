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
      'Remove fbclid, igshid, utm_*, si, and gclid tracking parameters when following links. Asks for permission to read all sites',
    defaultEnabled: false,
    status: 'active',
  },
];
