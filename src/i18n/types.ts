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
  };
  readonly common: {
    readonly soon: string;
    readonly auto: string;
    readonly activeCount: string;
  };
  readonly site: {
    readonly facebook: string;
    readonly messenger: string;
    readonly instagram: string;
  };
  readonly features: Record<string, FeatureTranslation>;
}
