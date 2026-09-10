import { LockCheckIcon, MonitorIcon, MoonIcon, SunIcon } from './icons';

export interface SidebarFooterProps {
  theme: 'light' | 'dark' | 'system';
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void;
  locale: string;
  onLocaleChange: (locale: 'en' | 'vi') => void;
}

export function SidebarFooter({
  theme,
  onThemeChange,
  locale,
  onLocaleChange,
}: SidebarFooterProps) {
  const isEn = locale === 'en';

  return (
    <div class="pt-3 pb-0.5 border-t border-border flex flex-col gap-2 select-none">
      {/* Combined Compact Controls: Theme (left) + Language (right) */}
      <div class="flex items-center justify-between gap-2 p-1 rounded-xl bg-surface-muted/80 border border-border/70 text-xs">
        {/* Theme icon-only segmented buttons */}
        <div
          role="group"
          aria-label="Theme switcher"
          class="flex items-center gap-0.5"
        >
          <button
            type="button"
            title="Light"
            aria-pressed={theme === 'light'}
            onClick={() => onThemeChange('light')}
            class={`flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-150 cursor-pointer outline-none focus:outline-none ${
              theme === 'light'
                ? 'bg-surface-card text-amber-500 shadow-xs'
                : 'text-text-muted hover:text-text hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'
            }`}
          >
            <SunIcon size={14} />
          </button>

          <button
            type="button"
            title="Dark"
            aria-pressed={theme === 'dark'}
            onClick={() => onThemeChange('dark')}
            class={`flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-150 cursor-pointer outline-none focus:outline-none ${
              theme === 'dark'
                ? 'bg-surface-card text-indigo-400 shadow-xs'
                : 'text-text-muted hover:text-text hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'
            }`}
          >
            <MoonIcon size={14} />
          </button>

          <button
            type="button"
            title="Auto"
            aria-pressed={theme === 'system'}
            onClick={() => onThemeChange('system')}
            class={`flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-150 cursor-pointer outline-none focus:outline-none ${
              theme === 'system'
                ? 'bg-surface-card text-blue-500 shadow-xs'
                : 'text-text-muted hover:text-text hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'
            }`}
          >
            <MonitorIcon size={14} />
          </button>
        </div>

        {/* Compact Language Switcher */}
        <div
          role="group"
          aria-label="Language switcher"
          class="flex items-center gap-0.5"
        >
          <button
            type="button"
            title="English"
            aria-pressed={isEn}
            onClick={() => onLocaleChange('en')}
            class={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all duration-150 cursor-pointer outline-none focus:outline-none ${
              isEn
                ? 'bg-surface-card text-text shadow-xs font-bold'
                : 'text-text-muted hover:text-text hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'
            }`}
          >
            EN
          </button>

          <button
            type="button"
            title="Tiếng Việt"
            aria-pressed={!isEn}
            onClick={() => onLocaleChange('vi')}
            class={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all duration-150 cursor-pointer outline-none focus:outline-none ${
              !isEn
                ? 'bg-surface-card text-text shadow-xs font-bold'
                : 'text-text-muted hover:text-text hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'
            }`}
          >
            VI
          </button>
        </div>
      </div>

      {/* Subtle Trust Caption */}
      <div class="flex items-center justify-center gap-1.5 pt-0.5 text-[10.5px] font-medium text-text-muted/75 tracking-tight whitespace-nowrap">
        <LockCheckIcon size={12.5} class="text-emerald-500/90 shrink-0" />
        <span>100% On-Device • Zero Telemetry</span>
      </div>
    </div>
  );
}
