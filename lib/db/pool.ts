import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing DATABASE_URL");
  }

  return new Pool({
    connectionString,
    max: 5, // keep low for Supabase
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
  
  // During build phase, DATABASE_URL may not be set - defer creation
  if (!process.env.DATABASE_URL && (process.env.NEXT_PHASE === "phase-production-build" || !process.env.NODE_ENV)) {
    // Return a proxy that will throw on actual use, but allows module to load
    return new Proxy({} as Pool, {
      get() {
        throw new Error("Pool not initialized - DATABASE_URL required at runtime");
      },
    });
  }
  
  global.__pgPool = createPool();
  return global.__pgPool;
}

export const pool = getPool();
