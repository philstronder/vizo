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
  },
});
