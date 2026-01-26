import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    // During build, DATABASE_URL may not be available - return a dummy pool that will error on use
    if (process.env.NEXT_PHASE === "phase-production-build") {
      return {} as Pool;
    }
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

function getPool(): Pool {
  if (!global.__pgPool) {
    global.__pgPool = createPool();
  }
  return global.__pgPool;
}

export const pool = getPool();
