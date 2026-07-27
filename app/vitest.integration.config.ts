import { defineConfig } from "vitest/config";

// Integration tests — require db_test (see ../docker-compose.yml) running
// and TEST_DATABASE_URL set. Run serially (no fileParallelism): they share
// one Postgres instance and this project's concurrency-critical specs
// (see specs/04-slots-booking-and-blackouts.md) will later need precise
// control over what runs concurrently, not Vitest's own worker parallelism
// fighting with it.
//
// ⚠️ Critical: these tests import and call the *real* route handlers, which
// import the app's db singleton (src/lib/db.ts) — that singleton always
// reads DATABASE_URL, never TEST_DATABASE_URL. Without the override below,
// route handlers under test would silently read/write the dev database
// while test assertions (via testDb) check the test database — two
// different databases, tests passing or failing for the wrong reasons
// entirely. Forcing DATABASE_URL = TEST_DATABASE_URL for this test process
// only (never touches the real .env or the dev DB) makes db and testDb
// resolve to the exact same database.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    fileParallelism: false,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL,
    },
  },
});
