import type { ComponentChildren } from 'preact';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  count?: number;
  icon?: ComponentChildren;
  title?: string;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  ariaLabel?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  ariaLabel,
}: SegmentedControlProps<T>) {
  const isSm = size === 'sm';

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      class={`inline-flex items-center rounded-lg bg-surface-muted p-0.5 border border-border/70 select-none ${
        isSm ? 'text-[11px]' : 'text-xs'
      }`}
    >
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            title={opt.title ?? opt.label}
            aria-pressed={isSelected}
            onClick={() => onChange(opt.value)}
            class={`relative flex items-center justify-center gap-1.5 rounded-md font-medium transition-[background-color,color,transform] duration-150 active:scale-[0.98] cursor-pointer outline-none focus:outline-none ${
              isSm ? 'px-2 py-0.5' : 'px-2.5 py-1'
            } ${
              isSelected
                ? 'bg-surface-card text-text shadow-xs font-bold ring-1 ring-border/60'
                : 'text-text-muted hover:text-text hover:bg-black/[0.025] dark:hover:bg-white/[0.035]'
            }`}
          >
            {opt.icon}
            <span>{opt.label}</span>
            {opt.count !== undefined && (
              <span
                class={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                  isSelected
                    ? 'bg-accent/10 text-accent font-semibold'
                    : 'bg-black/[0.05] dark:bg-white/[0.08] text-text-muted'
                }`}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
