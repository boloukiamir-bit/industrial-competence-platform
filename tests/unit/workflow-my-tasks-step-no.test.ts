/**
 * Legacy workflow my-tasks: must use wf_instance_tasks step column and expose stepOrder in the response.
 * (DB may have step_order or step_no depending on migration; this codebase uses step_order.)
 */
import { readFileSync } from "fs";
import { join } from "path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const routePath = join(process.cwd(), "app", "api", "workflows", "my-tasks", "route.ts");

describe("GET /api/workflows/my-tasks uses step column and returns stepOrder", () => {
  it("query selects step column and response maps to stepOrder", () => {
    const content = readFileSync(routePath, "utf-8");
    const usesStepOrder = content.includes("t.step_order");
    const usesStepNo = content.includes("t.step_no");
    assert(usesStepOrder || usesStepNo, "SQL must select step_order or step_no");
    assert(content.includes("stepOrder:"), "response must expose stepOrder");
  });
});
