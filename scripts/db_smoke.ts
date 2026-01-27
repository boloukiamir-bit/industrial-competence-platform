/**
 * Smoke test: connect to DB via DATABASE_URL, print host/user/db and run
 * SELECT current_user, current_database().
 *
 * Usage: npx tsx scripts/db_smoke.ts
 * Loads .env.local from project root if present.
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { Pool } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadEnvLocal(): void {
  try {
    const envPath = join(__dirname, "..", ".env.local");
    const envFile = readFileSync(envPath, "utf-8");
    envFile.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const eq = trimmed.indexOf("=");
        if (eq > 0) {
          const key = trimmed.slice(0, eq).trim();
          const raw = trimmed.slice(eq + 1).trim();
          const value = raw.replace(/^["']|["']$/g, "");
          if (!process.env[key]) process.env[key] = value;
        }
      }
    });
  } catch {
    /* .env.local missing or unreadable */
  }
}

function parseDbUrl(uri: string): { host: string; user: string; db: string } {
  const u = uri.replace(/^postgres(?:ql)?:\/\//, "");
  const at = u.indexOf("@");
  if (at === -1) throw new Error("Invalid DATABASE_URL: no @");
  const userPart = u.slice(0, at);
  const hostPart = u.slice(at + 1);
  const colon = userPart.indexOf(":");
  const user = colon === -1 ? userPart : userPart.slice(0, colon);
  const slash = hostPart.indexOf("/");
  const hostPort = slash === -1 ? hostPart : hostPart.slice(0, slash);
  const db = slash === -1 ? "postgres" : hostPart.slice(slash + 1).replace(/\?.*$/, "");
  return { host: hostPort, user, db };
}

async function main(): Promise<void> {
  loadEnvLocal();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const { host, user, db } = parseDbUrl(connectionString);
  console.log("host:", host);
  console.log("user:", user);
  console.log("db:", db);

  // Determine SSL configuration
  const isLocalhost = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  let ssl: boolean | { rejectUnauthorized: boolean };
  
  if (isLocalhost) {
    ssl = false;
  } else if (process.env.DB_SMOKE_INSECURE_SSL === "1") {
    console.warn("⚠️  WARNING: Using insecure SSL (rejectUnauthorized: false) due to DB_SMOKE_INSECURE_SSL=1");
    ssl = { rejectUnauthorized: false };
  } else {
    ssl = { rejectUnauthorized: true };
  }

  const pool = new Pool({
    connectionString,
    ssl,
  });

  try {
    const r = await pool.query("SELECT current_user, current_database()");
    const row = r.rows[0] as { current_user: string; current_database: string };
    console.log("current_user:", row?.current_user ?? "?");
    console.log("current_database:", row?.current_database ?? "?");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("db_smoke failed:", err);
  process.exit(1);
});
