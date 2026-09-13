export type SupportedLocale = 'en' | 'vi';
export type LocaleSetting = 'auto' | SupportedLocale;

export interface FeatureTranslation {
  readonly label: string;
  readonly description: string;
}

export interface TranslationDictionary {
  readonly app: {
    readonly name: string;
    readonly protectionOn: string;
    readonly protectionPaused: string;
    readonly protection: string;
    readonly openSiteHint: string;
    readonly footerNotice: string;
    readonly trustCaption: string;
    readonly socialAssistant: string;
    readonly webAssistant: string;
    readonly activeProtectionSummary: (siteName: string) => string;
    readonly standbySummary: string;
    readonly resumeHint: string;
    readonly e2eeNotice: string;
  };
  readonly quickPresets: {
    readonly stealthTitle: string;
    readonly stealthSubtitle: string;
    readonly stealthTooltip: string;
    readonly cleanTitle: string;
    readonly cleanSubtitle: string;
    readonly cleanTooltip: string;
  };
  readonly section: {
    readonly allWebsites: string;
    readonly feed: string;
    readonly privacy: string;
  };
  readonly tabs: {
    readonly feed: string;
    readonly privacy: string;
    readonly global: string;
    readonly all: string;
    readonly facebook: string;
    readonly instagram: string;
  };
  readonly dashboard: {
    readonly totalActiveFeatures: (count: number) => string;
    readonly activeNow: string;
    readonly platformSubtitle: (name: string) => string;
    readonly globalDescription: string;
  };
  readonly common: {
    readonly soon: string;
    readonly auto: string;
    readonly activeCount: string;
    readonly activeSite: string;
  };
  readonly site: {
    readonly facebook: string;
    readonly messenger: string;
    readonly instagram: string;
  };
  readonly search: {
    readonly placeholder: string;
    readonly noResultsTitle: string;
    readonly noResultsHint: string;
    readonly clear: string;
    readonly resultsCount: (count: number) => string;
    readonly allPlatforms: string;
    readonly shortcutHint: string;
  };
  readonly features: Record<string, FeatureTranslation>;
}

