/**
 * Re-exports the shared pg pool from lib/db.
 * All API routes should use the pool from here or from @/lib/db for consistent SSL config.
 */
export { pool, getPgPool } from "@/lib/db";
