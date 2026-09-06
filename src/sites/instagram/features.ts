import type { Feature } from '../types';

export const INSTAGRAM_FEATURES: readonly Feature[] = [
  {
    id: 'hideReadReceipts',
    label: 'Hide read receipts',
    description: 'Read direct messages without sending a seen marker',
    defaultEnabled: true,
    status: 'planned',
  },
  {
    id: 'hideTyping',
    label: 'Hide typing indicator',
    description: 'Stop the typing bubble appearing in direct messages',
    defaultEnabled: true,
    status: 'planned',
  },
  {
    id: 'hideStoryViews',
    label: 'Hide story views',
    description: 'Watch stories without appearing in the viewer list',
    defaultEnabled: true,
    status: 'planned',
  },
];
