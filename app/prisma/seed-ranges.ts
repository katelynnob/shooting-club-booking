// Seeds the 6 real Harbour House ranges — see ../SCOPE.md, "Club context"
// and specs/01-accounts-and-ranges.md's "Seed data". Capacities are
// placeholders (admin-editable from day one via PATCH /api/admin/ranges/:id)
// pending real numbers from the club. Idempotent — safe to re-run, skips
// ranges that already exist by name.
//
// Run with: npx tsx prisma/seed-ranges.ts

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

// dayOfWeek: 0 = Sunday .. 6 = Saturday. Wed/Fri/Sat/Sun, 11:00-16:00 per
// the club's current hours.
const DEFAULT_HOURS = [3, 5, 6, 0].map((dayOfWeek) => ({
  dayOfWeek,
  openTime: "11:00",
  closeTime: "16:00",
}));

const RANGES = [
  { name: "Rifle 100m", discipline: "Rifle" },
  { name: "Rifle 50m Benchrest", discipline: "Rifle" },
  { name: "Rifle 50m Gallery", discipline: "Rifle" },
  { name: "Pistol 25m", discipline: "Pistol" },
  { name: "Clay Pigeon", discipline: "Clay Pigeon" },
  { name: "Archery", discipline: "Archery" },
];

const PLACEHOLDER_CAPACITY = 6;

async function main() {
  for (const rangeData of RANGES) {
    const existing = await db.range.findUnique({ where: { name: rangeData.name } });
    if (existing) {
      console.log(`Skipping "${rangeData.name}" — already exists.`);
      continue;
    }

    const range = await db.range.create({
      data: {
        ...rangeData,
        capacity: PLACEHOLDER_CAPACITY,
        operatingHours: { create: DEFAULT_HOURS },
      },
    });
    console.log(`Created range "${range.name}" (placeholder capacity: ${PLACEHOLDER_CAPACITY}).`);
  }

  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
