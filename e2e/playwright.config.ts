import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { BACKEND_PORT, E2E_DATABASE_URL, FRONTEND_PORT, FRONTEND_URL } from "./env";

// Runs the real stack: a production build of the frontend, the backend API and
// a Postgres database dedicated to these tests (see scripts/prepare-db.mjs).
// Ports differ from the dev servers (3000/4000) so both can run side by side.

const backendDir = path.resolve(__dirname, "../backend");
const frontendDir = path.resolve(__dirname, "../frontend");
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: isCI ? [["list"], ["html", { open: "never" }], ["github"]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: FRONTEND_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Assertions use the English copy; the app defaults to pt-BR.
    storageState: {
      cookies: [
        {
          name: "vizo_locale",
          value: "en-US",
          domain: "localhost",
          path: "/",
          expires: -1,
          httpOnly: false,
          secure: false,
          sameSite: "Lax",
        },
      ],
      origins: [],
    },
  },
  projects: [
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      // Recreates the e2e database from db/schema.sql, then starts the API.
      command: `node "${path.resolve(__dirname, "scripts/prepare-db.mjs")}" && npx tsx src/server.ts`,
      cwd: backendDir,
      url: `http://localhost:${BACKEND_PORT}/health`,
      env: {
        NODE_ENV: "test",
        PORT: String(BACKEND_PORT),
        DATABASE_URL: E2E_DATABASE_URL,
        PGSSL: "false",
        JWT_SECRET: "e2e-secret",
        CORS_ORIGIN: FRONTEND_URL,
        COOKIE_SECURE: "false",
      },
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: "pipe",
    },
    {
      // A production build catches build-only breakage too. BACKEND_URL is
      // baked into the /api rewrite at build time.
      command: `npm run build && npx next start --port ${FRONTEND_PORT}`,
      cwd: frontendDir,
      url: FRONTEND_URL,
      env: {
        BACKEND_URL: `http://localhost:${BACKEND_PORT}`,
        NEXT_PUBLIC_API_URL: "",
        NEXT_PUBLIC_APP_URL: FRONTEND_URL,
        NEXT_TELEMETRY_DISABLED: "1",
      },
      reuseExistingServer: false,
      timeout: 300_000,
      stdout: "pipe",
    },
  ],
});
