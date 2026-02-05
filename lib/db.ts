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

type SslConfig = false | { rejectUnauthorized: boolean; ca?: string };

/** Whether SUPABASE_DB_CA_PEM_B64 is set (base64 of cert-2 + cert-3 PEM bundle). */
function hasCaPemB64(): boolean {
  return Boolean(process.env.SUPABASE_DB_CA_PEM_B64?.trim());
}

/**
 * Decode CA PEM from SUPABASE_DB_CA_PEM_B64. Throws if missing or invalid when required.
 */
function getCaPemFromB64(): string | null {
  const b64 = process.env.SUPABASE_DB_CA_PEM_B64?.trim();
  if (!b64) return null;
  try {
    return Buffer.from(b64, "base64").toString("utf8");
  } catch {
    return null;
  }
}

/**
 * SSL config for pg Pool. For Supabase pooler we require SUPABASE_DB_CA_PEM_B64
 * and rejectUnauthorized: true. No silent rejectUnauthorized: false in production.
 */
function getSslConfig(connectionString: string): SslConfig {
  const isLocalhost =
    connectionString.includes("localhost") || connectionString.includes("127.0.0.1");
  if (isLocalhost) {
    return false;
  }
  const caPem = getCaPemFromB64();
  if (caPem) {
    return { ca: caPem, rejectUnauthorized: true };
  }
  return { rejectUnauthorized: true };
}

function createPool(): Pool {
  const { usedDbEnvKey, connectionString } = getDbConnectionSource();
  if (usedDbEnvKey === "NONE" || !connectionString) {
    throw new Error(
      "Missing DATABASE_URL. Set DATABASE_URL (Supabase Transaction Pooler connection string from Dashboard > Settings > Database > Connection Pooling)."
    );
  }

  const isLocalhost =
    connectionString.includes("localhost") || connectionString.includes("127.0.0.1");
  if (!isLocalhost) {
    if (!hasCaPemB64()) {
      throw new Error(
        "Missing SUPABASE_DB_CA_PEM_B64. For Supabase pooler (port 6543) set SUPABASE_DB_CA_PEM_B64 to the base64 of the concatenated CA bundle (cert-2.pem + cert-3.pem). Get certs from Supabase or use: openssl s_client -showcerts -connect aws-1-eu-north-1.pooler.supabase.com:6543 </dev/null 2>/dev/null | openssl x509 -outform PEM."
      );
    }
    if (!getCaPemFromB64()) {
      throw new Error(
        "Invalid SUPABASE_DB_CA_PEM_B64: value is set but failed to decode as base64. Ensure it is the base64-encoded concatenated PEM (cert-2.pem + cert-3.pem)."
      );
    }
  }

  validateConnectionString(connectionString);

  const ssl = getSslConfig(connectionString);
  const rejectUnauthorized = typeof ssl === "object" ? ssl.rejectUnauthorized : false;
  const hasCaPem = hasCaPemB64();
  const { host, port } = parseDbUrl(connectionString);

  console.log(
    "[db] pool init: dbHost=%s dbPort=%s hasCaPem=%s sslRejectUnauthorized=%s",
    host,
    port,
    hasCaPem,
    rejectUnauthorized
  );

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
 * SSL uses SUPABASE_DB_CA_PEM_B64 (base64 of cert-2 + cert-3) and rejectUnauthorized: true
 * for Supabase pooler; localhost uses ssl: false.
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
 * Returns current pool connection diagnostic (no secrets).
 */
export function getPoolSslDiagnostic(): {
  usedDbEnvKey: DbEnvKey;
  dbHost: string;
  dbPort: string;
  sslRejectUnauthorized: boolean;
  rejectUnauthorized: boolean;
  hostname: string;
  hasCaPem: boolean;
} {
  const { usedDbEnvKey, connectionString } = getDbConnectionSource();
  const ssl = connectionString ? getSslConfig(connectionString) : false;
  const sslRejectUnauthorized = typeof ssl === "object" ? ssl.rejectUnauthorized : false;
  const { host, port } = connectionString ? parseDbUrl(connectionString) : { host: "", port: "" };
  const hasCaPem = hasCaPemB64();
  return {
    usedDbEnvKey,
    dbHost: host,
    dbPort: port,
    sslRejectUnauthorized,
    rejectUnauthorized: sslRejectUnauthorized,
    hostname: host,
    hasCaPem,
  };
}
