/**
 * Governance Coverage Audit: fails if any mutating API route is missing governance gating.
 * Mutating = POST | PUT | PATCH | DELETE. Must be gated (withGovernanceGate) OR in Phase A allowlist.
 * GOV:EXEMPT in files is ignored for pass/fail; reported as warning only.
 */
import * as fs from "fs/promises";
import * as path from "path";

const ROOT = process.cwd();
const API_DIR = path.join(ROOT, "app", "api");
const IGNORE_DIRS = new Set(["node_modules", ".next", "supabase", "dist", "build"]);

/** Phase A: mutating routes allowed without gate. Keep minimal (boot/auth only). */
const PHASE_A_ALLOW_MUTATIONS = new Set<string>([
  "app/api/auth/callback/route.ts",
]);

/** Phase A burn-down: ungoverned count must not exceed this (must trend down). Override via env PHASE_A_MAX_UNGOVERNED_MUTATIONS. */
const PHASE_A_MAX_UNGOVERNED_MUTATIONS = 92;

const RE_MUTATORS = /export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\b/g;
const RE_GATED = /withGovernanceGate\s*\(/;
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
    RE_MUTATORS.lastIndex = 0;
    const hasMutator = RE_MUTATORS.test(content);
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
  console.log(`  Gated (withGovernanceGate): ${gated}`);
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
    console.log("Failing routes (add gate or add to PHASE_A_ALLOW_MUTATIONS):");
    console.log("--------------------------------------------------------------");
    const pathWidth = Math.max(8, ...failing.map((e) => e.path.length));
    const fixWidth = 10;
    console.log(`  ${"Path".padEnd(pathWidth)}  Fix`);
    console.log(`  ${"-".repeat(pathWidth)}  ${"-".repeat(fixWidth)}`);
    for (const { path: p, fix } of failing) {
      console.log(`  ${p.padEnd(pathWidth)}  ${fix}`);
    }
    process.exit(1);
  }

  console.log("All mutating routes are gated or allowlisted.");
  process.exit(0);
}

main().catch((err) => {
  console.error("gov:audit error:", err);
  process.exit(1);
});
