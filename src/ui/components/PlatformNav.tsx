import { FacebookIcon, GlobeIcon, InstagramIcon } from './icons';

export type PlatformTab = 'facebook' | 'instagram' | 'global';

export interface PlatformNavProps {
  currentTab: PlatformTab;
  onSelectTab: (tab: PlatformTab) => void;
  sectionTitle: string;
  tabs: {
    facebook: string;
    instagram: string;
    global: string;
  };
  counts: {
    facebook: number;
    instagram: number;
    global: number;
  };
  isFbActiveSite: boolean;
  isIgActiveSite: boolean;
  activeNowText: string;
}

export function PlatformNav({
  currentTab,
  onSelectTab,
  sectionTitle,
  tabs,
  counts,
  isFbActiveSite,
  isIgActiveSite,
  activeNowText,
}: PlatformNavProps) {
  const items = [
    {
      id: 'facebook' as const,
      label: tabs.facebook,
      count: counts.facebook,
      icon: <FacebookIcon size={16} />,
      iconBg:
        'bg-blue-500/10 text-[#1877F2] dark:bg-blue-500/20 dark:text-blue-300',
      activeCard:
        'bg-blue-500/10 dark:bg-blue-500/20 text-[#1877F2] dark:text-blue-300 font-bold',
      activeBadge:
        'bg-[#1877F2] text-white shadow-xs dark:bg-blue-600',
      isActiveSite: isFbActiveSite,
    },
    {
      id: 'instagram' as const,
      label: tabs.instagram,
      count: counts.instagram,
      icon: <InstagramIcon size={16} />,
      iconBg:
        'bg-pink-500/10 text-[#E1306C] dark:bg-pink-500/20 dark:text-pink-300',
      activeCard:
        'bg-pink-500/10 dark:bg-pink-500/20 text-[#E1306C] dark:text-pink-300 font-bold',
      activeBadge:
        'bg-[#E1306C] text-white shadow-xs dark:bg-pink-600',
      isActiveSite: isIgActiveSite,
    },
    {
      id: 'global' as const,
      label: tabs.global,
      count: counts.global,
      icon: <GlobeIcon size={16} />,
      iconBg:
        'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300',
      activeCard:
        'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold',
      activeBadge:
        'bg-emerald-600 text-white shadow-xs dark:bg-emerald-600',
      isActiveSite: false,
    },
  ];

  return (
    <div class="flex-1 select-none">
      <div class="px-1.5 mb-2 text-[10px] font-bold tracking-wider text-text-muted/70 uppercase flex items-center justify-between">
        <span>{sectionTitle}</span>
      </div>
      <nav class="space-y-1.5">
        {items.map((item) => {
          const isSelected = currentTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-label={item.label}
              onClick={() => onSelectTab(item.id)}
              class={`group relative w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-[background-color,color,transform] duration-150 active:scale-[0.985] cursor-pointer text-left outline-none focus:outline-none border-0 contain-[layout_style] ${
                isSelected
                  ? item.activeCard
                  : 'text-text-muted hover:text-text hover:bg-surface-muted/60 font-medium'
              }`}
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <div
                  class={`w-7.5 h-7.5 rounded-lg flex items-center justify-center shrink-0 transition-transform ${
                    item.iconBg
                  } ${isSelected ? 'scale-105' : 'group-hover:scale-105'}`}
                >
                  {item.icon}
                </div>
                <span class="truncate text-xs">{item.label}</span>
                {item.isActiveSite && (
                  <span
                    class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9.5px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25"
                    title={activeNowText}
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>ON</span>
                  </span>
                )}
              </div>
              <span
                class={`text-[11px] px-2 py-0.5 rounded-full font-bold shrink-0 transition-all ${
                  isSelected
                    ? item.activeBadge
                    : 'bg-surface-muted text-text-muted font-medium'
                }`}
              >
                {item.count}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
