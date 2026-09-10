import { SegmentedControl } from './SegmentedControl';

export type SubCategory = 'all' | 'privacy' | 'feed';

export interface ContentHeaderProps {
  title: string;
  subtitle: string;
  isActiveSite?: boolean;
  activeNowText?: string;
  subTab?: SubCategory;
  onSubTabChange?: (tab: SubCategory) => void;
  subTabLabels?: {
    all: string;
    privacy: string;
    feed: string;
  };
  privacyCount?: number;
  feedCount?: number;
}

export function ContentHeader({
  title,
  subtitle,
  isActiveSite = false,
  activeNowText = 'Active now',
  subTab,
  onSubTabChange,
  subTabLabels,
  privacyCount,
  feedCount,
}: ContentHeaderProps) {
  const showSubTabs = subTab !== undefined && onSubTabChange && subTabLabels;

  return (
    <header class="px-5 py-3.5 border-b border-border bg-surface-card shrink-0 flex flex-col gap-1.5 select-none">
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div class="flex items-center gap-2.5 min-w-0">
          <h2 class="text-base font-semibold text-text tracking-tight truncate">
            {title}
          </h2>
          {isActiveSite && (
            <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {activeNowText}
            </span>
          )}
        </div>

        {showSubTabs && (
          <SegmentedControl
            options={[
              { value: 'all' as const, label: subTabLabels.all },
              {
                value: 'privacy' as const,
                label: subTabLabels.privacy,
                count: privacyCount,
              },
              {
                value: 'feed' as const,
                label: subTabLabels.feed,
                count: feedCount,
              },
            ]}
            value={subTab}
            onChange={onSubTabChange}
            size="sm"
            ariaLabel="Subcategory filter"
          />
        )}
      </div>

      <p class="text-xs text-text-muted leading-relaxed">
        {subtitle}
      </p>
    </header>
  );
}
