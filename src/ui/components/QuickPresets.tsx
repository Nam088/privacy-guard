import { AdBlockIcon, EyeOffIcon } from './icons';

export interface QuickPresetsProps {
  stealthTitle: string;
  stealthSubtitle: string;
  stealthTooltip: string;
  cleanTitle: string;
  cleanSubtitle: string;
  cleanTooltip: string;
  onApplyStealth: () => void;
  onApplyClean: () => void;
}

export function QuickPresets({
  stealthTitle,
  stealthSubtitle,
  stealthTooltip,
  cleanTitle,
  cleanSubtitle,
  cleanTooltip,
  onApplyStealth,
  onApplyClean,
}: QuickPresetsProps) {
  return (
    <div class="grid grid-cols-2 gap-2.5 select-none">
      <button
        type="button"
        onClick={onApplyStealth}
        class="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-surface-card hover:bg-surface-muted/60 hover:border-indigo-500/30 transition-all duration-150 text-left shadow-2xs cursor-pointer group active:scale-[0.99] outline-none focus:outline-none"
        title={stealthTooltip}
      >
        <div class="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300 ring-1 ring-indigo-500/20 flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105">
          <EyeOffIcon size={17} />
        </div>
        <div class="min-w-0">
          <div class="text-xs font-semibold text-text leading-tight truncate">
            {stealthTitle}
          </div>
          <div class="text-[11px] text-text-muted leading-tight truncate mt-0.5">
            {stealthSubtitle}
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={onApplyClean}
        class="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-surface-card hover:bg-surface-muted/60 hover:border-amber-500/30 transition-all duration-150 text-left shadow-2xs cursor-pointer group active:scale-[0.99] outline-none focus:outline-none"
        title={cleanTooltip}
      >
        <div class="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 ring-1 ring-amber-500/20 flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105">
          <AdBlockIcon size={17} />
        </div>
        <div class="min-w-0">
          <div class="text-xs font-semibold text-text leading-tight truncate">
            {cleanTitle}
          </div>
          <div class="text-[11px] text-text-muted leading-tight truncate mt-0.5">
            {cleanSubtitle}
          </div>
        </div>
      </button>
    </div>
  );
}
