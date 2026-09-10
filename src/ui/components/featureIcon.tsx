import type { ComponentChildren } from 'preact';
import {
  AdBlockIcon,
  ChatDotsIcon,
  ClockStopIcon,
  EyeOffIcon,
  FilmSlashIcon,
  GhostIcon,
  IncognitoIcon,
  LinkSlashIcon,
  LockCheckIcon,
  MicOffIcon,
  PauseReloadIcon,
  RadarIcon,
  SearchSlashIcon,
  ShieldNetworkIcon,
  SparklesSlashIcon,
  VideoOffIcon,
} from './icons';

type BadgeVariant =
  | 'indigo'
  | 'purple'
  | 'amber'
  | 'rose'
  | 'emerald'
  | 'sky'
  | 'teal';

function renderBadge(icon: ComponentChildren, variant: BadgeVariant): ComponentChildren {
  const variantStyles: Record<BadgeVariant, string> = {
    indigo:
      'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300 ring-1 ring-indigo-500/20',
    purple:
      'bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-300 ring-1 ring-purple-500/20',
    amber:
      'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 ring-1 ring-amber-500/20',
    rose:
      'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 ring-1 ring-rose-500/20',
    emerald:
      'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 ring-1 ring-emerald-500/20',
    sky:
      'bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400 ring-1 ring-sky-500/20',
    teal:
      'bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400 ring-1 ring-teal-500/20',
  };

  return (
    <div
      class={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 ${variantStyles[variant]}`}
    >
      {icon}
    </div>
  );
}

export function getFeatureIcon(key: string): ComponentChildren {
  switch (key) {
    case 'facebook.hideReadReceipts':
    case 'instagram.hideReadReceipts':
      return renderBadge(<EyeOffIcon size={17} />, 'indigo');

    case 'facebook.hideTyping':
    case 'instagram.hideTyping':
      return renderBadge(<ChatDotsIcon size={17} />, 'indigo');

    case 'facebook.hideStoryViews':
    case 'instagram.hideStoryViews':
      return renderBadge(<GhostIcon size={17} />, 'purple');

    case 'facebook.hideLiveStreamViews':
    case 'instagram.hideLiveStreamViews':
      return renderBadge(<VideoOffIcon size={17} />, 'purple');

    case 'facebook.hideInboxLastSeen':
      return renderBadge(<LockCheckIcon size={17} />, 'indigo');

    case 'facebook.hideOnlineStatus':
    case 'instagram.hideOnlineStatus':
      return renderBadge(<IncognitoIcon size={17} />, 'indigo');

    case 'facebook.hideVoicePlayed':
      return renderBadge(<MicOffIcon size={17} />, 'indigo');

    case 'facebook.stealthSearch':
    case 'instagram.stealthSearch':
      return renderBadge(<SearchSlashIcon size={17} />, 'purple');

    case 'facebook.hideSponsoredPosts':
    case 'instagram.hideSponsoredPosts':
      return renderBadge(<AdBlockIcon size={17} />, 'amber');

    case 'facebook.hideSuggestedPosts':
    case 'instagram.hideSuggestedPosts':
      return renderBadge(<SparklesSlashIcon size={17} />, 'amber');

    case 'facebook.hideReels':
    case 'instagram.hideReels':
      return renderBadge(<FilmSlashIcon size={17} />, 'rose');

    case 'facebook.blockFeedAutoRefresh':
      return renderBadge(<PauseReloadIcon size={17} />, 'teal');

    case 'facebook.scrambleDwellTime':
    case 'instagram.scrambleDwellTime':
      return renderBadge(<ClockStopIcon size={17} />, 'teal');

    case 'facebook.bypassLinkShim':
    case 'instagram.bypassLinkShim':
      return renderBadge(<LinkSlashIcon size={17} />, 'sky');

    case 'facebook.protectWebRtcIp':
    case 'instagram.protectWebRtcIp':
      return renderBadge(<ShieldNetworkIcon size={17} />, 'emerald');

    case 'global.blockMetaPixel':
      return renderBadge(<RadarIcon size={17} />, 'emerald');

    case 'global.stripFbclid':
      return renderBadge(<LinkSlashIcon size={17} />, 'sky');

    default:
      return null;
  }
}
