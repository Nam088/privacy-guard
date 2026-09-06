import type { Feature } from '../types';

export const INSTAGRAM_FEATURES: readonly Feature[] = [
  {
    id: 'hideReadReceipts',
    label: 'Hide read receipts',
    description: 'Read direct messages without sending a seen marker',
    defaultEnabled: true,
    status: 'active',
    category: 'privacy',
  },
  {
    id: 'hideTyping',
    label: 'Hide typing indicator',
    description: 'Stop the typing bubble appearing in direct messages',
    defaultEnabled: true,
    status: 'active',
    category: 'privacy',
  },
  {
    id: 'hideStoryViews',
    label: 'Hide story views',
    description: 'Watch stories without appearing in the viewer list',
    defaultEnabled: true,
    status: 'active',
    category: 'privacy',
  },
  {
    id: 'bypassLinkShim',
    label: 'Bypass Link Shim tracking',
    description: 'Open external links directly without routing through Instagram tracking redirect',
    defaultEnabled: true,
    status: 'active',
    category: 'privacy',
  },
  {
    id: 'hideSuggestedPosts',
    label: 'Hide suggested posts',
    description: 'Filter out algorithmic suggested posts from your feed',
    defaultEnabled: true,
    status: 'active',
    category: 'feed',
  },
  {
    id: 'hideReels',
    label: 'Hide Reels & short videos',
    description: 'Hide Reels shelves and video carousels in your feed',
    defaultEnabled: true,
    status: 'active',
    category: 'feed',
  },
];
