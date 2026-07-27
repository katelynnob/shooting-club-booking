// Dev-only convenience script — creates one APPROVED test member directly,
// bypassing the registration/approve flow (not built yet). Not the Super
// Admin bootstrap described in specs/01-accounts-and-ranges.md (that's a
// separate, still-to-be-written script); this just proves the login loop
// works end to end.
//
// Run with: npx tsx prisma/seed.ts

import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

const TEST_EMAIL = "test.member@example.com";
const TEST_PASSWORD = "correct-horse-battery-staple";

async function main() {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);

  const user = await db.user.upsert({
    where: { email: TEST_EMAIL },
    update: { passwordHash, status: "APPROVED" },
    create: {
      email: TEST_EMAIL,
      passwordHash,
      name: "Test Member",
      membershipNumber: "TEST-0001",
      status: "APPROVED",
    },
  });

  console.log(`Seeded test member: ${user.email} / ${TEST_PASSWORD} (status: ${user.status})`);
  await db.$disconnect();
}

main();
