import { useEffect, useState } from 'preact/hooks';
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
import { GlobeIcon } from '@/ui/components/icons';
import { MasterSwitchCard } from '@/ui/components/MasterSwitchCard';
import { NoticeBanner } from '@/ui/components/NoticeBanner';
import { PlatformNav, type PlatformTab } from '@/ui/components/PlatformNav';
import { QuickPresets } from '@/ui/components/QuickPresets';
import { SidebarFooter } from '@/ui/components/SidebarFooter';
import { Toggle } from '@/ui/components/Toggle';

const NEEDS_ALL_URLS = 'global.stripFbclid';

export interface PopupProps {
  initialSite?: SiteModule | null;
}

export function Popup({ initialSite }: PopupProps = {}) {
  const [activeSite, setActiveSite] = useState<SiteModule | null>(initialSite ?? null);
  const [platformTab, setPlatformTab] = useState<PlatformTab>(
    initialSite?.id === 'instagram' ? 'instagram' : 'facebook',
  );
  const [fbSubTab, setFbSubTab] = useState<SubCategory>('all');
  const [igSubTab, setIgSubTab] = useState<SubCategory>('all');

  useEffect(() => {
    void initSettingsStore();
    return () => stopSettingsStore();
  }, []);

  useEffect(() => {
    if (initialSite !== undefined) {
      return;
    }
    void getActiveSite().then((resolved) => {
      setActiveSite(resolved);
      if (resolved?.id === 'instagram') {
        setPlatformTab('instagram');
      } else if (resolved?.id === 'facebook') {
        setPlatformTab('facebook');
      }
    });
  }, [initialSite]);

  const current = settings.value;
  const master = current.masterEnabled;
  const activeLocale = resolveLocale(current.locale);
  const dict = getDictionary(activeLocale);

  useEffect(() => {
    applyTheme(current.theme);
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
  const statusText = master ? dict.app.protectionOn : dict.app.protectionPaused;
  const isFbActiveSite = activeSite?.id === 'facebook';
  const isIgActiveSite = activeSite?.id === 'instagram';
  const ready = isReady.value;

  return (
    <main
      class={`w-[685px] h-[570px] bg-surface text-text font-sans select-none flex overflow-hidden rounded-2xl border border-border shadow-xl relative ${
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
            onSelectTab={setPlatformTab}
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
          subTab={platformTab === 'facebook' ? fbSubTab : platformTab === 'instagram' ? igSubTab : undefined}
          onSubTabChange={platformTab === 'facebook' ? setFbSubTab : setIgSubTab}
          subTabLabels={{
            all: dict.tabs.all,
            privacy: dict.tabs.privacy,
            feed: dict.tabs.feed,
          }}
          privacyCount={platformTab === 'facebook' ? fbPrivacyFeatures.length : igPrivacyFeatures.length}
          feedCount={platformTab === 'facebook' ? fbFeedFeatures.length : igFeedFeatures.length}
        />

        {/* Scrollable Features Content */}
        <div class="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
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

          {/* Minimalist Footer Notice */}
          <footer class="pt-2 pb-1 text-center text-[11px] leading-tight text-text-muted/70">
            {dict.app.footerNotice}
          </footer>
        </div>
      </section>
    </main>
  );
}
