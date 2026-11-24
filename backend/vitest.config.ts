import { defineConfig } from "vitest/config";
import { testDatabaseUrl } from "./test/integration/database-url";

// Integration tests use a dedicated database so they never touch dev data;
// test/integration/global-setup.ts refuses any database not named *_test.

export default defineConfig({
  test: {
    // `npm run test:coverage` measures unit and integration tests together.
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // Entry points and CLI scripts only wire things up.
      exclude: ["src/server.ts", "src/db/migrate.ts", "src/db/make-admin.ts", "src/types/**"],
      reporter: ["text-summary", "text", "html", "json-summary"],
      // CI fails if coverage drops below these. Raise them as coverage grows.
      thresholds: { lines: 95, statements: 95, functions: 95, branches: 85 },
    },
    projects: [
      {
        test: {
          name: "unit",
          include: ["test/unit/**/*.test.ts"],
          environment: "node",
          env: { NODE_ENV: "test", JWT_SECRET: "test-secret" },
          // Each test starts with fresh mocks; beforeEach hooks set the defaults.
          mockReset: true,
          restoreMocks: true,
        },
      },
      {
        test: {
          name: "integration",
          include: ["test/integration/**/*.test.ts"],
          environment: "node",
          globalSetup: ["test/integration/global-setup.ts"],
          setupFiles: ["test/integration/setup.ts"],
          env: { NODE_ENV: "test", JWT_SECRET: "test-secret", DATABASE_URL: testDatabaseUrl },
          // Tests share one database, so files run one at a time in one process.
          pool: "forks",
          poolOptions: { forks: { singleFork: true } },
        },
      },
    ],
  },
});
