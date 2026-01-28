import { pool } from "@/lib/db/pool";

const DEFAULT_ORG_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const ORG_ID = process.env.CLEANUP_ORG_ID || DEFAULT_ORG_ID;
const DEMO_CODES = ["PRESS_A", "PRESS_B", "5S", "SAFETY_BASIC", "TRUCK_A1"];

async function run() {
  const client = await pool.connect();
  const confirmDelete = process.env.CONFIRM_DELETE === "true";

  try {
    await client.query("BEGIN");

    const beforeRes = await client.query(
      `SELECT s.code, COUNT(*)::int AS count
       FROM employee_skills es
       JOIN employees e ON e.id = es.employee_id
       JOIN skills s ON s.id = es.skill_id
       WHERE e.org_id = $1
         AND s.code = ANY($2::text[])
       GROUP BY s.code
       ORDER BY s.code ASC`,
      [ORG_ID, DEMO_CODES]
    );

    console.log("Target org_id:", ORG_ID);
    console.log("Demo code counts (before):", beforeRes.rows);

    if (!confirmDelete) {
      console.log("Dry run. Set CONFIRM_DELETE=true to execute deletions.");
      await client.query("ROLLBACK");
      return;
    }

    const deleteRes = await client.query(
      `DELETE FROM employee_skills es
       USING employees e, skills s
       WHERE es.employee_id = e.id
         AND es.skill_id = s.id
         AND e.org_id = $1
         AND s.code = ANY($2::text[])
       RETURNING es.id`,
      [ORG_ID, DEMO_CODES]
    );

    console.log(`Deleted ${deleteRes.rowCount} employee_skills rows for org ${ORG_ID}.`);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Cleanup failed:", error);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

run().catch((error) => {
  console.error("Cleanup failed:", error);
  process.exit(1);
});
