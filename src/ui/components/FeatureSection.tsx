import type { ComponentChildren } from 'preact';

export interface FeatureSectionProps {
  title: string;
  activeCount?: number;
  totalCount?: number;
  activeCountLabel?: string;
  children: ComponentChildren;
}

export function FeatureSection({
  title,
  activeCount,
  totalCount,
  activeCountLabel = 'active',
  children,
}: FeatureSectionProps) {
  const showCount = activeCount !== undefined && totalCount !== undefined;

  return (
    <div class="space-y-1.5 select-none contain-[content]">
      <div class="px-1 flex items-center justify-between text-text-muted">
        <span class="text-[11px] font-semibold tracking-wider uppercase text-text/80">
          {title}
        </span>
        {showCount && (
          <span class="text-[11px] font-medium text-text-muted bg-surface-muted px-2 py-0.5 rounded-full border border-border/60">
            {activeCount}/{totalCount} {activeCountLabel}
          </span>
        )}
      </div>
      <div class="rounded-xl border border-border bg-surface-card divide-y divide-border-subtle overflow-hidden shadow-2xs">
        {children}
      </div>
    </div>
  );
}
