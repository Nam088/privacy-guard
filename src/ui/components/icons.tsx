interface IconProps {
  class?: string;
  size?: number;
}

export function ShieldIcon({ class: className = '', size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      class={className}
    >
      <path
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
        fill="currentColor"
        fill-opacity="0.16"
      />
      <path d="m9 12 2 2 4-4" strokeWidth="2.2" />
    </svg>
  );
}

export function BrandLogo({ class: className = '', size = 28 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      class={className}
    >
      {/* Full-bleed Modern Squircle Base */}
      <rect x="0" y="0" width="512" height="512" rx="128" fill="#2563EB" />

      {/* Antennas Left & Right */}
      <path d="M 164,115 L 126,56" stroke="#FFFFFF" strokeWidth="28" strokeLinecap="round" />
      <circle cx="114" cy="42" r="26" fill="#FFFFFF" />
      <path d="M 348,115 L 386,56" stroke="#FFFFFF" strokeWidth="28" strokeLinecap="round" />
      <circle cx="398" cy="42" r="26" fill="#FFFFFF" />

      {/* Ear Caps / Side Modules */}
      <rect x="36" y="200" width="34" height="110" rx="17" fill="#E2E8F0" />
      <rect x="442" y="200" width="34" height="110" rx="17" fill="#E2E8F0" />

      {/* Robot Head Main Body */}
      <rect x="58" y="112" width="396" height="300" rx="90" fill="#FFFFFF" />

      {/* Face Screen */}
      <rect x="102" y="158" width="308" height="200" rx="56" fill="#1E40AF" />

      {/* Big Friendly Glowing Eyes */}
      <circle cx="190" cy="254" r="42" fill="#38BDF8" />
      <circle cx="322" cy="254" r="42" fill="#38BDF8" />

      {/* Eye Sparkle Highlights */}
      <circle cx="178" cy="242" r="14" fill="#FFFFFF" />
      <circle cx="310" cy="242" r="14" fill="#FFFFFF" />

      {/* Warm Friendly Smile */}
      <path
        d="M 226,296 Q 256,316 286,296"
        stroke="#38BDF8"
        strokeWidth="12"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function EyeOffIcon({ class: className = '', size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      class={className}
    >
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"
        fill="currentColor"
        fill-opacity="0.16"
      />
      <circle cx="12" cy="12" r="3" fill="currentColor" fill-opacity="0.3" />
      <line x1="3.5" y1="3.5" x2="20.5" y2="20.5" strokeWidth="2" />
    </svg>
  );
}

export function ChatDotsIcon({ class: className = '', size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      class={className}
    >
      <path
        d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.6-.8L3 21l1.8-5.9A8.5 8.5 0 1 1 21 11.5z"
        fill="currentColor"
        fill-opacity="0.16"
      />
      <circle cx="8" cy="11.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="11.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="16" cy="11.5" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function GhostIcon({ class: className = '', size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      class={className}
    >
      <path
        d="M12 2C7.5 2 4 5.5 4 10v9.5c0 .6.7.9 1.1.5L8 18l2.9 2c.6.4 1.6.4 2.2 0l2.9-2 2.9 2c.4.4 1.1.1 1.1-.5V10c0-4.5-3.5-8-8-8z"
        fill="currentColor"
        fill-opacity="0.18"
      />
      <circle cx="9" cy="9.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="15" cy="9.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function VideoOffIcon({ class: className = '', size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      class={className}
    >
      <rect
        x="2.5"
        y="6"
        width="13"
        height="12"
        rx="3"
        fill="currentColor"
        fill-opacity="0.16"
      />
      <path
        d="M15.5 10l5-3v10l-5-3"
        fill="currentColor"
        fill-opacity="0.2"
      />
      <line x1="3" y1="3" x2="21" y2="21" strokeWidth="2" />
    </svg>
  );
}

export function LockCheckIcon({ class: className = '', size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      class={className}
    >
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      <rect
        x="3.5"
        y="10.5"
        width="17"
        height="11"
        rx="3.5"
        fill="currentColor"
        fill-opacity="0.16"
      />
      <path d="m9 16 2 2 4-4" strokeWidth="2.2" />
    </svg>
  );
}

export function IncognitoIcon({ class: className = '', size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      class={className}
    >
      <path d="M2.5 11h19" />
      <path
        d="M6.5 11 8 4.5a2 2 0 0 1 2-1.5h4a2 2 0 0 1 2 1.5l1.5 6.5"
        fill="currentColor"
        fill-opacity="0.16"
      />
      <circle cx="8" cy="16.5" r="3" fill="currentColor" fill-opacity="0.16" />
      <circle cx="16" cy="16.5" r="3" fill="currentColor" fill-opacity="0.16" />
      <path d="M11 16.5h2" />
    </svg>
  );
}

export function MicOffIcon({ class: className = '', size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      class={className}
    >
      <line x1="2.5" y1="2.5" x2="21.5" y2="21.5" strokeWidth="2" />
      <path d="M18.89 13.23A7.12 7.12 0 0 0 19 11M5 11a7 7 0 0 0 10.74 5.92" />
      <path
        d="M15 9.34V5a3 3 0 0 0-5.68-1.33"
        fill="currentColor"
        fill-opacity="0.16"
      />
      <path
        d="M9 9v2a3 3 0 0 0 5.12 2.12"
        fill="currentColor"
        fill-opacity="0.16"
      />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}

export function AdBlockIcon({ class: className = '', size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      class={className}
    >
      <path
        d="M11 5 6 9H3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3l5 4V5z"
        fill="currentColor"
        fill-opacity="0.16"
      />
      <line x1="16" y1="10" x2="21" y2="15" strokeWidth="2" />
      <line x1="21" y1="10" x2="16" y2="15" strokeWidth="2" />
    </svg>
  );
}

export function SparklesSlashIcon({ class: className = '', size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      class={className}
    >
      <path
        d="M11 3C11 7.2 7.5 10.5 3 10.5c4.5 0 8 3.3 8 7.5 0-4.2 3.5-7.5 8-7.5-4.5 0-8-3.3-8-7.5z"
        fill="currentColor"
        fill-opacity="0.18"
      />
      <circle cx="18.5" cy="5.5" r="1.5" fill="currentColor" stroke="none" />
      <line x1="3" y1="3" x2="21" y2="21" strokeWidth="2" />
    </svg>
  );
}

export function FilmSlashIcon({ class: className = '', size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      class={className}
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="3.5"
        fill="currentColor"
        fill-opacity="0.16"
      />
      <path d="M3 10h18" />
      <polygon points="10,12.5 10,16.5 14,14.5" fill="currentColor" stroke="none" />
      <line x1="3" y1="3" x2="21" y2="21" strokeWidth="2" />
    </svg>
  );
}

export function PauseReloadIcon({ class: className = '', size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      class={className}
    >
      <path d="M21 12a9 9 0 1 1-2.6-6.4L21 8" />
      <polyline points="21 3 21 8 16 8" />
      <rect x="9.5" y="9.5" width="2.2" height="5.5" rx="1.1" fill="currentColor" stroke="none" />
      <rect x="13" y="9.5" width="2.2" height="5.5" rx="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ClockStopIcon({ class: className = '', size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      class={className}
    >
      <circle
        cx="12"
        cy="13"
        r="8"
        fill="currentColor"
        fill-opacity="0.16"
      />
      <path d="M12 2v3" />
      <path d="M10 2h4" />
      <path d="M12 9v4l2.5 1.5" />
      <line x1="3" y1="3" x2="21" y2="21" strokeWidth="2" />
    </svg>
  );
}

export function LinkSlashIcon({ class: className = '', size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      class={className}
    >
      <path d="M9 17H7A5 5 0 0 1 7 7h2" />
      <path d="M15 7h2a5 5 0 0 1 4 4.5" />
      <path d="M14 11a5 5 0 0 1-5 5" />
      <line x1="3" y1="3" x2="21" y2="21" strokeWidth="2" />
    </svg>
  );
}

export function ShieldNetworkIcon({ class: className = '', size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      class={className}
    >
      <path
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
        fill="currentColor"
        fill-opacity="0.16"
      />
      <circle cx="12" cy="14" r="1.6" fill="currentColor" stroke="none" />
      <path d="M9 10.5a4.5 4.5 0 0 1 6 0" />
      <path d="M6.5 8a8 8 0 0 1 11 0" />
    </svg>
  );
}

export function RadarIcon({ class: className = '', size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      class={className}
    >
      <path d="M12 22a10 10 0 1 0-10-10" />
      <path
        d="M12 18a6 6 0 1 0-6-6"
        fill="currentColor"
        fill-opacity="0.16"
      />
      <path d="M12 14a2 2 0 1 0-2-2" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <line x1="12" y1="12" x2="19" y2="5" strokeWidth="2" />
    </svg>
  );
}

export function SearchSlashIcon({ class: className = '', size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      class={className}
    >
      <path
        d="m10.5 4.5a6 6 0 0 1 6 6c0 1.4-.5 2.7-1.3 3.7"
        fill="currentColor"
        fill-opacity="0.16"
      />
      <path d="M6 6a6 6 0 0 0 4.5 10.5c1.4 0 2.7-.5 3.7-1.3" />
      <line x1="15.5" y1="15.5" x2="20.5" y2="20.5" strokeWidth="2.5" />
      <line x1="3" y1="3" x2="21" y2="21" strokeWidth="2" />
    </svg>
  );
}

export function FacebookIcon({ class: className = '', size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" class={className}>
      <path d="M14 13.5h2.5l1-4H14v-2c0-1.03.3-1.75 1.75-1.75H17.5V2.2A23.5 23.5 0 0 0 14.7 2C12 2 10 3.65 10 6.7v2.8H7v4h3V22h4v-8.5z" />
    </svg>
  );
}

export function InstagramIcon({ class: className = '', size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      class={className}
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function GlobeIcon({ class: className = '', size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      class={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <line x1="2" y1="12" x2="22" y2="12" />
    </svg>
  );
}

export function DownloadIcon({ class: className = '', size = 15 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      class={className}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export function SunIcon({ class: className = '', size = 14 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      class={className}
    >
      <circle cx="12" cy="12" r="4" fill="currentColor" fill-opacity="0.25" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

export function MoonIcon({ class: className = '', size = 14 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      class={className}
    >
      <path
        d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"
        fill="currentColor"
        fill-opacity="0.25"
      />
    </svg>
  );
}

export function MonitorIcon({ class: className = '', size = 14 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      class={className}
    >
      <rect
        width="20"
        height="14"
        x="2"
        y="3"
        rx="2"
        fill="currentColor"
        fill-opacity="0.2"
      />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}
