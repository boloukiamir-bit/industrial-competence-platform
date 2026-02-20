/**
 * Mutation Perimeter Audit: detects execution-critical API routes that mutate data
 * and verifies governance enforcement. Read-only; does not modify any code.
 *
 * Scans app/api/.../route.ts (recursive) for POST/PATCH/PUT/DELETE and reports:
 * - shift-context enforcement (normalizeShiftParam, SHIFT_CONTEXT_REQUIRED, or similar)
 * - governance gate usage (withGovernanceGate or withMutationGovernance)
 * - execution token validation logic
 *
 * Output: structured JSON with risk levels (HIGH = no governance, MEDIUM = governance no shift-context, LOW = fully enforced).
 *
 * Optional --live: dev-only smoke check. Calls 2 governed endpoints with safe invalid payloads;
 * expects 4xx and x-bcledge-governed: 1. No real mutations.
 */
import * as fs from "fs/promises";
import * as path from "path";

const GOVERNED_HEADER = "x-bcledge-governed";

const ROOT = process.cwd();
const API_DIR = path.join(ROOT, "app", "api");
const IGNORE_DIRS = new Set(["node_modules", ".next", "supabase", "dist", "build"]);

/** Match export async function POST/PUT/PATCH/DELETE or export const POST = ... */
const RE_MUTATORS =
  /export\s+(?:async\s+)?function\s+(POST|PUT|PATCH|DELETE)\b|export\s+const\s+(POST|PUT|PATCH|DELETE)\s*=/g;

/** Shift-context: normalizeShiftParam, SHIFT_CONTEXT_REQUIRED, context.shiftId/date/shift_code, or withMutationGovernance (enforces shift unless allowNoShiftContext: true) */
const RE_SHIFT_CONTEXT =
  /normalizeShiftParam|SHIFT_CONTEXT_REQUIRED|context\.(shiftId|shift_code|date)/;
/** withMutationGovernance without allowNoShiftContext: true means wrapper enforces shift context */
const RE_MUTATION_GOV_WITH_SHIFT = /withMutationGovernance\s*\(/;
const RE_ALLOW_NO_SHIFT = /allowNoShiftContext\s*:\s*true/;

/** Governance gate: withGovernanceGate or withMutationGovernance */
const RE_GOVERNANCE = /withGovernanceGate\s*\(|withMutationGovernance\s*\(/;

/** Execution token: verifyExecutionToken, execution_token, require_execution_token */
const RE_EXECUTION_TOKEN =
  /verifyExecutionToken|execution_token|require_execution_token|executionToken/;

type RiskLevel = "HIGH" | "MEDIUM" | "LOW";

interface RouteEntry {
  path: string;
  methods: string[];
  shift_context_enforced: boolean;
  governance_enforced: boolean;
  execution_token_required: boolean;
  risk_level: RiskLevel;
}

interface AuditReport {
  mutations_total: number;
  routes: RouteEntry[];
}

/** Business blast-radius scoring: [keyword, points]. Path is lowercased; each match adds points. */
const BLAST_RADIUS_SCORE: [string, number][] = [
  ["cockpit", 100],
  ["decisions", 100],
  ["execution", 100],
  ["governance", 100],
  ["shift_assignments", 100],
  ["shift", 100],
  ["assign", 100],
  ["roster", 100],
  ["compliance", 60],
  ["requirements", 60],
  ["hr", 40],
  ["templates", 40],
  ["import", 40],
  ["employees", 20],
  ["stations", 20],
  ["skills", 20],
];

interface HitlistItem {
  path: string;
  methods: string[];
  risk_level: "HIGH";
  score: number;
  why: string[];
}

function scoreRoutePath(routePath: string): { score: number; why: string[] } {
  const lower = routePath.toLowerCase();
  let score = 0;
  const why: string[] = [];
  for (const [keyword, points] of BLAST_RADIUS_SCORE) {
    if (lower.includes(keyword)) {
      score += points;
      why.push(keyword);
    }
  }
  return { score, why };
}

function normalizePath(absPath: string): string {
  const rel = path.relative(ROOT, absPath);
  return rel.split(path.sep).join("/");
}

async function findRouteFiles(dir: string, acc: string[]): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!IGNORE_DIRS.has(e.name)) await findRouteFiles(full, acc);
    } else if (e.name === "route.ts" && full.startsWith(API_DIR)) {
      acc.push(full);
    }
  }
  return acc;
}

function collectMutatingMethods(content: string): string[] {
  const methods = new Set<string>();
  let m: RegExpExecArray | null;
  RE_MUTATORS.lastIndex = 0;
  while ((m = RE_MUTATORS.exec(content)) !== null) {
    const method = m[1] ?? m[2];
    if (method) methods.add(method);
  }
  return [...methods].sort();
}

function computeRisk(
  governance_enforced: boolean,
  shift_context_enforced: boolean
): RiskLevel {
  if (!governance_enforced) return "HIGH";
  if (!shift_context_enforced) return "MEDIUM";
  return "LOW";
}

async function main(): Promise<void> {
  const allRoutes = await findRouteFiles(API_DIR, []);
  allRoutes.sort();

  const routes: RouteEntry[] = [];

  for (const filePath of allRoutes) {
    const content = await fs.readFile(filePath, "utf-8");
    const methods = collectMutatingMethods(content);
    if (methods.length === 0) continue;

    const hasMutationGov = RE_MUTATION_GOV_WITH_SHIFT.test(content);
    const allowNoShift = RE_ALLOW_NO_SHIFT.test(content);
    const shift_context_enforced =
      RE_SHIFT_CONTEXT.test(content) || (hasMutationGov && !allowNoShift);
    const governance_enforced = RE_GOVERNANCE.test(content);
    const execution_token_required = RE_EXECUTION_TOKEN.test(content);
    const risk_level = computeRisk(governance_enforced, shift_context_enforced);

    routes.push({
      path: normalizePath(filePath),
      methods,
      shift_context_enforced,
      governance_enforced,
      execution_token_required,
      risk_level,
    });
  }

  const report: AuditReport = {
    mutations_total: routes.length,
    routes,
  };

  console.log(JSON.stringify(report, null, 2));

  const highRoutes = routes.filter((r) => r.risk_level === "HIGH");
  const hitlistItems: HitlistItem[] = highRoutes.map((r) => {
    const { score, why } = scoreRoutePath(r.path);
    return {
      path: r.path,
      methods: r.methods,
      risk_level: "HIGH" as const,
      score,
      why,
    };
  });
  hitlistItems.sort((a, b) => b.score - a.score);
  const top20 = hitlistItems.slice(0, 20);
  console.error(JSON.stringify({ hitlist: top20 }, null, 2));

  const liveMode = process.argv.includes("--live");
  if (liveMode) {
    const baseUrl = (process.env.BASE_URL ?? "http://127.0.0.1:5001").replace(/\/$/, "");
    const bearer = process.env.DEV_BEARER_TOKEN ?? process.env.NEXT_PUBLIC_DEV_BEARER_TOKEN ?? "";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (bearer) headers["Authorization"] = `Bearer ${bearer}`;

    const liveProof: Array<{ endpoint: string; status: number; governed_header: boolean }> = [];

    // POST tomorrows-gaps/decisions with empty body -> 400 SHIFT_CONTEXT_REQUIRED, governed header
    try {
      const r = await fetch(`${baseUrl}/api/tomorrows-gaps/decisions`, {
        method: "POST",
        headers,
        body: "{}",
      });
      const governed = r.headers.get(GOVERNED_HEADER) === "1";
      liveProof.push({
        endpoint: "POST /api/tomorrows-gaps/decisions",
        status: r.status,
        governed_header: governed,
      });
    } catch (e) {
      liveProof.push({
        endpoint: "POST /api/tomorrows-gaps/decisions",
        status: 0,
        governed_header: false,
      });
    }

    // POST hr/tasks/resolve with empty body -> 400 missing fields, governed header
    try {
      const r = await fetch(`${baseUrl}/api/hr/tasks/resolve`, {
        method: "POST",
        headers,
        body: "{}",
      });
      const governed = r.headers.get(GOVERNED_HEADER) === "1";
      liveProof.push({
        endpoint: "POST /api/hr/tasks/resolve",
        status: r.status,
        governed_header: governed,
      });
    } catch (e) {
      liveProof.push({
        endpoint: "POST /api/hr/tasks/resolve",
        status: 0,
        governed_header: false,
      });
    }

    console.error("");
    console.error("live_proof (dev-only; no mutations). Requires app running at BASE_URL.");
    console.error(JSON.stringify({ live_proof: liveProof }, null, 2));

    const all4xx = liveProof.every((p) => p.status >= 400 && p.status < 500);
    const allGoverned = liveProof.every((p) => p.governed_header);
    if (!all4xx || !allGoverned) {
      console.error("live_proof failed: expect 4xx and x-bcledge-governed:1 for all probes (start dev server first).");
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error("gov_perimeter_audit error:", err);
  process.exit(1);
});
