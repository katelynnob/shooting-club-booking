import { defineConfig } from "vitest/config";

// Unit tests only — fast, no database, no Docker required. Anything under
// tests/integration/ is excluded here and run separately via
// vitest.integration.config.ts (needs db_test from docker-compose.yml up).
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", "tests/integration/**"],
  },
});
