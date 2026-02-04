import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

export type DbEnvKey = "DATABASE_URL" | "POSTGRES_URL" | "SUPABASE_DB_URL" | "NONE";

/**
 * Returns which env key is used for the DB connection. We use DATABASE_URL only;
 * no fallback to POSTGRES_URL or SUPABASE_DB_URL.
 */
function getDbConnectionSource(): {
  usedDbEnvKey: DbEnvKey;
  connectionString: string;
} {
  const url = process.env.DATABASE_URL?.trim();
  if (url && !url.includes("[YOUR_PASSWORD]")) {
    return { usedDbEnvKey: "DATABASE_URL", connectionString: url };
  }
  return { usedDbEnvKey: "NONE", connectionString: "" };
}

/** Parse host and port from connection URL; no username/password. */
function parseDbUrl(connectionString: string): { host: string; port: string } {
  try {
    const u = connectionString.replace(/^postgres(?:ql)?:\/\//, "");
    const at = u.indexOf("@");
    if (at === -1) return { host: "(no @ in url)", port: "" };
    const hostPart = u.slice(at + 1);
    const slash = hostPart.indexOf("/");
    const hostPort = slash === -1 ? hostPart : hostPart.slice(0, slash);
    const colon = hostPort.lastIndexOf(":");
    if (colon === -1) return { host: hostPort, port: "" };
    return { host: hostPort.slice(0, colon), port: hostPort.slice(colon + 1) };
  } catch {
    return { host: "(parse error)", port: "" };
  }
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
 * Uses connection string only (not NODE_ENV) so serverless runtimes always get the right config.
 */
function getSslConfig(connectionString: string): false | { rejectUnauthorized: boolean } {
  const isLocalhost =
    connectionString.includes("localhost") || connectionString.includes("127.0.0.1");
  if (isLocalhost) {
    return false;
  }
  // Any remote host (Supabase pooler, etc.): accept self-signed/in-chain certs
  return { rejectUnauthorized: false };
}

function createPool(): Pool {
  const { usedDbEnvKey, connectionString } = getDbConnectionSource();
  if (usedDbEnvKey === "NONE" || !connectionString) {
    throw new Error("Missing DATABASE_URL (only DATABASE_URL is used; no fallback to POSTGRES_URL/SUPABASE_DB_URL)");
  }

  validateConnectionString(connectionString);

  const ssl = getSslConfig(connectionString);
  const rejectUnauthorized = typeof ssl === "object" ? ssl.rejectUnauthorized : false;
  const { host, port } = parseDbUrl(connectionString);

  if (process.env.DEBUG_DIAGNOSTICS === "true") {
    console.log(
      "[DEBUG_DIAGNOSTICS] pg usedDbEnvKey =",
      usedDbEnvKey,
      "host =",
      host,
      "port =",
      port,
      "ssl rejectUnauthorized =",
      rejectUnauthorized
    );
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
  const { usedDbEnvKey, connectionString } = getDbConnectionSource();
  const missingDatabaseUrl = usedDbEnvKey === "NONE" || !connectionString;

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
 * Returns current pool connection diagnostic (no secrets). Use when DEBUG_DIAGNOSTICS=true.
 */
export function getPoolSslDiagnostic(): {
  usedDbEnvKey: DbEnvKey;
  dbHost: string;
  dbPort: string;
  sslRejectUnauthorized: boolean;
  rejectUnauthorized: boolean;
  hostname: string;
} {
  const { usedDbEnvKey, connectionString } = getDbConnectionSource();
  const ssl = connectionString ? getSslConfig(connectionString) : false;
  const sslRejectUnauthorized = typeof ssl === "object" ? ssl.rejectUnauthorized : false;
  const { host, port } = connectionString ? parseDbUrl(connectionString) : { host: "", port: "" };
  return {
    usedDbEnvKey,
    dbHost: host,
    dbPort: port,
    sslRejectUnauthorized,
    rejectUnauthorized: sslRejectUnauthorized,
    hostname: host,
  };
}
