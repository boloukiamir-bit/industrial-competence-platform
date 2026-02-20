/**
 * Unit tests for GET /api/auth/whoami.
 * Asserts dev-bearer works in non-prod and bearer path is disabled in production.
 */
import { it } from "node:test";
import assert from "node:assert/strict";

const whoamiUrl = "http://localhost/api/auth/whoami";

it("whoami: with dev-bearer in non-prod returns authenticated true", async () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origTestCtx = process.env.TEST_DEV_BEARER_CONTEXT_JSON;
  const origDevBearer = process.env.DEV_BEARER_TOKEN;
  try {
    process.env.NODE_ENV = "development";
    process.env.DEV_BEARER_TOKEN = "test-dev-bearer-token";
    process.env.TEST_DEV_BEARER_CONTEXT_JSON = JSON.stringify({
      userId: "user-1",
      email: "dev@test.com",
      active_org_id: "org-1",
      active_site_id: null,
      role: "admin",
    });
    const { GET } = await import("@/app/api/auth/whoami/route");
    const req = new Request(whoamiUrl, {
      headers: { Authorization: "Bearer test-dev-bearer-token" },
    });
    const res = await GET(req as any);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.authenticated, true);
    assert.equal(json.email, "dev@test.com");
    assert.equal(json.user_id, "user-1");
    assert.equal(json.active_org_id, "org-1");
    assert.equal(json.role, "admin");
  } finally {
    process.env.NODE_ENV = origNodeEnv;
    process.env.TEST_DEV_BEARER_CONTEXT_JSON = origTestCtx;
    process.env.DEV_BEARER_TOKEN = origDevBearer;
  }
});

it("whoami: in production without cookie returns unauthenticated (no bearer fallback)", async () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origVercelEnv = process.env.VERCEL_ENV;
  try {
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";
    const { GET } = await import("@/app/api/auth/whoami/route");
    const req = new Request(whoamiUrl, {
      headers: { Authorization: "Bearer any-token" },
    });
    const res = await GET(req as any);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.authenticated, false);
  } finally {
    process.env.NODE_ENV = origNodeEnv;
    process.env.VERCEL_ENV = origVercelEnv;
  }
});
