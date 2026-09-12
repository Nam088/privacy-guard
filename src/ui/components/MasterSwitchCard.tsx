import { ShieldIcon } from './icons';

export interface MasterSwitchCardProps {
  master: boolean;
  statusText: string;
  totalActive: number;
  activeLocale: string;
  onToggle: (next: boolean) => void;
}

export function MasterSwitchCard({
  master,
  statusText,
  totalActive,
  activeLocale,
  onToggle,
}: MasterSwitchCardProps) {
  return (
    <div
      class={`p-3 rounded-xl border transition-all duration-200 shadow-2xs ${
        master
          ? 'bg-gradient-to-br from-emerald-500/[0.08] to-emerald-600/[0.03] border-emerald-500/25 dark:from-emerald-950/30 dark:to-emerald-900/10 dark:border-emerald-500/30'
          : 'bg-gradient-to-br from-amber-500/[0.08] to-amber-600/[0.03] border-amber-500/25 dark:from-amber-950/30 dark:to-amber-900/10 dark:border-amber-500/30'
      }`}
    >
      <div class="flex items-center justify-between gap-2.5">
        <div class="flex items-center gap-2.5 min-w-0 flex-1">
          <span class="relative flex h-2.5 w-2.5 shrink-0">
            {master && (
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            )}
            <span
              class={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                master ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
          </span>
          <span class="text-xs font-bold leading-tight text-text whitespace-nowrap tracking-tight truncate">
            {statusText}
          </span>
        </div>

        {/* Master Switch */}
        <div class="shrink-0 flex items-center relative">
          <input
            id="master-switch"
            type="checkbox"
            role="switch"
            class="peer sr-only"
            checked={master}
            onChange={(e) => onToggle(e.currentTarget.checked)}
          />
          <label
            for="master-switch"
            class="relative block h-[22px] w-[38px] rounded-full bg-slate-300 dark:bg-slate-700 cursor-pointer transition-colors duration-200 peer-checked:bg-emerald-500 dark:peer-checked:bg-emerald-500 shadow-inner after:absolute after:top-[2px] after:left-[2px] after:h-[18px] after:w-[18px] after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:duration-200 after:content-[''] peer-checked:after:translate-x-4 outline-none select-none"
          />
        </div>
      </div>

      {master ? (
        <div class="mt-2.5 pt-2 border-t border-emerald-500/15 dark:border-emerald-500/20 flex items-center justify-between text-xs">
          <div class="flex items-center gap-1.5 min-w-0 text-text-muted font-medium">
            <ShieldIcon size={14} class="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span class="whitespace-nowrap">
              {activeLocale === 'vi' ? 'Đang chạy' : 'Active rules'}
            </span>
          </div>
          <span class="font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 dark:bg-emerald-500/25 px-2 py-0.5 rounded-full text-[11px] whitespace-nowrap shrink-0">
            {totalActive} {activeLocale === 'vi' ? 'tính năng' : 'features'}
          </span>
        </div>
      ) : (
        <div class="mt-2.5 pt-2 border-t border-amber-500/15 dark:border-amber-500/20 flex items-center justify-between text-xs text-amber-700 dark:text-amber-400 font-medium">
          <span class="whitespace-nowrap">
            {activeLocale === 'vi' ? 'Tạm dừng' : 'Shield standby'}
          </span>
          <span class="text-[11px] opacity-85 whitespace-nowrap shrink-0">
            {activeLocale === 'vi' ? 'Chạm để bật' : 'Tap to resume'}
          </span>
        </div>
      )}
    </div>
  );
}
