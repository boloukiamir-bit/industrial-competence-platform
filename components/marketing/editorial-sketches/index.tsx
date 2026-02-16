"use client";

/**
 * Editorial sketch library for BCLEDGE marketing.
 * One illustration system: hand-drawn, confident strokes, currentColor.
 * No gradients. Use for hero, section accents, and storytelling only.
 */

const stroke = "currentColor";
const strokeWidth = 1.1;
const strokeLinecap = "round" as const;
const strokeLinejoin = "round" as const;
const defaultOpacity = 0.9;

export type EditorialSketchProps = {
  className?: string;
  "aria-hidden"?: boolean;
  opacity?: number;
};

function svgProps(
  viewBox: string,
  props: EditorialSketchProps
): React.SVGAttributes<SVGSVGElement> {
  const { className, "aria-hidden": ariaHidden = true, opacity = defaultOpacity } = props;
  return {
    className,
    viewBox,
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": ariaHidden,
    style: { opacity },
  };
}

/** Workforce coordination: people, screens, checklists */
export function SketchWorkforceCoordination(props: EditorialSketchProps) {
  return (
    <svg {...svgProps("0 0 160 120", props)}>
      <path
        d="M28 92v-8h12v8M48 92v-6h10v6M72 92v-8h14v8"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap={strokeLinecap}
        strokeLinejoin={strokeLinejoin}
      />
      <path
        d="M34 84c0-2 1.5-4 4-4s4 2 4 4M54 86c0-1.5 1-3 3-3s3 1.5 3 3M78 84c0-2 1.5-4 4-4s4 2 4 4"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap={strokeLinecap}
      />
      <rect x="20" y="52" width="24" height="28" rx="1" stroke={stroke} strokeWidth={strokeWidth} />
      <path d="M24 62h16M24 68h12M24 74h10" stroke={stroke} strokeWidth={strokeWidth * 0.9} strokeLinecap={strokeLinecap} />
      <rect x="52" y="48" width="28" height="36" rx="1" stroke={stroke} strokeWidth={strokeWidth} />
      <path d="M58 58h18M58 64h14" stroke={stroke} strokeWidth={strokeWidth * 0.9} strokeLinecap={strokeLinecap} />
      <circle cx="66" cy="76" r="4" stroke={stroke} strokeWidth={strokeWidth} />
      <rect x="92" y="44" width="32" height="42" rx="1" stroke={stroke} strokeWidth={strokeWidth} />
      <path d="M98 54h18M98 60h14M98 66h10" stroke={stroke} strokeWidth={strokeWidth * 0.9} strokeLinecap={strokeLinecap} />
      <path d="M108 78l4 4 8-8" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} />
    </svg>
  );
}

/** Factory station: operator at station with checklist */
export function SketchFactoryStationOperator(props: EditorialSketchProps) {
  return (
    <svg {...svgProps("0 0 140 100", props)}>
      <path d="M12 88h116" stroke={stroke} strokeWidth={strokeWidth} />
      <path d="M24 88V56l16-10v42M48 46v42h20V46M76 52v36h18V52l-9-5-9 5M102 60v28h18V60" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin={strokeLinejoin} />
      <circle cx="32" cy="62" r="5" stroke={stroke} strokeWidth={strokeWidth} />
      <circle cx="58" cy="56" r="5" stroke={stroke} strokeWidth={strokeWidth} />
      <rect x="82" y="58" width="24" height="20" rx="1" stroke={stroke} strokeWidth={strokeWidth} />
      <path d="M86 64h14M86 70h10" stroke={stroke} strokeWidth={strokeWidth * 0.9} strokeLinecap={strokeLinecap} />
      <path d="M94 78l2 2 4-4" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} />
      <path d="M70 88V72h8v16M70 72c0-2 1.5-4 4-4s4 2 4 4" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} />
    </svg>
  );
}

/** Manager reviewing readiness / audit log */
export function SketchManagerReadiness(props: EditorialSketchProps) {
  return (
    <svg {...svgProps("0 0 150 110", props)}>
      <path d="M24 94V70h22v24M54 94V66h20v28M84 94V72h24v22" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin={strokeLinejoin} />
      <path d="M35 70c0-2 2-4 5-4s5 2 5 4M65 66c0-1.5 1.5-3 4-3s4 1.5 4 3M95 72c0-2 2-4 5-4s5 2 5 4" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} />
      <rect x="28" y="38" width="36" height="28" rx="1" stroke={stroke} strokeWidth={strokeWidth} />
      <path d="M32 46h28M32 52h24M32 58h18M32 64h14" stroke={stroke} strokeWidth={strokeWidth * 0.9} strokeLinecap={strokeLinecap} />
      <rect x="72" y="32" width="44" height="36" rx="1" stroke={stroke} strokeWidth={strokeWidth} />
      <path d="M76 40h34M76 46h30M76 52h26M76 58h22M76 64h18" stroke={stroke} strokeWidth={strokeWidth * 0.9} strokeLinecap={strokeLinecap} />
      <path d="M92 72l3 3 6-6" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} />
    </svg>
  );
}

/** Team across shifts: timeline / clock reference */
export function SketchTeamShifts(props: EditorialSketchProps) {
  return (
    <svg {...svgProps("0 0 160 90", props)}>
      <path d="M12 44h136" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} />
      <circle cx="28" cy="44" r="6" stroke={stroke} strokeWidth={strokeWidth} />
      <circle cx="80" cy="44" r="6" stroke={stroke} strokeWidth={strokeWidth} />
      <circle cx="132" cy="44" r="6" stroke={stroke} strokeWidth={strokeWidth} />
      <path d="M28 44h46M80 44h46" stroke={stroke} strokeWidth={strokeWidth * 0.8} strokeDasharray="3 2" />
      <circle cx="80" cy="44" r="18" stroke={stroke} strokeWidth={strokeWidth} />
      <path d="M80 44v-10M80 44h8M80 44v6" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} />
      <path d="M20 68V52h16v16M52 68V54h14v14M100 68V54h16v14" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin={strokeLinejoin} />
      <path d="M28 52c0-1 1-2 2-2s2 1 2 2M60 54c0-1 1-2 2-2s2 1 2 2M108 54c0-1 1-2 2-2s2 1 2 2" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} />
    </svg>
  );
}

/** Compliance moment: stamp, clipboard, document handoff */
export function SketchComplianceHandoff(props: EditorialSketchProps) {
  return (
    <svg {...svgProps("0 0 140 100", props)}>
      <path d="M16 84V52h28v32M52 84V56h24v28M84 84V60h28v24" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin={strokeLinejoin} />
      <path d="M30 52c0-2 2-4 5-4s5 2 5 4M66 56c0-1.5 1.5-3 4-3s4 1.5 4 3M98 60c0-2 2-4 5-4s5 2 5 4" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} />
      <rect x="20" y="28" width="20" height="22" rx="1" stroke={stroke} strokeWidth={strokeWidth} />
      <path d="M24 34h12M24 40h10" stroke={stroke} strokeWidth={strokeWidth * 0.9} strokeLinecap={strokeLinecap} />
      <ellipse cx="52" cy="38" rx="12" ry="8" stroke={stroke} strokeWidth={strokeWidth} strokeDasharray="2 2" />
      <path d="M52 34v8M48 38h8" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} />
      <rect x="78" y="32" width="28" height="26" rx="1" stroke={stroke} strokeWidth={strokeWidth} />
      <path d="M82 38h18M82 44h14M82 50h10" stroke={stroke} strokeWidth={strokeWidth * 0.9} strokeLinecap={strokeLinecap} />
      <path d="M92 58l3 3 6-6" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} />
    </svg>
  );
}

/** HR + Production: desk, screen, PPE hint */
export function SketchHRProductionDesk(props: EditorialSketchProps) {
  return (
    <svg {...svgProps("0 0 150 100", props)}>
      <path d="M12 88h126" stroke={stroke} strokeWidth={strokeWidth} />
      <rect x="24" y="52" width="52" height="36" rx="1" stroke={stroke} strokeWidth={strokeWidth} />
      <rect x="28" y="56" width="20" height="14" rx="0.5" stroke={stroke} strokeWidth={strokeWidth} />
      <path d="M32 62h10M32 66h8" stroke={stroke} strokeWidth={strokeWidth * 0.9} strokeLinecap={strokeLinecap} />
      <path d="M54 70h18M54 76h14" stroke={stroke} strokeWidth={strokeWidth * 0.9} strokeLinecap={strokeLinecap} />
      <path d="M44 88V72h12v16M44 72c0-2 1.5-4 4-4s4 2 4 4" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} />
      <rect x="88" y="48" width="38" height="40" rx="1" stroke={stroke} strokeWidth={strokeWidth} />
      <path d="M92 54h28M92 60h24M92 66h20M92 72h16" stroke={stroke} strokeWidth={strokeWidth * 0.9} strokeLinecap={strokeLinecap} />
      <path d="M100 80l3 3 6-6" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} />
      <path d="M96 88V76h8v12M96 76c0-1.5 1.5-3 4-3s4 1.5 4 3" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} />
    </svg>
  );
}

/** Audit trail: list + timestamps */
export function SketchAuditTrail(props: EditorialSketchProps) {
  return (
    <svg {...svgProps("0 0 120 80", props)}>
      <path d="M12 16h72M12 28h56M12 40h48M12 52h60M12 64h44" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} />
      <path d="M88 22l4 4-4 4M88 34l4 4-4 4M64 46l4 4-4 4" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} />
      <circle cx="18" cy="16" r="2" stroke={stroke} strokeWidth={strokeWidth} />
      <circle cx="18" cy="28" r="2" stroke={stroke} strokeWidth={strokeWidth} />
      <circle cx="18" cy="40" r="2" stroke={stroke} strokeWidth={strokeWidth} />
    </svg>
  );
}

/** Checklist scene: clipboard + checks */
export function SketchChecklistScene(props: EditorialSketchProps) {
  return (
    <svg {...svgProps("0 0 100 120", props)}>
      <rect x="24" y="16" width="52" height="72" rx="1" stroke={stroke} strokeWidth={strokeWidth} />
      <path d="M32 28h36M32 40h36M32 52h28M32 64h32M32 76h24" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} />
      <path d="M64 34l2 2 4-4M64 46l2 2 4-4M64 58l2 2 4-4" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} />
      <path d="M42 92V78h16v14M42 78c0-2 1.5-4 4-4s4 2 4 4" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} />
    </svg>
  );
}

/** Document review: person + doc */
export function SketchDocumentReview(props: EditorialSketchProps) {
  return (
    <svg {...svgProps("0 0 110 100", props)}>
      <path d="M28 88V62h24v26M60 88V66h22v22" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin={strokeLinejoin} />
      <path d="M40 62c0-2 1.5-4 4-4s4 2 4 4M72 66c0-1.5 1.5-3 4-3s4 1.5 4 3" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} />
      <rect x="32" y="28" width="28" height="32" rx="1" stroke={stroke} strokeWidth={strokeWidth} />
      <path d="M36 34h20M36 40h16M36 46h12M36 52h14" stroke={stroke} strokeWidth={strokeWidth * 0.9} strokeLinecap={strokeLinecap} />
      <rect x="68" y="24" width="32" height="40" rx="1" stroke={stroke} strokeWidth={strokeWidth} />
      <path d="M72 30h22M72 36h18M72 42h14M72 48h18" stroke={stroke} strokeWidth={strokeWidth * 0.9} strokeLinecap={strokeLinecap} />
      <path d="M84 56l2 2 4-4" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} />
    </svg>
  );
}

/** Oversight: overview / dashboard feel */
export function SketchOversight(props: EditorialSketchProps) {
  return (
    <svg {...svgProps("0 0 140 90", props)}>
      <rect x="12" y="20" width="38" height="28" rx="1" stroke={stroke} strokeWidth={strokeWidth} />
      <rect x="54" y="20" width="38" height="28" rx="1" stroke={stroke} strokeWidth={strokeWidth} />
      <rect x="96" y="20" width="38" height="28" rx="1" stroke={stroke} strokeWidth={strokeWidth} />
      <path d="M20 28h22M20 34h18M20 40h14" stroke={stroke} strokeWidth={strokeWidth * 0.9} strokeLinecap={strokeLinecap} />
      <path d="M62 28h22M62 34h18" stroke={stroke} strokeWidth={strokeWidth * 0.9} strokeLinecap={strokeLinecap} />
      <path d="M104 28h22M104 34h18" stroke={stroke} strokeWidth={strokeWidth * 0.9} strokeLinecap={strokeLinecap} />
      <circle cx="31" cy="52" r="4" stroke={stroke} strokeWidth={strokeWidth} />
      <circle cx="73" cy="52" r="4" stroke={stroke} strokeWidth={strokeWidth} />
      <circle cx="115" cy="52" r="4" stroke={stroke} strokeWidth={strokeWidth} />
      <path d="M12 68h116M35 68V56M73 68V56M111 68V56" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} />
    </svg>
  );
}

/** Shield (security / compliance) – for SecurityTrust */
export function SketchShield(props: EditorialSketchProps) {
  return (
    <svg {...svgProps("0 0 80 96", props)}>
      <path
        d="M40 8L14 20v22c0 14 26 26 26 26s26-12 26-26V20L40 8z"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin={strokeLinejoin}
      />
    </svg>
  );
}

/** Timeline (shifts / sequence) – for FinalCTA */
export function SketchTimeline(props: EditorialSketchProps) {
  return (
    <svg {...svgProps("0 0 144 80", props)}>
      <path d="M12 40h120" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} />
      <circle cx="28" cy="40" r="8" stroke={stroke} strokeWidth={strokeWidth} />
      <circle cx="72" cy="40" r="8" stroke={stroke} strokeWidth={strokeWidth} />
      <circle cx="116" cy="40" r="8" stroke={stroke} strokeWidth={strokeWidth} />
      <path d="M28 40h38M72 40h38" stroke={stroke} strokeWidth={strokeWidth * 0.9} strokeDasharray="3 2" />
    </svg>
  );
}

/** Stamp / compliance approval – for quote block */
export function SketchComplianceStamp(props: EditorialSketchProps) {
  return (
    <svg {...svgProps("0 0 100 64", props)}>
      <path d="M16 32h24l8 12 16-24 12 12" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} />
      <ellipse cx="58" cy="34" rx="20" ry="14" stroke={stroke} strokeWidth={strokeWidth} strokeDasharray="4 3" />
    </svg>
  );
}
