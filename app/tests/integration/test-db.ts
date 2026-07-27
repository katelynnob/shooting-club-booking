import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Deliberately separate from src/lib/db.ts's singleton, which always reads
// DATABASE_URL (the dev database) — integration tests must never be able to
// accidentally point at dev data, so this reads TEST_DATABASE_URL only, and
// throws loudly if it's missing rather than silently falling back to
// DATABASE_URL.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL is not set — integration tests require the db_test service from docker-compose.yml. " +
      "See ../GETTING_STARTED.md.",
  );
}

const adapter = new PrismaPg({ connectionString: testDatabaseUrl });
export const testDb = new PrismaClient({ adapter });
