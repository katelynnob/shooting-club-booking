import { afterEach, describe, expect, it } from "vitest";
import { testDb } from "./test-db";

// Formalizes the manual smoke test run during initial Prisma setup (create →
// count → delete against a real Postgres instance) as an actual, repeatable
// test — proof the migrate-against-db_test → integration-test pipeline
// genuinely works, not just that the files exist.

const TEST_RANGE_NAME = "__integration_test_range__";

afterEach(async () => {
  // Children before parent — no onDelete: Cascade on RangeOperatingHours,
  // matching specs/01-accounts-and-ranges.md's schema exactly.
  const range = await testDb.range.findUnique({ where: { name: TEST_RANGE_NAME } });
  if (range) {
    await testDb.rangeOperatingHours.deleteMany({ where: { rangeId: range.id } });
    await testDb.range.delete({ where: { id: range.id } });
  }
});

describe("Range + RangeOperatingHours (Prisma against a real test database)", () => {
  it("creates a range with nested operating hours and reads it back", async () => {
    const created = await testDb.range.create({
      data: {
        name: TEST_RANGE_NAME,
        discipline: "Test",
        capacity: 6,
        operatingHours: {
          create: [{ dayOfWeek: 3, openTime: "11:00", closeTime: "16:00" }],
        },
      },
      include: { operatingHours: true },
    });

    expect(created.capacity).toBe(6);
    expect(created.operatingHours).toHaveLength(1);
    expect(created.operatingHours[0].openTime).toBe("11:00");
  });

  it("enforces unique range names", async () => {
    await testDb.range.create({
      data: { name: TEST_RANGE_NAME, discipline: "Test", capacity: 6 },
    });

    await expect(
      testDb.range.create({
        data: { name: TEST_RANGE_NAME, discipline: "Test", capacity: 4 },
      }),
    ).rejects.toThrow();
  });

  it("enforces one operating-hours row per range per day of week", async () => {
    const range = await testDb.range.create({
      data: { name: TEST_RANGE_NAME, discipline: "Test", capacity: 6 },
    });

    await testDb.rangeOperatingHours.create({
      data: { rangeId: range.id, dayOfWeek: 3, openTime: "11:00", closeTime: "16:00" },
    });

    await expect(
      testDb.rangeOperatingHours.create({
        data: { rangeId: range.id, dayOfWeek: 3, openTime: "09:00", closeTime: "12:00" },
      }),
    ).rejects.toThrow();
  });
});
