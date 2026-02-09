/** Simple line-art SVGs for marketing. No images. */

const stroke = "currentColor";
const strokeOpacity = 0.35;

export function FactoryOutline({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M20 60V35l20-12v37H20zM40 23v37h20V23H40zM60 35v25h20V35l-10-6-10 6zM80 45v15h20V45H80z"
        stroke={stroke}
        strokeOpacity={strokeOpacity}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M10 70h100"
        stroke={stroke}
        strokeOpacity={strokeOpacity}
        strokeWidth="1"
      />
      <circle cx="30" cy="50" r="4" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth="1" fill="none" />
      <circle cx="50" cy="38" r="4" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth="1" fill="none" />
      <circle cx="70" cy="48" r="4" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth="1" fill="none" />
    </svg>
  );
}

export function ChecklistLine({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M8 12h32M8 24h32M8 36h24"
        stroke={stroke}
        strokeOpacity={strokeOpacity}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M38 32l3 3 5-6"
        stroke={stroke}
        strokeOpacity={0.6}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="14" cy="12" r="2" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth="1" fill="none" />
      <circle cx="14" cy="24" r="2" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth="1" fill="none" />
      <circle cx="14" cy="36" r="2" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth="1" fill="none" />
    </svg>
  );
}

export function ShieldLine({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M24 4L8 12v14c0 12 16 22 16 22s16-10 16-22V12L24 4z"
        stroke={stroke}
        strokeOpacity={strokeOpacity}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StationLine({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect
        x="8"
        y="16"
        width="32"
        height="24"
        rx="2"
        stroke={stroke}
        strokeOpacity={strokeOpacity}
        strokeWidth="1.2"
      />
      <path
        d="M16 24h16M16 30h12"
        stroke={stroke}
        strokeOpacity={strokeOpacity}
        strokeWidth="1"
        strokeLinecap="round"
      />
      <circle cx="24" cy="10" r="4" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth="1.2" fill="none" />
    </svg>
  );
}
