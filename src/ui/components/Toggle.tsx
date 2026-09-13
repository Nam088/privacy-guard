import type { ComponentChildren } from 'preact';

export interface ToggleProps {
  label: string;
  description?: string;
  badge?: string;
  icon?: ComponentChildren;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}

export function Toggle({
  label,
  description,
  badge,
  icon,
  checked,
  disabled = false,
  onChange,
}: ToggleProps) {
  const containerClass = disabled
    ? 'group relative flex items-center gap-3.5 px-3.5 py-2.5 cursor-not-allowed opacity-40 select-none contain-[layout_style]'
    : 'group relative flex items-center gap-3.5 px-3.5 py-2.5 cursor-pointer hover:bg-surface-muted/50 active:bg-surface-muted/80 transition-colors duration-150 select-none contain-[layout_style]';

  return (
    <label class={containerClass}>
      {icon && (
        <div class="shrink-0 flex items-center justify-center">
          {icon}
        </div>
      )}

      <div class="min-w-0 flex-1 pr-1.5">
        <div class="flex items-center gap-1.5">
          <span class="text-[13px] font-semibold text-text leading-snug tracking-tight truncate">
            {label}
          </span>
          {badge && (
            <span class="shrink-0 rounded-full border border-border/70 bg-surface-muted px-1.5 py-0.2 text-[10px] font-medium tracking-wide text-text-muted uppercase">
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p class="mt-0.5 text-[11.5px] leading-relaxed text-text-muted line-clamp-2">
            {description}
          </p>
        )}
      </div>

      <div class="shrink-0 flex items-center relative">
        <input
          type="checkbox"
          role="switch"
          class="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(event) => {
            if (disabled) return;
            onChange(event.currentTarget.checked);
          }}
        />
        <span class="relative block h-5 w-9 rounded-full bg-slate-300 dark:bg-slate-700 transition-colors duration-200 peer-checked:bg-emerald-500 dark:peer-checked:bg-emerald-500 after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-xs after:transition-transform after:duration-200 after:ease-out after:will-change-transform after:translate-z-0 after:content-[''] peer-checked:after:translate-x-4 outline-none select-none" />
      </div>
    </label>
  );
}
