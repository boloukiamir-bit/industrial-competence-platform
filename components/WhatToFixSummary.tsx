import React from "react";

type GapItem = {
  line: string;
  role: string;
  skill: string;
  missingCount: number;
};

type TrainingItem = {
  skill: string;
  countLevel0or1: number;
};

type OverstaffedItem = {
  skill: string;
  countLevel3or4: number;
};

type WhatToFixSummaryProps = {
  criticalGaps: GapItem[];
  trainingPriorities: TrainingItem[];
  overstaffedSkills: OverstaffedItem[];
};

export const WhatToFixSummary: React.FC<WhatToFixSummaryProps> = ({
  criticalGaps,
  trainingPriorities,
  overstaffedSkills,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* Critical Gaps */}
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <h3 className="font-semibold text-red-800 mb-2">Critical Gaps</h3>
        {criticalGaps.length === 0 && (
          <p className="text-sm text-red-700">
            Inga kritiska gaps för imorgon.
          </p>
        )}
        {criticalGaps.slice(0, 5).map((g, idx) => (
          <div key={idx} className="text-xs text-red-900 mb-1">
            <span className="font-semibold">{g.line}</span>
            {" – "}
            <span>{g.role}</span>
            {": "}
            <span>{g.skill}</span>
            {" (saknas "}
            <span className="font-semibold">{g.missingCount}</span>
            {")"}
          </div>
        ))}
      </div>

      {/* Training Priorities */}
      <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
        <h3 className="font-semibold text-yellow-800 mb-2">
          Training Priorities
        </h3>
        {trainingPriorities.length === 0 && (
          <p className="text-sm text-yellow-700">
            Inga tydliga utbildningsbehov.
          </p>
        )}
        {trainingPriorities.slice(0, 5).map((t, idx) => (
          <div key={idx} className="text-xs text-yellow-900 mb-1">
            <span className="font-semibold">{t.skill}</span>
            {": "}
            <span>{t.countLevel0or1}</span> personer på nivå 0–1
          </div>
        ))}
      </div>

      {/* Overstaffed Skills */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <h3 className="font-semibold text-blue-800 mb-2">Overstaffed Skills</h3>
        {overstaffedSkills.length === 0 && (
          <p className="text-sm text-blue-700">
            Ingen överkapacitet identifierad.
          </p>
        )}
        {overstaffedSkills.slice(0, 5).map((o, idx) => (
          <div key={idx} className="text-xs text-blue-900 mb-1">
            <span className="font-semibold">{o.skill}</span>
            {": "}
            <span>{o.countLevel3or4}</span> personer på nivå 3–4
          </div>
        ))}
      </div>
    </div>
  );
};
