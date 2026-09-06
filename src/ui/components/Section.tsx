import type { ComponentChildren } from 'preact';

export interface SectionProps {
  title: string;
  badge?: string;
  children: ComponentChildren;
}

export function Section({ title, badge, children }: SectionProps) {
  return (
    <section class="mt-2.5">
      <div class="flex items-center justify-between px-3 pb-1">
        <h2 class="text-[10.5px] font-bold tracking-wider text-text-muted uppercase">
          {title}
        </h2>
        {badge && (
          <span class="text-[10px] font-semibold text-accent px-1.5 py-0.2 rounded bg-accent-subtle">
            {badge}
          </span>
        )}
      </div>
      <div class="mx-2.5 rounded-xl border border-border bg-surface-card divide-y divide-border/60 overflow-hidden shadow-2xs">
        {children}
      </div>
    </section>
  );
}
