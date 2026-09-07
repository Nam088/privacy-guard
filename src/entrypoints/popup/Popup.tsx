import { useEffect, useState } from 'preact/hooks';
import { getActiveSite } from '@/core/activeSite';
import { ensureAllUrlsPermission } from '@/core/permissions';
import {
  initSettingsStore,
  setFeature,
  setLocale,
  setMasterEnabled,
  setTheme,
  settings,
  stopSettingsStore,
} from '@/core/settings/store';
import { getDictionary, getFeatureTranslation, resolveLocale } from '@/i18n';
import { facebook } from '@/sites/facebook';
import { instagram } from '@/sites/instagram';
import { featureKey, type Feature, type SiteModule } from '@/sites/types';
import { GLOBAL_FEATURES } from '@/trackers/features';
import { Toggle } from '@/ui/components/Toggle';
import {
  AdBlockIcon,
  BrandLogo,
  ChatDotsIcon,
  ClockStopIcon,
  EyeOffIcon,
  FacebookIcon,
  FilmSlashIcon,
  GhostIcon,
  GlobeIcon,
  IncognitoIcon,
  InstagramIcon,
  LinkSlashIcon,
  LockCheckIcon,
  MicOffIcon,
  PauseReloadIcon,
  RadarIcon,
  SearchSlashIcon,
  ShieldNetworkIcon,
  SparklesSlashIcon,
} from '@/ui/components/icons';

const NEEDS_ALL_URLS = 'global.stripFbclid';

function getFeatureIcon(key: string) {
  switch (key) {
    case 'facebook.hideSponsoredPosts':
    case 'instagram.hideSponsoredPosts':
      return <AdBlockIcon size={15} class="text-amber-500" />;
    case 'facebook.hideSuggestedPosts':
    case 'instagram.hideSuggestedPosts':
      return <SparklesSlashIcon size={15} class="text-blue-500" />;
    case 'facebook.hideReels':
    case 'instagram.hideReels':
      return <FilmSlashIcon size={15} class="text-purple-500" />;
    case 'facebook.blockFeedAutoRefresh':
      return <PauseReloadIcon size={15} class="text-emerald-500" />;
    case 'facebook.scrambleDwellTime':
    case 'instagram.scrambleDwellTime':
      return <ClockStopIcon size={15} class="text-sky-500" />;
    case 'facebook.bypassLinkShim':
    case 'instagram.bypassLinkShim':
      return <LinkSlashIcon size={15} class="text-amber-500" />;
    case 'facebook.hideReadReceipts':
    case 'instagram.hideReadReceipts':
      return <EyeOffIcon size={15} class="text-indigo-500" />;
    case 'facebook.hideTyping':
    case 'instagram.hideTyping':
      return <ChatDotsIcon size={15} class="text-cyan-500" />;
    case 'facebook.hideOnlineStatus':
    case 'instagram.hideOnlineStatus':
      return <IncognitoIcon size={15} class="text-teal-500" />;
    case 'facebook.protectWebRtcIp':
    case 'instagram.protectWebRtcIp':
      return <ShieldNetworkIcon size={15} class="text-emerald-500" />;
    case 'facebook.hideVoicePlayed':
      return <MicOffIcon size={15} class="text-violet-500" />;
    case 'facebook.hideStoryViews':
    case 'instagram.hideStoryViews':
      return <GhostIcon size={15} class="text-pink-500" />;
    case 'facebook.hideInboxLastSeen':
      return <LockCheckIcon size={15} class="text-teal-500" />;
    case 'facebook.stealthSearch':
    case 'instagram.stealthSearch':
      return <SearchSlashIcon size={15} class="text-cyan-500" />;
    case 'global.blockMetaPixel':
      return <RadarIcon size={15} class="text-rose-500" />;
    case 'global.stripFbclid':
      return <LinkSlashIcon size={15} class="text-amber-500" />;
    default:
      return null;
  }
}

type PlatformTab = 'facebook' | 'instagram' | 'global';
type SubCategory = 'all' | 'privacy' | 'feed';

export function Popup() {
  const [activeSite, setActiveSite] = useState<SiteModule | null>(null);
  const [platformTab, setPlatformTab] = useState<PlatformTab>('facebook');
  const [fbSubTab, setFbSubTab] = useState<SubCategory>('all');
  const [igSubTab, setIgSubTab] = useState<SubCategory>('all');

  useEffect(() => {
    void initSettingsStore();
    return () => stopSettingsStore();
  }, []);

  useEffect(() => {
    void getActiveSite().then((resolved) => {
      setActiveSite(resolved);
      if (resolved?.id === 'instagram') {
        setPlatformTab('instagram');
      } else if (resolved?.id === 'facebook') {
        setPlatformTab('facebook');
      }
    });
  }, []);

  const current = settings.value;
  const master = current.masterEnabled;
  const activeLocale = resolveLocale(current.locale);
  const dict = getDictionary(activeLocale);

  useEffect(() => {
    const root = document.documentElement;
    if (current.theme === 'system') {
      delete root.dataset.theme;
    } else {
      root.dataset.theme = current.theme;
    }
  }, [current.theme]);

  async function handleFeatureChange(key: string, next: boolean): Promise<void> {
    if (key === NEEDS_ALL_URLS && next) {
      const granted = await ensureAllUrlsPermission();
      if (!granted) {
        return;
      }
    }
    await setFeature(key, next);
  }

  async function applyQuickStealth(platform: 'facebook' | 'instagram'): Promise<void> {
    const keys = [
      `${platform}.hideReadReceipts`,
      `${platform}.hideTyping`,
      `${platform}.hideOnlineStatus`,
      `${platform}.hideStoryViews`,
    ];
    for (const k of keys) {
      await setFeature(k, true);
    }
  }

  async function applyQuickCleanFeed(platform: 'facebook' | 'instagram'): Promise<void> {
    const keys = [
      `${platform}.hideSponsoredPosts`,
      `${platform}.hideSuggestedPosts`,
      `${platform}.hideReels`,
    ];
    if (platform === 'facebook') {
      keys.push('facebook.blockFeedAutoRefresh');
    }
    for (const k of keys) {
      await setFeature(k, true);
    }
  }

  function renderFeature(scope: string, feature: Feature) {
    const key = featureKey(scope, feature.id);
    const planned = feature.status === 'planned';
    const translation = getFeatureTranslation(key, activeLocale);

    let label = feature.label;
    let description = feature.description;
    if (translation) {
      label = translation.label;
      description = translation.description;
    }

    let badgeText: string | undefined = undefined;
    if (planned) {
      badgeText = dict.common.soon;
    }

    return (
      <Toggle
        key={key}
        label={label}
        description={description}
        badge={badgeText}
        icon={getFeatureIcon(key)}
        checked={current.features[key] ?? feature.defaultEnabled}
        disabled={!master || planned}
        onChange={(next) => void handleFeatureChange(key, next)}
      />
    );
  }

  const fbModule = activeSite?.id === 'facebook' ? activeSite : facebook;
  const igModule = activeSite?.id === 'instagram' ? activeSite : instagram;

  // Count active features per platform
  const fbPrivacyFeatures = fbModule.features.filter((f) => f.category === 'privacy');
  const fbFeedFeatures = fbModule.features.filter((f) => f.category === 'feed');
  const fbActiveCount = fbModule.features.filter(
    (f) => current.features[featureKey(fbModule.id, f.id)] ?? f.defaultEnabled,
  ).length;

  const igPrivacyFeatures = igModule.features.filter((f) => f.category === 'privacy');
  const igFeedFeatures = igModule.features.filter((f) => f.category === 'feed');
  const igActiveCount = igModule.features.filter(
    (f) => current.features[featureKey(igModule.id, f.id)] ?? f.defaultEnabled,
  ).length;

  const globalActiveCount = GLOBAL_FEATURES.filter(
    (f) => current.features[featureKey('global', f.id)] ?? f.defaultEnabled,
  ).length;

  const totalActive = fbActiveCount + igActiveCount + globalActiveCount;

  let enBtnClass = 'px-2 py-0.5 rounded-md text-[10.5px] font-medium text-text-muted hover:text-text cursor-pointer transition-colors';
  if (activeLocale === 'en') {
    enBtnClass = 'px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-surface-card text-text shadow-xs cursor-default';
  }

  let viBtnClass = 'px-2 py-0.5 rounded-md text-[10.5px] font-medium text-text-muted hover:text-text cursor-pointer transition-colors';
  if (activeLocale === 'vi') {
    viBtnClass = 'px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-surface-card text-text shadow-xs cursor-default';
  }

  let statusText = dict.app.protectionPaused;
  let statusColorClass = 'bg-amber-500';
  if (master) {
    statusText = dict.app.protectionOn;
    statusColorClass = 'bg-emerald-500';
  }

  const isFbActiveSite = activeSite?.id === 'facebook';
  const isIgActiveSite = activeSite?.id === 'instagram';

  return (
    <main class="w-[660px] h-[560px] bg-surface text-text font-sans select-none flex overflow-hidden rounded-2xl border border-border shadow-2xl">
      {/* SIDEBAR NAVIGATION */}
      <aside class="w-[220px] shrink-0 border-r border-border bg-surface-card flex flex-col justify-between p-3.5 z-10 select-none">
        <div class="flex flex-col min-h-0">
          {/* Brand Header */}
          <div class="flex items-center gap-2.5 px-1 py-0.5">
            <div class="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg shadow-xs overflow-hidden">
              <BrandLogo size={32} class="shrink-0" />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <h1 class="text-[13.5px] font-extrabold tracking-tight text-text leading-tight truncate">
                  {dict.app.name}
                </h1>
              </div>
              <p class="text-[9.5px] text-text-muted leading-tight mt-0.5 truncate">
                {dict.app.socialAssistant}
              </p>
            </div>
          </div>

          {/* Master Switch & Status Card */}
          <div
            class={`mt-3 p-3 rounded-xl border transition-all duration-150 ${
              master
                ? 'bg-emerald-500/10 border-emerald-500/25'
                : 'bg-amber-500/10 border-amber-500/25'
            }`}
          >
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0 flex-1">
                <span class={`h-2.5 w-2.5 shrink-0 rounded-full ${statusColorClass} ${master ? 'animate-pulse' : ''}`} />
                <span class="text-[12px] font-bold leading-tight text-text whitespace-nowrap">
                  {statusText}
                </span>
              </div>

              {/* Master Switch */}
              <div class="shrink-0">
                <input
                  id="master-switch"
                  type="checkbox"
                  role="switch"
                  class="peer sr-only"
                  checked={master}
                  onChange={(e) => void setMasterEnabled(e.currentTarget.checked)}
                />
                <label
                  for="master-switch"
                  class="relative block h-5 w-9 rounded-full bg-border cursor-pointer transition-colors duration-150 peer-checked:bg-accent after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform after:duration-150 after:content-[''] peer-checked:after:translate-x-4"
                />
              </div>
            </div>

            {master && (
              <div class="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between text-[10px]">
                <span class="text-text-muted">{activeLocale === 'vi' ? 'Đang kích hoạt' : 'Active'}</span>
                <span class="font-bold text-accent">
                  {totalActive} {activeLocale === 'vi' ? 'tính năng' : 'features'}
                </span>
              </div>
            )}
          </div>

          {/* Platform Navigation */}
          <div class="mt-4 flex-1">
            <div class="px-2 mb-1.5 text-[9.5px] font-bold tracking-wider text-text-muted/80 uppercase">
              {dict.app.protection}
            </div>
            <nav class="space-y-1">
              {/* Facebook Button */}
              <button
                type="button"
                onClick={() => setPlatformTab('facebook')}
                class={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[12px] font-semibold transition-all cursor-pointer ${
                  platformTab === 'facebook'
                    ? 'bg-accent/10 text-accent font-bold shadow-2xs border border-accent/20'
                    : 'text-text-muted hover:text-text hover:bg-surface-muted border border-transparent'
                }`}
              >
                <div class="flex items-center gap-2 min-w-0">
                  <FacebookIcon size={16} class={platformTab === 'facebook' ? 'text-accent' : 'text-blue-500'} />
                  <span class="truncate">{dict.tabs.facebook}</span>
                  {isFbActiveSite && (
                    <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" title={dict.dashboard.activeNow} />
                  )}
                </div>
                <span
                  class={`text-[9.5px] px-1.5 py-0.2 rounded-full font-bold shrink-0 ${
                    platformTab === 'facebook'
                      ? 'bg-accent/15 text-accent'
                      : 'bg-surface-muted text-text-muted'
                  }`}
                >
                  {fbActiveCount}
                </span>
              </button>

              {/* Instagram Button */}
              <button
                type="button"
                onClick={() => setPlatformTab('instagram')}
                class={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[12px] font-semibold transition-all cursor-pointer ${
                  platformTab === 'instagram'
                    ? 'bg-accent/10 text-accent font-bold shadow-2xs border border-accent/20'
                    : 'text-text-muted hover:text-text hover:bg-surface-muted border border-transparent'
                }`}
              >
                <div class="flex items-center gap-2 min-w-0">
                  <InstagramIcon size={16} class={platformTab === 'instagram' ? 'text-accent' : 'text-pink-500'} />
                  <span class="truncate">{dict.tabs.instagram}</span>
                  {isIgActiveSite && (
                    <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" title={dict.dashboard.activeNow} />
                  )}
                </div>
                <span
                  class={`text-[9.5px] px-1.5 py-0.2 rounded-full font-bold shrink-0 ${
                    platformTab === 'instagram'
                      ? 'bg-accent/15 text-accent'
                      : 'bg-surface-muted text-text-muted'
                  }`}
                >
                  {igActiveCount}
                </span>
              </button>

              {/* Global Button */}
              <button
                type="button"
                aria-label="Global"
                onClick={() => setPlatformTab('global')}
                class={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[12px] font-semibold transition-all cursor-pointer ${
                  platformTab === 'global'
                    ? 'bg-accent/10 text-accent font-bold shadow-2xs border border-accent/20'
                    : 'text-text-muted hover:text-text hover:bg-surface-muted border border-transparent'
                }`}
              >
                <div class="flex items-center gap-2 min-w-0">
                  <GlobeIcon size={16} class={platformTab === 'global' ? 'text-accent' : 'text-emerald-500'} />
                  <span class="truncate">{dict.tabs.global}</span>
                </div>
                <span
                  class={`text-[9.5px] px-1.5 py-0.2 rounded-full font-bold shrink-0 ${
                    platformTab === 'global'
                      ? 'bg-accent/15 text-accent'
                      : 'bg-surface-muted text-text-muted'
                  }`}
                >
                  {globalActiveCount}
                </span>
              </button>
            </nav>
          </div>
        </div>

        {/* Sidebar Footer: Theme, Language Switcher & Disclaimer */}
        <div class="pt-3 border-t border-border/60 flex flex-col gap-2">
          {/* Theme Switcher */}
          <div class="flex items-center justify-between">
            <span class="text-[10px] text-text-muted font-medium">Theme</span>
            <div class="flex items-center rounded-lg border border-border/80 bg-surface-muted p-0.5 text-[9.5px]">
              <button
                type="button"
                class={current.theme === 'light' ? 'px-1.5 py-0.5 rounded-md text-[9.5px] font-bold bg-surface-card text-text shadow-xs cursor-default' : 'px-1.5 py-0.5 rounded-md text-[9.5px] font-medium text-text-muted hover:text-text cursor-pointer transition-colors'}
                onClick={() => void setTheme('light')}
                title="Light"
              >
                Light
              </button>
              <button
                type="button"
                class={current.theme === 'dark' ? 'px-1.5 py-0.5 rounded-md text-[9.5px] font-bold bg-surface-card text-text shadow-xs cursor-default' : 'px-1.5 py-0.5 rounded-md text-[9.5px] font-medium text-text-muted hover:text-text cursor-pointer transition-colors'}
                onClick={() => void setTheme('dark')}
                title="Dark"
              >
                Dark
              </button>
              <button
                type="button"
                class={current.theme === 'system' ? 'px-1.5 py-0.5 rounded-md text-[9.5px] font-bold bg-surface-card text-text shadow-xs cursor-default' : 'px-1.5 py-0.5 rounded-md text-[9.5px] font-medium text-text-muted hover:text-text cursor-pointer transition-colors'}
                onClick={() => void setTheme('system')}
                title="Auto (System)"
              >
                Auto
              </button>
            </div>
          </div>

          <div class="flex items-center justify-between">
            <span class="text-[10px] text-text-muted font-medium">Language</span>
            <div class="flex items-center rounded-lg border border-border/80 bg-surface-muted p-0.5 text-[9.5px]">
              <button
                type="button"
                class={enBtnClass}
                onClick={() => void setLocale('en')}
                title="English"
              >
                EN
              </button>
              <button
                type="button"
                class={viBtnClass}
                onClick={() => void setLocale('vi')}
                title="Tiếng Việt"
              >
                VI
              </button>
            </div>
          </div>
          <div class="text-[9px] text-text-muted/70 leading-tight">
            Zero telemetry • 100% local
          </div>
        </div>
      </aside>

      {/* MAIN DASHBOARD CONTENT */}
      <section class="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-surface">
        {/* Top Header Bar */}
        <header class="px-5 py-3 border-b border-border/80 bg-surface-card/60 backdrop-blur-xs shrink-0 flex flex-col gap-1.5">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2 min-w-0">
              <h2 class="text-[14.5px] font-bold text-text truncate">
                {platformTab === 'facebook' && dict.site.facebook}
                {platformTab === 'instagram' && dict.site.instagram}
                {platformTab === 'global' && dict.section.allWebsites}
              </h2>
              {platformTab === 'facebook' && isFbActiveSite && (
                <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {dict.dashboard.activeNow}
                </span>
              )}
              {platformTab === 'instagram' && isIgActiveSite && (
                <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {dict.dashboard.activeNow}
                </span>
              )}
            </div>

            {/* Subcategory Filter Tabs (Facebook & Instagram) */}
            {platformTab === 'facebook' && (
              <div class="flex items-center gap-1 p-0.5 rounded-lg bg-surface-muted/90 border border-border/60 text-[10px] shrink-0">
                <button
                  type="button"
                  onClick={() => setFbSubTab('all')}
                  class={`px-2 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    fbSubTab === 'all'
                      ? 'bg-surface-card text-accent shadow-2xs'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  {dict.tabs.all}
                </button>
                <button
                  type="button"
                  onClick={() => setFbSubTab('privacy')}
                  class={`px-2 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    fbSubTab === 'privacy'
                      ? 'bg-surface-card text-accent shadow-2xs'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  {dict.tabs.privacy} ({fbPrivacyFeatures.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFbSubTab('feed')}
                  class={`px-2 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    fbSubTab === 'feed'
                      ? 'bg-surface-card text-accent shadow-2xs'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  {dict.tabs.feed} ({fbFeedFeatures.length})
                </button>
              </div>
            )}

            {platformTab === 'instagram' && (
              <div class="flex items-center gap-1 p-0.5 rounded-lg bg-surface-muted/90 border border-border/60 text-[10px] shrink-0">
                <button
                  type="button"
                  onClick={() => setIgSubTab('all')}
                  class={`px-2 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    igSubTab === 'all'
                      ? 'bg-surface-card text-accent shadow-2xs'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  {dict.tabs.all}
                </button>
                <button
                  type="button"
                  onClick={() => setIgSubTab('privacy')}
                  class={`px-2 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    igSubTab === 'privacy'
                      ? 'bg-surface-card text-accent shadow-2xs'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  {dict.tabs.privacy} ({igPrivacyFeatures.length})
                </button>
                <button
                  type="button"
                  onClick={() => setIgSubTab('feed')}
                  class={`px-2 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    igSubTab === 'feed'
                      ? 'bg-surface-card text-accent shadow-2xs'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  {dict.tabs.feed} ({igFeedFeatures.length})
                </button>
              </div>
            )}
          </div>

          <p class="text-[11px] text-text-muted leading-snug">
            {platformTab === 'facebook' && dict.dashboard.platformSubtitle(dict.site.facebook)}
            {platformTab === 'instagram' && dict.dashboard.platformSubtitle(dict.site.instagram)}
            {platformTab === 'global' && dict.dashboard.globalDescription}
          </p>
        </header>

        {/* Main Scrollable Panel */}
        <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* FACEBOOK PANEL */}
          {platformTab === 'facebook' && (
            <div class="space-y-4">
              {/* 1-Tap Quick Action Presets */}
              {master && (
                <div class="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => void applyQuickStealth('facebook')}
                    class="flex items-center gap-2.5 p-2.5 rounded-xl border border-border bg-surface-card hover:bg-accent/5 hover:border-accent/30 transition-all text-left shadow-2xs cursor-pointer group"
                    title={dict.quickPresets.stealthTooltip}
                  >
                    <div class="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <EyeOffIcon size={15} />
                    </div>
                    <div class="min-w-0">
                      <div class="text-[11.5px] font-bold text-text leading-tight truncate">
                        {dict.quickPresets.stealthTitle}
                      </div>
                      <div class="text-[9.5px] text-text-muted leading-tight truncate mt-0.5">
                        {dict.quickPresets.stealthSubtitle}
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => void applyQuickCleanFeed('facebook')}
                    class="flex items-center gap-2.5 p-2.5 rounded-xl border border-border bg-surface-card hover:bg-accent/5 hover:border-accent/30 transition-all text-left shadow-2xs cursor-pointer group"
                    title={dict.quickPresets.cleanTooltip}
                  >
                    <div class="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <AdBlockIcon size={15} />
                    </div>
                    <div class="min-w-0">
                      <div class="text-[11.5px] font-bold text-text leading-tight truncate">
                        {dict.quickPresets.cleanTitle}
                      </div>
                      <div class="text-[9.5px] text-text-muted leading-tight truncate mt-0.5">
                        {dict.quickPresets.cleanSubtitle}
                      </div>
                    </div>
                  </button>
                </div>
              )}

              {/* Privacy Section */}
              {(fbSubTab === 'all' || fbSubTab === 'privacy') && fbPrivacyFeatures.length > 0 && (
                <div>
                  <div class="px-1 pb-1.5 flex items-center justify-between text-text-muted">
                    <span class="text-[10px] font-bold tracking-wider uppercase text-text/80">
                      {dict.section.privacy}
                    </span>
                    <span class="text-[9.5px] font-medium text-text-muted">
                      {fbPrivacyFeatures.filter((f) => current.features[featureKey(facebook.id, f.id)] ?? f.defaultEnabled).length}/{fbPrivacyFeatures.length} {dict.common.activeCount}
                    </span>
                  </div>
                  <div class="rounded-xl border border-border bg-surface-card divide-y divide-border/60 overflow-hidden shadow-2xs">
                    {fbPrivacyFeatures.map((feature) => renderFeature(facebook.id, feature))}
                  </div>
                  <div class="mt-2 px-3 py-1.5 rounded-xl bg-accent/5 border border-accent/20 text-[10px] text-text-muted flex items-center gap-2">
                    <LockCheckIcon size={13} class="text-accent shrink-0" />
                    <span class="leading-tight">
                      {dict.app.e2eeNotice}
                    </span>
                  </div>
                </div>
              )}

              {/* Feed Section */}
              {(fbSubTab === 'all' || fbSubTab === 'feed') && fbFeedFeatures.length > 0 && (
                <div>
                  <div class="px-1 pb-1.5 flex items-center justify-between text-text-muted">
                    <span class="text-[10px] font-bold tracking-wider uppercase text-text/80">
                      {dict.section.feed}
                    </span>
                    <span class="text-[9.5px] font-medium text-text-muted">
                      {fbFeedFeatures.filter((f) => current.features[featureKey(facebook.id, f.id)] ?? f.defaultEnabled).length}/{fbFeedFeatures.length} {dict.common.activeCount}
                    </span>
                  </div>
                  <div class="rounded-xl border border-border bg-surface-card divide-y divide-border/60 overflow-hidden shadow-2xs">
                    {fbFeedFeatures.map((feature) => renderFeature(facebook.id, feature))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* INSTAGRAM PANEL */}
          {platformTab === 'instagram' && (
            <div class="space-y-4">
              {/* 1-Tap Quick Action Presets for Instagram */}
              {master && (
                <div class="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => void applyQuickStealth('instagram')}
                    class="flex items-center gap-2.5 p-2.5 rounded-xl border border-border bg-surface-card hover:bg-accent/5 hover:border-accent/30 transition-all text-left shadow-2xs cursor-pointer group"
                    title={dict.quickPresets.stealthTooltip}
                  >
                    <div class="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <EyeOffIcon size={15} />
                    </div>
                    <div class="min-w-0">
                      <div class="text-[11.5px] font-bold text-text leading-tight truncate">
                        {dict.quickPresets.stealthTitle}
                      </div>
                      <div class="text-[9.5px] text-text-muted leading-tight truncate mt-0.5">
                        {dict.quickPresets.stealthSubtitle}
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => void applyQuickCleanFeed('instagram')}
                    class="flex items-center gap-2.5 p-2.5 rounded-xl border border-border bg-surface-card hover:bg-accent/5 hover:border-accent/30 transition-all text-left shadow-2xs cursor-pointer group"
                    title={dict.quickPresets.cleanTooltip}
                  >
                    <div class="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <AdBlockIcon size={15} />
                    </div>
                    <div class="min-w-0">
                      <div class="text-[11.5px] font-bold text-text leading-tight truncate">
                        {dict.quickPresets.cleanTitle}
                      </div>
                      <div class="text-[9.5px] text-text-muted leading-tight truncate mt-0.5">
                        {dict.quickPresets.cleanSubtitle}
                      </div>
                    </div>
                  </button>
                </div>
              )}

              {/* Instagram Privacy Section */}
              {(igSubTab === 'all' || igSubTab === 'privacy') && igPrivacyFeatures.length > 0 && (
                <div>
                  <div class="px-1 pb-1.5 flex items-center justify-between text-text-muted">
                    <span class="text-[10px] font-bold tracking-wider uppercase text-text/80">
                      {dict.section.privacy}
                    </span>
                    <span class="text-[9.5px] font-medium text-text-muted">
                      {igPrivacyFeatures.filter((f) => current.features[featureKey(instagram.id, f.id)] ?? f.defaultEnabled).length}/{igPrivacyFeatures.length} {dict.common.activeCount}
                    </span>
                  </div>
                  <div class="rounded-xl border border-border bg-surface-card divide-y divide-border/60 overflow-hidden shadow-2xs">
                    {igPrivacyFeatures.map((feature) => renderFeature(instagram.id, feature))}
                  </div>
                </div>
              )}

              {/* Instagram Feed Section */}
              {(igSubTab === 'all' || igSubTab === 'feed') && igFeedFeatures.length > 0 && (
                <div>
                  <div class="px-1 pb-1.5 flex items-center justify-between text-text-muted">
                    <span class="text-[10px] font-bold tracking-wider uppercase text-text/80">
                      {dict.section.feed}
                    </span>
                    <span class="text-[9.5px] font-medium text-text-muted">
                      {igFeedFeatures.filter((f) => current.features[featureKey(instagram.id, f.id)] ?? f.defaultEnabled).length}/{igFeedFeatures.length} {dict.common.activeCount}
                    </span>
                  </div>
                  <div class="rounded-xl border border-border bg-surface-card divide-y divide-border/60 overflow-hidden shadow-2xs">
                    {igFeedFeatures.map((feature) => renderFeature(instagram.id, feature))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* GLOBAL WEB PROTECTION PANEL */}
          {platformTab === 'global' && (
            <div class="space-y-4">
              {/* Info Card */}
              <div class="p-3.5 rounded-xl border border-border/80 bg-surface-card text-[11px] leading-relaxed text-text-muted shadow-2xs">
                <div class="flex items-center gap-2 mb-1.5 text-text font-bold">
                  <GlobeIcon size={16} class="text-accent" />
                  <span class="text-[12px]">{dict.section.allWebsites}</span>
                </div>
                <p>{dict.dashboard.globalDescription}</p>
              </div>

              {/* Global Features List */}
              <div>
                <div class="px-1 pb-1.5 flex items-center justify-between text-text-muted">
                  <span class="text-[10px] font-bold tracking-wider uppercase text-text/80">
                    {dict.section.allWebsites}
                  </span>
                  <span class="text-[9.5px] font-medium text-text-muted">
                    {globalActiveCount}/{GLOBAL_FEATURES.length} {dict.common.activeCount}
                  </span>
                </div>
                <div class="rounded-xl border border-border bg-surface-card divide-y divide-border/60 overflow-hidden shadow-2xs">
                  {GLOBAL_FEATURES.map((feature) => renderFeature('global', feature))}
                </div>
              </div>
            </div>
          )}

          {/* Footer Notice */}
          <footer class="pt-2 pb-1 text-center text-[10px] leading-tight text-text-muted">
            {dict.app.footerNotice}
          </footer>
        </div>
      </section>
    </main>
  );
}
