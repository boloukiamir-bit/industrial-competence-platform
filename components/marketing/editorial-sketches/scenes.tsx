"use client";

/**
 * Editorial scene illustrations for BCLEDGE marketing.
 * Hand-drawn outlines (currentColor + opacity), soft fills, minimal palette.
 * People + factory + checklists vibe; no raster textures.
 */

export type SceneProps = {
  className?: string;
  title?: string;
  "aria-hidden"?: boolean;
};

const stroke = "currentColor";
const strokeWidth = 1.05;
const strokeLinecap = "round" as const;
const strokeLinejoin = "round" as const;
const strokeOpacity = 0.5;
const fillOpacity = 0.08;

function sceneSvgProps(
  viewBox: string,
  props: SceneProps
): React.SVGAttributes<SVGSVGElement> {
  const { className, title, "aria-hidden": ariaHidden = true } = props;
  return {
    className,
    viewBox,
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": ariaHidden,
    ...(title && { "aria-label": title }),
  };
}

/** People, laptops, flags/checklists collaboration */
export function SceneWorkforceCollaboration(props: SceneProps) {
  return (
    <svg {...sceneSvgProps("0 0 240 160", props)}>
      <title>{props.title}</title>
      {/* Soft background shapes */}
      <rect x="20" y="40" width="80" height="100" rx="2" fill={stroke} fillOpacity={fillOpacity} stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} strokeLinejoin={strokeLinejoin} />
      <rect x="100" y="30" width="100" height="110" rx="2" fill={stroke} fillOpacity={fillOpacity * 1.2} stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} strokeLinejoin={strokeLinejoin} />
      <rect x="140" y="90" width="80" height="60" rx="1" fill={stroke} fillOpacity={fillOpacity} stroke={stroke} strokeOpacity={strokeOpacity * 0.8} strokeWidth={strokeWidth} />
      {/* Figures */}
      <path d="M50 128v-12h14v12M50 116c0-2 1.5-4 4-4s4 2 4 4" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} />
      <path d="M82 124v-10h12v10M82 114c0-1.5 1-3 3-3s3 1.5 3 3" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} />
      <path d="M158 122v-8h10v8M158 114c0-1.5 1-3 3-3s3 1.5 3 3" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} />
      {/* Screens / clipboards */}
      <rect x="36" y="68" width="28" height="22" rx="1" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} />
      <path d="M40 74h18M40 80h14" stroke={stroke} strokeOpacity={strokeOpacity * 0.9} strokeWidth={strokeWidth * 0.9} strokeLinecap={strokeLinecap} />
      <rect x="118" y="52" width="36" height="28" rx="1" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} />
      <path d="M122 58h26M122 64h20" stroke={stroke} strokeOpacity={strokeOpacity * 0.9} strokeWidth={strokeWidth * 0.9} strokeLinecap={strokeLinecap} />
      <path d="M148 96l2 2 4-4" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} />
    </svg>
  );
}

/** Operator at station + checklist panel */
export function SceneFactoryStation(props: SceneProps) {
  return (
    <svg {...sceneSvgProps("0 0 220 140", props)}>
      <title>{props.title}</title>
      <rect x="12" y="100" width="196" height="28" rx="1" fill={stroke} fillOpacity={fillOpacity} stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} strokeLinejoin={strokeLinejoin} />
      <path d="M40 100V68l20-12v44M80 56v44h22V56M122 64v36h24V64l-12-6-12 6M166 72v28h22V72" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} strokeLinejoin={strokeLinejoin} />
      <circle cx="50" cy="78" r="6" fill={stroke} fillOpacity={fillOpacity} stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} />
      <circle cx="91" cy="70" r="6" fill={stroke} fillOpacity={fillOpacity} stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} />
      <rect x="130" y="72" width="32" height="28" rx="1" fill={stroke} fillOpacity={fillOpacity * 0.8} stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} />
      <path d="M134 78h22M134 84h16" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth * 0.9} strokeLinecap={strokeLinecap} />
      <path d="M142 90l2 2 4-4" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} />
      <path d="M88 100V84h10v16M88 84c0-2 1.5-4 4-4s4 2 4 4" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} />
      <rect x="24" y="24" width="56" height="44" rx="1" fill={stroke} fillOpacity={fillOpacity} stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} />
      <path d="M28 30h44M28 36h38M28 42h28" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth * 0.9} strokeLinecap={strokeLinecap} />
    </svg>
  );
}

/** HR + production coordination desk */
export function SceneHRDesk(props: SceneProps) {
  return (
    <svg {...sceneSvgProps("0 0 240 150", props)}>
      <title>{props.title}</title>
      <path d="M16 118h208" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} />
      <rect x="28" y="62" width="72" height="56" rx="1" fill={stroke} fillOpacity={fillOpacity} stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} strokeLinejoin={strokeLinejoin} />
      <rect x="34" y="66" width="28" height="22" rx="0.5" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} />
      <path d="M38 72h18M38 78h14" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth * 0.9} strokeLinecap={strokeLinecap} />
      <path d="M68 82h26M68 88h22" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth * 0.9} strokeLinecap={strokeLinecap} />
      <path d="M52 118V98h14v20M52 98c0-2 1.5-4 4-4s4 2 4 4" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} />
      <rect x="112" y="54" width="96" height="64" rx="1" fill={stroke} fillOpacity={fillOpacity * 1.2} stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} strokeLinejoin={strokeLinejoin} />
      <path d="M116 60h80M116 68h72M116 76h64M116 84h56" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth * 0.9} strokeLinecap={strokeLinecap} />
      <path d="M156 96l3 3 6-6" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} />
      <path d="M148 118V102h12v16M148 102c0-1.5 1.5-3 4-3s4 1.5 4 3" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} />
    </svg>
  );
}

/** Manager reviewing readiness / dashboard */
export function SceneManagerReadiness(props: SceneProps) {
  return (
    <svg {...sceneSvgProps("0 0 200 130", props)}>
      <title>{props.title}</title>
      <rect x="20" y="28" width="72" height="56" rx="1" fill={stroke} fillOpacity={fillOpacity} stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} strokeLinejoin={strokeLinejoin} />
      <path d="M24 34h60M24 42h52M24 50h40M24 58h36" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth * 0.9} strokeLinecap={strokeLinecap} />
      <rect x="100" y="22" width="80" height="64" rx="1" fill={stroke} fillOpacity={fillOpacity * 1.2} stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} strokeLinejoin={strokeLinejoin} />
      <path d="M104 28h68M104 36h60M104 44h52M104 52h44M104 60h38" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth * 0.9} strokeLinecap={strokeLinecap} />
      <path d="M136 72l3 3 6-6" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} />
      <path d="M38 98V78h18v20M38 78c0-2 2-4 5-4s5 2 5 4" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} />
      <path d="M158 96V80h14v16M158 80c0-2 2-4 5-4s5 2 5 4" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} />
    </svg>
  );
}

/** Document + stamp + handoff */
export function SceneComplianceHandoff(props: SceneProps) {
  return (
    <svg {...sceneSvgProps("0 0 200 120", props)}>
      <title>{props.title}</title>
      <path d="M24 98V62h32v36M72 98V68h28v30M120 98V72h32v26" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} strokeLinejoin={strokeLinejoin} />
      <path d="M40 62c0-2 2-4 5-4s5 2 5 4M82 68c0-1.5 1.5-3 4-3s4 1.5 4 3M130 72c0-2 2-4 5-4s5 2 5 4" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} />
      <rect x="28" y="28" width="28" height="32" rx="1" fill={stroke} fillOpacity={fillOpacity} stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} />
      <path d="M32 34h18M32 40h14" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth * 0.9} strokeLinecap={strokeLinecap} />
      <ellipse cx="88" cy="48" rx="18" ry="12" fill={stroke} fillOpacity={fillOpacity * 0.5} stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} strokeDasharray="3 2" />
      <path d="M88 42v12M82 48h12" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} />
      <rect x="118" y="32" width="40" height="44" rx="1" fill={stroke} fillOpacity={fillOpacity} stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} />
      <path d="M122 38h28M122 44h22M122 50h16" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth * 0.9} strokeLinecap={strokeLinecap} />
      <path d="M134 62l3 3 6-6" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} />
    </svg>
  );
}

/** Coach/worker + certification card */
export function SceneTrainingMoment(props: SceneProps) {
  return (
    <svg {...sceneSvgProps("0 0 180 130", props)}>
      <title>{props.title}</title>
      <path d="M32 108V82h20v26M72 108V86h18v22" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} strokeLinejoin={strokeLinejoin} />
      <path d="M42 82c0-2 1.5-4 4-4s4 2 4 4M82 86c0-1.5 1.5-3 4-3s4 1.5 4 3" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} />
      <rect x="28" y="28" width="44" height="52" rx="1" fill={stroke} fillOpacity={fillOpacity} stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} />
      <path d="M32 34h34M32 42h28M32 50h22M32 58h18" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth * 0.9} strokeLinecap={strokeLinecap} />
      <rect x="88" y="36" width="72" height="44" rx="1" fill={stroke} fillOpacity={fillOpacity * 1.2} stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} />
      <path d="M92 42h60M92 50h52M92 58h44" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth * 0.9} strokeLinecap={strokeLinecap} />
      <path d="M124 68l2 2 4-4" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} />
    </svg>
  );
}
