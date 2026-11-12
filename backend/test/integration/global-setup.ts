import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { testDatabaseUrl } from "./database-url";

// Creates the test database if needed and applies db/schema.sql to it, once
// per run. The schema is idempotent, so re-running it is safe.
export default async function setup() {
  const url = new URL(testDatabaseUrl);
  const dbName = url.pathname.slice(1);
  // Each test truncates every table, so never run against a real database.
  if (!dbName.endsWith("_test")) {
    throw new Error(`Refusing to run integration tests against "${dbName}": its name must end with _test`);
  }

  const adminUrl = new URL(testDatabaseUrl);
  adminUrl.pathname = "/postgres";
  const admin = new Client({ connectionString: adminUrl.toString() });
  try {
    await admin.connect();
  } catch (err) {
    throw new Error(
      `Could not reach Postgres for integration tests at ${url.host}. Start it with ` +
        `"docker compose up -d" or set TEST_DATABASE_URL. (${(err as Error).message})`
    );
  }
  try {
    const { rowCount } = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (!rowCount) await admin.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
  } finally {
    await admin.end();
  }

  const client = new Client({ connectionString: testDatabaseUrl });
  await client.connect();
  try {
    await client.query(readFileSync(path.resolve(__dirname, "../../db/schema.sql"), "utf8"));
  } finally {
    await client.end();
  }
}
