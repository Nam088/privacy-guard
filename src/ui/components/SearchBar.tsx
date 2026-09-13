import { CloseIcon, SearchIcon } from './icons';

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder?: string;
  shortcutHint?: string;
  inputRef?: { current: HTMLInputElement | null };
  class?: string;
}

export function SearchBar({
  value,
  onChange,
  onClear,
  placeholder = 'Search features...',
  shortcutHint = '/',
  inputRef,
  class: className = '',
}: SearchBarProps) {
  const hasValue = value.length > 0;

  return (
    <div
      class={`relative flex items-center w-full bg-surface-card border border-border/70 rounded-xl px-3 py-1.5 shadow-2xs hover:border-border transition-colors duration-150 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15 ${className}`}
      role="search"
    >
      <SearchIcon
        size={15}
        class="text-text-muted/70 shrink-0 mr-2.5 transition-colors group-focus-within:text-accent"
      />
      <input
        ref={(el) => {
          if (inputRef) {
            inputRef.current = el;
          }
        }}
        type="text"
        role="searchbox"
        value={value}
        onInput={(e) => onChange(e.currentTarget.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        class="w-full bg-transparent border-none outline-none text-[13px] text-text placeholder:text-text-muted/50 leading-normal select-text"
        autoComplete="off"
        spellcheck={false}
      />
      {hasValue ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          class="shrink-0 p-1 ml-1 rounded-md text-text-muted hover:text-text hover:bg-surface-muted/80 transition-colors focus:outline-hidden focus:ring-1 focus:ring-accent/40"
        >
          <CloseIcon size={14} />
        </button>
      ) : shortcutHint ? (
        <kbd
          title="Press / to search"
          class="shrink-0 hidden sm:inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-medium font-mono text-text-muted/60 bg-surface-muted border border-border/60 rounded select-none"
        >
          {shortcutHint}
        </kbd>
      ) : null}
    </div>
  );
}
