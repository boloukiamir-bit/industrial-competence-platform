/**
 * Mandatory wrapper for mutation routes. Enforces shift context (unless allowed),
 * governance gate (withGovernanceGate) always, and optional execution token verification.
 * Binds policy fingerprint + snapshot id via governance enrichment.
 * Returns NextResponse with consistent error codes: 400, 401, 403, 409, 412, 503.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { normalizeShiftParam } from "@/lib/server/normalizeShift";
import { requireGovernedMutation } from "@/lib/server/governance/firewall";
import {
  withGovernanceGate,
  type GovernanceContext,
  type GovernanceEnrichment,
} from "@/lib/server/governance/withGovernanceGate";
import { verifyExecutionToken } from "@/lib/server/governance/executionToken";
import type { ExecutionTokenPayload } from "@/lib/server/governance/executionToken";

export type { GovernanceEnrichment, ExecutionTokenPayload };

export type MutationGovernanceContext = {
  request: NextRequest;
  supabase: SupabaseClient;
  admin: SupabaseClient;
  orgId: string;
  siteId: string | null;
  userId: string;
  body: Record<string, unknown>;
  date?: string;
  shift_code?: string;
  governance?: GovernanceEnrichment;
  executionTokenPayload?: ExecutionTokenPayload;
  pendingCookies: { name: string; value: string; options?: Record<string, unknown> }[];
};

export type MutationGovernanceOptions = {
  /** Route path for firewall and meta (e.g. "/api/cockpit/decisions"). */
  route: string;
  /** Action for governance context (e.g. "COCKPIT_DECISION_CREATE"). */
  action: string;
  /** Target type for governance context (e.g. "line_shift"). */
  target_type: string;
  /** If true, shift context (date + shift_code) is not required; org-only gate. */
  allowNoShiftContext?: boolean;
  /** If true, body.execution_token is required and verified. */
  requireExecutionToken?: boolean;
  /** When requireExecutionToken, allowed_actions must include this (e.g. "COCKPIT_DECISION_CREATE"). */
  executionTokenAction?: string;
  /**
   * Body key for shift code (default "shift_code"). Use "shift" for routes that send shift in "shift".
   */
  shiftCodeKey?: string;
  /**
   * Build target_id and meta for governance context from body and shift.
   * Required when allowNoShiftContext is false; optional otherwise (uses fallback).
   */
  getTargetIdAndMeta?: (
    body: Record<string, unknown>,
    shift: { date?: string; shift_code?: string }
  ) => { target_id: string; meta: Record<string, unknown> };
};

function getAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const GOVERNED_HEADER = "x-bcledge-governed";
const FINGERPRINT_HEADER = "x-bcledge-policy-fingerprint";
const SNAPSHOT_ID_HEADER = "x-bcledge-snapshot-id";

/** Set governance proof headers on a response. Always set x-bcledge-governed=1; add fingerprint/snapshot if present. Never throws. */
function setGovernanceHeaders(
  res: NextResponse,
  governance?: GovernanceEnrichment | null
): void {
  res.headers.set(GOVERNED_HEADER, "1");
  if (governance?.policy_fingerprint != null && governance.policy_fingerprint !== "") {
    res.headers.set(FINGERPRINT_HEADER, governance.policy_fingerprint);
  }
  if (governance?.snapshot_id != null && governance.snapshot_id !== "") {
    res.headers.set(SNAPSHOT_ID_HEADER, governance.snapshot_id);
  }
}

function jsonResponse(
  payload: Record<string, unknown>,
  status: number,
  pendingCookies: MutationGovernanceContext["pendingCookies"],
  governance?: GovernanceEnrichment | null
): NextResponse {
  const res = NextResponse.json(payload, { status });
  setGovernanceHeaders(res, governance);
  applySupabaseCookies(res, pendingCookies);
  return res;
}

/**
 * Wraps a mutation handler with mandatory governance: auth, org, firewall, optional shift context,
 * optional execution token, withGovernanceGate, then handler(ctx). Handler returns NextResponse
 * or a result; wrapper applies cookies and returns NextResponse.
 */
export function withMutationGovernance(
  handler: (ctx: MutationGovernanceContext) => Promise<NextResponse>,
  options: MutationGovernanceOptions
): (request: NextRequest) => Promise<NextResponse> {
  const {
    route,
    action,
    target_type,
    allowNoShiftContext = false,
    requireExecutionToken = false,
    executionTokenAction,
    shiftCodeKey = "shift_code",
    getTargetIdAndMeta,
  } = options;

  return async function wrapped(request: NextRequest): Promise<NextResponse> {
    const { supabase, pendingCookies } = await createSupabaseServerClient(request);
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const status = org.status as 400 | 401 | 403;
      const code = status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN";
      return jsonResponse(
        { ok: false, error: org.error, code },
        status,
        pendingCookies,
        undefined
      );
    }

    const admin = getAdmin();
    const fw = requireGovernedMutation({
      admin,
      governed: true,
      context: { route, action },
    });
    if (!fw.ok) {
      return jsonResponse(
        fw.body as Record<string, unknown>,
        fw.status,
        pendingCookies,
        undefined
      );
    }

    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return jsonResponse(
        { ok: false, error: "Invalid JSON body", code: "BAD_REQUEST" },
        400,
        pendingCookies,
        undefined
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const bodyDate = typeof body.date === "string" ? body.date.trim() || null : null;
    const bodyShiftVal =
      typeof body[shiftCodeKey] === "string" ? (body[shiftCodeKey] as string).trim() || null : null;
    const bodyShiftCode =
      shiftCodeKey === "shift_code"
        ? (typeof body.shift_code === "string" ? body.shift_code.trim() || null : null)
        : bodyShiftVal;
    const queryDate = searchParams.get("date")?.trim() || null;
    const queryShiftCode = searchParams.get("shift_code")?.trim() || null;
    const dateParam = bodyDate ?? queryDate;
    const shiftCodeParam = bodyShiftCode ?? bodyShiftVal ?? queryShiftCode;

    let date: string | undefined;
    let shift_code: string | undefined;

    if (!allowNoShiftContext) {
      const hasDate = dateParam != null && dateParam !== "";
      const hasShiftCode = shiftCodeParam != null && shiftCodeParam !== "";
      if (!hasDate || !hasShiftCode) {
        return jsonResponse(
          {
            ok: false,
            error: {
              kind: "GOVERNANCE",
              code: "SHIFT_CONTEXT_REQUIRED",
              message: "date and shift_code are required for this action.",
            },
          },
          400,
          pendingCookies,
          undefined
        );
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam!)) {
        return jsonResponse(
          {
            ok: false,
            error: {
              kind: "GOVERNANCE",
              code: "SHIFT_CONTEXT_INVALID",
              message: "date must be YYYY-MM-DD.",
            },
          },
          400,
          pendingCookies,
          undefined
        );
      }
      const normalized = normalizeShiftParam(shiftCodeParam!);
      if (normalized == null || normalized === "") {
        return jsonResponse(
          {
            ok: false,
            error: {
              kind: "GOVERNANCE",
              code: "SHIFT_CONTEXT_INVALID",
              message: "Invalid shift_code.",
            },
          },
          400,
          pendingCookies,
          undefined
        );
      }
      date = dateParam!;
      shift_code = normalized;
    }

    let executionTokenPayload: ExecutionTokenPayload | undefined;
    if (requireExecutionToken) {
      const raw =
        typeof body.execution_token === "string" ? body.execution_token.trim() || null : null;
      if (!raw) {
        return jsonResponse(
          {
            ok: false,
            error: { kind: "RUNTIME", code: "MISSING_EXECUTION_TOKEN" },
          },
          400,
          pendingCookies,
          undefined
        );
      }
      const verification = verifyExecutionToken(raw);
      if (!verification.valid) {
        const code =
          verification.error?.code === "TOKEN_EXPIRED"
            ? "EXECUTION_TOKEN_EXPIRED"
            : "INVALID_EXECUTION_TOKEN";
        return jsonResponse(
          { ok: false, error: { kind: "RUNTIME", code } },
          400,
          pendingCookies,
          undefined
        );
      }
      executionTokenPayload = verification.payload;
      if (
        executionTokenAction &&
        Array.isArray(executionTokenPayload?.allowed_actions) &&
        !executionTokenPayload.allowed_actions.includes(executionTokenAction)
      ) {
        return jsonResponse(
          { ok: false, error: { kind: "RUNTIME", code: "TOKEN_ACTION_NOT_ALLOWED" } },
          409,
          pendingCookies,
          undefined
        );
      }
    }

    const shiftForTarget = { date, shift_code };
    const { target_id, meta } = getTargetIdAndMeta
      ? getTargetIdAndMeta(body, shiftForTarget)
      : { target_id: "unknown", meta: { route } as Record<string, unknown> };

    const context: GovernanceContext = {
      action,
      target_type,
      target_id,
      meta: { ...meta, route },
      ...(date != null && { date }),
      ...(shift_code != null && { shift_code }),
    };

    const result = await withGovernanceGate({
      supabase,
      admin: admin!,
      orgId: org.activeOrgId,
      siteId: org.activeSiteId,
      context,
      handler: async (governance) => {
        const ctx: MutationGovernanceContext = {
          request,
          supabase,
          admin: admin!,
          orgId: org.activeOrgId,
          siteId: org.activeSiteId,
          userId: org.userId,
          body,
          date,
          shift_code,
          governance,
          executionTokenPayload,
          pendingCookies,
        };
        return handler(ctx);
      },
    });

    if (!result.ok) {
      const status = result.status as 400 | 403 | 412;
      const code =
        status === 412
          ? "GOVERNANCE_BLOCKED"
          : (result.error as { code?: string })?.code ?? "GOVERNANCE_ERROR";
      return jsonResponse(
        { ok: false, error: result.error, code },
        status,
        pendingCookies,
        undefined
      );
    }

    const response = result.data as NextResponse;
    setGovernanceHeaders(response, result.governance);
    applySupabaseCookies(response, pendingCookies);
    return response;
  };
}
