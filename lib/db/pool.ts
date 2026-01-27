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
  // Check for direct connection port (5432) - this is a warning, not an error
  // as localhost/dev might legitimately use direct connection
  if (connectionString.includes(":5432/") && !connectionString.includes("localhost")) {
    console.warn(
      "⚠️  WARNING: DATABASE_URL appears to use direct Postgres connection (port 5432).\n" +
      "   For production, use Supabase Transaction Pooler connection (port 6543).\n" +
      "   Direct connections will cause connection churn and performance issues.\n" +
      "   Get the pooler connection string from: Supabase Dashboard > Settings > Database > Connection Pooling"
    );
  }
  
  // Check for pooler indicators (positive validation)
  if (connectionString.includes(":6543/") || connectionString.includes("pooler.supabase.com")) {
    // Good - using pooler
    return;
  }
  
  // If it's a Supabase URL but not clearly pooler, warn
  if (connectionString.includes("supabase.com") && !connectionString.includes("pooler")) {
    console.warn(
      "⚠️  WARNING: DATABASE_URL may not be using Transaction Pooler.\n" +
      "   Ensure you're using the 'Transaction Pooler' connection string from Supabase dashboard,\n" +
      "   not the 'Direct connection' string."
    );
  }
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing DATABASE_URL");
  }

  // Validate connection string format (warns but doesn't fail)
  validateConnectionString(connectionString);

  return new Pool({
    connectionString,
    max: 5, // keep low for Supabase transaction pooler
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
  });
}

// Lazy initialization: only create pool when actually used (not during build)
function getPool(): Pool {
  if (global.__pgPool) {
    return global.__pgPool;
  }
  
  // During build phase or dev mode without DATABASE_URL - defer creation with proxy
  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
  const isDevMode = process.env.NODE_ENV !== "production";
  const missingDatabaseUrl = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("[YOUR_PASSWORD]");
  
  if (missingDatabaseUrl && (isBuildPhase || isDevMode)) {
    // Return a proxy that will throw on actual use, but allows module to load
    // Routes can catch this error and return JSON with requestId
    const errorMessage = "DATABASE_URL not configured. Get connection string from: Supabase Dashboard > Settings > Database > Connection Pooling > Transaction Pooler";
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
  
  // Production or DATABASE_URL is set - create pool (will throw if DATABASE_URL missing in prod)
  global.__pgPool = createPool();
  return global.__pgPool;
}

export const pool = getPool();
