import { useEffect, useState } from 'preact/hooks';
import { getActiveSite } from '@/core/activeSite';
import { ensureAllUrlsPermission } from '@/core/permissions';
import {
  initSettingsStore,
  setFeature,
  setLocale,
  setMasterEnabled,
  settings,
  stopSettingsStore,
} from '@/core/settings/store';
import { getDictionary, getFeatureTranslation, resolveLocale } from '@/i18n';
import { featureKey, type Feature, type SiteModule } from '@/sites/types';
import { GLOBAL_FEATURES } from '@/trackers/features';
import { Section } from '@/ui/components/Section';
import { Toggle } from '@/ui/components/Toggle';
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
  BrandLogo,
  ShieldNetworkIcon,
  SparklesSlashIcon,
} from '@/ui/components/icons';

const NEEDS_ALL_URLS = 'global.stripFbclid';

function getFeatureIcon(key: string) {
  switch (key) {
    case 'facebook.hideSponsoredPosts':
      return <AdBlockIcon size={13} class="text-amber-500" />;
    case 'facebook.hideSuggestedPosts':
    case 'instagram.hideSuggestedPosts':
      return <SparklesSlashIcon size={13} class="text-blue-500" />;
    case 'facebook.hideReels':
    case 'instagram.hideReels':
      return <FilmSlashIcon size={13} class="text-purple-500" />;
    case 'facebook.blockFeedAutoRefresh':
      return <PauseReloadIcon size={13} class="text-emerald-500" />;
    case 'facebook.scrambleDwellTime':
      return <ClockStopIcon size={13} class="text-sky-500" />;
    case 'facebook.bypassLinkShim':
    case 'instagram.bypassLinkShim':
      return <LinkSlashIcon size={13} class="text-amber-500" />;
    case 'facebook.hideReadReceipts':
    case 'instagram.hideReadReceipts':
      return <EyeOffIcon size={13} class="text-indigo-500" />;
    case 'facebook.hideTyping':
    case 'instagram.hideTyping':
      return <ChatDotsIcon size={13} class="text-cyan-500" />;
    case 'facebook.hideOnlineStatus':
      return <IncognitoIcon size={13} class="text-teal-500" />;
    case 'facebook.protectWebRtcIp':
      return <ShieldNetworkIcon size={13} class="text-emerald-500" />;
    case 'facebook.hideVoicePlayed':
      return <MicOffIcon size={13} class="text-violet-500" />;
    case 'facebook.hideStoryViews':
    case 'instagram.hideStoryViews':
      return <GhostIcon size={13} class="text-pink-500" />;
    case 'facebook.hideInboxLastSeen':
      return <LockCheckIcon size={13} class="text-teal-500" />;
    case 'global.blockMetaPixel':
      return <RadarIcon size={13} class="text-rose-500" />;
    case 'global.stripFbclid':
      return <LinkSlashIcon size={13} class="text-amber-500" />;
    default:
      return null;
  }
}

export function Popup() {
  const [site, setSite] = useState<SiteModule | null>(null);
  const [siteResolved, setSiteResolved] = useState(false);
  const [activeTab, setActiveTab] = useState<'feed' | 'privacy' | 'global' | 'all'>('feed');

  useEffect(() => {
    void initSettingsStore();
    return () => stopSettingsStore();
  }, []);

  useEffect(() => {
    void getActiveSite().then((resolved) => {
      setSite(resolved);
      setSiteResolved(true);
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

  let enBtnClass = 'px-1.5 py-0.5 rounded text-[10px] font-medium text-text-muted hover:text-text';
  if (activeLocale === 'en') {
    enBtnClass = 'px-1.5 py-0.5 rounded text-[10px] font-bold bg-surface-card text-text shadow-xs';
  }

  let viBtnClass = 'px-1.5 py-0.5 rounded text-[10px] font-medium text-text-muted hover:text-text';
  if (activeLocale === 'vi') {
    viBtnClass = 'px-1.5 py-0.5 rounded text-[10px] font-bold bg-surface-card text-text shadow-xs';
  }

  let statusText = dict.app.protectionPaused;
  let statusColorClass = 'bg-amber-500';
  if (master) {
    statusText = dict.app.protectionOn;
    statusColorClass = 'bg-emerald-500';
  }

  let siteSectionTitle = '';
  if (site) {
    siteSectionTitle = site.displayName;
    if (site.id === 'facebook') {
      siteSectionTitle = dict.site.facebook;
    }
  }

  const feedFeatures = site ? site.features.filter((f) => f.category === 'feed') : [];
  const privacyFeatures = site ? site.features.filter((f) => f.category === 'privacy') : [];
  const otherFeatures = site
    ? site.features.filter((f) => f.category !== 'feed' && f.category !== 'privacy')
    : [];
  const hasCategories = feedFeatures.length > 0 && privacyFeatures.length > 0;

  const feedActiveCount = site
    ? feedFeatures.filter((f) => current.features[featureKey(site.id, f.id)] ?? f.defaultEnabled)
        .length
    : 0;
  const privacyActiveCount = site
    ? privacyFeatures.filter(
        (f) => current.features[featureKey(site.id, f.id)] ?? f.defaultEnabled,
      ).length
    : 0;
  const globalActiveCount = GLOBAL_FEATURES.filter(
    (f) => current.features[featureKey('global', f.id)] ?? f.defaultEnabled,
  ).length;

  return (
    <main class="w-[340px] bg-surface text-text pb-2 font-sans select-none overflow-x-hidden">
      {/* Header */}
      <header class="bg-surface-card border-b border-border px-3 py-2">
        {/* Top row: logo + name + lang switcher + master switch */}
        <div class="flex items-center gap-2">
          <BrandLogo size={20} class="text-accent shrink-0" />
          <h1 class="flex-1 min-w-0 text-[13px] font-bold tracking-tight text-text leading-tight truncate">
            {dict.app.name}
          </h1>

          {/* Language switcher */}
          <div class="shrink-0 flex items-center rounded-md border border-border bg-surface-muted p-0.5">
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

          {/* Master switch */}
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

        {/* Status row */}
        <div class="flex items-center gap-1.5 mt-1">
          <span class={`h-1.5 w-1.5 shrink-0 rounded-full ${statusColorClass}`} />
          <p class="text-[10.5px] font-medium text-text-muted">
            {statusText}
          </p>
        </div>
      </header>

      {/* Site Header Badge */}
      {site && (
        <div class="px-3 pt-2 pb-0.5 flex items-center justify-between">
          <h2 class="text-[10.5px] font-bold uppercase tracking-wider text-text-muted">
            {siteSectionTitle}
          </h2>
          <span class="text-[9.5px] font-medium text-text-muted px-1.5 py-0.2 rounded bg-surface-muted border border-border/50">
            {activeLocale === 'vi' ? 'Trang hiện tại' : 'Active site'}
          </span>
        </div>
      )}

      {/* Segmented Tab Navigation for categorized sites (e.g. Facebook) */}
      {site && hasCategories && (
        <div class="px-2.5 pt-1.5 pb-1">
          <div class="grid grid-cols-4 gap-1 p-0.5 rounded-lg bg-surface-muted border border-border/60 text-[10.5px]">
            <button
              type="button"
              onClick={() => setActiveTab('feed')}
              class={`flex items-center justify-center gap-1 py-1 px-1 rounded-md font-semibold transition-all ${
                activeTab === 'feed'
                  ? 'bg-surface-card text-accent shadow-xs'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              <span>{dict.tabs.feed}</span>
              <span class="text-[9px] px-1 rounded-full bg-accent/10 text-accent font-bold">
                {feedActiveCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('privacy')}
              class={`flex items-center justify-center gap-1 py-1 px-1 rounded-md font-semibold transition-all ${
                activeTab === 'privacy'
                  ? 'bg-surface-card text-accent shadow-xs'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              <span>{dict.tabs.privacy}</span>
              <span class="text-[9px] px-1 rounded-full bg-accent/10 text-accent font-bold">
                {privacyActiveCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('global')}
              class={`flex items-center justify-center gap-1 py-1 px-1 rounded-md font-semibold transition-all ${
                activeTab === 'global'
                  ? 'bg-surface-card text-accent shadow-xs'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              <span>{dict.tabs.global}</span>
              <span class="text-[9px] px-1 rounded-full bg-surface-muted text-text-muted font-bold">
                {globalActiveCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              class={`flex items-center justify-center py-1 px-1 rounded-md font-semibold transition-all ${
                activeTab === 'all'
                  ? 'bg-surface-card text-accent shadow-xs'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              <span>{dict.tabs.all}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content Panels */}
      <div>
        {site && hasCategories && (
          <div class="mt-1">
            {/* Feed Group */}
            <div class={activeTab === 'feed' || activeTab === 'all' ? 'block' : 'hidden'}>
              {feedFeatures.length > 0 && (
                <div class="px-2.5 pb-2">
                  <div class="px-1 pb-1 flex items-center justify-between text-text-muted">
                    <span class="text-[10px] font-bold tracking-wider uppercase text-text/80">
                      {dict.section.feed}
                    </span>
                    <span class="text-[9.5px] font-medium text-text-muted">
                      {feedActiveCount}/{feedFeatures.length} {dict.common.activeCount}
                    </span>
                  </div>
                  <div class="rounded-xl border border-border bg-surface-card divide-y divide-border/60 overflow-hidden shadow-2xs">
                    {feedFeatures.map((feature) => renderFeature(site.id, feature))}
                  </div>
                </div>
              )}
            </div>

            {/* Privacy Group */}
            <div class={activeTab === 'privacy' || activeTab === 'all' ? 'block' : 'hidden'}>
              {privacyFeatures.length > 0 && (
                <div class="px-2.5 pb-2">
                  <div class="px-1 pb-1 flex items-center justify-between text-text-muted">
                    <span class="text-[10px] font-bold tracking-wider uppercase text-text/80">
                      {dict.section.privacy}
                    </span>
                    <span class="text-[9.5px] font-medium text-text-muted">
                      {privacyActiveCount}/{privacyFeatures.length} {dict.common.activeCount}
                    </span>
                  </div>
                  <div class="rounded-xl border border-border bg-surface-card divide-y divide-border/60 overflow-hidden shadow-2xs">
                    {privacyFeatures.map((feature) => renderFeature(site.id, feature))}
                  </div>
                  <div class="mt-1.5 px-2.5 py-1.5 rounded-lg bg-accent/5 border border-accent/20 text-[10px] text-text-muted flex items-center gap-1.5">
                    <LockCheckIcon size={12} class="text-accent shrink-0" />
                    <span class="leading-tight">
                      {activeLocale === 'vi'
                        ? 'Đã trang bị lớp bảo vệ kép cho cả Messenger tiêu chuẩn & mã hóa E2EE (Armadillo).'
                        : 'Dual-layer protection active for both standard Messenger & E2EE chats (Armadillo).'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Other features (if any) */}
            {otherFeatures.length > 0 && (
              <div class={activeTab === 'all' ? 'block px-2.5 pb-2' : 'hidden'}>
                <div class="rounded-xl border border-border bg-surface-card divide-y divide-border/60 overflow-hidden shadow-2xs">
                  {otherFeatures.map((feature) => renderFeature(site.id, feature))}
                </div>
              </div>
            )}

            {/* Global Group (when on categorized site) */}
            <div class={activeTab === 'global' || activeTab === 'all' ? 'block px-2.5 pb-2' : 'hidden'}>
              <div class="px-1 pb-1 flex items-center justify-between text-text-muted">
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

        {/* Site without sub-categories (e.g. Instagram) */}
        {site && !hasCategories && (
          <div class="px-2.5 mt-1.5">
            <div class="rounded-xl border border-border bg-surface-card divide-y divide-border/60 overflow-hidden shadow-2xs">
              {site.features.map((feature) => renderFeature(site.id, feature))}
            </div>
            <div class="mt-2.5">
              <div class="px-1 pb-1">
                <span class="text-[10px] font-bold tracking-wider uppercase text-text/80">
                  {dict.section.allWebsites}
                </span>
              </div>
              <div class="rounded-xl border border-border bg-surface-card divide-y divide-border/60 overflow-hidden shadow-2xs">
                {GLOBAL_FEATURES.map((feature) => renderFeature('global', feature))}
              </div>
            </div>
          </div>
        )}

        {/* Unsupported Site */}
        {!site && (
          <div>
            {siteResolved && (
              <div class="mx-2.5 mt-2 rounded-xl border border-border bg-surface-card p-2.5 text-[11px] leading-snug text-text-muted">
                {dict.app.openSiteHint}
              </div>
            )}
            <Section title={dict.section.allWebsites}>
              {GLOBAL_FEATURES.map((feature) => renderFeature('global', feature))}
            </Section>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer class="mt-2 px-3 text-center text-[10px] leading-tight text-text-muted">
        {dict.app.footerNotice}
      </footer>
    </main>
  );
}

