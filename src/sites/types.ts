export const GLOBAL_SCOPE = 'global';

export type FeatureStatus = 'active' | 'planned';
export type FeatureCategory = 'feed' | 'privacy';

export interface Feature {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly defaultEnabled: boolean;
  readonly status: FeatureStatus;
  readonly category?: FeatureCategory;
}

export interface SiteModule {
  readonly id: string;
  readonly displayName: string;
  readonly matches: readonly string[];
  readonly hosts: readonly string[];
  readonly features: readonly Feature[];
}

export function featureKey(scope: string, id: string): string {
  return `${scope}.${id}`;
}
