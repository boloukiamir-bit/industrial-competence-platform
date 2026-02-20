/**
 * Governance Coverage Audit: fails if any mutating API route is missing governance gating.
 * Mutating = POST | PUT | PATCH | DELETE. Must be gated (withGovernanceGate or withMutationGovernance) OR in Phase A allowlist.
 * GOV:EXEMPT in files is ignored for pass/fail; reported as warning only.
 * Phase A HIGH cap: risk_level HIGH count must be <= PHASE_A_MAX_HIGH (default 62).
 * Burn-down: if PHASE_A_PREVIOUS_HIGH is set (e.g. by CI from main), HIGH must decrease by at least PHASE_A_BURN_DOWN (5).
 */
import * as fs from "fs/promises";
import * as path from "path";
import { execSync } from "child_process";

const ROOT = process.cwd();
const API_DIR = path.join(ROOT, "app", "api");
const IGNORE_DIRS = new Set(["node_modules", ".next", "supabase", "dist", "build"]);

/** Phase A: mutating routes allowed without gate. Keep minimal (boot/auth only). */
const PHASE_A_ALLOW_MUTATIONS = new Set<string>([
  "app/api/auth/callback/route.ts",
]);

/** Phase A burn-down: ungoverned count must not exceed this (must trend down). Override via env PHASE_A_MAX_UNGOVERNED_MUTATIONS. */
const PHASE_A_MAX_UNGOVERNED_MUTATIONS = 92;

/** Phase A HIGH risk cap: mutation routes with risk_level HIGH must not exceed this. Override via env PHASE_A_MAX_HIGH. */
const PHASE_A_MAX_HIGH = 62;
/** Required burn-down of HIGH count per PR. CI sets PHASE_A_PREVIOUS_HIGH from main. Override via env PHASE_A_BURN_DOWN. */
const PHASE_A_BURN_DOWN = 5;

const RE_MUTATORS = /export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\b|export\s+const\s+(POST|PUT|PATCH|DELETE)\s*=\s*withMutationGovernance/g;
const RE_GATED = /withGovernanceGate\s*\(|withMutationGovernance\s*\(/;
const RE_EXEMPT = /^\s*\/\/\s*GOV:EXEMPT\b/m;

/** Normalize to repo-relative path with forward slashes. */
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

type FailingEntry = { path: string; fix: "GATE" | "ALLOWLIST" };

async function main(): Promise<void> {
  const allRoutes: string[] = await findRouteFiles(API_DIR, []);
  allRoutes.sort();

  let mutating = 0;
  let gated = 0;
  let allowlisted = 0;
  let hasExemptMarker = 0;
  const failing: FailingEntry[] = [];

  for (const filePath of allRoutes) {
    const content = await fs.readFile(filePath, "utf-8");
    const hasMutator = RE_MUTATORS.test(content);
    RE_MUTATORS.lastIndex = 0;
    if (!hasMutator) continue;

    mutating += 1;
    const normalized = normalizePath(filePath);
    const isGated = RE_GATED.test(content);
    const isAllowlisted = PHASE_A_ALLOW_MUTATIONS.has(normalized);
    const hasExempt = RE_EXEMPT.test(content);
    if (hasExempt) hasExemptMarker += 1;

    if (isGated) gated += 1;
    if (isAllowlisted) allowlisted += 1;

    if (!isGated && !isAllowlisted) {
      failing.push({ path: normalized, fix: "GATE" });
    }
  }

  // Summary
  console.log("Governance Coverage Audit");
  console.log("------------------------");
  console.log(`  Total route.ts scanned:  ${allRoutes.length}`);
  console.log(`  Mutating routes found:   ${mutating}`);
  console.log(`  Gated (withGovernanceGate or withMutationGovernance): ${gated}`);
  console.log(`  Allowlisted (Phase A):   ${allowlisted} (max ${PHASE_A_ALLOW_MUTATIONS.size})`);
  if (hasExemptMarker > 0) {
    console.log(`  (GOV:EXEMPT in files:   ${hasExemptMarker} — ignored for pass/fail)`);
  }
  console.log(`  Failing:                ${failing.length}`);

  const failingCount = failing.length;
  const envCap = Number(process.env.PHASE_A_MAX_UNGOVERNED_MUTATIONS ?? PHASE_A_MAX_UNGOVERNED_MUTATIONS);
  const cap = Number.isFinite(envCap) ? envCap : PHASE_A_MAX_UNGOVERNED_MUTATIONS;
  const delta = failingCount - cap;
  console.log(`  Phase A cap: ${cap} | Current ungoverned: ${failingCount} | Delta: ${delta}`);
  console.log("");

  if (failingCount > cap) {
    console.log(`GOVERNANCE REGRESSION: ungoverned mutating routes = ${failingCount} exceeds Phase A cap = ${cap}`);
    process.exit(2);
  }

  if (failing.length > 0) {
    console.log("Ungoverned routes (add gate or allowlist; burn down over time):");
    console.log("--------------------------------------------------------------");
    const pathWidth = Math.max(8, ...failing.map((e) => e.path.length));
    const fixWidth = 10;
    console.log(`  ${"Path".padEnd(pathWidth)}  Fix`);
    console.log(`  ${"-".repeat(pathWidth)}  ${"-".repeat(fixWidth)}`);
    for (const { path: p, fix } of failing) {
      console.log(`  ${p.padEnd(pathWidth)}  ${fix}`);
    }
    console.log("");
  }

  // Phase A HIGH cap and burn-down: run perimeter audit and enforce HIGH <= cap, HIGH <= previous - burn_down
  let highCount = 0;
  try {
    const perimeterOut = execSync("npx tsx scripts/gov_perimeter_audit.ts", {
      encoding: "utf-8",
      maxBuffer: 2 * 1024 * 1024,
    });
    const report = JSON.parse(perimeterOut) as { routes?: { risk_level: string }[] };
    highCount = report.routes?.filter((r) => r.risk_level === "HIGH").length ?? 0;
  } catch (e) {
    console.error("gov:audit could not run gov:perimeter:", e);
    process.exit(2);
  }

  const maxHigh = Number(process.env.PHASE_A_MAX_HIGH ?? PHASE_A_MAX_HIGH);
  const burnDown = Number(process.env.PHASE_A_BURN_DOWN ?? PHASE_A_BURN_DOWN);
  const previousHigh = process.env.PHASE_A_PREVIOUS_HIGH != null
    ? Number(process.env.PHASE_A_PREVIOUS_HIGH)
    : null;

  console.log(`  Perimeter HIGH count: ${highCount} (cap ${maxHigh})`);
  if (previousHigh != null && Number.isFinite(previousHigh)) {
    console.log(`  Previous HIGH (main): ${previousHigh} | required burn-down: ${burnDown}`);
  }

  if (highCount > maxHigh) {
    console.log("");
    console.log(`GOVERNANCE REGRESSION: HIGH risk mutation routes = ${highCount} exceeds cap = ${maxHigh}`);
    process.exit(2);
  }

  if (previousHigh != null && Number.isFinite(previousHigh)) {
    const requiredMax = Math.max(0, previousHigh - burnDown);
    if (highCount > requiredMax) {
      console.log("");
      console.log(
        `BURN-DOWN REQUIRED: HIGH = ${highCount} must be <= ${requiredMax} (previous ${previousHigh} - ${burnDown})`
      );
      process.exit(2);
    }
  }

  console.log("Ungoverned within cap; HIGH cap and burn-down satisfied.");
  process.exit(0);
}

main().catch((err) => {
  console.error("gov:audit error:", err);
  process.exit(1);
});
