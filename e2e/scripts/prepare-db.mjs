// Gives the e2e run an empty database: creates it if needed, drops everything
// in it, and applies backend/db/schema.sql. Reads DATABASE_URL (set by
// playwright.config.ts) and refuses any database not named *_test.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set");

const url = new URL(databaseUrl);
const dbName = decodeURIComponent(url.pathname.slice(1));
if (!dbName.endsWith("_test")) {
  throw new Error(`Refusing to wipe "${dbName}" for e2e tests: its name must end with _test`);
}

const adminUrl = new URL(databaseUrl);
adminUrl.pathname = "/postgres";
const admin = new pg.Client({ connectionString: adminUrl.toString() });
try {
  await admin.connect();
} catch (err) {
  throw new Error(
    `Could not reach Postgres at ${url.host}. Start it with "docker compose up -d" in backend/ ` +
      `or set E2E_DATABASE_URL. (${err.message})`
  );
}
try {
  const { rowCount } = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (!rowCount) await admin.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
} finally {
  await admin.end();
}

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
try {
  await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await client.query(readFileSync(path.resolve(here, "../../backend/db/schema.sql"), "utf8"));
  console.log(`[e2e] Prepared database ${dbName}`);
} finally {
  await client.end();
}
