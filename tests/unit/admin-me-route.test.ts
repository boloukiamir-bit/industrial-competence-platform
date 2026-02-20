/**
 * Unit test for GET /api/admin/me.
 * Asserts route source includes no-cache config and dev-bearer/production behavior.
 */
import { readFileSync } from "fs";
import { join } from "path";
import test from "node:test";
import assert from "node:assert/strict";

const routePath = join(process.cwd(), "app", "api", "admin", "me", "route.ts");

test("admin/me route source includes force-dynamic and revalidate=0", () => {
  const content = readFileSync(routePath, "utf-8");
  assert(content.includes('export const dynamic = "force-dynamic"'), "route must export dynamic force-dynamic");
  assert(content.includes("export const revalidate = 0"), "route must export revalidate 0");
});

test("admin/me route source includes Cache-Control no-store", () => {
  const content = readFileSync(routePath, "utf-8");
  assert(content.includes("Cache-Control"), "route must set Cache-Control header");
  assert(content.includes("no-store"), "route must include no-store in Cache-Control");
});

test("admin/me: with dev-bearer in non-prod returns role and memberships", async () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origTestCtx = process.env.TEST_DEV_BEARER_CONTEXT_JSON;
  const origDevBearer = process.env.DEV_BEARER_TOKEN;
  const origSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const origServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    process.env.NODE_ENV = "development";
    process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-service-key";
    process.env.DEV_BEARER_TOKEN = "test-admin-me-bearer";
    process.env.TEST_DEV_BEARER_CONTEXT_JSON = JSON.stringify({
      userId: "user-1",
      email: "admin@test.com",
      active_org_id: "org-1",
      active_site_id: null,
      role: "hr",
    });
    const { GET } = await import("@/app/api/admin/me/route");
    const req = new Request("http://localhost/api/admin/me", {
      headers: { Authorization: "Bearer test-admin-me-bearer" },
    });
    const res = await GET(req as any);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.email, "admin@test.com");
    assert.equal(json.active_org_id, "org-1");
    assert.equal(json.membership_role, "hr");
  } finally {
    process.env.NODE_ENV = origNodeEnv;
    process.env.TEST_DEV_BEARER_CONTEXT_JSON = origTestCtx;
    process.env.DEV_BEARER_TOKEN = origDevBearer;
    if (origSupabaseUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = origSupabaseUrl;
    if (origServiceKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = origServiceKey;
  }
});

test("admin/me: in production without cookie returns error (no bearer fallback)", async () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origVercelEnv = process.env.VERCEL_ENV;
  const origSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const origServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const origAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  try {
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";
    process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-service-key";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "test-anon-key";
    const { GET } = await import("@/app/api/admin/me/route");
    const req = new Request("http://localhost/api/admin/me", {
      headers: { Authorization: "Bearer any-token" },
    });
    const res = await GET(req as any);
    assert(res.status === 401 || res.status === 403 || res.status === 500, `expected 401/403/500, got ${res.status}`);
    const json = await res.json();
    assert(json.error);
  } finally {
    process.env.NODE_ENV = origNodeEnv;
    process.env.VERCEL_ENV = origVercelEnv;
    if (origSupabaseUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = origSupabaseUrl;
    if (origServiceKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = origServiceKey;
    if (origAnonKey !== undefined) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = origAnonKey;
  }
});
