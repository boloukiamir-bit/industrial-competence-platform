/**
 * Unit test for server-side Pilot Mode guard on legacy workflow endpoints.
 * Verifies that when NEXT_PUBLIC_PILOT_MODE=true, mutating endpoints return 403.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

describe("Workflow pilot mode guard", () => {
  let originalPilotMode: string | undefined;

  before(() => {
    originalPilotMode = process.env.NEXT_PUBLIC_PILOT_MODE;
  });

  after(() => {
    process.env.NEXT_PUBLIC_PILOT_MODE = originalPilotMode;
  });

  it("returns 403 with pilot_mode_blocked when PILOT_MODE=true and POST seed-defaults", async () => {
    process.env.NEXT_PUBLIC_PILOT_MODE = "true";
    const { POST } = await import("@/app/api/workflows/templates/seed-defaults/route");
    const req = new Request("http://localhost/api/workflows/templates/seed-defaults", {
      method: "POST",
    });
    const res = await POST(req as any);
    assert.equal(res.status, 403);
    const json = await res.json();
    assert.equal(json.ok, false);
    assert.equal(json.error, "pilot_mode_blocked");
    assert.match(json.message, /Pilot mode: use \/api\/hr/);
  });

  it("returns 403 with pilot_mode_blocked when PILOT_MODE=true and POST templates (create)", async () => {
    process.env.NEXT_PUBLIC_PILOT_MODE = "true";
    const { POST } = await import("@/app/api/workflows/templates/route");
    const req = new Request("http://localhost/api/workflows/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test", category: "HR", steps: [] }),
    });
    const res = await POST(req as any);
    assert.equal(res.status, 403);
    const json = await res.json();
    assert.equal(json.error, "pilot_mode_blocked");
  });

  it("returns 403 with pilot_mode_blocked when PILOT_MODE=true and POST instances (create)", async () => {
    process.env.NEXT_PUBLIC_PILOT_MODE = "true";
    const { POST } = await import("@/app/api/workflows/instances/route");
    const req = new Request("http://localhost/api/workflows/instances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: "any" }),
    });
    const res = await POST(req as any);
    assert.equal(res.status, 403);
    const json = await res.json();
    assert.equal(json.error, "pilot_mode_blocked");
  });

  it("returns 403 with pilot_mode_blocked when PILOT_MODE=true and POST setup", async () => {
    process.env.NEXT_PUBLIC_PILOT_MODE = "true";
    const { POST } = await import("@/app/api/workflows/setup/route");
    const req = new Request("http://localhost/api/workflows/setup", {
      method: "POST",
    });
    const res = await POST(req as any);
    assert.equal(res.status, 403);
    const json = await res.json();
    assert.equal(json.error, "pilot_mode_blocked");
  });
});
