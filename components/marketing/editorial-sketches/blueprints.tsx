"use client";

/**
 * System blueprint sketches for BCLEDGE marketing.
 * Same editorial style: hand-drawn, monochrome, currentColor.
 * System diagrams only — no people, no scenes.
 */

import type { EditorialSketchProps } from "./index";

const stroke = "currentColor";
const strokeWidth = 1;
const strokeLinecap = "round" as const;
const strokeLinejoin = "round" as const;
const defaultOpacity = 0.9;

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

/** Organization → Site → Line → Station → Shift. Light arrows, labels. */
export function SketchOrgArchitecture(props: EditorialSketchProps) {
  return (
    <svg {...svgProps("0 0 320 100", props)}>
      {/* Boxes */}
      <rect x="8" y="32" width="48" height="36" rx="1" stroke={stroke} strokeWidth={strokeWidth} />
      <rect x="72" y="32" width="48" height="36" rx="1" stroke={stroke} strokeWidth={strokeWidth} />
      <rect x="136" y="32" width="48" height="36" rx="1" stroke={stroke} strokeWidth={strokeWidth} />
      <rect x="200" y="32" width="48" height="36" rx="1" stroke={stroke} strokeWidth={strokeWidth} />
      <rect x="264" y="32" width="48" height="36" rx="1" stroke={stroke} strokeWidth={strokeWidth} />
      {/* Arrows */}
      <path d="M56 50h12M68 50l4 4-4 4" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} opacity={0.7} />
      <path d="M120 50h12M132 50l4 4-4 4" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} opacity={0.7} />
      <path d="M184 50h12M196 50l4 4-4 4" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} opacity={0.7} />
      <path d="M248 50h12M260 50l4 4-4 4" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} opacity={0.7} />
      {/* Labels */}
      <text x="32" y="54" fill={stroke} fontSize="8" fontFamily="system-ui, sans-serif" fontWeight="500" opacity={0.85}>Org</text>
      <text x="88" y="54" fill={stroke} fontSize="8" fontFamily="system-ui, sans-serif" fontWeight="500" opacity={0.85}>Site</text>
      <text x="152" y="54" fill={stroke} fontSize="8" fontFamily="system-ui, sans-serif" fontWeight="500" opacity={0.85}>Line</text>
      <text x="216" y="54" fill={stroke} fontSize="8" fontFamily="system-ui, sans-serif" fontWeight="500" opacity={0.85}>Station</text>
      <text x="280" y="54" fill={stroke} fontSize="8" fontFamily="system-ui, sans-serif" fontWeight="500" opacity={0.85}>Shift</text>
    </svg>
  );
}

/** Skills → Requirements → Coverage → Readiness. Traceability. */
export function SketchCompetenceFlow(props: EditorialSketchProps) {
  return (
    <svg {...svgProps("0 0 280 80", props)}>
      <rect x="8" y="22" width="56" height="36" rx="1" stroke={stroke} strokeWidth={strokeWidth} />
      <rect x="80" y="22" width="56" height="36" rx="1" stroke={stroke} strokeWidth={strokeWidth} />
      <rect x="152" y="22" width="56" height="36" rx="1" stroke={stroke} strokeWidth={strokeWidth} />
      <rect x="224" y="22" width="56" height="36" rx="1" stroke={stroke} strokeWidth={strokeWidth} />
      <path d="M64 40h12M76 40l4 4-4 4" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} opacity={0.7} />
      <path d="M136 40h12M148 40l4 4-4 4" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} opacity={0.7} />
      <path d="M208 40h12M220 40l4 4-4 4" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} opacity={0.7} />
      <text x="18" y="44" fill={stroke} fontSize="8" fontFamily="system-ui, sans-serif" fontWeight="500" opacity={0.85}>Skills</text>
      <text x="92" y="44" fill={stroke} fontSize="7" fontFamily="system-ui, sans-serif" fontWeight="500" opacity={0.85}>Requirements</text>
      <text x="162" y="44" fill={stroke} fontSize="8" fontFamily="system-ui, sans-serif" fontWeight="500" opacity={0.85}>Coverage</text>
      <text x="238" y="44" fill={stroke} fontSize="8" fontFamily="system-ui, sans-serif" fontWeight="500" opacity={0.85}>Readiness</text>
    </svg>
  );
}

/** Requirement → Due → Action → Decision → Audit log. */
export function SketchComplianceLoop(props: EditorialSketchProps) {
  return (
    <svg {...svgProps("0 0 300 72", props)}>
      <rect x="8" y="18" width="52" height="36" rx="1" stroke={stroke} strokeWidth={strokeWidth} />
      <rect x="72" y="18" width="52" height="36" rx="1" stroke={stroke} strokeWidth={strokeWidth} />
      <rect x="136" y="18" width="52" height="36" rx="1" stroke={stroke} strokeWidth={strokeWidth} />
      <rect x="200" y="18" width="52" height="36" rx="1" stroke={stroke} strokeWidth={strokeWidth} />
      <rect x="264" y="18" width="52" height="36" rx="1" stroke={stroke} strokeWidth={strokeWidth} />
      <path d="M60 36h8M68 36l3 3-3 3" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} opacity={0.7} />
      <path d="M124 36h8M132 36l3 3-3 3" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} opacity={0.7} />
      <path d="M188 36h8M196 36l3 3-3 3" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} opacity={0.7} />
      <path d="M252 36h8M260 36l3 3-3 3" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} opacity={0.7} />
      <text x="16" y="40" fill={stroke} fontSize="7" fontFamily="system-ui, sans-serif" fontWeight="500" opacity={0.85}>Requirement</text>
      <text x="80" y="40" fill={stroke} fontSize="8" fontFamily="system-ui, sans-serif" fontWeight="500" opacity={0.85}>Due</text>
      <text x="144" y="40" fill={stroke} fontSize="8" fontFamily="system-ui, sans-serif" fontWeight="500" opacity={0.85}>Action</text>
      <text x="208" y="40" fill={stroke} fontSize="7" fontFamily="system-ui, sans-serif" fontWeight="500" opacity={0.85}>Decision</text>
      <text x="272" y="40" fill={stroke} fontSize="7" fontFamily="system-ui, sans-serif" fontWeight="500" opacity={0.85}>Audit log</text>
    </svg>
  );
}
