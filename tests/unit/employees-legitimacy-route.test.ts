/**
 * Unit tests for GET /api/employees/[id]/legitimacy.
 * Bearer-only does not throw and returns ok:true with empty compliance items; employee not found returns 404.
 */
import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";

const EMPLOYEE_ID_EXISTING = "11111111-1111-1111-1111-111111111111";
const EMPLOYEE_ID_NOT_FOUND = "00000000-0000-0000-0000-000000000001";

function mockSupabaseAdmin(options: {
  employee: { id: string; name?: string; first_name?: string | null; last_name?: string | null; employee_number?: string; site_id?: string | null; line_code?: string | null } | null;
  catalog: Array<{ id: string; code: string; name: string; default_warning_window_days: number | null }>;
  assigned: Array<{ compliance_id: string; valid_to: string | null; waived: boolean }>;
  bindings?: Array<{ compliance_code: string; warning_window_days_override: number | null }>;
  employee_roles?: Array<{ role_id: string }>;
  employee_induction?: { status: string } | null;
}): SupabaseClient {
  const { employee, catalog, assigned, bindings = [], employee_roles: roles = [], employee_induction: inductionRow = null } = options;
  const from = (table: string) => {
    const result =
      table === "employees"
        ? { data: employee, error: null }
        : table === "compliance_catalog"
          ? { data: catalog, error: null }
          : table === "employee_compliance"
            ? { data: assigned, error: null }
            : table === "compliance_requirement_bindings"
              ? { data: bindings, error: null }
              : table === "employee_roles"
                ? { data: roles, error: null }
                : table === "employee_induction"
                  ? { data: inductionRow, error: null }
                  : { data: null, error: null };
    const chain = {
      select: () => chain,
      eq: () => chain,
      or: () => chain,
      in: () => chain,
      order: () => chain,
      maybeSingle: () => Promise.resolve(result),
      then(resolve: (v: { data: unknown; error: null }) => void) {
        return Promise.resolve(result).then(resolve);
      },
      catch(fn: (e: unknown) => void) {
        return Promise.resolve(result).catch(fn);
      },
    };
    return chain;
  };
  return { from } as unknown as SupabaseClient;
}

test("employees/[id]/legitimacy: bearer-only request does not throw and returns ok:true with empty compliance items", async () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origTestCtx = process.env.TEST_DEV_BEARER_CONTEXT_JSON;
  const origDevBearer = process.env.DEV_BEARER_TOKEN;
  const origSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const origServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const origAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const mockAdmin = mockSupabaseAdmin({
    employee: {
      id: EMPLOYEE_ID_EXISTING,
      name: "Test User",
      first_name: "Test",
      last_name: "User",
      employee_number: "E001",
    },
    catalog: [],
    assigned: [],
  });

  try {
    process.env.NODE_ENV = "development";
    process.env.DEV_BEARER_TOKEN = "test-legitimacy-bearer";
    process.env.TEST_DEV_BEARER_CONTEXT_JSON = JSON.stringify({
      userId: "user-1",
      email: "dev@test.com",
      active_org_id: "org-1",
      active_site_id: null,
      role: "admin",
    });
    process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-service-key";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "test-anon-key";
    process.env.TEST_LEGITIMACY_MOCK_ORG = JSON.stringify({
      activeOrgId: "org-1",
      userId: "user-1",
      activeSiteId: null,
    });

    (globalThis as any).__LEGITIMACY_SUPABASE_ADMIN__ = mockAdmin;

    const { GET } = await import("@/app/api/employees/[id]/legitimacy/route");
    const req = new Request(`http://localhost/api/employees/${EMPLOYEE_ID_EXISTING}/legitimacy`, {
      headers: { Authorization: "Bearer test-legitimacy-bearer" },
    });
    (req as any).cookies = { getAll: () => [] };
    const res = await GET(req, { params: Promise.resolve({ id: EMPLOYEE_ID_EXISTING }) });
    assert.equal(res.status, 200, "expected 200");
    const json = await res.json();
    assert.equal(json.ok, true);
    assert.ok(Array.isArray(json.compliance?.items));
    assert.equal(json.compliance.items.length, 0);
    assert.equal(json.legitimacy?.status, "GO");
    assert.equal(json.employee?.id, EMPLOYEE_ID_EXISTING);
    assert.equal(json.employee?.name, "Test User");
    assert.equal(json.employee?.employee_number, "E001");
  } finally {
    delete process.env.TEST_LEGITIMACY_MOCK_ORG;
    (globalThis as any).__LEGITIMACY_SUPABASE_ADMIN__ = undefined;
    process.env.NODE_ENV = origNodeEnv;
    process.env.TEST_DEV_BEARER_CONTEXT_JSON = origTestCtx;
    process.env.DEV_BEARER_TOKEN = origDevBearer;
    if (origSupabaseUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = origSupabaseUrl;
    if (origServiceKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = origServiceKey;
    if (origAnonKey !== undefined) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = origAnonKey;
  }
});

test("employees/[id]/legitimacy: employee not found returns 404", async () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origTestCtx = process.env.TEST_DEV_BEARER_CONTEXT_JSON;
  const origDevBearer = process.env.DEV_BEARER_TOKEN;
  const origSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const origServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const origAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const mockAdmin = mockSupabaseAdmin({
    employee: null,
    catalog: [],
    assigned: [],
  });

  try {
    process.env.NODE_ENV = "development";
    process.env.DEV_BEARER_TOKEN = "test-legitimacy-bearer-404";
    process.env.TEST_DEV_BEARER_CONTEXT_JSON = JSON.stringify({
      userId: "user-1",
      email: "dev@test.com",
      active_org_id: "org-1",
      active_site_id: null,
      role: "admin",
    });
    process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-service-key";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "test-anon-key";
    process.env.TEST_LEGITIMACY_MOCK_ORG = JSON.stringify({
      activeOrgId: "org-1",
      userId: "user-1",
      activeSiteId: null,
    });

    (globalThis as any).__LEGITIMACY_SUPABASE_ADMIN__ = mockAdmin;

    const { GET } = await import("@/app/api/employees/[id]/legitimacy/route");
    const req = new Request(`http://localhost/api/employees/${EMPLOYEE_ID_NOT_FOUND}/legitimacy`, {
      headers: { Authorization: "Bearer test-legitimacy-bearer-404" },
    });
    (req as any).cookies = { getAll: () => [] };
    const res = await GET(req as any, { params: Promise.resolve({ id: EMPLOYEE_ID_NOT_FOUND }) });
    assert.equal(res.status, 404);
    const json = await res.json();
    assert.equal(json.ok, false);
    assert.ok(json.error);
  } finally {
    delete process.env.TEST_LEGITIMACY_MOCK_ORG;
    (globalThis as any).__LEGITIMACY_SUPABASE_ADMIN__ = undefined;
    process.env.NODE_ENV = origNodeEnv;
    process.env.TEST_DEV_BEARER_CONTEXT_JSON = origTestCtx;
    process.env.DEV_BEARER_TOKEN = origDevBearer;
    if (origSupabaseUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = origSupabaseUrl;
    if (origServiceKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = origServiceKey;
    if (origAnonKey !== undefined) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = origAnonKey;
  }
});

test("employees/[id]/legitimacy: evaluator returns only applicable requirements (2 catalog, 1 binding → 1 item)", async () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origTestCtx = process.env.TEST_DEV_BEARER_CONTEXT_JSON;
  const origDevBearer = process.env.DEV_BEARER_TOKEN;
  const origSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const origServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const origAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const catalogTwo = [
    { id: "cat-1", code: "LIC1", name: "License One", default_warning_window_days: 30 },
    { id: "cat-2", code: "LIC2", name: "License Two", default_warning_window_days: 30 },
  ];
  const bindingsOne = [{ compliance_code: "LIC1", warning_window_days_override: null }];

  const mockAdmin = mockSupabaseAdmin({
    employee: {
      id: EMPLOYEE_ID_EXISTING,
      name: "Test User",
      first_name: "Test",
      last_name: "User",
      employee_number: "E001",
      site_id: null,
      line_code: null,
    },
    catalog: catalogTwo,
    assigned: [],
    bindings: bindingsOne,
    employee_roles: [],
  });

  try {
    process.env.NODE_ENV = "development";
    process.env.DEV_BEARER_TOKEN = "test-legitimacy-evaluator";
    process.env.TEST_LEGITIMACY_MOCK_ORG = JSON.stringify({
      activeOrgId: "org-1",
      userId: "user-1",
      activeSiteId: null,
    });
    process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-service-key";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "test-anon-key";

    (globalThis as any).__LEGITIMACY_SUPABASE_ADMIN__ = mockAdmin;

    const { GET } = await import("@/app/api/employees/[id]/legitimacy/route");
    const req = new Request(`http://localhost/api/employees/${EMPLOYEE_ID_EXISTING}/legitimacy`, {
      headers: { Authorization: "Bearer test-legitimacy-evaluator" },
    });
    (req as any).cookies = { getAll: () => [] };
    const res = await GET(req as any, { params: Promise.resolve({ id: EMPLOYEE_ID_EXISTING }) });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.ok, true);
    assert.equal(json.compliance.items.length, 1, "evaluator should return only 1 applicable item (LIC1)");
    assert.equal(json.compliance.items[0].code, "LIC1");
    assert.equal(json.compliance.items[0].requirement_id, "cat-1");
  } finally {
    delete process.env.TEST_LEGITIMACY_MOCK_ORG;
    (globalThis as any).__LEGITIMACY_SUPABASE_ADMIN__ = undefined;
    process.env.NODE_ENV = origNodeEnv;
    process.env.TEST_DEV_BEARER_CONTEXT_JSON = origTestCtx;
    process.env.DEV_BEARER_TOKEN = origDevBearer;
    if (origSupabaseUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = origSupabaseUrl;
    if (origServiceKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = origServiceKey;
    if (origAnonKey !== undefined) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = origAnonKey;
  }
});

test("employees/[id]/legitimacy: employee_induction RESTRICTED yields legitimacy RESTRICTED (overrides compliance WARNING/ILLEGAL)", async () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origTestCtx = process.env.TEST_DEV_BEARER_CONTEXT_JSON;
  const origDevBearer = process.env.DEV_BEARER_TOKEN;
  const origSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const origServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const origAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const SITE_ID = "22222222-2222-2222-2222-222222222222";
  const mockAdmin = mockSupabaseAdmin({
    employee: {
      id: EMPLOYEE_ID_EXISTING,
      name: "New Hire",
      first_name: "New",
      last_name: "Hire",
      employee_number: "E002",
      site_id: SITE_ID,
      line_code: null,
    },
    catalog: [{ id: "cat-1", code: "LIC1", name: "License One", default_warning_window_days: 30 }],
    assigned: [],
    bindings: [{ compliance_code: "LIC1", warning_window_days_override: null }],
    employee_roles: [],
    employee_induction: { status: "RESTRICTED" },
  });
  try {
    process.env.NODE_ENV = "development";
    process.env.DEV_BEARER_TOKEN = "test-legitimacy-restricted";
    process.env.TEST_DEV_BEARER_CONTEXT_JSON = JSON.stringify({
      userId: "user-1",
      email: "dev@test.com",
      active_org_id: "org-1",
      active_site_id: SITE_ID,
      role: "admin",
    });
    process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-service-key";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "test-anon-key";
    process.env.TEST_LEGITIMACY_MOCK_ORG = JSON.stringify({
      activeOrgId: "org-1",
      userId: "user-1",
      activeSiteId: SITE_ID,
    });
    (globalThis as any).__LEGITIMACY_SUPABASE_ADMIN__ = mockAdmin;
    const { GET } = await import("@/app/api/employees/[id]/legitimacy/route");
    const req = new Request(`http://localhost/api/employees/${EMPLOYEE_ID_EXISTING}/legitimacy`, {
      headers: { Authorization: "Bearer test-legitimacy-restricted" },
    });
    (req as any).cookies = { getAll: () => [] };
    const res = await GET(req, { params: Promise.resolve({ id: EMPLOYEE_ID_EXISTING }) });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.ok, true);
    assert.equal(json.legitimacy?.status, "RESTRICTED", "induction RESTRICTED must override compliance and yield legitimacy RESTRICTED");
  } finally {
    delete process.env.TEST_LEGITIMACY_MOCK_ORG;
    (globalThis as any).__LEGITIMACY_SUPABASE_ADMIN__ = undefined;
    process.env.NODE_ENV = origNodeEnv;
    process.env.TEST_DEV_BEARER_CONTEXT_JSON = origTestCtx;
    process.env.DEV_BEARER_TOKEN = origDevBearer;
    if (origSupabaseUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = origSupabaseUrl;
    if (origServiceKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = origServiceKey;
    if (origAnonKey !== undefined) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = origAnonKey;
  }
});
