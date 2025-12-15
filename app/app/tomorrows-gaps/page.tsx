"use client";

import { WhatToFixSummary } from "@/components/WhatToFixSummary";
import { getCriticalGaps, getTrainingPriorities, getOverstaffedSkills } from "@/services/competenceService";

export default function TomorrowsGapsPage() {
  // TODO: Replace with actual data from API/database
  const gapsData = [
    { line_name: "Pressline 1", role_name: "Operator – Night", skill_name: "PRESS_A", missing: 2 },
    { line_name: "Assembly", role_name: "Technician – Day", skill_name: "5S", missing: 1 },
  ];

  const skillStats = {
    "5S": { level_0: 2, level_1: 3, level_3: 1, level_4: 0 },
    "TRUCK_A1": { level_0: 1, level_1: 2, level_3: 0, level_4: 0 },
    "SAFETY_BASIC": { level_0: 0, level_1: 0, level_3: 2, level_4: 2 },
  };

  const criticalGaps = getCriticalGaps(gapsData);
  const trainingPriorities = getTrainingPriorities(skillStats);
  const overstaffedSkills = getOverstaffedSkills(skillStats);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Tomorrow&apos;s Gaps</h1>
      <WhatToFixSummary
        criticalGaps={criticalGaps}
        trainingPriorities={trainingPriorities}
        overstaffedSkills={overstaffedSkills}
      />
    </div>
  );
}
