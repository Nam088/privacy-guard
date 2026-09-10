import type { ComponentChildren } from 'preact';
import { LockCheckIcon } from './icons';

export interface NoticeBannerProps {
  icon?: ComponentChildren;
  title?: string;
  children: ComponentChildren;
}

export function NoticeBanner({
  icon = <LockCheckIcon size={14} class="text-accent shrink-0" />,
  title,
  children,
}: NoticeBannerProps) {
  return (
    <div class="px-3 py-2.5 rounded-xl bg-surface-muted/60 border border-border/80 text-xs text-text-muted flex items-start gap-2.5">
      {icon}
      <div class="min-w-0 flex-1">
        {title && (
          <div class="text-xs font-semibold text-text mb-0.5 leading-tight">
            {title}
          </div>
        )}
        <div class="text-[11px] leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
