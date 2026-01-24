"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import type { ShiftType } from "@/types/lineOverview";
import { useOrgState } from "@/hooks/useOrg";
import { NoGoResolveDrawer, type ShiftAssignmentRow } from "@/components/NoGoResolveDrawer";
import { supabase } from "@/lib/supabaseClient";
import { apiPost } from "@/lib/apiClient";

const stationName = (a: ShiftAssignmentRow) => a.stations?.[0]?.name ?? "";

export function ExecutionDecisionPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedShift, setSelectedShift] = useState<ShiftType>("Day");
  const [selectedLine, setSelectedLine] = useState<string>("");
  const [lines, setLines] = useState<string[]>([]);
  const [shiftAssignments, setShiftAssignments] = useState<ShiftAssignmentRow[]>([]);
  
  // Default to tomorrow (local time)
  const getTomorrowDate = (): string => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    // Format as YYYY-MM-DD in local timezone
    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const day = String(tomorrow.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  
  const [selectedDate, setSelectedDate] = useState<string>(() => getTomorrowDate());
  const { currentOrg } = useOrgState();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedShiftAssignmentId, setSelectedShiftAssignmentId] = useState<string | null>(null);
  const [selectedShiftAssignment, setSelectedShiftAssignment] = useState<ShiftAssignmentRow | null>(null);
  const [resolvedByTargetId, setResolvedByTargetId] = useState<Map<string, string>>(new Map());
  
  const isDev = typeof window !== "undefined" && process.env.NODE_ENV === "development";

  // Load lines from stations
  useEffect(() => {
    async function loadLines() {
      if (!currentOrg?.id) return;
      
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("active_org_id")
          .single();
        
        const orgId = profile?.active_org_id || currentOrg.id;
        
        const { data, error } = await supabase
          .from("stations")
          .select("line")
          .eq("org_id", orgId)
          .not("line", "is", null)
          .order("line");
        
        if (error) throw error;
        
        // Get unique lines and filter out "Assembly" as per requirements
        const uniqueLines = [...new Set((data || []).map((s: any) => s.line).filter(Boolean))]
          .filter((line: string) => line !== "Assembly");
        setLines(uniqueLines);
        
        if (uniqueLines.length > 0 && !selectedLine) {
          setSelectedLine(uniqueLines[0]);
        }
      } catch (err) {
        console.error("Failed to load lines:", err);
      }
    }
    loadLines();
  }, [currentOrg?.id, selectedLine]);

  // Load shift assignments when date/shift/line changes
  useEffect(() => {
    async function loadShiftAssignments() {
      if (!selectedLine || !currentOrg?.id) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("active_org_id")
          .single();
        
        const orgId = profile?.active_org_id || currentOrg.id;
        
        // Ensure shift context first
        await apiPost("/api/shift-context/ensure", {
          shift_date: selectedDate,
          shift_type: selectedShift,
          line: selectedLine,
        });
        
        // Find shift_id by shift_date, shift_type, and line
        const { data: shiftData } = await supabase
          .from("shifts")
          .select("id")
          .eq("org_id", orgId)
          .eq("shift_date", selectedDate)
          .eq("shift_type", selectedShift)
          .eq("line", selectedLine)
          .single();
        
        if (!shiftData?.id) {
          throw new Error("Shift not found. Ensure shift context was created.");
        }
        
        // Load shift_assignments for this line
        // First get station IDs for this line
        const { data: stationsData } = await supabase
          .from("stations")
          .select("id")
          .eq("org_id", orgId)
          .eq("line", selectedLine)
          .eq("is_active", true);
        
        if (!stationsData || stationsData.length === 0) {
          setShiftAssignments([]);
          setLoading(false);
          return;
        }
        
        const stationIds = stationsData.map((s: any) => s.id);
        
        // Load shift_assignments
        const { data: assignments, error } = await supabase
          .from("shift_assignments")
          .select("id, station_id, employee_id, shift_id, stations(name)")
          .eq("org_id", orgId)
          .eq("shift_id", shiftData.id)
          .in("station_id", stationIds)
          .eq("assignment_date", selectedDate);
        
        if (error) throw error;
        
        setShiftAssignments((assignments || []) as ShiftAssignmentRow[]);
        
        // Load resolved status
        if (assignments && assignments.length > 0) {
          const targetIds = assignments.map((a: any) => a.id);
          const { data: resolvedData } = await supabase
            .from("execution_decisions")
            .select("target_id, created_at")
            .eq("decision_type", "resolve_no_go")
            .eq("target_type", "shift_assignment")
            .eq("status", "active")
            .in("target_id", targetIds)
            .order("created_at", { ascending: false });
          
          const resolvedMap = new Map<string, string>();
          if (resolvedData) {
            for (const row of resolvedData) {
              if (!resolvedMap.has(row.target_id)) {
                resolvedMap.set(row.target_id, row.created_at);
              }
            }
          }
          setResolvedByTargetId(resolvedMap);
        }
      } catch (err) {
        console.error("Failed to load shift assignments:", err);
        setError(err instanceof Error ? err.message : "Failed to load shift assignments");
        setShiftAssignments([]);
      } finally {
        setLoading(false);
      }
    }
    
    loadShiftAssignments();
  }, [selectedDate, selectedShift, selectedLine, currentOrg?.id]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const handleRowClick = (assignment: ShiftAssignmentRow) => {
    setSelectedShiftAssignmentId(assignment.id);
    setSelectedShiftAssignment(assignment);
    setDrawerOpen(true);
  };

  // Show loading state only when actually loading
  if (loading) {
    return (
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="px-6 py-4">
          <div className="animate-pulse text-sm text-gray-500">Loading execution status...</div>
        </div>
      </section>
    );
  }

  // If error occurred, show error message
  if (error) {
    return (
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Execution Decision
              </h2>
            </div>
          </div>
        </div>
        <div className="px-6 py-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      </section>
    );
  }

  const resolvedCount = Array.from(resolvedByTargetId.keys()).length;
  const noGoCount = shiftAssignments.length - resolvedCount;

  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Execution Decision
            </h2>
            <div className="flex items-center gap-2 text-sm">
              <span className="flex items-center gap-1 text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                {resolvedCount} Resolved
              </span>
              {noGoCount > 0 && (
                <span className="flex items-center gap-1 text-red-700 dark:text-red-400">
                  <XCircle className="h-4 w-4" />
                  {noGoCount} NO-GO
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <select
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value as ShiftType)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="Day">Day</option>
              <option value="Evening">Evening</option>
              <option value="Night">Night</option>
            </select>
            <select
              value={selectedLine}
              onChange={(e) => setSelectedLine(e.target.value)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {lines.map((line) => (
                <option key={line} value={line}>
                  {line}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-4">
            <span>Date: {formatDate(selectedDate)}</span>
            <span>Shift: {selectedShift}</span>
            {selectedLine && <span>Line: {selectedLine}</span>}
            {currentOrg?.name && <span>Site: {currentOrg.name}</span>}
          </div>
          <span>Decision owner: Operations Manager</span>
        </div>
      </div>

      {/* Scrollable list */}
      <div className="max-h-[420px] overflow-y-auto px-6 py-4 space-y-2">
        {shiftAssignments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No shift assignments found</p>
            <p className="text-xs mt-1">Select a date, shift, and line to view assignments</p>
          </div>
        ) : (
          shiftAssignments.map((assignment) => {
            const isResolved = resolvedByTargetId.has(assignment.id);
            const resolvedAt = resolvedByTargetId.get(assignment.id);

            return (
              <div
                key={assignment.id}
                className={`border rounded-lg ${
                  isResolved
                    ? "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30"
                    : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30"
                }`}
                onClick={() => handleRowClick(assignment)}
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {isResolved ? (
                        <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                      )}
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {isResolved ? "Resolved" : "NO-GO"}
                      </span>
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      {assignment.stations?.[0]?.name || "Unknown Station"} • {selectedShift}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isResolved && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        Resolved
                      </span>
                    )}
                    {!isResolved && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                        NO-GO
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <NoGoResolveDrawer
        open={drawerOpen}
        onClose={async (wasResolved) => {
          setDrawerOpen(false);
          setSelectedShiftAssignmentId(null);
          setSelectedShiftAssignment(null);
          // Reload shift assignments if resolved
          if (wasResolved && selectedLine && currentOrg?.id) {
            try {
              const { data: profile } = await supabase
                .from("profiles")
                .select("active_org_id")
                .single();
              
              const orgId = profile?.active_org_id || currentOrg.id;
              
              const { data: shiftData } = await supabase
                .from("shifts")
                .select("id")
                .eq("org_id", orgId)
                .eq("shift_date", selectedDate)
                .eq("shift_type", selectedShift)
                .eq("line", selectedLine)
                .single();
              
              if (shiftData?.id) {
                const { data: stationsData } = await supabase
                  .from("stations")
                  .select("id")
                  .eq("org_id", orgId)
                  .eq("line", selectedLine)
                  .eq("is_active", true);
                
                if (stationsData && stationsData.length > 0) {
                  const stationIds = stationsData.map((s: any) => s.id);
                  const { data: assignments } = await supabase
                    .from("shift_assignments")
                    .select("id, station_id, employee_id, shift_id, stations(name)")
                    .eq("org_id", orgId)
                    .eq("shift_id", shiftData.id)
                    .in("station_id", stationIds)
                    .eq("assignment_date", selectedDate);
                  
                  setShiftAssignments((assignments || []) as ShiftAssignmentRow[]);
                  
                  // Reload resolved status
                  if (assignments && assignments.length > 0) {
                    const targetIds = assignments.map((a: any) => a.id);
                    const { data: resolvedData } = await supabase
                      .from("execution_decisions")
                      .select("target_id, created_at")
                      .eq("decision_type", "resolve_no_go")
                      .eq("target_type", "shift_assignment")
                      .eq("status", "active")
                      .in("target_id", targetIds)
                      .order("created_at", { ascending: false });
                    
                    const resolvedMap = new Map<string, string>();
                    if (resolvedData) {
                      for (const row of resolvedData) {
                        if (!resolvedMap.has(row.target_id)) {
                          resolvedMap.set(row.target_id, row.created_at);
                        }
                      }
                    }
                    setResolvedByTargetId(resolvedMap);
                  }
                }
              }
            } catch (err) {
              console.error("Failed to reload after resolve:", err);
            }
          }
        }}
        shiftAssignmentId={selectedShiftAssignmentId}
        shiftAssignment={selectedShiftAssignment}
        date={selectedDate}
        shiftType={selectedShift}
        line={selectedLine}
      />
    </section>
  );
}
