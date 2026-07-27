import { z } from "zod";

const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Must be in HH:MM 24-hour format");

export const createRangeSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  discipline: z.string().trim().min(1, "Discipline is required"),
  capacity: z.number().int().positive("Capacity must be a positive integer"),
  slotLengthMinutes: z.number().int().positive().default(60),
});

// PATCH /api/admin/ranges/:id — any subset, but not an empty body.
export const updateRangeSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    discipline: z.string().trim().min(1).optional(),
    capacity: z.number().int().positive().optional(),
    slotLengthMinutes: z.number().int().positive().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

const operatingHoursEntrySchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    openTime: timeOfDay,
    closeTime: timeOfDay,
  })
  .refine((entry) => entry.openTime < entry.closeTime, {
    message: "openTime must be before closeTime",
    path: ["closeTime"],
  });

// PUT /api/admin/ranges/:id/hours — replaces the full week in one call
// (spec 01: "simpler than per-day PATCHes"). Each dayOfWeek may appear at
// most once.
export const replaceRangeHoursSchema = z
  .array(operatingHoursEntrySchema)
  .refine(
    (entries) => new Set(entries.map((e) => e.dayOfWeek)).size === entries.length,
    { message: "dayOfWeek must not repeat" },
  );
