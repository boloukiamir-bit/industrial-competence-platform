import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getOrgIdFromSession } from "@/lib/orgSession";
import type { RootCausePayload, RootCauseMissingItem, RootCauseType } from "@/types/cockpit";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase service role configuration");
  }
  return createClient(url, key);
}

function toDateOnly(input?: string | null): string {
  if (!input) return new Date().toISOString().slice(0, 10);
  return input.slice(0, 10);
}

function isDateExpired(value: string | null | undefined, referenceDate: string) {
  return Boolean(value && value.slice(0, 10) < referenceDate);
}

function recommendedActionsFor(type: RootCauseType): RootCausePayload["recommended_actions"] {
  if (type === "competence") return ["swap", "assign"];
  if (type === "cert" || type === "medical") return ["assign", "call_in"];
  return ["fix_data", "escalate"];
}

type AssignmentRow = {
  id: string;
  org_id: string;
  station_id: string;
  employee_id?: string | null;
  assignment_date: string;
  station?: { id: string; name?: string | null };
  shift?: { shift_date?: string | null };
};

async function loadAssignment(
  supabaseAdmin: ReturnType<typeof getServiceClient>,
  orgId: string,
  shiftAssignmentId: string
): Promise<AssignmentRow | null> {
  const { data, error } = await supabaseAdmin
    .from("shift_assignments")
    .select(
      `
        id,
        org_id,
        station_id,
        employee_id,
        assignment_date,
        station:station_id(id, name),
        shift:shift_id(shift_date)
      `
    )
    .eq("org_id", orgId)
    .eq("id", shiftAssignmentId)
    .maybeSingle();

  if (error) {
    console.error("root-cause: failed to load assignment", error);
    throw error;
  }

  return (data as AssignmentRow | null) ?? null;
}

async function computeRootCause(options: {
  supabaseAdmin: ReturnType<typeof getServiceClient>;
  assignment: AssignmentRow;
  referenceDate: string;
}): Promise<RootCausePayload> {
  const { supabaseAdmin, assignment, referenceDate } = options;
  const stationId = assignment.station_id;
  const stationName = assignment.station?.name ?? "Station";
  const employeeId = assignment.employee_id;

  if (!employeeId) {
    return {
      type: "data",
      message: "No employee assigned to this station",
      blocking: true,
      details: {
        station_id: stationId,
        station_name: stationName,
        employee_id: null,
      },
      missing: [
        { kind: "skill", code: "assignment", label: "Assignment missing" },
      ],
      recommended_actions: ["assign", "call_in"],
    };
  }

  const [requirementsRes, empCompetencesRes, complianceRes, medicalEventsRes, trainingEventsRes] =
    await Promise.all([
      supabaseAdmin
        .from("station_role_requirements")
        .select("skill_id, required_level, is_mandatory")
        .eq("station_id", stationId)
        .eq("org_id", assignment.org_id),
      supabaseAdmin
        .from("employee_competences")
        .select("competence_id, level, valid_to")
        .eq("employee_id", employeeId),
      supabaseAdmin
        .from("compliance_items")
        .select("id, type, title, expiry_date, status")
        .eq("employee_id", employeeId)
        .eq("org_id", assignment.org_id),
      supabaseAdmin
        .from("person_events")
        .select("id, title, due_date, status, category")
        .eq("employee_id", employeeId)
        .eq("category", "medical_check")
        .lte("due_date", referenceDate)
        .neq("status", "completed"),
      supabaseAdmin
        .from("person_events")
        .select("id, title, due_date, status, category")
        .eq("employee_id", employeeId)
        .eq("category", "training")
        .lte("due_date", referenceDate)
        .neq("status", "completed"),
    ]);

  const empCompetences = (empCompetencesRes.data || []) as Array<{
    competence_id: string;
    level: number | null;
    valid_to?: string | null;
  }>;

  const requirements = (requirementsRes.data || []) as Array<{
    skill_id?: string | null;
    required_level?: number | null;
    is_mandatory?: boolean | null;
  }>;

  const complianceItems = (complianceRes.data || []) as Array<{
    id: string;
    type: string;
    title: string;
    expiry_date?: string | null;
    status?: string | null;
  }>;

  const medicalEvents = (medicalEventsRes.data || []) as Array<{
    id: string;
    title: string;
    due_date: string;
  }>;

  const trainingEvents = (trainingEventsRes.data || []) as Array<{
    id: string;
    title: string;
    due_date: string;
  }>;

  const requirementIds = requirements
    .map((r) => r.skill_id)
    .filter((id): id is string => Boolean(id));

  let competenceMap = new Map<string, { id: string; name?: string | null; code?: string | null }>();
  if (requirementIds.length > 0) {
    const { data: comps } = await supabaseAdmin
      .from("competences")
      .select("id, name, code")
      .in("id", requirementIds);
    competenceMap = new Map(
      (comps || []).map((c: any) => [c.id as string, { id: c.id as string, name: c.name, code: c.code }])
    );
  }

  const empCompMap = new Map(
    empCompetences.map((c) => [c.competence_id, { level: c.level, valid_to: c.valid_to ?? null }])
  );

  const missing: RootCauseMissingItem[] = [];

  for (const req of requirements) {
    const compId = req.skill_id;
    if (!compId) continue;
    const compInfo = competenceMap.get(compId);
    const empComp = empCompMap.get(compId);
    const requiredLevel = req.required_level ?? undefined;

    if (!empComp) {
      missing.push({
        kind: "skill",
        code: compInfo?.code || compId,
        label: compInfo?.name || "Required skill",
        required_level: requiredLevel,
      });
      continue;
    }

    if (typeof requiredLevel === "number" && empComp.level !== null && empComp.level < requiredLevel) {
      missing.push({
        kind: "skill",
        code: compInfo?.code || compId,
        label: compInfo?.name || "Required skill",
        required_level: requiredLevel,
        employee_level: empComp.level ?? undefined,
        valid_until: empComp.valid_to,
      });
    }

    if (isDateExpired(empComp.valid_to, referenceDate)) {
      missing.push({
        kind: "cert",
        code: compInfo?.code || compId,
        label: `${compInfo?.name || "Certification"} expired`,
        valid_until: empComp.valid_to,
      });
    }
  }

  const expiredCompliance = complianceItems.filter(
    (c) => c.status === "expired" || isDateExpired(c.expiry_date, referenceDate)
  );

  const hasMedical = medicalEvents.length > 0;

  if (
    requirements.length === 0 &&
    !hasMedical &&
    expiredCompliance.length === 0 &&
    trainingEvents.length === 0
  ) {
    return {
      type: "data",
      message: "Missing requirements data",
      blocking: false,
      details: { station_id: stationId, station_name: stationName, employee_id: employeeId },
      missing: [],
      recommended_actions: ["fix_data"],
    } as unknown as RootCausePayload;
  }

  let rootCauseType: RootCauseType = "data";
  let rootCauseMessage = "Root cause not yet classified";

  if (hasMedical) {
    rootCauseType = "medical";
    rootCauseMessage = medicalEvents[0]?.title
      ? `Medical check due: ${medicalEvents[0].title}`
      : "Medical check overdue";
    missing.push({
      kind: "medical",
      code: "medical_check",
      label: medicalEvents[0]?.title || "Medical check",
      valid_until: medicalEvents[0]?.due_date,
    });
  } else if (expiredCompliance.length > 0 || trainingEvents.length > 0) {
    rootCauseType = "cert";
    const first = expiredCompliance[0] || trainingEvents[0];
    rootCauseMessage =
      expiredCompliance.length > 0
        ? `${expiredCompliance.length} certification item(s) expired`
        : "Training action due";

    expiredCompliance.forEach((c) =>
      missing.push({
        kind: "cert",
        code: c.type || c.id,
        label: c.title || "Certification",
        valid_until: c.expiry_date ?? null,
      })
    );

    trainingEvents.forEach((e) =>
      missing.push({
        kind: "cert",
        code: "training",
        label: e.title || "Training",
        valid_until: e.due_date,
      })
    );

    if (!missing.length && first) {
      missing.push({
        kind: "cert",
        code: "cert",
        label: "Certification gap",
      });
    }
  } else if (missing.some((m) => m.kind === "skill")) {
    rootCauseType = "competence";
    rootCauseMessage = "Employee lacks required competence";
  }

  return {
    type: rootCauseType,
    message: rootCauseMessage || "Root cause not yet classified",
    blocking: true,
    details: {
      station_id: stationId,
      station_name: stationName,
      employee_id: employeeId,
    },
    missing: missing.length > 0 ? missing : [],
    recommended_actions: recommendedActionsFor(rootCauseType),
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await getOrgIdFromSession(request);
    if (!session.success) {
      return NextResponse.json({ error: session.error }, { status: session.status });
    }

    const supabaseAdmin = getServiceClient();
    const body = await request.json().catch(() => ({}));
    const shiftAssignmentId = body?.shift_assignment_id as string | undefined;

    if (!shiftAssignmentId) {
      return NextResponse.json({ error: "shift_assignment_id is required" }, { status: 400 });
    }

    const assignment = await loadAssignment(supabaseAdmin, session.orgId, shiftAssignmentId);
    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    const referenceDate = toDateOnly(assignment.shift?.shift_date || assignment.assignment_date);
    const rootCause = await computeRootCause({ supabaseAdmin, assignment, referenceDate });

    return NextResponse.json({ root_cause: rootCause });
  } catch (error) {
    console.error("root-cause endpoint error:", error);
    return NextResponse.json(
      { error: "Failed to determine root cause" },
      { status: 500 }
    );
  }
}
