import { WhatToFixSummary } from "../../components/WhatToFixSummary";

const mockCriticalGaps = [
  {
    line: "Pressline 1",
    role: "Operator – Night",
    skill: "PRESS_A",
    missingCount: 2,
  },
  { line: "Assembly", role: "Technician – Day", skill: "5S", missingCount: 1 },
];

const mockTrainingPriorities = [
  { skill: "5S", countLevel0or1: 5 },
  { skill: "TRUCK_A1", countLevel0or1: 3 },
];

const mockOverstaffedSkills = [{ skill: "SAFETY_BASIC", countLevel3or4: 4 }];

export default function TomorrowsGapsPage() {
  const mockCriticalGaps = [
    {
      line: "Pressline 1",
      role: "Operator – Night",
      skill: "PRESS_A",
      missingCount: 2,
    },
    {
      line: "Assembly",
      role: "Technician – Day",
      skill: "5S",
      missingCount: 1,
    },
  ];

  const mockTrainingPriorities = [
    { skill: "5S", countLevel0or1: 5 },
    { skill: "TRUCK_A1", countLevel0or1: 3 },
  ];

  const mockOverstaffedSkills = [{ skill: "SAFETY_BASIC", countLevel3or4: 4 }];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Tomorrow&apos;s Gaps</h1>
      <WhatToFixSummary
        criticalGaps={mockCriticalGaps}
        trainingPriorities={mockTrainingPriorities}
        overstaffedSkills={mockOverstaffedSkills}
      />
    </div>
  );
}
