import type { ComponentChildren } from 'preact';

export interface SectionProps {
  title: string;
  badge?: string;
  children: ComponentChildren;
}

export function Section({ title, badge, children }: SectionProps) {
  return (
    <section class="mt-3 select-none">
      <div class="flex items-center justify-between px-1 pb-1.5">
        <h2 class="text-[11px] font-semibold tracking-wider text-text-muted uppercase">
          {title}
        </h2>
        {badge && (
          <span class="text-[11px] font-medium text-accent px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20">
            {badge}
          </span>
        )}
      </div>
      <div class="rounded-xl border border-border bg-surface-card divide-y divide-border-subtle overflow-hidden shadow-2xs">
        {children}
      </div>
    </section>
  );
}
