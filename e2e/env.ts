// Shared by the Playwright config, the DB prep script's caller and the tests.
export const BACKEND_PORT = Number(process.env.E2E_BACKEND_PORT ?? 4100);
export const FRONTEND_PORT = Number(process.env.E2E_FRONTEND_PORT ?? 3100);
export const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;

// Defaults to a vizo_e2e_test database on the docker-compose Postgres.
// scripts/prepare-db.mjs wipes it on every run, so it must end in _test.
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgres://vizo:vizo@localhost:5433/vizo_e2e_test";
