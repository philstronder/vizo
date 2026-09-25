import "../lib/env";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pool } from "./pool";

// Applies db/schema.sql to DATABASE_URL. Runs with the same pg driver as the
// app, so no psql client is needed locally, in CI, or on the deploy host.
// Resolves the same from src/db (tsx) and dist/db (compiled).
const schemaPath = path.resolve(__dirname, "../../db/schema.sql");

async function migrate() {
  const sql = readFileSync(schemaPath, "utf8");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log(`Applied ${path.relative(process.cwd(), schemaPath)}`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
