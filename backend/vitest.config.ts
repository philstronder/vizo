import { defineConfig } from "vitest/config";
import { testDatabaseUrl } from "./test/integration/database-url";

// Integration tests use a dedicated database so they never touch dev data;
// test/integration/global-setup.ts refuses any database not named *_test.

export default defineConfig({
  test: {
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
