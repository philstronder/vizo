import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// Dates render in the browser's time zone; pin it so formatted output is stable.
process.env.TZ = "UTC";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.{ts,tsx}"],
    setupFiles: ["test/setup.ts"],
    mockReset: true,
    restoreMocks: true,
    unstubGlobals: true,
    // `npm run test:coverage`. Pages and most views are exercised by the
    // Playwright suite in e2e/, which this doesn't measure, so the totals are
    // lower than the backend's. CI fails if coverage drops below these; raise
    // them as coverage grows.
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/types/**"],
      reporter: ["text-summary", "text", "html", "json-summary"],
      thresholds: { lines: 37, statements: 37, functions: 44, branches: 85 },
    },
  },
});
