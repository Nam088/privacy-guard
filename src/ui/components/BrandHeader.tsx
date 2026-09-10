import { BrandLogo } from './icons';

export interface BrandHeaderProps {
  title: string;
  subtitle: string;
  /** Formatted version badge, for example "v0.12.0". Hidden when empty. */
  version?: string;
}

export function BrandHeader({ title, subtitle, version }: BrandHeaderProps) {
  return (
    <div class="flex items-center gap-3 px-1 py-1 select-none">
      <div class="shrink-0 flex items-center justify-center w-8.5 h-8.5 rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 p-0.5 shadow-sm ring-1 ring-black/5 dark:ring-white/10 overflow-hidden">
        <BrandLogo size={34} class="shrink-0" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5 min-w-0">
          <h1 class="text-sm font-bold tracking-tight text-text leading-tight truncate">
            {title}
          </h1>
          {version && (
            <span class="text-[9px] font-bold text-accent dark:text-blue-400 bg-accent/10 px-1.5 py-0.2 rounded-full border border-accent/20 shrink-0">
              {version}
            </span>
          )}
        </div>
        <p class="text-[11px] text-text-muted leading-tight mt-0.5 truncate">
          {subtitle}
        </p>
      </div>
    </div>
  );
}
