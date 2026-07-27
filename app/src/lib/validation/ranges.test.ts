import { describe, expect, it } from "vitest";
import { createRangeSchema, replaceRangeHoursSchema, updateRangeSchema } from "./ranges";

describe("createRangeSchema", () => {
  it("accepts a valid range, defaulting slotLengthMinutes to 60", () => {
    const result = createRangeSchema.safeParse({ name: "Rifle 100m", discipline: "Rifle", capacity: 6 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.slotLengthMinutes).toBe(60);
  });

  it("rejects a non-positive capacity", () => {
    expect(createRangeSchema.safeParse({ name: "Rifle 100m", discipline: "Rifle", capacity: 0 }).success).toBe(false);
    expect(createRangeSchema.safeParse({ name: "Rifle 100m", discipline: "Rifle", capacity: -1 }).success).toBe(false);
  });

  it("rejects a non-integer capacity", () => {
    expect(createRangeSchema.safeParse({ name: "Rifle 100m", discipline: "Rifle", capacity: 6.5 }).success).toBe(false);
  });
});

describe("updateRangeSchema", () => {
  it("rejects an empty body", () => {
    expect(updateRangeSchema.safeParse({}).success).toBe(false);
  });

  it("accepts a single field", () => {
    expect(updateRangeSchema.safeParse({ capacity: 8 }).success).toBe(true);
  });
});

describe("replaceRangeHoursSchema", () => {
  it("accepts a valid week of entries", () => {
    const result = replaceRangeHoursSchema.safeParse([
      { dayOfWeek: 3, openTime: "11:00", closeTime: "16:00" },
      { dayOfWeek: 5, openTime: "11:00", closeTime: "16:00" },
    ]);
    expect(result.success).toBe(true);
  });

  it("accepts an empty array (range closed every day)", () => {
    expect(replaceRangeHoursSchema.safeParse([]).success).toBe(true);
  });

  it("rejects a malformed time string", () => {
    const result = replaceRangeHoursSchema.safeParse([{ dayOfWeek: 3, openTime: "11am", closeTime: "16:00" }]);
    expect(result.success).toBe(false);
  });

  it("rejects openTime not before closeTime", () => {
    const result = replaceRangeHoursSchema.safeParse([{ dayOfWeek: 3, openTime: "16:00", closeTime: "11:00" }]);
    expect(result.success).toBe(false);
  });

  it("rejects a dayOfWeek outside 0-6", () => {
    const result = replaceRangeHoursSchema.safeParse([{ dayOfWeek: 7, openTime: "11:00", closeTime: "16:00" }]);
    expect(result.success).toBe(false);
  });

  it("rejects a repeated dayOfWeek", () => {
    const result = replaceRangeHoursSchema.safeParse([
      { dayOfWeek: 3, openTime: "11:00", closeTime: "16:00" },
      { dayOfWeek: 3, openTime: "09:00", closeTime: "10:00" },
    ]);
    expect(result.success).toBe(false);
  });
});
