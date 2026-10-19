import { readFileSync } from "node:fs";
import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.PGSSL === "true"
      ? process.env.PGSSL_CA_PATH
        ? { ca: readFileSync(process.env.PGSSL_CA_PATH, "utf8") }
        : { rejectUnauthorized: false }
      : undefined,
});
