import { useEffect, useMemo, useState } from 'preact/hooks';
import { getActiveSite } from '@/core/activeSite';
import { ensureAllUrlsPermission } from '@/core/permissions';
import { formatVersionBadge, getExtensionVersion } from '@/core/version';
import {
  applyTheme,
  initSettingsStore,
  isReady,
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
import { BrandHeader } from '@/ui/components/BrandHeader';
import { ContentHeader, type SubCategory } from '@/ui/components/ContentHeader';
import { FeatureSection } from '@/ui/components/FeatureSection';
import { getFeatureIcon } from '@/ui/components/featureIcon';
import { GlobeIcon, SearchSlashIcon } from '@/ui/components/icons';
import { MasterSwitchCard } from '@/ui/components/MasterSwitchCard';
import { NoticeBanner } from '@/ui/components/NoticeBanner';
import { PlatformNav, type PlatformTab } from '@/ui/components/PlatformNav';
import { QuickPresets } from '@/ui/components/QuickPresets';
import { SearchBar } from '@/ui/components/SearchBar';
import { SidebarFooter } from '@/ui/components/SidebarFooter';
import { Toggle } from '@/ui/components/Toggle';
import { useFeatureSearch } from '@/ui/search/useFeatureSearch';
import type { SearchResultItem } from '@/ui/search/featureSearch';

const NEEDS_ALL_URLS = 'global.stripFbclid';

export interface PopupProps {
  initialSite?: SiteModule | null;
}

export function Popup({ initialSite }: PopupProps = {}) {
  const [activeSite, setActiveSite] = useState<SiteModule | null>(initialSite ?? null);
  const [platformTab, setPlatformTab] = useState<PlatformTab>(() => {
    if (initialSite?.id === 'instagram') return 'instagram';
    if (initialSite?.id === 'facebook') return 'facebook';
    try {
      const cached = localStorage.getItem('pg_last_tab');
      if (cached === 'instagram' || cached === 'facebook' || cached === 'global') {
        return cached as PlatformTab;
      }
    } catch {
      // Ignore localStorage errors
    }
    return 'facebook';
  });
  const [fbSubTab, setFbSubTab] = useState<SubCategory>('all');
  const [igSubTab, setIgSubTab] = useState<SubCategory>('all');

  const handleSelectTab = (tab: PlatformTab) => {
    setPlatformTab(tab);
    try {
      localStorage.setItem('pg_last_tab', tab);
    } catch {
      // Ignore localStorage errors
    }
  };

  useEffect(() => {
    void initSettingsStore();
    return () => stopSettingsStore();
  }, []);

  useEffect(() => {
    if (initialSite !== undefined) {
      return;
    }
    void getActiveSite().then((resolved) => {
      if (resolved && (!activeSite || activeSite.id !== resolved.id)) {
        setActiveSite(resolved);
      }
      if (resolved?.id === 'instagram') {
        setPlatformTab((prev) => {
          if (prev !== 'instagram') {
            try {
              localStorage.setItem('pg_last_tab', 'instagram');
            } catch {
              // ignore storage errors
            }
            return 'instagram';
          }
          return prev;
        });
      } else if (resolved?.id === 'facebook') {
        setPlatformTab((prev) => {
          if (prev !== 'facebook') {
            try {
              localStorage.setItem('pg_last_tab', 'facebook');
            } catch {
              // ignore storage errors
            }
            return 'facebook';
          }
          return prev;
        });
      }
    });
  }, [initialSite]);

  const current = settings.value;
  const master = current.masterEnabled;
  const activeLocale = resolveLocale(current.locale);
  const dict = getDictionary(activeLocale);

  useEffect(() => {
    applyTheme(current.theme);
    try {
      localStorage.setItem('pg_theme', current.theme);
    } catch {
      // Ignore localStorage errors
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

  const fbPrivacyFeatures = useMemo(
    () => fbModule.features.filter((f) => f.category === 'privacy'),
    [fbModule],
  );
  const fbFeedFeatures = useMemo(
    () => fbModule.features.filter((f) => f.category === 'feed'),
    [fbModule],
  );
  const fbActiveCount = useMemo(
    () =>
      fbModule.features.filter(
        (f) => current.features[featureKey(fbModule.id, f.id)] ?? f.defaultEnabled,
      ).length,
    [fbModule, current.features],
  );

  const igPrivacyFeatures = useMemo(
    () => igModule.features.filter((f) => f.category === 'privacy'),
    [igModule],
  );
  const igFeedFeatures = useMemo(
    () => igModule.features.filter((f) => f.category === 'feed'),
    [igModule],
  );
  const igActiveCount = useMemo(
    () =>
      igModule.features.filter(
        (f) => current.features[featureKey(igModule.id, f.id)] ?? f.defaultEnabled,
      ).length,
    [igModule, current.features],
  );

  const globalActiveCount = useMemo(
    () =>
      GLOBAL_FEATURES.filter(
        (f) => current.features[featureKey('global', f.id)] ?? f.defaultEnabled,
      ).length,
    [current.features],
  );

  const totalActive = fbActiveCount + igActiveCount + globalActiveCount;
  const statusText = master ? dict.app.protectionOn : dict.app.protectionPaused;
  const isFbActiveSite = activeSite?.id === 'facebook';
  const isIgActiveSite = activeSite?.id === 'instagram';
  const ready = isReady.value;

  const search = useFeatureSearch(activeLocale);

  function renderSearchResults(results: SearchResultItem[]) {
    const fbResults = results.filter((r) => r.item.scope === 'facebook');
    const igResults = results.filter((r) => r.item.scope === 'instagram');
    const globalResults = results.filter((r) => r.item.scope === 'global');

    return (
      <div class="space-y-4">
        {fbResults.length > 0 && (
          <FeatureSection
            title={`${dict.site.facebook} (${fbResults.length})`}
            activeCount={
              fbResults.filter(
                (r) => current.features[r.item.key] ?? r.item.feature.defaultEnabled,
              ).length
            }
            totalCount={fbResults.length}
            activeCountLabel={dict.common.activeCount}
          >
            {fbResults.map((r) => renderFeature(r.item.scope, r.item.feature))}
          </FeatureSection>
        )}

        {igResults.length > 0 && (
          <FeatureSection
            title={`${dict.site.instagram} (${igResults.length})`}
            activeCount={
              igResults.filter(
                (r) => current.features[r.item.key] ?? r.item.feature.defaultEnabled,
              ).length
            }
            totalCount={igResults.length}
            activeCountLabel={dict.common.activeCount}
          >
            {igResults.map((r) => renderFeature(r.item.scope, r.item.feature))}
          </FeatureSection>
        )}

        {globalResults.length > 0 && (
          <FeatureSection
            title={`${dict.section.allWebsites} (${globalResults.length})`}
            activeCount={
              globalResults.filter(
                (r) => current.features[r.item.key] ?? r.item.feature.defaultEnabled,
              ).length
            }
            totalCount={globalResults.length}
            activeCountLabel={dict.common.activeCount}
          >
            {globalResults.map((r) => renderFeature(r.item.scope, r.item.feature))}
          </FeatureSection>
        )}
      </div>
    );
  }

  return (
    <main
      class={`w-[685px] h-[570px] bg-surface text-text font-sans select-none flex overflow-hidden relative ${
        !ready ? 'is-loading' : ''
      }`}
    >
      {/* SIDEBAR NAVIGATION */}
      <aside class="w-[235px] shrink-0 border-r border-border bg-surface-sidebar flex flex-col justify-between p-3.5 select-none relative">
        <div class="flex flex-col min-h-0 space-y-3">
          {/* Brand Header */}
          <BrandHeader
            title={dict.app.name}
            subtitle={dict.app.socialAssistant}
            version={formatVersionBadge(getExtensionVersion())}
          />

          {/* Master Switch Card */}
          <MasterSwitchCard
            master={master}
            statusText={statusText}
            totalActive={totalActive}
            activeLocale={activeLocale}
            onToggle={(next) => void setMasterEnabled(next)}
          />

          {/* Platform Navigation */}
          <PlatformNav
            currentTab={platformTab}
            onSelectTab={handleSelectTab}
            sectionTitle={dict.app.protection}
            tabs={{
              facebook: dict.tabs.facebook,
              instagram: dict.tabs.instagram,
              global: dict.tabs.global,
            }}
            counts={{
              facebook: fbActiveCount,
              instagram: igActiveCount,
              global: globalActiveCount,
            }}
            isFbActiveSite={isFbActiveSite}
            isIgActiveSite={isIgActiveSite}
            activeNowText={dict.dashboard.activeNow}
          />
        </div>

        {/* Sidebar Footer */}
        <SidebarFooter
          theme={current.theme}
          onThemeChange={(t) => void setTheme(t)}
          locale={activeLocale}
          onLocaleChange={(l) => void setLocale(l)}
          trustCaption={dict.app.trustCaption}
        />
      </aside>

      {/* MAIN CONTENT AREA */}
      <section
        class="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden bg-surface relative"
        onScroll={(e) => {
          if (e.currentTarget.scrollTop !== 0) e.currentTarget.scrollTop = 0;
          if (e.currentTarget.scrollLeft !== 0) e.currentTarget.scrollLeft = 0;
        }}
      >
        {/* Content Header Bar */}
        <ContentHeader
          title={
            platformTab === 'facebook'
              ? dict.site.facebook
              : platformTab === 'instagram'
              ? dict.site.instagram
              : dict.section.allWebsites
          }
          subtitle={
            platformTab === 'facebook'
              ? dict.dashboard.platformSubtitle(dict.site.facebook)
              : platformTab === 'instagram'
              ? dict.dashboard.platformSubtitle(dict.site.instagram)
              : dict.dashboard.globalDescription
          }
          isActiveSite={
            (platformTab === 'facebook' && isFbActiveSite) ||
            (platformTab === 'instagram' && isIgActiveSite)
          }
          activeNowText={dict.dashboard.activeNow}
          subTab={
            search.isSearching
              ? undefined
              : platformTab === 'facebook'
              ? fbSubTab
              : platformTab === 'instagram'
              ? igSubTab
              : undefined
          }
          onSubTabChange={platformTab === 'facebook' ? setFbSubTab : setIgSubTab}
          subTabLabels={{
            all: dict.tabs.all,
            privacy: dict.tabs.privacy,
            feed: dict.tabs.feed,
          }}
          privacyCount={platformTab === 'facebook' ? fbPrivacyFeatures.length : igPrivacyFeatures.length}
          feedCount={platformTab === 'facebook' ? fbFeedFeatures.length : igFeedFeatures.length}
        />

        {/* Search Bar Row */}
        <div class="px-5 pt-3 pb-0.5 shrink-0">
          <SearchBar
            value={search.inputValue}
            onChange={search.setInputValue}
            onClear={search.clearSearch}
            placeholder={dict.search.placeholder}
            shortcutHint="/"
            inputRef={search.inputRef}
          />
        </div>

        {/* Scrollable Features Content */}
        <div class="flex-1 min-h-0 overflow-y-auto px-5 py-3.5 space-y-4 overscroll-y-contain scroll-smooth">
          {search.isSearching ? (
            <div class="space-y-3.5">
              <div class="flex items-center justify-between px-1 text-xs text-text-muted">
                <span class="font-medium text-text/80">
                  {dict.search.resultsCount(search.results.length)}
                </span>
                <button
                  type="button"
                  onClick={search.clearSearch}
                  class="text-accent hover:underline cursor-pointer text-xs"
                >
                  {dict.search.clear}
                </button>
              </div>

              {search.results.length === 0 ? (
                <div class="flex flex-col items-center justify-center py-10 px-4 text-center rounded-2xl border border-dashed border-border bg-surface-card/40">
                  <div class="p-3 rounded-full bg-surface-muted text-text-muted mb-3">
                    <SearchSlashIcon size={24} />
                  </div>
                  <h3 class="text-sm font-semibold text-text mb-1">
                    {dict.search.noResultsTitle}
                  </h3>
                  <p class="text-xs text-text-muted max-w-[280px] leading-relaxed mb-4">
                    {dict.search.noResultsHint}
                  </p>
                  <button
                    type="button"
                    onClick={search.clearSearch}
                    class="px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-muted hover:bg-surface-muted/80 text-text border border-border/80 transition-colors cursor-pointer"
                  >
                    {dict.search.clear}
                  </button>
                </div>
              ) : (
                renderSearchResults(search.results)
              )}
            </div>
          ) : (
            <>
              {/* FACEBOOK TAB */}
              {platformTab === 'facebook' && (
                <div class="space-y-4">
                  {master && (
                    <QuickPresets
                      stealthTitle={dict.quickPresets.stealthTitle}
                      stealthSubtitle={dict.quickPresets.stealthSubtitle}
                      stealthTooltip={dict.quickPresets.stealthTooltip}
                      cleanTitle={dict.quickPresets.cleanTitle}
                      cleanSubtitle={dict.quickPresets.cleanSubtitle}
                      cleanTooltip={dict.quickPresets.cleanTooltip}
                      onApplyStealth={() => void applyQuickStealth('facebook')}
                      onApplyClean={() => void applyQuickCleanFeed('facebook')}
                    />
                  )}

                  {(fbSubTab === 'all' || fbSubTab === 'privacy') && fbPrivacyFeatures.length > 0 && (
                    <div class="space-y-2.5">
                      <FeatureSection
                        title={dict.section.privacy}
                        activeCount={
                          fbPrivacyFeatures.filter((f) => current.features[featureKey(facebook.id, f.id)] ?? f.defaultEnabled).length
                        }
                        totalCount={fbPrivacyFeatures.length}
                        activeCountLabel={dict.common.activeCount}
                      >
                        {fbPrivacyFeatures.map((feature) => renderFeature(facebook.id, feature))}
                      </FeatureSection>
                      <NoticeBanner>
                        {dict.app.e2eeNotice}
                      </NoticeBanner>
                    </div>
                  )}

                  {(fbSubTab === 'all' || fbSubTab === 'feed') && fbFeedFeatures.length > 0 && (
                    <FeatureSection
                      title={dict.section.feed}
                      activeCount={
                        fbFeedFeatures.filter((f) => current.features[featureKey(facebook.id, f.id)] ?? f.defaultEnabled).length
                      }
                      totalCount={fbFeedFeatures.length}
                      activeCountLabel={dict.common.activeCount}
                    >
                      {fbFeedFeatures.map((feature) => renderFeature(facebook.id, feature))}
                    </FeatureSection>
                  )}
                </div>
              )}

              {/* INSTAGRAM TAB */}
              {platformTab === 'instagram' && (
                <div class="space-y-4">
                  {master && (
                    <QuickPresets
                      stealthTitle={dict.quickPresets.stealthTitle}
                      stealthSubtitle={dict.quickPresets.stealthSubtitle}
                      stealthTooltip={dict.quickPresets.stealthTooltip}
                      cleanTitle={dict.quickPresets.cleanTitle}
                      cleanSubtitle={dict.quickPresets.cleanSubtitle}
                      cleanTooltip={dict.quickPresets.cleanTooltip}
                      onApplyStealth={() => void applyQuickStealth('instagram')}
                      onApplyClean={() => void applyQuickCleanFeed('instagram')}
                    />
                  )}

                  {(igSubTab === 'all' || igSubTab === 'privacy') && igPrivacyFeatures.length > 0 && (
                    <FeatureSection
                      title={dict.section.privacy}
                      activeCount={
                        igPrivacyFeatures.filter((f) => current.features[featureKey(instagram.id, f.id)] ?? f.defaultEnabled).length
                      }
                      totalCount={igPrivacyFeatures.length}
                      activeCountLabel={dict.common.activeCount}
                    >
                      {igPrivacyFeatures.map((feature) => renderFeature(instagram.id, feature))}
                    </FeatureSection>
                  )}

                  {(igSubTab === 'all' || igSubTab === 'feed') && igFeedFeatures.length > 0 && (
                    <FeatureSection
                      title={dict.section.feed}
                      activeCount={
                        igFeedFeatures.filter((f) => current.features[featureKey(instagram.id, f.id)] ?? f.defaultEnabled).length
                      }
                      totalCount={igFeedFeatures.length}
                      activeCountLabel={dict.common.activeCount}
                    >
                      {igFeedFeatures.map((feature) => renderFeature(instagram.id, feature))}
                    </FeatureSection>
                  )}
                </div>
              )}

              {/* GLOBAL TAB */}
              {platformTab === 'global' && (
                <div class="space-y-4">
                  <NoticeBanner
                    icon={<GlobeIcon size={16} class="text-accent shrink-0 mt-0.5" />}
                    title={dict.section.allWebsites}
                  >
                    {dict.dashboard.globalDescription}
                  </NoticeBanner>

                  <FeatureSection
                    title={dict.section.allWebsites}
                    activeCount={globalActiveCount}
                    totalCount={GLOBAL_FEATURES.length}
                    activeCountLabel={dict.common.activeCount}
                  >
                    {GLOBAL_FEATURES.map((feature) => renderFeature('global', feature))}
                  </FeatureSection>
                </div>
              )}
            </>
          )}

          {/* Minimalist Footer Notice */}
          <footer class="pt-2 pb-1 text-center text-[11px] leading-tight text-text-muted/70">
            {dict.app.footerNotice}
          </footer>
        </div>
      </section>
    </main>
  );
}
