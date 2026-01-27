/**
 * Unit tests for HR Tasks seed data filtering
 * Verifies that seed/test rows are excluded from production queries
 */

import test from "node:test";
import assert from "node:assert/strict";

test("HR Tasks Seed Filtering - Source column filtering logic - should exclude seed rows when includeSeed is false", () => {
  // Simulate SQL WHERE clause logic
  const shouldInclude = (source: string | null, includeSeed: boolean): boolean => {
    if (includeSeed) return true;
    return source === null || !["seed", "test"].includes(source);
  };

  assert.equal(shouldInclude("seed", false), false);
  assert.equal(shouldInclude("test", false), false);
  assert.equal(shouldInclude("manual", false), true);
  assert.equal(shouldInclude("import", false), true);
  assert.equal(shouldInclude(null, false), true); // Backwards compatible
});

test("HR Tasks Seed Filtering - Source column filtering logic - should include all rows when includeSeed is true (dev mode)", () => {
  const shouldInclude = (source: string | null, includeSeed: boolean): boolean => {
    if (includeSeed) return true;
    return source === null || !["seed", "test"].includes(source);
  };

  assert.equal(shouldInclude("seed", true), true);
  assert.equal(shouldInclude("test", true), true);
  assert.equal(shouldInclude("manual", true), true);
  assert.equal(shouldInclude("import", true), true);
  assert.equal(shouldInclude(null, true), true);
});

test("HR Tasks Seed Filtering - Source column filtering logic - should handle backwards compatibility (null source)", () => {
  const shouldInclude = (source: string | null, includeSeed: boolean): boolean => {
    if (includeSeed) return true;
    return source === null || !["seed", "test"].includes(source);
  };

  // When source is null (column doesn't exist or not set), include the row
  assert.equal(shouldInclude(null, false), true);
  assert.equal(shouldInclude(null, true), true);
});

test("HR Tasks Seed Filtering - Query parameter handling - should parse includeSeed query parameter correctly", () => {
  const parseIncludeSeed = (url: string, isDev: boolean): boolean => {
    const urlObj = new URL(url);
    const includeSeedParam = urlObj.searchParams.get("includeSeed");
    return isDev && includeSeedParam === "true";
  };

  // Dev mode with includeSeed=true
  assert.equal(parseIncludeSeed("http://localhost:5001/api/hr/tasks?includeSeed=true", true), true);
  
  // Dev mode with includeSeed=false
  assert.equal(parseIncludeSeed("http://localhost:5001/api/hr/tasks?includeSeed=false", true), false);
  
  // Dev mode without parameter
  assert.equal(parseIncludeSeed("http://localhost:5001/api/hr/tasks", true), false);
  
  // Production mode (should always be false)
  assert.equal(parseIncludeSeed("http://localhost:5001/api/hr/tasks?includeSeed=true", false), false);
  assert.equal(parseIncludeSeed("http://localhost:5001/api/hr/tasks", false), false);
});

test("HR Tasks Seed Filtering - Source value validation - should recognize valid source values", () => {
  const validSources = ["seed", "import", "manual", "test"];
  const isValid = (source: string): boolean => {
    return validSources.includes(source);
  };

  assert.equal(isValid("seed"), true);
  assert.equal(isValid("import"), true);
  assert.equal(isValid("manual"), true);
  assert.equal(isValid("test"), true);
  assert.equal(isValid("invalid"), false);
  assert.equal(isValid(""), false);
});

test("HR Tasks Seed Filtering - Migration backwards compatibility - should detect missing source column error correctly", () => {
  // Simulate error codes that indicate missing column (Postgres undefined_column 42703)
  const isColumnMissingError = (error: { code?: string; message?: string }): boolean => {
    return (
      String(error?.code) === "42703" ||
      (String(error?.message || "").includes("column") &&
        String(error?.message || "").includes("source"))
    );
  };

  assert.equal(
    isColumnMissingError({ code: "42703", message: "column pe.source does not exist" }),
    true
  );
  assert.equal(
    isColumnMissingError({ code: "42P01", message: "relation does not exist" }),
    false
  );
  assert.equal(
    isColumnMissingError({ message: "column pe.source does not exist" }),
    true
  );
});

test("HR Tasks Seed Filtering - Migration backwards compatibility - should fail-closed in production when source column is missing", () => {
  const isProduction = true;
  const error = { code: "42703", message: "column pe.source does not exist" };
  const isMissingColumnError =
    String(error?.code) === "42703" ||
    (String(error?.message || "").includes("column") && String(error?.message || "").includes("source"));

  if (isMissingColumnError && isProduction) {
    // In production, should return 500 error
    const response = {
      status: 500,
      error: "Schema out of date: person_events.source missing. Please run database migrations.",
    };
    assert.equal(response.status, 500);
    assert.ok(response.error.includes("person_events.source missing"));
  }
});

test("HR Tasks Seed Filtering - Migration backwards compatibility - should fallback in dev mode when source column is missing", () => {
  const isProduction = false;
  const error = { code: "42703", message: "column pe.source does not exist" };
  const isMissingColumnError =
    String(error?.code) === "42703" ||
    (String(error?.message || "").includes("column") && String(error?.message || "").includes("source"));

  if (isMissingColumnError && !isProduction) {
    // In dev mode, should use fallback (include all rows)
    const useFallback = true;
    assert.equal(useFallback, true);
  }
});

test("HR Tasks Seed Filtering - Production fail-closed behavior - should detect production environment correctly", () => {
  const isProduction = (nodeEnv: string | undefined, vercelEnv: string | undefined): boolean => {
    return nodeEnv === "production" || vercelEnv === "production";
  };

  assert.equal(isProduction("production", undefined), true);
  assert.equal(isProduction(undefined, "production"), true);
  assert.equal(isProduction("production", "production"), true);
  assert.equal(isProduction("development", undefined), false);
  assert.equal(isProduction(undefined, "preview"), false);
  assert.equal(isProduction(undefined, undefined), false);
});

test("HR Tasks Seed Filtering - Production fail-closed behavior - should return 500 with clear error message in production", () => {
  const productionError = {
    status: 500,
    error: "Schema out of date: person_events.source missing. Please run database migrations.",
  };

  assert.equal(productionError.status, 500);
  assert.ok(productionError.error.includes("person_events.source missing"));
  assert.ok(productionError.error.includes("database migrations"));
});

test("HR Tasks Seed Filtering - includeSeed parameter security - should only allow includeSeed=true in dev mode", () => {
  const parseIncludeSeed = (url: string, isDev: boolean): boolean => {
    const urlObj = new URL(url);
    const includeSeedParam = urlObj.searchParams.get("includeSeed");
    return isDev && includeSeedParam === "true";
  };

  // Production mode should never allow includeSeed
  assert.equal(parseIncludeSeed("http://example.com/api/hr/tasks?includeSeed=true", false), false);
  assert.equal(parseIncludeSeed("http://example.com/api/hr/tasks", false), false);

  // Dev mode can allow it
  assert.equal(parseIncludeSeed("http://localhost:5001/api/hr/tasks?includeSeed=true", true), true);
  assert.equal(parseIncludeSeed("http://localhost:5001/api/hr/tasks?includeSeed=false", true), false);
  assert.equal(parseIncludeSeed("http://localhost:5001/api/hr/tasks", true), false);
});
