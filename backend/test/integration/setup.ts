import { afterAll, beforeEach } from "vitest";
import { pool } from "../../src/db/pool";

// Every test starts from empty tables.
beforeEach(async () => {
  const { rows } = await pool.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
  );
  if (rows.length) {
    await pool.query(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  }
});

afterAll(async () => {
  await pool.end();
});
