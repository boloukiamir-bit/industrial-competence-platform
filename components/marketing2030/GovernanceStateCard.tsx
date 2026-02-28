"use client";

/**
 * Governance Control Panel — compliance verification artifact.
 * Static. No animation. Institutional.
 */

const ROWS = [
  { label: "Governance Status", value: "VERIFIED", status: "verified" as const },
  { label: "Compliance Integrity", value: "100%" },
  { label: "Certification Validity", value: "Complete" },
  { label: "Decision Traceability", value: "Enabled" },
  { label: "Execution State", value: "LEGALLY EXECUTABLE" },
];

export function GovernanceStateCard() {
  return (
    <div
      className="w-full max-w-[360px] border bg-white p-5"
      style={{
        borderRadius: "4px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        border: "1px solid #E5E7EB",
      }}
      aria-label="Governance control panel"
    >
      <div className="mb-4">
        <p
          className="text-[10px] font-medium uppercase tracking-[0.2em]"
          style={{ color: "#6B7280" }}
        >
          Entity
        </p>
        <p className="mt-0.5 text-sm font-medium" style={{ color: "#0B1220" }}>
          Northern Energy Grid
        </p>
      </div>
      <div
        className="h-px w-full mb-4"
        style={{ backgroundColor: "#E5E7EB" }}
        aria-hidden
      />
      <div className="space-y-3">
        {ROWS.map(({ label, value, status }) => (
          <div
            key={label}
            className="flex items-center justify-between gap-4 text-[11px]"
          >
            <span
              className="uppercase tracking-[0.12em] shrink-0"
              style={{ color: "#6B7280" }}
            >
              {label}:
            </span>
            <span
              className="tabular-nums font-medium shrink-0 text-right"
              style={{
                color:
                  status === "verified"
                    ? "#166534"
                    : "#0B1220",
              }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
