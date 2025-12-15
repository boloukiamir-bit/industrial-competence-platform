"use client";

import { useEffect, useState } from "react";
import { WhatToFixSummary } from "@/components/WhatToFixSummary";
import { 
  calculateTomorrowsGaps, 
  getCriticalGapsFromItems, 
  getTrainingPriorities, 
  getOverstaffedSkills,
  getSkillStats 
} from "@/services/gaps";
import type { GapItem } from "@/types/domain";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function TomorrowsGapsPage() {
  const [gaps, setGaps] = useState<GapItem[]>([]);
  const [criticalGaps, setCriticalGaps] = useState<{ line: string; role: string; skill: string; missingCount: number }[]>([]);
  const [trainingPriorities, setTrainingPriorities] = useState<{ skill: string; countLevel0or1: number }[]>([]);
  const [overstaffedSkills, setOverstaffedSkills] = useState<{ skill: string; countLevel3or4: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      
      const gapsData = await calculateTomorrowsGaps();
      setGaps(gapsData);
      
      const critical = getCriticalGapsFromItems(gapsData);
      setCriticalGaps(critical);
      
      const skillStats = await getSkillStats();
      const training = getTrainingPriorities(skillStats);
      const overstaffed = getOverstaffedSkills(skillStats);
      
      setTrainingPriorities(training);
      setOverstaffedSkills(overstaffed);
      
      setLoading(false);
    }
    
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Tomorrow&apos;s Gaps</h1>

      <WhatToFixSummary
        criticalGaps={criticalGaps}
        trainingPriorities={trainingPriorities}
        overstaffedSkills={overstaffedSkills}
      />

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Detailed Gap Analysis</h2>
        
        {gaps.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No competence gaps detected. All skill requirements are met.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {gaps.map((gap, index) => (
              <Card key={index} data-testid={`card-gap-${index}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-base">{gap.skillName}</CardTitle>
                    <Badge variant="destructive">
                      Missing: {gap.missingCount}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Line:</span>
                      <p className="font-medium">{gap.line}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Role:</span>
                      <p className="font-medium">{gap.role}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Required Level:</span>
                      <p className="font-medium">{gap.requiredLevel}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Current Avg:</span>
                      <p className="font-medium">{gap.currentAvgLevel}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
