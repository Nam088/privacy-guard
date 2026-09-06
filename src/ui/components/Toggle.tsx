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
  let containerClass =
    'flex items-center gap-3 px-3.5 py-2.5 cursor-pointer hover:bg-surface-muted/60 transition-colors select-none';
  if (disabled) {
    containerClass = 'flex items-center gap-3 px-3.5 py-2.5 cursor-not-allowed opacity-45 select-none';
  }

  return (
    <label class={containerClass}>
      {icon && (
        <div class="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg bg-surface-muted border border-border/60 shadow-2xs">
          {icon}
        </div>
      )}

      <div class="min-w-0 flex-1 pr-1.5">
        <div class="flex items-center gap-1.5">
          <span class="text-[12.5px] font-semibold text-text leading-snug truncate">
            {label}
          </span>
          {badge && (
            <span class="shrink-0 rounded-md border border-border bg-surface-muted px-1.5 py-0.2 text-[9px] font-bold tracking-wide text-text-muted uppercase">
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p class="mt-0.5 text-[11px] leading-snug text-text-muted line-clamp-2">
            {description}
          </p>
        )}
      </div>

      <div class="shrink-0">
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
        <span class="relative block h-5 w-9 rounded-full bg-border transition-colors duration-150 peer-checked:bg-accent after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform after:duration-150 after:content-[''] peer-checked:after:translate-x-4" />
      </div>
    </label>
  );
}
