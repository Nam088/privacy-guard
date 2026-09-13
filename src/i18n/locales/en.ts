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
    trustCaption: '100% On-Device • Zero Telemetry',
    socialAssistant: 'Social Privacy Assistant',
    webAssistant: 'Web Privacy Assistant',
    activeProtectionSummary: (siteName: string) => `Active protection running on ${siteName}.`,
    standbySummary: 'Standing by to protect when you open Facebook or Instagram.',
    resumeHint: 'Toggle the switch in the top right to resume protection.',
    e2eeNotice: 'Dual-layer protection active for both standard Messenger & E2EE chats (Armadillo).',
  },
  quickPresets: {
    stealthTitle: '1-Tap Stealth',
    stealthSubtitle: 'Seen & typing off',
    stealthTooltip: 'Enable all stealth features (seen, typing, story, online)',
    cleanTitle: '1-Tap Clean',
    cleanSubtitle: 'No ads & reels',
    cleanTooltip: 'Enable all clean feed features (sponsored, suggested, reels)',
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
    facebook: 'Facebook',
    instagram: 'Instagram',
  },
  dashboard: {
    totalActiveFeatures: (count: number) => `${count} active features`,
    activeNow: 'Active now',
    platformSubtitle: (name: string) => `Configure ${name} privacy & content filtering`,
    globalDescription: 'Privacy protections that apply across all websites you visit.',
  },
  common: {
    soon: 'Soon',
    auto: 'Auto',
    activeCount: 'active',
    activeSite: 'Active site',
  },
  site: {
    facebook: 'Facebook',
    messenger: 'Messenger',
    instagram: 'Instagram',
  },
  search: {
    placeholder: 'Search features (e.g. typing, ads, reels)...',
    noResultsTitle: 'No features found',
    noResultsHint: 'Try searching with different keywords or in Vietnamese (e.g. đang gõ, đã xem, quảng cáo)',
    clear: 'Clear search',
    resultsCount: (count: number) => `${count} ${count === 1 ? 'feature' : 'features'} found`,
    allPlatforms: 'All Platforms',
    shortcutHint: 'Press / to search, Esc to clear',
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
    'facebook.hideLiveStreamViews': {
      label: 'Hide live stream views',
      description: 'Watch Facebook Live videos anonymously without appearing in the viewer list',
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
      label: 'Block cursor & dwell tracking',
      description: 'Stop Meta tracking mouse cursor movements, hover heatmaps, and dwell seconds',
    },
    'facebook.bypassLinkShim': {
      label: 'Bypass Link Shim tracking',
      description: 'Open external links directly without routing through Facebook tracking redirect',
    },
    'facebook.stealthSearch': {
      label: 'Stealth search (Zero-trace history)',
      description: 'Search profiles and pages without saving to recent search history or skewing recommendations',
    },
    'facebook.piiLeakShield': {
      label: 'Local PII & secret leak shield',
      description: 'Warn before pasting bank cards, citizen IDs, passwords, or API keys into chat',
    },
    'facebook.cleanShareLinks': {
      label: 'Clean shared links (Anti-tracking)',
      description: 'Automatically strip mibextid, rdid, and user tracking tokens when copying links',
    },
    'facebook.antiFingerprint': {
      label: 'Anti-fingerprinting shield',
      description: 'Spoof hardware telemetry, WebGL vendor, and canvas noise to prevent device fingerprinting',
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
    'instagram.hideLiveStreamViews': {
      label: 'Hide live stream views',
      description: 'Watch Instagram Live videos anonymously without sending join notifications',
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
    'instagram.hideOnlineStatus': {
      label: 'Invisible mode (Hide online status)',
      description: 'Stay completely invisible on Instagram Direct without the active status dot',
    },
    'instagram.hideSponsoredPosts': {
      label: 'Hide sponsored posts & ads',
      description: 'Hide ads and sponsored content in your Instagram feed',
    },
    'instagram.protectWebRtcIp': {
      label: 'WebRTC IP leak shield',
      description: 'Prevent local and public IP exposure during Instagram Direct calls',
    },
    'instagram.scrambleDwellTime': {
      label: 'Block cursor & dwell tracking',
      description: 'Stop Meta tracking mouse movements, hover heatmaps, and dwell seconds',
    },
    'instagram.stealthSearch': {
      label: 'Stealth search (Zero-trace history)',
      description: 'Search accounts and tags without recording to recent search history or skewing explore suggestions',
    },
    'instagram.piiLeakShield': {
      label: 'Local PII & secret leak shield',
      description: 'Warn before pasting bank cards, citizen IDs, passwords, or API keys into chat',
    },
    'instagram.cleanShareLinks': {
      label: 'Clean shared links (Anti-tracking)',
      description: 'Automatically strip igsh, igshid, and UTM tokens when copying links',
    },
    'instagram.antiFingerprint': {
      label: 'Anti-fingerprinting shield',
      description: 'Spoof hardware telemetry, WebGL vendor, and canvas noise to prevent device fingerprinting',
    },
    'global.stripFbclid': {
      label: 'Strip fbclid from links',
      description: 'Remove fbclid, igshid, utm_*, si, and gclid tracking identifiers from links you click',
    },
    'global.blockMetaPixel': {
      label: 'Block Meta Pixel',
      description: 'Block Meta tracking pixels and analytics across third-party websites',
    },
  },
};
