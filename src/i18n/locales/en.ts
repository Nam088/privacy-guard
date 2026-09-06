import type { TranslationDictionary } from '../types';

export const en: TranslationDictionary = {
  app: {
    name: 'Privacy Guard',
    protectionOn: 'Protection on',
    protectionPaused: 'Protection paused',
    protection: 'Protection',
    openSiteHint:
      'Open Facebook, Messenger or Instagram to see the controls for that site. The settings below apply everywhere.',
    footerNotice: 'Works only on your own session. Privacy Guard sends no data anywhere.',
  },
  section: {
    allWebsites: 'All websites',
    feed: 'Feed & Content',
    privacy: 'Privacy & Chat',
  },
  tabs: {
    feed: 'Feed',
    privacy: 'Privacy',
    global: 'Global',
    all: 'All',
  },
  common: {
    soon: 'Soon',
    auto: 'Auto',
    activeCount: 'active',
  },
  site: {
    facebook: 'Facebook',
    messenger: 'Messenger',
    instagram: 'Instagram',
  },
  features: {
    'facebook.hideReadReceipts': {
      label: 'Hide read receipts',
      description: 'Read messages without telling the sender you read them',
    },
    'facebook.hideTyping': {
      label: 'Hide typing indicator',
      description: 'Stop the three dots appearing while you type',
    },
    'facebook.hideStoryViews': {
      label: 'Hide story views',
      description: 'Watch stories without appearing in the viewer list',
    },
    'facebook.blockFeedAutoRefresh': {
      label: 'Stop the feed reloading',
      description: 'Keep your place when you switch back to the tab',
    },
    'facebook.hideInboxLastSeen': {
      label: 'Hide when you opened your inbox',
      description: 'Stop Messenger recording the time you last looked at your chat list',
    },
    'facebook.hideSponsoredPosts': {
      label: 'Hide sponsored posts',
      description: 'Hide ads and sponsored content in your feed',
    },
    'facebook.hideSuggestedPosts': {
      label: 'Hide suggested posts',
      description: 'Show only posts from friends and pages you follow',
    },
    'facebook.hideReels': {
      label: 'Hide Reels & short videos',
      description: 'Hide Reels trays and short video clips in your feed',
    },
    'facebook.hideOnlineStatus': {
      label: 'Invisible mode (Hide online status)',
      description: 'Stay completely invisible on Messenger without the green active dot',
    },
    'facebook.protectWebRtcIp': {
      label: 'WebRTC IP leak shield',
      description: 'Prevent local and public IP exposure during Messenger calls',
    },
    'facebook.hideVoicePlayed': {
      label: 'Hide voice note played marker',
      description: 'Listen to voice messages without notifying the sender',
    },
    'facebook.scrambleDwellTime': {
      label: 'Scramble dwell time tracking',
      description: 'Stop Meta measuring exact seconds spent looking at posts and videos',
    },
    'facebook.bypassLinkShim': {
      label: 'Bypass Link Shim tracking',
      description: 'Open external links directly without routing through Facebook tracking redirect',
    },
    'instagram.hideReadReceipts': {
      label: 'Hide read receipts',
      description: 'Read direct messages without sending a seen marker',
    },
    'instagram.hideTyping': {
      label: 'Hide typing indicator',
      description: 'Stop the typing bubble appearing in direct messages',
    },
    'instagram.hideStoryViews': {
      label: 'Hide story views',
      description: 'Watch stories without appearing in the viewer list',
    },
    'instagram.bypassLinkShim': {
      label: 'Bypass Link Shim tracking',
      description: 'Open external links directly without routing through Instagram tracking redirect',
    },
    'instagram.hideSuggestedPosts': {
      label: 'Hide suggested posts',
      description: 'Filter out algorithmic suggested posts from your feed',
    },
    'instagram.hideReels': {
      label: 'Hide Reels & short videos',
      description: 'Hide Reels shelves and video carousels in your feed',
    },
    'global.stripFbclid': {
      label: 'Strip fbclid from links',
      description: 'Remove tracking identifiers from links you click',
    },
    'global.blockMetaPixel': {
      label: 'Block Meta Pixel',
      description: 'Block Meta tracking pixels and analytics across third-party websites',
    },
  },
};
