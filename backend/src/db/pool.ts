import { Pool } from "pg";

// A single shared connection pool for the process. On RDS, set DATABASE_URL to
// the instance endpoint; SSL is required for most RDS Postgres configurations.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.PGSSL === "true"
      ? { rejectUnauthorized: false }
      : undefined,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle Postgres client", err);
});
