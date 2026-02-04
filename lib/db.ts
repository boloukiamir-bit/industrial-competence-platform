import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

/**
 * Validates that DATABASE_URL is using Supabase Transaction Pooler (not direct connection).
 *
 * IMPORTANT: Use the "Transaction Pooler" connection string from Supabase dashboard,
 * NOT the direct Postgres connection. The pooler connection typically:
 * - Uses port 6543 (pooler) instead of 5432 (direct)
 * - Has format: postgresql://...@...pooler.supabase.com:6543/...
 *
 * Direct connections (port 5432) will cause connection churn and performance issues.
 */
function validateConnectionString(connectionString: string): void {
  if (connectionString.includes(":5432/") && !connectionString.includes("localhost")) {
    console.warn(
      "⚠️  WARNING: DATABASE_URL appears to use direct Postgres connection (port 5432).\n" +
        "   For production, use Supabase Transaction Pooler connection (port 6543).\n" +
        "   Get the pooler connection string from: Supabase Dashboard > Settings > Database > Connection Pooling"
    );
  }
  if (connectionString.includes(":6543/") || connectionString.includes("pooler.supabase.com")) {
    return;
  }
  if (connectionString.includes("supabase.com") && !connectionString.includes("pooler")) {
    console.warn(
      "⚠️  WARNING: DATABASE_URL may not be using Transaction Pooler.\n" +
        "   Ensure you're using the 'Transaction Pooler' connection string from Supabase dashboard."
    );
  }
}

/**
 * Explicit SSL config for pg Pool to avoid Vercel SELF_SIGNED_CERT_IN_CHAIN when
 * connecting to Supabase pooler. We do NOT set NODE_TLS_REJECT_UNAUTHORIZED.
 */
function getSslConfig(connectionString: string): false | { rejectUnauthorized: boolean } {
  const isProduction = process.env.NODE_ENV === "production";
  const isLocalhost = connectionString.includes("localhost");

  if (isProduction) {
    // Vercel/Supabase pooler: use SSL with rejectUnauthorized false to accept pooler cert
    return { rejectUnauthorized: false };
  }
  // Non-production: no SSL for localhost, otherwise same as production for remote dev
  if (isLocalhost) {
    return false;
  }
  return { rejectUnauthorized: false };
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing DATABASE_URL");
  }

  validateConnectionString(connectionString);

  const ssl = getSslConfig(connectionString);
  const rejectUnauthorized = typeof ssl === "object" ? ssl.rejectUnauthorized : false;

  if (process.env.DEBUG_DIAGNOSTICS === "true") {
    console.log("[DEBUG_DIAGNOSTICS] pg ssl rejectUnauthorized =", rejectUnauthorized);
  }

  return new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl,
  });
}

/**
 * Returns the shared pg Pool. Use this (or the `pool` export) for all DB access.
 * SSL is set explicitly for production (rejectUnauthorized: false) to fix
 * SELF_SIGNED_CERT_IN_CHAIN on Vercel when connecting to Supabase pooler.
 */
export function getPgPool(): Pool {
  if (global.__pgPool) {
    return global.__pgPool;
  }

  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
  const isDevMode = process.env.NODE_ENV !== "production";
  const missingDatabaseUrl =
    !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("[YOUR_PASSWORD]");

  if (missingDatabaseUrl && (isBuildPhase || isDevMode)) {
    const errorMessage =
      "DATABASE_URL not configured. Get connection string from: Supabase Dashboard > Settings > Database > Connection Pooling > Transaction Pooler";
    return new Proxy({} as Pool, {
      get(_target, prop) {
        if (prop === "query") {
          return () => {
            throw new Error(errorMessage);
          };
        }
        throw new Error(errorMessage);
      },
    });
  }

  global.__pgPool = createPool();
  return global.__pgPool;
}

/** Shared pg pool; prefer getPgPool() for clarity. */
export const pool = getPgPool();

/**
 * Returns current pool SSL diagnostic for logging (no secrets). Use when DEBUG_DIAGNOSTICS=true.
 */
export function getPoolSslDiagnostic(): {
  rejectUnauthorized: boolean;
  hostname: string;
} {
  const connectionString = process.env.DATABASE_URL ?? "";
  const ssl = connectionString ? getSslConfig(connectionString) : false;
  const rejectUnauthorized = typeof ssl === "object" ? ssl.rejectUnauthorized : false;
  const hostname = (() => {
    try {
      const u = connectionString.replace(/^postgres(?:ql)?:\/\//, "");
      const at = u.indexOf("@");
      if (at === -1) return "(no @ in url)";
      const hostPart = u.slice(at + 1);
      const slash = hostPart.indexOf("/");
      const hostPort = slash === -1 ? hostPart : hostPart.slice(0, slash);
      const colon = hostPort.lastIndexOf(":");
      return colon === -1 ? hostPort : hostPort.slice(0, colon);
    } catch {
      return "(parse error)";
    }
  })();
  return { rejectUnauthorized, hostname };
}
